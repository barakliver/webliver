-- ============================================================================
--  0107 — a new account says what it came for
-- ============================================================================
--  Everybody who signed in for the first time and was not invited was guessed
--  to be a producer, and the console then had to ask a question the person
--  themselves could have answered in one press. Now they answer it.
--
--  There are three answers: a production business, a wedding, a business
--  event. Nothing is let in by saying so. The answer is a request, written to
--  one column on the profile, and the bell of the root address rings; the
--  existing queue on /app/admin is where it is granted, and nothing about
--  authorisation moves — role and producers.status are still the only things
--  every screen decides from.
--
--  An address somebody invited beforehand never reaches this: handle_new_user
--  already makes it a client at the door, bound to the event it was invited
--  to, and that has not changed.
--
--  Nothing here touches a row. The columns are added empty, and an account
--  that has not answered reads as it did before: asked, once, on its next
--  visit to the waiting screen.
-- ============================================================================

alter table public.profiles
  add column if not exists signup_intent    text,
  add column if not exists signup_intent_at timestamptz;

alter table public.profiles drop constraint if exists profiles_signup_intent;
alter table public.profiles add constraint profiles_signup_intent
  check (signup_intent is null or signup_intent in ('producer', 'wedding', 'business')) not valid;

comment on column public.profiles.signup_intent is
  'What the person said they came for, the first time they signed in: a '
  'production business, a wedding or a business event. A request, not a '
  'permission - role and producers.status are what every screen decides from.';


-- ── the one door that writes it ─────────────────────────────────────────────
--  profiles_update_self would let a person write any column of their own row,
--  and a request that anybody can rewrite after it was granted is a record
--  that says nothing. So the app goes through here: only somebody still
--  waiting, never the root address, and only a change rings the bell.
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

  if p_intent not in ('producer', 'wedding', 'business') then
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

  /* Still waiting, and nothing else. An approved producer, a couple, a crew
     member or a suspended account has been decided about, and a form must
     not be able to reopen that. */
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
        when 'wedding'  then 'עושים חתונה'
        else 'עושים אירוע עסקי'
      end,
      '/app/admin'
    );
  end if;

  return p_intent;
end $$;

comment on function public.choose_my_path(text) is
  'A new account saying what it came for. Writes profiles.signup_intent for '
  'the caller only, only while their workspace is pending, and rings the '
  'root bell. It grants nothing.';

revoke all on function public.choose_my_path(text) from public, anon;
grant execute on function public.choose_my_path(text) to authenticated;


