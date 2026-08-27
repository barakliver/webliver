-- ============================================================================
--  0039 — the couple can hand over a file
-- ============================================================================
--  Until now everything a couple wanted to send arrived somewhere else. The
--  seating chart their aunt made, the invitation PDF, the photo of the hall
--  they liked, the guest list their mother typed into Word — all of it lands
--  in WhatsApp, gets scrolled past, and is gone by the week of the wedding.
--  The moodboard is not the answer: it takes images only, and it exists to
--  agree on a look, not to hold a document somebody has to open in the hall.
--
--  So: one shared folder per event. Both sides put things in it, both sides
--  see everything in it. Deliberately symmetric — a file one side cannot see
--  is not a shared folder, it is two folders and a misunderstanding. Anything
--  genuinely producer-only already has a home: costs live in budget_items,
--  crew in crew, and the signed agreement in contracts.
-- ============================================================================

alter type notice_kind add value if not exists 'file';


-- ── the bucket ──────────────────────────────────────────────────────────────
--  Private, and laid out the same way the moodboard bucket is: the first path
--  segment is the workspace, which is what the storage policies read to decide
--  who may touch the object. storage_client_id() answers null for a path that
--  is not a uuid folder, and can_read_client() answers false rather than
--  raising for a null id — so a file dropped at the root of the bucket belongs
--  to nobody and is reachable by nobody.
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do update set public = false;

drop policy if exists client_files_objects_read on storage.objects;
create policy client_files_objects_read on storage.objects for select
  using (bucket_id = 'files' and public.can_read_client(public.storage_client_id(name)));

drop policy if exists client_files_objects_write on storage.objects;
create policy client_files_objects_write on storage.objects for insert
  with check (bucket_id = 'files' and public.can_read_client(public.storage_client_id(name)));

drop policy if exists client_files_objects_update on storage.objects;
create policy client_files_objects_update on storage.objects for update
  using (bucket_id = 'files' and public.can_read_client(public.storage_client_id(name)));

drop policy if exists client_files_objects_delete on storage.objects;
create policy client_files_objects_delete on storage.objects for delete
  using (bucket_id = 'files' and public.can_read_client(public.storage_client_id(name)));


-- ── the record of what is in it ─────────────────────────────────────────────
--  The object store holds bytes under a generated name. This holds what the
--  file was called when somebody chose it, who put it there, and what they
--  said about it — none of which survives a path.
create table if not exists public.client_files (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  name        text not null,
  path        text not null unique,
  mime        text not null default '',
  size_bytes  bigint not null default 0,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  constraint client_files_name_len check (char_length(btrim(name)) between 1 and 200),
  constraint client_files_note_len check (char_length(note) <= 300),
  /* 50MB. Large enough for a venue plan or a long PDF, small enough that a
     phone video does not become the platform's storage bill by accident. The
     screen refuses first and says why; this is the floor under it. */
  constraint client_files_size check (size_bytes between 0 and 52428800)
);
create index if not exists client_files_client_idx
  on public.client_files (client_id, created_at desc);

alter table public.client_files enable row level security;

drop policy if exists client_files_read on public.client_files;
create policy client_files_read on public.client_files for select
  using (public.can_read_client(client_id));

/* Signing your own name, the same rule the thread uses. Without it a couple
   could file something as the producer, and the one thing this table is for is
   knowing where a document came from. */
drop policy if exists client_files_write on public.client_files;
create policy client_files_write on public.client_files for insert
  with check (public.can_read_client(client_id) and uploaded_by = auth.uid());

/* The note is the only thing worth changing after the fact. Renaming the path
   would point the row at somebody else's object, so the path is not editable
   and neither is the workspace it belongs to. */
drop policy if exists client_files_update on public.client_files;
create policy client_files_update on public.client_files for update
  using (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

create or replace function public.client_files_immutable() returns trigger
language plpgsql as $$
begin
  new.client_id   := old.client_id;
  new.path        := old.path;
  new.uploaded_by := old.uploaded_by;
  new.mime        := old.mime;
  new.size_bytes  := old.size_bytes;
  new.created_at  := old.created_at;
  return new;
end $$;

drop trigger if exists client_files_keep_provenance on public.client_files;
create trigger client_files_keep_provenance before update on public.client_files
  for each row execute function public.client_files_immutable();

/* Whoever put it there may take it back, and the producer who owns the event
   may clear anything from their own folder — a wrong file sitting on an event
   for six months is the producer's problem to fix, not a support ticket. */
drop policy if exists client_files_delete on public.client_files;
create policy client_files_delete on public.client_files for delete
  using (
    uploaded_by = auth.uid()
    or public.client_producer_profile(client_id) = auth.uid()
    or public.is_super_admin()
  );


-- ── telling the other side ──────────────────────────────────────────────────
--  A file nobody is told about is a file nobody opens. Same shape as the
--  thread's notice: whoever did it is not told they did it.
create or replace function public.notify_new_file() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who      uuid;
  producer uuid;
  author   text;
begin
  select coalesce(nullif(btrim(full_name), ''), email) into author
    from public.profiles where id = new.uploaded_by;

  producer := public.client_producer_profile(new.client_id);
  if producer is not null and producer is distinct from new.uploaded_by then
    perform public.notify(producer, 'file', coalesce(author, 'קובץ חדש'),
                          new.name, '/app/clients/' || new.client_id || '?tab=files');
  end if;

  for who in select public.client_couple_profiles(new.client_id) loop
    if who is distinct from new.uploaded_by then
      perform public.notify(who, 'file', coalesce(author, 'קובץ חדש'),
                            new.name, '/app/portal');
    end if;
  end loop;

  return new;
end $$;

drop trigger if exists client_files_notify on public.client_files;
create trigger client_files_notify after insert on public.client_files
  for each row execute function public.notify_new_file();


-- ── live, like everything else ──────────────────────────────────────────────
alter table public.client_files replica identity full;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_files'
  ) then
    alter publication supabase_realtime add table public.client_files;
  end if;
end $$;

grant all on public.client_files to authenticated, service_role;
