-- ============================================================================
--  0005 — the winning board, and locking down the files behind it
-- ============================================================================
--  The row policy on moodboards was already per client. The storage policies
--  were not: they allowed
--
--    read   -> bucket_id = 'moodboards'                       (everybody)
--    write  -> bucket_id = 'moodboards' and auth.uid() is not null
--    delete -> bucket_id = 'moodboards' and auth.uid() is not null
--
--  so any signed-in person could read, overwrite and delete the photos of
--  every couple in the system, and read was not even limited to signed-in
--  people. The table said "your event only" while the images themselves were
--  open to the world.
--
--  Objects are stored as <client_id>/<file>, so the folder name is the
--  workspace and access can be decided by the same rule as everything else.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('moodboards', 'moodboards', false)
on conflict (id) do update set public = false;

-- the first path segment is the workspace this file belongs to
create or replace function public.storage_client_id(object_name text) returns uuid
language plpgsql immutable as $$
declare seg text;
begin
  seg := split_part(object_name, '/', 1);
  if seg !~ '^[0-9a-fA-F-]{36}$' then
    return null;
  end if;
  return seg::uuid;
exception when others then
  return null;
end $$;

drop policy if exists moodboard_objects_read on storage.objects;
create policy moodboard_objects_read on storage.objects for select
  using (
    bucket_id = 'moodboards'
    and public.can_read_client(public.storage_client_id(name))
  );

drop policy if exists moodboard_objects_write on storage.objects;
create policy moodboard_objects_write on storage.objects for insert
  with check (
    bucket_id = 'moodboards'
    and public.can_read_client(public.storage_client_id(name))
  );

drop policy if exists moodboard_objects_update on storage.objects;
create policy moodboard_objects_update on storage.objects for update
  using (
    bucket_id = 'moodboards'
    and public.can_read_client(public.storage_client_id(name))
  );

drop policy if exists moodboard_objects_delete on storage.objects;
create policy moodboard_objects_delete on storage.objects for delete
  using (
    bucket_id = 'moodboards'
    and public.can_read_client(public.storage_client_id(name))
  );

-- can_read_client answers false rather than raising for a null id, so a file
-- dropped at the root of the bucket belongs to nobody and is reachable by
-- nobody, which is the safe way for a malformed path to fail.
