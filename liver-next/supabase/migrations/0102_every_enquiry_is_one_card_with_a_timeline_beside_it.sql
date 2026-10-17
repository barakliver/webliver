-- ============================================================================
--  0102 — every enquiry is one card, with a timeline beside it
-- ============================================================================
--  An enquiry arrives through five doors today — the site form, a producer's
--  own channel address, the platform's shared key, a phone call typed in, and
--  whatever Zapier is pointed at — and every one of them ends in a row in
--  `leads`. What none of them could do was recognise the same couple twice.
--  Somebody who filled in the form on Sunday and wrote on Instagram on Tuesday
--  was two cards, each with half the story, and the producer answered one of
--  them and never saw the other.
--
--  So a twin is looked for before a row is made. Same producer, same phone or
--  the same address, within ninety days, not already lost: the second arrival
--  is written onto the first card as a message, the card comes back to the
--  top of the pile, and no second row exists. The check is a trigger on the
--  table rather than a branch in one function, because there are five doors
--  and a rule that lives in one of them is a rule four of them do not have.
--
--  The timeline is the other half. A card that says "contacted" and nothing
--  else cannot answer when, by whom, or what was said; `lead_events` is every
--  thing that happened to an enquiry, in order, written by triggers for the
--  things the database can see (it arrived, its status moved) and by the app
--  for the things it cannot (a message went out, a summary was drawn).
--
--  Three more things, each small:
--
--    · two statuses that were missing from the pipeline — an offer went out
--      and is not yet answered, and "not now, ask again in spring", which
--      until now had to be filed as lost and was therefore lost;
--    · the columns a reading of the message can fill in (partner, budget,
--      whether the hall is booked) and a score with its reasoning, so the
--      pile can be sorted by something better than arrival time;
--    · how a producer wants to be told, and the browser subscriptions that
--      telling goes through.
--
--  Nothing here touches a row that exists. Every column is nullable or
--  defaulted, every constraint is `not valid`, and the two enum values are
--  added, not renamed.
-- ============================================================================

-- ── two more places an enquiry can be ──────────────────────────────────────
--  At the top level, not inside a do-block: a value added to an enum cannot be
--  used until the transaction that added it commits, and a do-block is one
--  transaction.
alter type public.lead_state add value if not exists 'proposal_sent';
alter type public.lead_state add value if not exists 'nurture';

-- ── what a reading of the message can fill in ──────────────────────────────
alter table public.leads
  add column if not exists partner_name        text not null default '',
  add column if not exists instagram_handle    text not null default '',
  add column if not exists event_date_flexible boolean,
  add column if not exists budget_min          integer,
  add column if not exists budget_max          integer,
  add column if not exists venue_booked        boolean,
  /* What the message is asking for, in the vocabulary the reader uses:
     full_production, accompaniment, day_of, course, game, question, spam.
     Free text rather than an enum because the reader's vocabulary will grow
     and an enum would make each new word a migration. */
  add column if not exists intent              text not null default '',
  add column if not exists urgency             text not null default '',
  /* 0 to 100, and the sentence that explains it. The number is computed in
     code from rules anybody can read; the sentence is kept so the number can
     be argued with. */
  add column if not exists score               smallint,
  add column if not exists score_reason        text not null default '',
  /* One line in Hebrew saying what this is, and a draft of the answer. Both
     are the reader's and both are drafts: nothing sends the reply. */
  add column if not exists summary             text not null default '',
  add column if not exists suggested_reply     text not null default '',
  add column if not exists next_action         text not null default '',
  add column if not exists next_action_at      timestamptz,
  add column if not exists lost_reason         text not null default '',
  /* Set once, by the trigger below, the first time the status leaves 'new'
     or a message goes out. The one number a producer is judged on and the
     one nobody writes down. */
  add column if not exists first_response_at   timestamptz,
  add column if not exists updated_at          timestamptz not null default now(),
  /* Whatever the door was handed, kept whole. A field the reader did not
     know to look for in October is still here in March. */
  add column if not exists source_payload      jsonb;

