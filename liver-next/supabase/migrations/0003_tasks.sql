-- ============================================================================
--  0003 — a shared checklist that neither side can quietly rewrite
-- ============================================================================
--  tasks_all gave anyone who can read a workspace full rights over every task
--  on it. That is right for ticking and adding — the point of the list is that
--  both sides use it — but it also let a couple delete the producer's entire
--  checklist, and let either side claim a task had been written by the other.
--
--  So: authorship is recorded by the database rather than sent by the browser,
--  and deleting is limited to whoever wrote the task, plus the producer who
--  owns the workspace so they can still tidy up.
-- ============================================================================

-- ── who wrote this is not the browser's to say ──────────────────────────────
create or replace function public.stamp_task_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_by := auth.uid();
  return new;
end $$;
drop trigger if exists tasks_stamp_author on public.tasks;
create trigger tasks_stamp_author before insert on public.tasks
  for each row execute function public.stamp_task_author();

-- created_by is the record of who wrote it, so it must not drift afterwards
create or replace function public.freeze_task_author() returns trigger
language plpgsql as $$
begin
  new.created_by := old.created_by;
  return new;
end $$;
drop trigger if exists tasks_freeze_author on public.tasks;
create trigger tasks_freeze_author before update on public.tasks
  for each row execute function public.freeze_task_author();

-- ── read and write together, delete only your own ───────────────────────────
drop policy if exists tasks_all on public.tasks;

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select
  using (public.can_read_client(client_id));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert
  with check (public.can_read_client(client_id));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update
  using (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete
  using (
    public.can_read_client(client_id)
    and (
      created_by = auth.uid()
      or public.owns_producer(public.producer_of_client(client_id))
      or public.is_super_admin()
    )
  );

create index if not exists tasks_client_owner_idx on public.tasks(client_id, done, due_on);
