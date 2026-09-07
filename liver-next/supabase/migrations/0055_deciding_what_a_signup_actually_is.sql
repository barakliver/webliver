-- ============================================================================
--  0055 — deciding what a sign-up actually is
-- ============================================================================
--  Somebody signs up. The platform has no way of knowing whether they are a
--  production business or a couple planning their own wedding, so it guesses:
--  handle_new_user makes everybody a producer with a pending workspace, and
--  that guess is right about half the time.
--
--  There was nothing to do about it. The console offered approve and reject —
--  two answers to a question nobody had asked. Reject a couple and she has an
--  account that opens onto nothing; approve her and she is a production
--  business with a client list. Neither is what she is.
--
--  So the decision becomes explicit, and it has three answers rather than two:
--
--    producer  a real production business. Her workspace goes back to pending
--              and the existing approve button finishes the job.
--    diy       a couple planning their own wedding. She becomes a client and
--              gets a workspace of her own, marked diy — which is what that
--              word means here, and what the feature flags gate on.
--    managed   a couple whose producer will invite her onto their event. She
--              becomes a client and waits, because the event is not ours to
--              create; it belongs to whoever is producing it.
--
--  The producer row is kept in both client cases rather than deleted, marked
--  rejected. Deleting it loses the fact that somebody applied, and this list
--  is the only record of who tried.
--
--  Root only, checked here rather than only in the app: this writes to
--  profiles.role, which is the value every authorisation decision in the
--  product is made from, and a check that lives only in a screen is a check
--  that a fetch call goes around.
-- ============================================================================

drop function if exists public.set_account_kind(uuid, text);

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

  /* The root account is not a case this handles. Turning the owner of the
     platform into a couple is a locked door with the key inside, and it is
     easier to refuse it here than to explain it afterwards. */
  if v_email = public.root_admin_email() then
    raise exception 'the root account cannot be reassigned';
  end if;

  -- ── a production business ────────────────────────────────────────────────
  if p_kind = 'producer' then
    update public.profiles set role = 'producer'::app_role where id = p_owner;
    /* Back to pending rather than straight to approved. Deciding somebody is
       a producer and deciding to let them in are two decisions, and the
       second one already has a button. */
    update public.producers set status = 'pending'::producer_state
     where owner_id = p_owner and status = 'rejected'::producer_state;
    return 'producer';
  end if;

  -- ── a couple, either way ─────────────────────────────────────────────────
  update public.profiles set role = 'client'::app_role where id = p_owner;

  /* Kept, not deleted. Marked, so the list stops offering to approve a
     workspace for somebody who is not running one. */
  update public.producers set status = 'rejected'::producer_state
   where owner_id = p_owner and status <> 'rejected'::producer_state;

  if p_kind = 'managed' then
    return 'managed';
  end if;

  -- ── and for a couple planning alone, somewhere to plan ───────────────────
  /* Only if they have nowhere already. Pressing this twice must not leave
     somebody with two weddings. */
  select e.client_id into v_client
    from public.client_authorized_emails e
   where e.email = v_email or e.profile_id = p_owner
   limit 1;

  if v_client is not null then
    /* They are already on an event. Say so rather than making a second one:
       what they are is now recorded, and the event they have is the event
       they have. */
    update public.clients set plan = 'diy'::client_plan where id = v_client;
    return 'diy-existing';
  end if;

  /* Under the platform's own producer. A couple planning alone has no
     production business behind them, and every workspace needs one — theirs
     is the rejected row, which cannot write. */
  v_producer := public.public_site_producer();
  if v_producer is null then
    raise exception 'the platform has no producer of its own to hang a workspace on';
  end if;

  insert into public.clients (producer_id, display_name, kind, plan)
  values (v_producer, v_name, 'wedding', 'diy'::client_plan)
  returning id into v_client;

  /* The invitation, which is what makes it theirs. The bind trigger fills in
     profile_id from the address. */
  insert into public.client_authorized_emails (client_id, email)
  values (v_client, v_email)
  on conflict do nothing;

  return 'diy-created';
end $$;

comment on function public.set_account_kind(uuid, text) is
  'Root decides whether a sign-up is a production business, a couple planning '
  'alone, or a couple who will be invited onto a producer''s event. Writes '
  'profiles.role, so it checks is_super_admin() itself rather than trusting '
  'the screen that calls it.';

revoke all on function public.set_account_kind(uuid, text) from public, anon;
grant execute on function public.set_account_kind(uuid, text) to authenticated;


-- ── and the console needs two more columns to offer the decision ────────────
--  The leaderboard returns a producer's brand, status and counts. Deciding
--  what an account is needs the account: the owner's profile id to write the
--  role to, and the role it currently has, so the screen shows what is true
--  rather than what it assumes.
--
--  Dropped before it is replaced. `create or replace function` cannot change a
--  return type, and adding two columns changes it — which is the exact failure
--  that stopped the first automatic release, from a function whose signature
--  moved between 0031 and 0046 with nothing dropping it first.
--
--  Still counts only. A profile id and a role are governance, the same as an
--  approval status; no couple, no event name and no money crosses this
--  boundary, and none is added here.
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
  owner_role    text
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
    p.role::text
  from public.producers pr
  left join public.profiles p on p.id = pr.owner_id
  order by 6 desc, 8 desc;
end $$;

revoke all on function public.producer_leaderboard() from public;
grant execute on function public.producer_leaderboard() to authenticated;
