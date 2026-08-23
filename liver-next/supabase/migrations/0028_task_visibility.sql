-- ============================================================================
--  0028 — a task the couple should not see
-- ============================================================================
--  Every task on an event has been visible to the couple, because tasks_read
--  asks can_read_client and nothing else. For most of them that is right: the
--  point of the shared workspace is that both sides see the same list.
--
--  Some of them are not for sharing, and the producer's own file makes that
--  obvious the moment it is read: "cash envelopes for the rabbi, the magnet
--  photographer and tips for the hall staff", "no extra bottles to the tables
--  without approval". Those are operating instructions. Put in front of a
--  couple three weeks before their wedding they read as a list of things that
--  might go wrong, which is the opposite of what this platform is for.
--
--  So a task carries whether it is shared, the producer decides per task, and
--  the default is shared. Defaulting the other way would quietly hide every
--  task that already exists, which is the kind of migration that loses trust
--  in one afternoon.
-- ============================================================================

alter table public.tasks
  add column if not exists visible_to_client boolean not null default true;

comment on column public.tasks.visible_to_client is
  'False keeps a task on the producer''s side of the wall. Default true, so '
  'nothing that already existed changes hands.';

/* The couple's half of the read: shared tasks only. The producer's half is
   unconditional, because it is their workspace. Written as two branches
   rather than one clever expression so the next person can see which is
   which. */
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or public.is_super_admin()
    or (public.can_read_client(client_id) and visible_to_client)
  );

/* A couple may still tick their own tasks off, and may not decide what they
   are allowed to see. Enforced in a trigger because row level security has no
   opinion about which column changed. */
create or replace function public.guard_task_visibility() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.visible_to_client is distinct from old.visible_to_client
     and not public.owns_producer(public.producer_of_client(new.client_id))
     and not public.is_super_admin() then
    raise exception 'רק המפיק קובע מה משותף' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

drop trigger if exists tasks_guard_visibility on public.tasks;
create trigger tasks_guard_visibility before update on public.tasks
  for each row execute function public.guard_task_visibility();

/* And a couple cannot create a hidden task either, which would otherwise be
   the way around the trigger: insert it already false. */
create or replace function public.default_task_visibility() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_producer(public.producer_of_client(new.client_id))
     and not public.is_super_admin() then
    new.visible_to_client := true;
  end if;
  return new;
end $$;

drop trigger if exists tasks_default_visibility on public.tasks;
create trigger tasks_default_visibility before insert on public.tasks
  for each row execute function public.default_task_visibility();
