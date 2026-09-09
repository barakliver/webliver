-- ============================================================================
--  0033 — inviting somebody who already has an account
-- ============================================================================
--  Reproduced against a real database, as an ordinary producer:
--
--      insert into client_authorized_emails (client_id, email) values (…);
--      ERROR:  a role is set by barakliver@gmail.com only
--      CONTEXT:  PL/pgSQL function guard_role_change() …
--                SQL statement "update public.profiles set role = 'client' …"
--                PL/pgSQL function bind_authorized_email() …
--
--  The whole insert fails. A producer cannot invite a couple whose address
--  already signed up — which is most couples who ever visited the site and
--  made an account before being invited.
--
--  Two correct pieces fighting each other. bind_authorized_email demotes such
--  an account from 'producer' to 'client' so they see the workspace they were
--  invited to. guard_role_change refuses any role change not made by root.
--  Being security definer does not help: that changes the database role, and
--  the guard reads auth.uid(), which is still the producer doing the inviting.
--
--  The fix is not to weaken the guard. Escalation is what it exists to stop,
--  and it keeps stopping it. What is allowed is one specific reduction —
--  producer to client — and only while bind_authorized_email is the thing
--  making it, marked by a transaction-local setting that function sets and
--  clears around its own update.
--
--  Nothing else can reach it: the flag is local to the transaction, no role
--  other than the definer can set it through the API, and even holding it the
--  guard still refuses anything except that one downward step.
-- ============================================================================

create or replace function public.guard_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  if public.is_super_admin() then
    return new;
  end if;

  /* The one exception: an account being turned into a couple because it was
     just invited onto a workspace. A reduction, never a promotion, and only
     while the function that performs it says so. */
  if old.role = 'producer'
     and new.role = 'client'
     and coalesce(current_setting('liver.binding_invite', true), '') = 'on' then
    return new;
  end if;

  raise exception 'a role is set by % only', public.root_admin_email();
end $$;


-- ── stricter about what counts as an empty workspace ────────────────────────
--  The existing cleanup asked only whether the workspace had clients. A
--  producer whose application is still pending may well have leads, suppliers
--  or booked calls and no events yet, and deleting that row throws away real
--  work. A named business is not empty either, whatever else is true of it.
/* Dropped first rather than replaced. `create or replace` cannot change a
   function's return type, so a signature that ever differed — between two
   deploys, or between a database that ran an earlier build and one that did
   not — turns a re-runnable file into one that fails halfway. */
drop function if exists public.drop_empty_producer(uuid);

create or replace function public.drop_empty_producer(p_owner uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.producers pr
   where pr.owner_id = p_owner
     and pr.status in ('pending','rejected')
     and coalesce(btrim(pr.brand_name), '') = ''
     and not exists (select 1 from public.clients     c where c.producer_id = pr.id)
     and not exists (select 1 from public.leads       l where l.producer_id = pr.id)
     and not exists (select 1 from public.vendors     v where v.producer_id = pr.id)
     and not exists (select 1 from public.sales_calls s where s.producer_id = pr.id);
  get diagnostics n = row_count;
  return n;
end $$;

comment on function public.drop_empty_producer(uuid) is
  'Removes the placeholder workspace left behind when somebody who signed up '
  'as a producer turns out to be a couple. Refuses to touch anything approved, '
  'named, or holding a single lead, supplier, call or event.';


create or replace function public.bind_authorized_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  select id, role into p from public.profiles where lower(email) = lower(new.email);
  if not found then
    return new;
  end if;

  new.profile_id := p.id;

  -- never demote the root admin, and never demote a producer who already owns
  -- an approved workspace of their own
  if p.role = 'producer'
     and not exists (select 1 from public.producers pr
                     where pr.owner_id = p.id and pr.status = 'approved') then

    /* Local to this transaction and cleared straight after, so the permission
       exists for exactly the length of one update and cannot be left on. */
    perform set_config('liver.binding_invite', 'on', true);
    update public.profiles set role = 'client' where id = p.id;
    perform set_config('liver.binding_invite', '', true);

    perform public.drop_empty_producer(p.id);
  end if;

  return new;
end $$;


-- ── root reads a profile because of what the person is ──────────────────────
--  0030 scoped root to "profiles of people who own a producers row". That is
--  the right idea keyed to the wrong table: a placeholder workspace left on
--  somebody's account makes them a producer owner by that definition, and a
--  couple's profile leaks to root through it.
--
--  Caught by seeding a couple whose row was created in a different order than
--  the app creates it. The order was unrealistic; the fragility it exposed is
--  not. A boundary whose safety depends on a second table being tidy is a
--  boundary that fails the first time it is not.
--
--  The role column is the platform's own statement of what somebody is, and it
--  is guarded by two triggers already. Read that instead.
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (
    id = auth.uid()
    or (public.is_super_admin() and role in ('producer','super_admin'))
  );

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (
    id = auth.uid()
    or (public.is_super_admin() and role in ('producer','super_admin'))
  )
  with check (
    id = auth.uid()
    or (public.is_super_admin() and role in ('producer','super_admin'))
  );