do $$ begin
  alter table public.leads add constraint leads_card_text_len check (
    char_length(partner_name) <= 120 and char_length(instagram_handle) <= 80
    and char_length(intent) <= 40 and char_length(urgency) <= 20
    and char_length(score_reason) <= 1000 and char_length(summary) <= 600
    and char_length(suggested_reply) <= 2000 and char_length(next_action) <= 300
    and char_length(lost_reason) <= 300
  ) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.leads add constraint leads_score_range
    check (score is null or (score >= 0 and score <= 100)) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.leads add constraint leads_budget_sane check (
    (budget_min is null or budget_min >= 0) and (budget_max is null or budget_max >= 0)
    and (budget_min is null or budget_max is null or budget_min <= budget_max)
  ) not valid;
exception when duplicate_object then null; end $$;

drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

-- ── a phone number in one spelling ─────────────────────────────────────────
--  `normalize_phone()` is 0022's, the same rule lib/phone.ts carries, so a
--  number typed on the site and the same number arriving from WhatsApp
--  compare equal. Indexed on the folded form, because the twin lookup below
--  asks it on every arrival.
create index if not exists leads_phone_norm_idx
  on public.leads (producer_id, public.normalize_phone(phone))
  where phone <> '';
create index if not exists leads_email_idx
  on public.leads (producer_id, lower(email))
  where email <> '';
create index if not exists leads_pipeline_idx
  on public.leads (producer_id, status, created_at desc);

