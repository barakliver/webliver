-- ============================================================================
--  0014 — three defects found by auditing the invitation path end to end
-- ============================================================================
--  The invitation flow itself turned out to be sound: a couple invited before
--  or after they sign up ends as role 'client', bound to the workspace, seeing
--  their event and nothing else, and a third address is refused. That was
--  tested against a real Postgres with the policies on, both orderings.
--
--  These are the three things that were actually wrong.
-- ============================================================================


-- ── 1. the couple could see the money ───────────────────────────────────────
--  budget_items is gated on clients.budget_visible, so a producer who has not
--  chosen to share numbers keeps them private. payments was not gated at all:
--  the same couple read every instalment, its amount and its due date. Cost is
--  the producer's information until the producer decides otherwise, and one of
--  the two money tables was quietly ignoring that.
--
--  Note this is read only. Writing payments was already producer-only.

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select using (
  public.owns_producer(public.producer_of_client(client_id))
  or public.is_super_admin()
  or (
    public.can_read_client(client_id)
    and exists (select 1 from public.clients c
                 where c.id = payments.client_id and c.budget_visible)
  )
);


-- ── 2. couples were queuing for producer approval ───────────────────────────
--  Somebody who signs up before being invited is a producer until the invite
--  arrives, and gets a producers row on the way. bind_authorized_email() then
--  demotes the profile to 'client' but left that row behind, so the root admin
--  opened the approval queue and found couples waiting in it, and the couple's
--  own header showed their stale pending brand name instead of the producer's.
--
--  A demoted account has no business owning a workspace. The row goes when the
--  role does — but only when it is empty, because an account that has already
--  produced events is a real producer being invited to somebody else's wedding,
--  and deleting that would cascade their own clients away.

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

      -- and take the empty workspace with it, so the approval queue holds
      -- producers and only producers
      delete from public.producers pr
       where pr.owner_id = p.id
         and pr.status <> 'approved'
         and not exists (select 1 from public.clients c where c.producer_id = pr.id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists cae_bind on public.client_authorized_emails;
create trigger cae_bind before insert on public.client_authorized_emails
  for each row execute function public.bind_authorized_email();

-- clear the ones already sitting in the queue
delete from public.producers pr
 using public.profiles p
 where p.id = pr.owner_id
   and p.role = 'client'
   and pr.status <> 'approved'
   and not exists (select 1 from public.clients c where c.producer_id = pr.id);


-- ── 3. the schema assumed grants it never made ──────────────────────────────
--  Every table here is created without a single grant, on the assumption that
--  the public schema still carries the default privileges a new Supabase
--  project ships with. That assumption holds right up until the schema is
--  recreated — which our own reset script does — and then every table returns
--  "permission denied", before RLS is ever consulted. It is the exact symptom
--  that reads as "the couple cannot get in", and it is invisible in the SQL
--  editor, which runs as an owner that needs no grant.
--
--  Saying it out loud costs nothing and is idempotent.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;

alter default privileges in schema public grant all    on tables    to authenticated, service_role;
alter default privileges in schema public grant all    on sequences to authenticated, service_role;
alter default privileges in schema public grant select on tables    to anon;

--  RLS is what actually protects these tables; the grant only decides whether
--  the request gets as far as a policy. Every table in this schema has row
--  level security enabled, so a blanket grant hands nobody a row they were not
--  already entitled to. Guard that claim rather than trusting it:
do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    raise exception 'table public.% has no row level security, and was just granted to authenticated', t;
  end loop;
end $$;
