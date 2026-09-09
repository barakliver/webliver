-- ============================================================================
--  0012 — profile pictures
-- ============================================================================
--  A couple should be able to put their own face on their account, and see the
--  producer's. That makes the avatar the one image in the product that is
--  deliberately visible to people outside the account that owns it.
--
--  So this bucket is public for READ and strictly owned for WRITE. Anyone may
--  see an avatar; only its owner may add, replace or delete one. Objects are
--  stored as <user_id>/<file>, so the folder name is the owner and the rule is
--  the same shape as the winning board's, which keys on the first path segment.
--
--  Public read is a deliberate choice, not an oversight: it means an avatar can
--  be rendered with a plain URL that caches, instead of a signed URL minted per
--  request per viewer. Nothing private is ever put in this bucket.
-- ============================================================================

alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- the first path segment is the account that owns the file
create or replace function public.storage_owner_id(object_name text) returns uuid
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

drop policy if exists avatar_objects_read on storage.objects;
create policy avatar_objects_read on storage.objects for select
  using (bucket_id = 'avatars');

-- write, replace and remove: the owner alone. auth.uid() is null for an
-- anonymous caller and storage_owner_id is null for a path that is not a uuid
-- folder, and null = null is not true, so both are refused rather than allowed.
drop policy if exists avatar_objects_write on storage.objects;
create policy avatar_objects_write on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and public.storage_owner_id(name) = auth.uid()
  );

drop policy if exists avatar_objects_update on storage.objects;
create policy avatar_objects_update on storage.objects for update
  using (
    bucket_id = 'avatars'
    and public.storage_owner_id(name) = auth.uid()
  );

drop policy if exists avatar_objects_delete on storage.objects;
create policy avatar_objects_delete on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and public.storage_owner_id(name) = auth.uid()
  );

-- ── who may change a profile row ────────────────────────────────────────────
-- Everyone signed in can already read profiles they share an event with. This
-- lets a person edit their own name and avatar, and nobody else's. The role
-- column stays out of reach: guard_super_admin already refuses to let anyone
-- but the root address hold super_admin, and this policy does not widen that.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- A person may not change their own role by editing their profile.
create or replace function public.freeze_own_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() = old.id
     and lower(old.email) <> public.root_admin_email() then
    raise exception 'a role is not self-assigned';
  end if;
  return new;
end $$;

drop trigger if exists profiles_freeze_own_role on public.profiles;
create trigger profiles_freeze_own_role
  before update on public.profiles
  for each row execute function public.freeze_own_role();