-- ── the timeline ───────────────────────────────────────────────────────────
do $$ begin
  create type public.lead_event_type as enum (
    'created', 'message_in', 'message_out', 'call', 'status_change',
    'note', 'meeting_scheduled', 'proposal_sent', 'notification_sent', 'ai_summary'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.lead_events (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade,
  type       public.lead_event_type not null,
  /* whatsapp / email / instagram / phone / site / system */
  channel    text not null default '',
  body       text not null default '',
  meta       jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint lead_events_channel_len check (char_length(channel) <= 40),
  constraint lead_events_body_len    check (char_length(body) <= 8000)
);
create index if not exists lead_events_lead_idx on public.lead_events (lead_id, created_at desc);

alter table public.lead_events enable row level security;

--  Reached exactly as far as the lead is: the same predicate, through the
--  lead. A couple has no policy on leads and so has none here.
drop policy if exists lead_events_read on public.lead_events;
create policy lead_events_read on public.lead_events for select
  using (exists (
    select 1 from public.leads l
     where l.id = lead_id and l.producer_id is not null and public.owns_producer(l.producer_id)
  ));

drop policy if exists lead_events_write on public.lead_events;
create policy lead_events_write on public.lead_events for insert
  with check (exists (
    select 1 from public.leads l
     where l.id = lead_id and l.producer_id is not null and public.owns_producer(l.producer_id)
  ));

--  The app writes events for things only it can see; the two below are the
--  things the table can see for itself.
create or replace function public.lead_event_on_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.lead_events (lead_id, type, channel, body, created_by)
  values (new.id, 'created', coalesce(new.source, ''), coalesce(new.message, ''), auth.uid());
  return new;
end $$;
drop trigger if exists leads_timeline_insert on public.leads;
create trigger leads_timeline_insert after insert on public.leads
  for each row execute function public.lead_event_on_insert();

create or replace function public.lead_event_on_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.lead_events (lead_id, type, channel, body, meta, created_by)
    values (new.id, 'status_change', 'system', new.status::text,
            jsonb_build_object('from', old.status::text, 'to', new.status::text), auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists leads_timeline_status on public.leads;
create trigger leads_timeline_status after update of status on public.leads
  for each row execute function public.lead_event_on_status();

--  The first time the card leaves 'new' is the first response, unless it was
--  already stamped by a message going out. Before update, so the stamp lands
--  in the same write as the status.
create or replace function public.lead_first_response() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.status = 'new' and new.status <> 'new' and new.first_response_at is null then
    new.first_response_at := now();
  end if;
  return new;
end $$;
drop trigger if exists leads_first_response on public.leads;
create trigger leads_first_response before update of status on public.leads
  for each row execute function public.lead_first_response();

--  A message out, written by the app, is also a first response.
create or replace function public.lead_event_stamps_response() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'message_out' then
    update public.leads set first_response_at = coalesce(first_response_at, new.created_at)
     where id = new.lead_id;
  end if;
  return new;
end $$;
drop trigger if exists lead_events_stamp on public.lead_events;
create trigger lead_events_stamp after insert on public.lead_events
  for each row execute function public.lead_event_stamps_response();

-- ── the same couple, twice ─────────────────────────────────────────────────
--  Before insert, so it holds at every door. A twin is the same producer's
--  lead with the same normalised phone or the same address, ninety days back,
--  not lost. Found, the new arrival is written onto it as a message and the
--  insert is skipped — returning null from a before-insert trigger drops the
--  row, which is the one honest way to say "this already exists" to a caller
--  that may be a plain insert.
--
--  A caller that needs the twin's id asks lead_twin() for it, which is what
--  store_lead does below. The status comes back to 'new' from 'nurture' only:
--  a couple who were told "not now" and wrote again are a new decision, while
--  one already in a meeting is not sent back to the top of the pile by a
--  second message.
create or replace function public.lead_twin(p_producer uuid, p_phone text, p_email text) returns uuid
language sql stable set search_path = public as $$
  select l.id from public.leads l
   where l.producer_id = p_producer
     and l.status <> 'lost'
     and l.created_at > now() - interval '90 days'
     and (
       (public.normalize_phone(p_phone) is not null
        and l.phone <> '' and public.normalize_phone(l.phone) = public.normalize_phone(p_phone))
       or (nullif(lower(btrim(coalesce(p_email, ''))), '') is not null
        and l.email <> '' and lower(l.email) = lower(btrim(p_email)))
     )
   order by l.created_at desc
   limit 1
$$;

create or replace function public.lead_fold_twin() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  twin uuid;
begin
  if new.producer_id is null then return new; end if;
  twin := public.lead_twin(new.producer_id, new.phone, new.email);
  if twin is null then return new; end if;

  insert into public.lead_events (lead_id, type, channel, body, meta)
  values (twin, 'message_in', coalesce(new.source, ''), coalesce(new.message, ''),
          jsonb_build_object('folded', true, 'source', new.source,
                             'event_date', new.event_date, 'guest_count', new.guest_count,
                             'location', new.location));

  update public.leads
     set updated_at = now(),
         status = case when status = 'nurture' then 'new' else status end,
         /* Fill what was blank; never overwrite what the producer typed. */
         event_date  = coalesce(event_date, new.event_date),
         guest_count = coalesce(guest_count, new.guest_count),
         location    = case when location = '' then coalesce(new.location, '') else location end,
         email       = case when email = '' then coalesce(new.email, '') else email end,
         phone       = case when phone = '' then coalesce(new.phone, '') else phone end
   where id = twin;

  return null;
end $$;

--  After leads_attribute, which fills producer_id for the site form, and
--  before anything is written. Trigger order among before-triggers is
--  alphabetical, and 'leads_attribute' < 'leads_fold_twin'.
drop trigger if exists leads_fold_twin on public.leads;
create trigger leads_fold_twin before insert on public.leads
  for each row execute function public.lead_fold_twin();

-- ── store_lead learns to answer with the twin ──────────────────────────────
--  Same signature, same return. Only the tail moved: an insert the trigger
--  folded returns no id, and the twin's id is the honest answer to "where
--  did this go".
create or replace function public.store_lead(
  p_producer_id uuid,
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default '',
  p_source      text default 'webhook',
  p_external_id text default null,
  p_location    text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name   text := btrim(coalesce(p_full_name, ''));
  v_phone  text := btrim(coalesce(p_phone, ''));
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_ext    text := nullif(btrim(coalesce(p_external_id, '')), '');
  v_date   date := p_event_date;
  v_guests integer := p_guest_count;
  v_id     uuid;
begin
  if p_producer_id is null then
    raise exception 'פנייה בלי מפיק' using errcode = 'check_violation';
  end if;

  if v_name = '' and v_phone = '' and v_email = '' then
    raise exception 'פנייה ריקה' using errcode = 'check_violation';
  end if;

  if v_ext is not null then
    select id into v_id from public.leads where external_id = v_ext;
    if found then return v_id; end if;
  end if;

  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then v_email := ''; end if;
  if v_date is not null and v_date < date '2026-01-01' then v_date := null; end if;
  if v_guests is not null and (v_guests <= 0 or v_guests > 1500) then v_guests := null; end if;
  if v_name = '' then v_name := coalesce(nullif(v_phone, ''), v_email); end if;

  insert into public.leads (
    producer_id, full_name, phone, email, kind, event_date, guest_count,
    message, source, external_id, location
  ) values (
    p_producer_id,
    left(v_name, 120),
    left(v_phone, 40),
    left(v_email, 160),
    (case when p_kind = 'corporate' then 'corporate' else 'wedding' end)::event_class,
    v_date,
    v_guests,
    left(coalesce(p_message, ''), 4000),
    public.normalize_source(p_source),
    v_ext,
    left(btrim(coalesce(p_location, '')), 120)
  )
  on conflict (external_id) where external_id is not null do nothing
  returning id into v_id;

  if v_id is null and v_ext is not null then
    select id into v_id from public.leads where external_id = v_ext;
  end if;

  /* Folded onto a twin: answer with the twin. */
  if v_id is null then
    v_id := public.lead_twin(p_producer_id, v_phone, v_email);
  end if;

  return v_id;
end $$;

revoke all on function public.store_lead(uuid, text, text, text, text, date, integer, text, text, text, text) from public;

-- ── how a producer wants to be told ────────────────────────────────────────
create table if not exists public.notification_preferences (
  profile_id        uuid primary key references public.profiles(id) on delete cascade,
  whatsapp_number   text not null default '',
  push_enabled      boolean not null default true,
  email_enabled     boolean not null default false,
  /* Between these two, local to the events' zone, nothing rings. A lead
     scoring 80 or more is the one exception and is made in code. */
  quiet_start       time,
  quiet_end         time,
  digest_time       time not null default '08:00',
  updated_at        timestamptz not null default now(),
  constraint notification_preferences_wa_len check (char_length(whatsapp_number) <= 40)
);
alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop trigger if exists notification_preferences_touch on public.notification_preferences;
create trigger notification_preferences_touch before update on public.notification_preferences
  for each row execute function public.touch_updated_at();

-- ── the browsers a push can reach ──────────────────────────────────────────
--  One row per browser a producer said yes in. The endpoint is the browser's
--  own address and is unique across the world, so it is the key; the two
--  keys beside it are what the Web Push standard needs to encrypt to it.
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  /* Set when a push to it is refused with 404 or 410, which is the browser
     saying the subscription is gone. Kept rather than deleted so a failing
     endpoint is a fact on screen and not a row that vanished. */
  gone_at    timestamptz,
  constraint push_subscriptions_len check (
    char_length(endpoint) <= 2000 and char_length(p256dh) <= 200
    and char_length(auth) <= 100 and char_length(user_agent) <= 300
  )
);
create index if not exists push_subscriptions_profile_idx on public.push_subscriptions (profile_id) where gone_at is null;
alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

comment on table public.lead_events is
  'Everything that happened to one enquiry, in order. Arrival and status moves are written by '
  'triggers; messages, calls and readings by the app. Reached exactly as far as the lead is.';
comment on function public.lead_twin(uuid, text, text) is
  'The same producer''s open lead with the same phone or address in the last ninety days, or null. '
  'What the fold-on-insert trigger and store_lead both ask.';
