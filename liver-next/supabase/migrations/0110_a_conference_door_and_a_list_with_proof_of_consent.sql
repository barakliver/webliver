-- ============================================================================
--  0110 — a door for a conference, and a list that can prove it was invited
-- ============================================================================
--  Until now everybody who signed in landed in a queue and waited for one
--  person to press approve, which is the right rule for a stranger and the
--  wrong one for somebody standing at a stand scanning a code.
--
--  So there is now a second way in, and it is narrow on purpose:
--
--    · A CAMPAIGN is a code printed as a QR. It has a name, a kind (an event
--      producer or a DJ), an end date, and a ceiling on how many people it
--      will let in. Past either, it answers exactly like a code that never
--      existed.
--    · Somebody who arrives through one leaves their name, phone and address,
--      accepts the terms, and may separately agree to be written to. They are
--      a CONTACT, and the contact is the point of the exercise: after the
--      day, every person who came is somebody he can reach.
--    · If they sign in with Google as well, the account they get is approved
--      as a producer of that kind, without waiting. That is the only thing a
--      campaign can grant. It cannot make anybody root, a couple, or crew,
--      and it never reopens a decision already made about an account.
--
--  Consent is a record rather than a flag (the lesson of 0101): what was
--  accepted, which version of the terms it was, when, and the same for the
--  list. The list tick defaults to false and is a different tick from the
--  terms. Withdrawing it is a link, not a login.
--
--  Nothing here touches a row. Two new tables, two new columns with defaults,
--  and three functions replaced.
-- ============================================================================

-- ── what kind of business a producer account is ─────────────────────────────
alter table public.producers
  add column if not exists vertical text not null default 'events';

do $$ begin
  alter table public.producers add constraint producers_vertical_known
    check (vertical in ('events', 'dj')) not valid;
exception when duplicate_object then null; end $$;

comment on column public.producers.vertical is
  'What kind of business the account runs: ''events'' (the default, every account that existed) or ''dj''. It only changes which screens are offered; the data, the policies and the rules are the same.';

alter table public.profiles drop constraint if exists profiles_signup_intent;
alter table public.profiles add constraint profiles_signup_intent
  check (signup_intent is null or signup_intent in ('producer', 'wedding', 'business', 'dj')) not valid;