-- ── approving a couple opens the kind of event they asked for ──────────────
--  The function is the one from 0081 with one line changed: the workspace it
--  opens for a couple planning alone is a business event when that is what
--  they said, and a wedding otherwise. Same signature and return type, so a
--  plain create or replace is safe to replay.
create or replace function public.set_account_kind(p_owner uuid, p_kind text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email   text;
  v_name    text;
  v_intent  text;
  v_client  uuid;
  v_producer uuid;
begin
  if not public.is_super_admin() then
    raise exception 'only % may decide what an account is', public.root_admin_email();
  end if;

  if p_kind not in ('producer', 'diy', 'managed') then
    raise exception 'unknown kind: %', p_kind;
  end if;

  select lower(email), coalesce(nullif(btrim(full_name), ''), split_part(lower(email), '@', 1)), signup_intent
    into v_email, v_name, v_intent
    from public.profiles where id = p_owner;

  if v_email is null then
    raise exception 'no such account';
  end if;

  if v_email = public.root_admin_email() then
    raise exception 'the root account cannot be reassigned';
  end if;

  if p_kind = 'producer' then
    update public.profiles
       set role = 'producer'::app_role, account_kind = 'producer'
     where id = p_owner;
    update public.producers set status = 'pending'::producer_state
     where owner_id = p_owner and status = 'rejected'::producer_state;
    return 'producer';
  end if;

  update public.profiles
     set role = 'client'::app_role, account_kind = p_kind
   where id = p_owner;

  update public.producers set status = 'rejected'::producer_state
   where owner_id = p_owner and status <> 'rejected'::producer_state;

  if p_kind = 'managed' then
    return 'managed';
  end if;

  select e.client_id into v_client
    from public.client_authorized_emails e
   where e.email = v_email or e.profile_id = p_owner
   limit 1;

  if v_client is not null then
    update public.clients set plan = 'diy'::client_plan where id = v_client;
    return 'diy-existing';
  end if;

  v_producer := public.public_site_producer();
  if v_producer is null then
    raise exception 'the platform has no producer of its own to hang a workspace on';
  end if;

  insert into public.clients (producer_id, display_name, kind, plan)
  values (v_producer, v_name,
          case when v_intent = 'business' then 'corporate'::event_class else 'wedding'::event_class end,
          'diy'::client_plan)
  returning id into v_client;

  insert into public.client_authorized_emails (client_id, email)
  values (v_client, v_email)
  on conflict do nothing;

  return 'diy-created';
end $$;

comment on function public.set_account_kind(uuid, text) is
  'Root decides whether a sign-up is a production business, a couple planning '
  'alone, or a couple who will be invited onto a producer''s event. Writes '
  'profiles.role and profiles.account_kind, so it checks is_super_admin() '
  'itself rather than trusting the screen that calls it. A couple planning '
  'alone gets the kind of event they asked for in signup_intent.';

revoke all on function public.set_account_kind(uuid, text) from public, anon;
grant execute on function public.set_account_kind(uuid, text) to authenticated;


-- ── and the queue shows what each account asked for ─────────────────────────
--  One more column on the leaderboard, so it is dropped before it is
--  replaced: create or replace cannot change a return type, and replaying the
--  earlier definition after this one would otherwise fail on the second run.
drop function if exists public.producer_leaderboard();

create or replace function public.producer_leaderboard()
returns table (
  producer_id   uuid,
  brand         text,
  contact_email text,
  status        text,
  last_seen_at  timestamptz,
  events_live   integer,
  events_total  integer,
  leads_total   integer,
  leads_30d     integer,
  signed_total  integer,
  owner_id      uuid,
  owner_role    text,
  owner_kind    text,
  owner_intent  text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    pr.id,
    coalesce(nullif(pr.brand_name, ''), nullif(pr.contact_name, ''), pr.contact_email),
    pr.contact_email,
    pr.status::text,
    p.last_seen_at,
    (select count(*)::int from public.clients c
      where c.producer_id = pr.id and c.archived_at is null),
    (select count(*)::int from public.clients c where c.producer_id = pr.id),
    (select count(*)::int from public.leads l where l.producer_id = pr.id),
    (select count(*)::int from public.leads l
      where l.producer_id = pr.id and l.created_at > now() - interval '30 days'),
    (select count(distinct ct.client_id)::int
       from public.contracts ct
       join public.clients c on c.id = ct.client_id
      where c.producer_id = pr.id and ct.signed_at is not null),
    pr.owner_id,
    p.role::text,
    coalesce(
      p.account_kind,
      case when p.role = 'client'::app_role then 'managed' else 'producer' end
    ),
    p.signup_intent
  from public.producers pr
  left join public.profiles p on p.id = pr.owner_id
  order by 6 desc, 8 desc;
end $$;

revoke all on function public.producer_leaderboard() from public;
grant execute on function public.producer_leaderboard() to authenticated;


-- ── and the platform owner reads no producer's budget again ─────────────────
--  Found by the schema check, which the last four releases had not been
--  running against a regenerated sync.sql. 0104 wrote `or is_super_admin()`
--  into three policies on the budget, which hands the root address every
--  producer's budget lines, their private notes on a line and every payment
--  against it - the one thing 0030 took away on purpose, and the line
--  "the owner reads no producer's private rows" exists to keep taken away.
--
--  Policies only. No row is read, written or moved, and what the owner of a
--  workspace and its couple may do is exactly what it was.
drop policy if exists budget_read on public.budget_items;
create policy budget_read on public.budget_items for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or (
      public.can_read_client(client_id)
      and visible_to_couple
      and exists (select 1 from public.clients c where c.id = client_id and c.budget_visible)
    )
  );

drop policy if exists budget_item_private_producer on public.budget_item_private;
create policy budget_item_private_producer on public.budget_item_private for all
  using (
    exists (
      select 1 from public.budget_items b
      where b.id = item_id and public.owns_producer(public.producer_of_client(b.client_id))
    )
  )
  with check (
    exists (
      select 1 from public.budget_items b
      where b.id = item_id and public.owns_producer(public.producer_of_client(b.client_id))
    )
  );

drop policy if exists budget_payments_write on public.budget_payments;
create policy budget_payments_write on public.budget_payments for all
  using (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));
