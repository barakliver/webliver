-- ============================================================================
--  0081 — the console remembers what it decided about an account
-- ============================================================================
--  He pressed one of the three buttons under "מה החשבון הזה" and reported that
--  it does not work. The function it calls works: run it against a real
--  PostgreSQL and every one of the three does exactly what it says. What does
--  not work is the screen, and the difference matters, because from where he
--  was sitting they are the same thing.
--
--  The screen marked the first option when the account was not a client, and
--  marked neither of the other two, ever — they were written `on: false` and
--  left there. So for an account that is already a couple, pressing "זוג
--  שמתכנן לבד" or "זוג של מפיק" changed a role that was already right, wrote
--  what it had to write, and redrew a screen identical in every pixel to the
--  one before. A button that does nothing visible is a button that does
--  nothing.
--
--  It could not have marked them. Which of the two a couple is was never
--  stored anywhere: both write role='client', and they differ only in whether
--  a workspace was opened. Guessing it back from the workspaces is guessing —
--  a couple switched from planning alone to being invited still has the
--  workspace the first decision opened, so the guess would contradict the
--  press that had just been made.
--
--  So the decision is stored. One column, nullable, written by the function
--  that makes the decision, read by the console that offers it.
--
--  Nothing here touches a row: the column is added empty, and an account
--  nobody has decided about yet reads as what it already is.
-- ============================================================================

alter table public.profiles
  add column if not exists account_kind text;

alter table public.profiles drop constraint if exists profiles_account_kind;
alter table public.profiles add constraint profiles_account_kind
  check (account_kind is null or account_kind in ('producer', 'diy', 'managed'));

comment on column public.profiles.account_kind is
  'What root last decided this account is, from the three the console offers. '
  'Null until somebody decides. Not an authorisation column — role is, and '
  'this only records which of the two couple kinds was chosen, which role '
  'cannot hold because both are ''client''.';


-- ── the function records what it did ────────────────────────────────────────
--  Otherwise unchanged from 0055, and still root only, still checked here
--  rather than in the screen that calls it.
create or replace function public.set_account_kind(p_owner uuid, p_kind text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email   text;
  v_name    text;
  v_client  uuid;
  v_producer uuid;
begin
  if not public.is_super_admin() then
    raise exception 'only % may decide what an account is', public.root_admin_email();
  end if;

  if p_kind not in ('producer', 'diy', 'managed') then
    raise exception 'unknown kind: %', p_kind;
  end if;

  select lower(email), coalesce(nullif(btrim(full_name), ''), split_part(lower(email), '@', 1))
    into v_email, v_name
    from public.profiles where id = p_owner;

  if v_email is null then
    raise exception 'no such account';
  end if;

  if v_email = public.root_admin_email() then
    raise exception 'the root account cannot be reassigned';
  end if;

  -- ── a production business ────────────────────────────────────────────────
  if p_kind = 'producer' then
    update public.profiles
       set role = 'producer'::app_role, account_kind = 'producer'
     where id = p_owner;
    update public.producers set status = 'pending'::producer_state
     where owner_id = p_owner and status = 'rejected'::producer_state;
    return 'producer';
  end if;

  -- ── a couple, either way ─────────────────────────────────────────────────
  update public.profiles
     set role = 'client'::app_role, account_kind = p_kind
   where id = p_owner;

  update public.producers set status = 'rejected'::producer_state
   where owner_id = p_owner and status <> 'rejected'::producer_state;

  if p_kind = 'managed' then
    return 'managed';
  end if;

  /* Only if they have nowhere already. Pressing this twice must not leave
     somebody with two weddings — and a couple moved to "with a producer" and
     back again finds the workspace they already had, rather than a second
     one beside it. */
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
  values (v_producer, v_name, 'wedding', 'diy'::client_plan)
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
  'itself rather than trusting the screen that calls it.';

revoke all on function public.set_account_kind(uuid, text) from public, anon;
grant execute on function public.set_account_kind(uuid, text) to authenticated;


-- ── and the console reads it back ───────────────────────────────────────────
--  Dropped before it is replaced, because the return type gains a column and
--  `create or replace function` cannot change one. That is the exact failure
--  0055 warns about in its own comment, from the two functions whose
--  signatures moved between 0031 and 0046 with nothing dropping them first.
--
--  Still counts and governance only. An account's kind is the same sort of
--  fact as its approval status; no couple, no event name and no money crosses
--  this boundary, and none is added here.
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
  owner_kind    text
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
    /* What was decided, or what the account already is where nobody has
       decided yet. Never a guess between the two couple kinds: an account
       with no decision on it and a client role is waiting for a producer to
       invite them, which is what 'managed' means. */
    coalesce(
      p.account_kind,
      case when p.role = 'client'::app_role then 'managed' else 'producer' end
    )
  from public.producers pr
  left join public.profiles p on p.id = pr.owner_id
  order by 6 desc, 8 desc;
end $$;

revoke all on function public.producer_leaderboard() from public;
grant execute on function public.producer_leaderboard() to authenticated;