-- ── the campaign: a code that lets people in, for a while ───────────────────
create table if not exists public.signup_campaigns (
  id           uuid primary key default gen_random_uuid(),
  token        text not null,
  name         text not null,
  kind         text not null default 'producer',
  expires_at   timestamptz,
  max_signups  integer not null default 500,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create unique index if not exists signup_campaigns_token_key on public.signup_campaigns (token);

do $$ begin
  alter table public.signup_campaigns add constraint signup_campaigns_kind_known
    check (kind in ('producer', 'dj')) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.signup_campaigns add constraint signup_campaigns_bounds
    check (max_signups between 1 and 5000 and char_length(name) between 1 and 120) not valid;
exception when duplicate_object then null; end $$;

alter table public.signup_campaigns enable row level security;

drop policy if exists signup_campaigns_root on public.signup_campaigns;
create policy signup_campaigns_root on public.signup_campaigns for all
  using (public.is_super_admin()) with check (public.is_super_admin());


-- ── the contact: somebody who came, and what they agreed to ─────────────────
create table if not exists public.contacts (
  id                    uuid primary key default gen_random_uuid(),
  campaign_id           uuid references public.signup_campaigns(id) on delete set null,
  name                  text not null,
  phone                 text not null default '',
  email                 text not null,
  terms_accepted_at     timestamptz not null default now(),
  terms_version         text not null,
  broadcast_consent     boolean not null default false,
  broadcast_consent_at  timestamptz,
  broadcast_revoked_at  timestamptz,
  /* Minted only while consent stands, so nobody who declined has a link to
     leak. */
  unsubscribe_token     text,
  profile_id            uuid references public.profiles(id) on delete set null,
  note                  text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists contacts_campaign_email_key
  on public.contacts (campaign_id, lower(email));
create unique index if not exists contacts_unsubscribe_token_key
  on public.contacts (unsubscribe_token) where unsubscribe_token is not null;
create index if not exists contacts_campaign_idx on public.contacts (campaign_id, created_at desc);

do $$ begin
  alter table public.contacts add constraint contacts_shape
    check (char_length(name) between 2 and 120
           and char_length(phone) <= 30
           and char_length(email) between 5 and 200 and position('@' in email) > 1
           and char_length(terms_version) between 1 and 40
           and char_length(note) <= 2000) not valid;
exception when duplicate_object then null; end $$;

alter table public.contacts enable row level security;

--  Read and corrected by the root address alone. There is no insert policy:
--  a contact is born through campaign_contact() or join_campaign(), which
--  check the code, the ceiling and the terms.
drop policy if exists contacts_root_read on public.contacts;
create policy contacts_root_read on public.contacts for select using (public.is_super_admin());
drop policy if exists contacts_root_update on public.contacts;
create policy contacts_root_update on public.contacts for update
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists contacts_root_delete on public.contacts;
create policy contacts_root_delete on public.contacts for delete using (public.is_super_admin());


-- ── what was sent to the list, and to how many ──────────────────────────────
--  A mailing is a thing that happened, and "how many did that reach" is the
--  question asked the morning after. The recipients themselves are not copied
--  here: who was written to is who had consent at the moment of sending, and
--  copying that would make a second list to keep in step with the first.
create table if not exists public.broadcasts (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null,
  body        text not null,
  campaign_id uuid references public.signup_campaigns(id) on delete set null,
  recipients  integer not null default 0,
  sent        integer not null default 0,
  failed      integer not null default 0,
  status      text not null default 'sending',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

do $$ begin
  alter table public.broadcasts add constraint broadcasts_shape
    check (char_length(subject) between 1 and 200 and char_length(body) between 1 and 8000
           and status in ('sending', 'done')) not valid;
exception when duplicate_object then null; end $$;

alter table public.broadcasts enable row level security;
drop policy if exists broadcasts_root on public.broadcasts;
create policy broadcasts_root on public.broadcasts for all
  using (public.is_super_admin()) with check (public.is_super_admin());


-- ── is this code still letting people in ────────────────────────────────────
--  One answer to every way of being closed: unknown, switched off, past its
--  date, or full. A page that said which would help whoever is guessing.
drop function if exists public.campaign_open(text);
create or replace function public.campaign_open(p_token text)
returns table (id uuid, name text, kind text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.kind
    from public.signup_campaigns c
   where c.token = p_token
     and char_length(coalesce(p_token, '')) >= 24
     and c.active
     and (c.expires_at is null or c.expires_at > now())
     and (select count(*) from public.contacts k where k.campaign_id = c.id) < c.max_signups
$$;
grant execute on function public.campaign_open(text) to anon, authenticated, service_role;


-- ── writing a contact, once, for both doors ─────────────────────────────────
--  Not callable from outside: the two public functions below are the doors.
--  The same address in the same campaign is the same person, so a second
--  visit updates the row instead of making another, and the ceiling counts
--  people and not presses.
drop function if exists public.contact_upsert(uuid, text, text, text, text, boolean, uuid);
create or replace function public.contact_upsert(
  p_campaign uuid, p_name text, p_phone text, p_email text,
  p_terms_version text, p_broadcast boolean, p_profile uuid
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name  text := btrim(coalesce(p_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_id    uuid;
  v_had   boolean;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'נא למלא שם';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then
    raise exception 'כתובת המייל לא תקינה';
  end if;
  if char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7 or char_length(v_phone) > 30 then
    raise exception 'נא למלא מספר טלפון';
  end if;
  /* Accepting the terms is not optional and is not a default. */
  if char_length(btrim(coalesce(p_terms_version, ''))) = 0 then
    raise exception 'יש לאשר את תנאי השימוש';
  end if;

  select id, broadcast_consent into v_id, v_had
    from public.contacts
   where campaign_id = p_campaign and lower(email) = v_email;

  if v_id is null then
    insert into public.contacts
      (campaign_id, name, phone, email, terms_version, broadcast_consent,
       broadcast_consent_at, unsubscribe_token, profile_id)
    values
      (p_campaign, v_name, v_phone, v_email, left(btrim(p_terms_version), 40), coalesce(p_broadcast, false),
       case when p_broadcast then now() end,
       case when p_broadcast then encode(gen_random_bytes(24), 'hex') end,
       p_profile)
    returning id into v_id;
    return v_id;
  end if;

  update public.contacts set
    name = v_name,
    phone = v_phone,
    terms_accepted_at = now(),
    terms_version = left(btrim(p_terms_version), 40),
    profile_id = coalesce(p_profile, profile_id),
    updated_at = now(),
    /* Ticking the list is a consent given now. Not ticking it on a second
       visit is a withdrawal. The first stamp is kept while consent stands, so
       the evidence is the day it was first given. */
    broadcast_consent = coalesce(p_broadcast, false),
    broadcast_consent_at = case
      when coalesce(p_broadcast, false) and not v_had then now()
      else broadcast_consent_at end,
    broadcast_revoked_at = case
      when coalesce(p_broadcast, false) then null
      when v_had then now()
      else broadcast_revoked_at end,
    unsubscribe_token = case
      when coalesce(p_broadcast, false) then coalesce(unsubscribe_token, encode(gen_random_bytes(24), 'hex'))
      else null end
  where id = v_id;
  return v_id;
end $$;
revoke all on function public.contact_upsert(uuid, text, text, text, text, boolean, uuid) from public, anon, authenticated;


-- ── door one: leaving details, with no account ──────────────────────────────
drop function if exists public.campaign_contact(text, text, text, text, text, boolean);
create or replace function public.campaign_contact(
  p_token text, p_name text, p_phone text, p_email text, p_terms_version text, p_broadcast boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare v_campaign uuid;
begin
  select id into v_campaign from public.campaign_open(p_token);
  if v_campaign is null then
    raise exception 'that link is not active';
  end if;
  perform public.contact_upsert(v_campaign, p_name, p_phone, p_email, p_terms_version, p_broadcast, null);
end $$;
grant execute on function public.campaign_contact(text, text, text, text, text, boolean)
  to anon, authenticated, service_role;


-- ── door two: signing in with Google through the code ───────────────────────
--  The address comes from the account, not from the form: it is the one thing
--  here that has been proved. What the account is allowed to do afterwards is
--  the only grant a campaign has, and it is decided by what the account is
--  now, so a decision already taken is never reopened by a code.
drop function if exists public.join_campaign(text, text, text, text, boolean);
create or replace function public.join_campaign(
  p_token text, p_name text, p_phone text, p_terms_version text, p_broadcast boolean
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_email    text;
  v_role     app_role;
  v_campaign uuid;
  v_kind     text;
  v_status   producer_state;
  v_root     uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  select c.id, c.kind into v_campaign, v_kind from public.campaign_open(p_token) c;
  if v_campaign is null then
    raise exception 'that link is not active';
  end if;

  select lower(email), role into v_email, v_role from public.profiles where id = v_uid;
  if v_email is null then
    raise exception 'no such account';
  end if;

  perform public.contact_upsert(v_campaign, p_name, p_phone, v_email, p_terms_version, p_broadcast, v_uid);

  /* Root, a couple and crew keep what they are. They are on the list and
     that is all a campaign does for them. */
  if v_email = public.root_admin_email() or v_role <> 'producer'::app_role then
    return 'recorded';
  end if;

  select status into v_status from public.producers where owner_id = v_uid;
  if v_status is null then
    return 'recorded';
  end if;
  if v_status = 'approved'::producer_state then
    return 'already';
  end if;
  if v_status <> 'pending'::producer_state then
    /* Rejected or suspended is a decision somebody made. */
    return 'recorded';
  end if;

  perform set_config('liver.campaign_join', v_uid::text, true);
  update public.producers
     set status = 'approved'::producer_state,
         vertical = case when v_kind = 'dj' then 'dj' else 'events' end
   where owner_id = v_uid;
  perform set_config('liver.campaign_join', '', true);

  update public.profiles
     set signup_intent = case when v_kind = 'dj' then 'dj' else 'producer' end,
         signup_intent_at = now()
   where id = v_uid;

  select id into v_root from public.profiles
   where lower(email) = public.root_admin_email() limit 1;
  perform public.notify(
    v_root, 'invite',
    'נכנס/ה דרך הכנס',
    btrim(p_name) || ' (' || v_email || ') · ' || case v_kind when 'dj' then 'DJ' else 'מפיק/ה אירועים' end,
    '/app/admin/conference'
  );

  return 'approved';
end $$;
revoke all on function public.join_campaign(text, text, text, text, boolean) from public, anon;
grant execute on function public.join_campaign(text, text, text, text, boolean) to authenticated;


-- ── the one narrow exception to "only root changes a producer's status" ─────
--  A campaign may move one account from pending to approved, in the same
--  transaction as the join, and nothing else. The setting is transaction-local
--  and holds the account's own id, so it cannot be left switched on and cannot
--  approve anybody but the person who just joined.
create or replace function public.guard_producer_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and not public.is_super_admin() then
    if old.status = 'pending'::producer_state
       and new.status = 'approved'::producer_state
       and current_setting('liver.campaign_join', true) = new.owner_id::text then
      return new;
    end if;
    raise exception 'only % may change a producer status', public.root_admin_email();
  end if;
  return new;
end $$;


-- ── stopping, in one press and with no account ──────────────────────────────
--  The same promise as lead_unsubscribe: true whatever it found, the link
--  single use, and the date consent was given left standing as the evidence.
create or replace function public.contact_unsubscribe(p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(p_token, '')) < 32 then
    return true;
  end if;
  update public.contacts
     set broadcast_consent = false,
         broadcast_revoked_at = now(),
         unsubscribe_token = null,
         updated_at = now()
   where unsubscribe_token = p_token;
  return true;
end $$;
revoke all on function public.contact_unsubscribe(text) from public;
grant execute on function public.contact_unsubscribe(text) to anon, authenticated, service_role;


-- ── a DJ is a path a new account can name ───────────────────────────────────
create or replace function public.choose_my_path(p_intent text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_name   text;
  v_prev   text;
  v_root   uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  if p_intent not in ('producer', 'wedding', 'business', 'dj') then
    raise exception 'unknown path: %', p_intent;
  end if;

  select lower(email), coalesce(nullif(btrim(full_name), ''), split_part(lower(email), '@', 1)), signup_intent
    into v_email, v_name, v_prev
    from public.profiles where id = v_uid;

  if v_email is null then
    raise exception 'no such account';
  end if;

  if v_email = public.root_admin_email() then
    raise exception 'the root account has no path to choose';
  end if;

  if not exists (
    select 1 from public.profiles p
      join public.producers pr on pr.owner_id = p.id
     where p.id = v_uid and p.role = 'producer'::app_role and pr.status = 'pending'::producer_state
  ) then
    raise exception 'this account is not waiting for a decision';
  end if;

  update public.profiles
     set signup_intent = p_intent, signup_intent_at = now()
   where id = v_uid;

  if v_prev is distinct from p_intent then
    select id into v_root from public.profiles
     where lower(email) = public.root_admin_email() limit 1;

    perform public.notify(
      v_root, 'invite',
      'בקשה חדשה לאישור',
      v_name || ' (' || v_email || ') · ' || case p_intent
        when 'producer' then 'מפיק/ה אירועים'
        when 'dj'       then 'DJ'
        when 'wedding'  then 'עושים חתונה'
        else 'עושים אירוע עסקי'
      end,
      '/app/admin'
    );
  end if;

  return p_intent;
end $$;

revoke all on function public.choose_my_path(text) from public, anon;
grant execute on function public.choose_my_path(text) to authenticated;

comment on table public.contacts is
  'Somebody who came through a campaign: details, the terms version they accepted and, separately, whether and when they agreed to be written to.';
comment on table public.signup_campaigns is
  'A printed code that lets people in until it ends or fills. Grants nothing but an approved producer account of its kind.';
