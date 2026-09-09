-- ============================================================================
--  0002 — who a new account becomes, and what it may do before approval
-- ============================================================================
--  0001 made every non-root signup a producer. That is wrong for an invited
--  couple: the address is already on a workspace, so the account belongs to
--  that workspace as a client, not to a producer of its own. It also left
--  producers with no workspace row at all, so there was nothing for the root
--  admin to approve.
--
--  House rule this file enforces: only barakliver@gmail.com is ever elevated,
--  and every other producer signup lands in 'pending' and can do nothing until
--  the root admin approves it.
-- ============================================================================

-- ── new account -> the right role, and a workspace to be approved ───────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  addr        text := lower(new.email);
  is_root     boolean := addr = public.root_admin_email();
  is_invited  boolean;
  new_role    app_role;
begin
  select exists (select 1 from public.client_authorized_emails e where lower(e.email) = addr)
    into is_invited;

  new_role := case
    when is_root    then 'super_admin'::app_role
    when is_invited then 'client'::app_role
    else 'producer'::app_role
  end;

  insert into public.profiles (id, email, full_name, role)
  values (new.id, addr, coalesce(new.raw_user_meta_data->>'full_name',''), new_role)
  on conflict (id) do nothing;

  -- an invited address is bound to the workspaces that invited it
  if is_invited then
    update public.client_authorized_emails
       set profile_id = new.id
     where lower(email) = addr and profile_id is null;
  end if;

  -- a producer gets a workspace immediately, but it starts unapproved;
  -- the root account is the one exception and is live from the first login
  if new_role in ('producer','super_admin') then
    insert into public.producers (owner_id, brand_name, contact_name, contact_email, status)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'brand_name',''),
      coalesce(new.raw_user_meta_data->>'full_name',''),
      addr,
      case when is_root then 'approved'::producer_state else 'pending'::producer_state end
    );
  end if;

  return new;
end $$;

-- ── an address invited after it already signed up ───────────────────────────
--  Without this, a couple who happened to have an account first would stay a
--  producer forever and never see the workspace they were invited to.
create or replace function public.bind_authorized_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  select id, role into p from public.profiles where lower(email) = lower(new.email);
  if found then
    new.profile_id := p.id;
    -- never demote the root admin, and never demote a producer who already
    -- owns an approved workspace of their own
    if p.role = 'producer'
       and not exists (select 1 from public.producers pr
                       where pr.owner_id = p.id and pr.status = 'approved') then
      update public.profiles set role = 'client' where id = p.id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists cae_bind on public.client_authorized_emails;
create trigger cae_bind before insert on public.client_authorized_emails
  for each row execute function public.bind_authorized_email();

-- ── "may this account actually do anything yet?" ────────────────────────────
create or replace function public.my_producer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.producers where owner_id = auth.uid() order by created_at limit 1
$$;

create or replace function public.is_approved_producer() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.producers pr
    where pr.owner_id = auth.uid() and pr.status = 'approved'
  )
$$;

-- A pending producer could previously create clients, leads and everything
-- hanging off them. Approval now gates writes across the workspace tables.
drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients for all
  using (public.can_read_client(id) and public.is_approved_producer())
  with check (public.owns_producer(producer_id) and public.is_approved_producer());

drop policy if exists producers_update on public.producers;
create policy producers_update on public.producers for update
  using (public.is_super_admin() or owner_id = auth.uid())
  with check (public.is_super_admin() or owner_id = auth.uid());

-- Status is the root admin's decision alone: an owner may edit their own brand
-- details but must not be able to approve themselves.
create or replace function public.guard_producer_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and not public.is_super_admin() then
    raise exception 'only % may change a producer status', public.root_admin_email();
  end if;
  return new;
end $$;
drop trigger if exists producers_guard_status on public.producers;
create trigger producers_guard_status before update on public.producers
  for each row execute function public.guard_producer_status();

-- Self-service signup must not be able to mint a producer row that is already
-- approved, nor one owned by somebody else.
drop policy if exists producers_insert on public.producers;
create policy producers_insert on public.producers for insert
  with check (
    public.is_super_admin()
    or (owner_id = auth.uid() and status = 'pending')
  );

-- ── a profile must not be able to promote itself ────────────────────────────
--  profiles_self_update let a signed-in user write any column on their row,
--  role included. The super_admin guard blocked the top of the ladder, but
--  nothing stopped a client from writing 'producer'.
create or replace function public.guard_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_super_admin() then
    raise exception 'a role is set by % only', public.root_admin_email();
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_role_change();
