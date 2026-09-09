-- ============================================================================
--  0018 — a thread per event, so the planning stops living in WhatsApp
-- ============================================================================
--  Right now every decision about an event is agreed somewhere else and then
--  half-remembered here. Which is fine until somebody needs to know what was
--  actually said about the chuppah, and the answer is three months up a chat
--  that also contains two other weddings and a plumber.
--
--  So: one thread attached to the event, readable by exactly the people the
--  event is already readable by. Nothing clever — a record that stays with the
--  thing it is about.
-- ============================================================================

-- ── a kind of notification for it ───────────────────────────────────────────
--  Adding an enum value inside a transaction is allowed on PostgreSQL 12 and
--  up; what is not allowed is *using* the new value in that same transaction.
--  A plpgsql body is not resolved when the function is created, only when it
--  runs, and nothing here inserts a notification during setup — so the trigger
--  below can name 'message' and still be created in the same script. Checked
--  against a real server rather than assumed, because getting this wrong is
--  how the enum block broke the whole schema once already.
alter type notice_kind add value if not exists 'message';

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_len check (char_length(btrim(body)) between 1 and 4000)
);
create index if not exists messages_client_idx on public.messages (client_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select
  using (public.can_read_client(client_id));

/* Writing requires being on the workspace *and* signing your own name. Without
   the second half a couple could post as the producer, which is worth ruling
   out in the database rather than trusting every future screen to get right. */
drop policy if exists messages_write on public.messages;
create policy messages_write on public.messages for insert
  with check (public.can_read_client(client_id) and author_id = auth.uid());

/* No update policy at all, deliberately. A thread people rely on is a record;
   silently editing what was said three weeks ago is worse than being wrong in
   public. Removing your own message is allowed — that is a retraction, and it
   is visibly gone rather than quietly different. */
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete
  using (author_id = auth.uid() or public.is_super_admin());


-- ── how far each person has read ────────────────────────────────────────────
--  One row per person per thread rather than a flag per message: the question
--  being asked is "is there anything new for me", and a timestamp answers it
--  in one comparison however long the thread gets.
create table if not exists public.message_reads (
  client_id    uuid not null references public.clients(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (client_id, profile_id)
);

alter table public.message_reads enable row level security;

drop policy if exists message_reads_own on public.message_reads;
create policy message_reads_own on public.message_reads for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and public.can_read_client(client_id));

/* Marking read is an upsert from a screen that just rendered the thread, so it
   gets a function rather than making every caller write the conflict clause. */
create or replace function public.mark_thread_read(p_client uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.can_read_client(p_client) then
    return;
  end if;
  insert into public.message_reads (client_id, profile_id, last_read_at)
  values (p_client, auth.uid(), now())
  on conflict (client_id, profile_id) do update set last_read_at = now();
end $$;

revoke all on function public.mark_thread_read(uuid) from public;
grant execute on function public.mark_thread_read(uuid) to authenticated, service_role;


-- ── telling the other side ──────────────────────────────────────────────────
create or replace function public.notify_new_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who      uuid;
  producer uuid;
  author   text;
  preview  text;
begin
  select coalesce(nullif(btrim(full_name), ''), email) into author
    from public.profiles where id = new.author_id;

  /* A message is short by nature, but not always. The notification carries
     enough to decide whether to open it and no more. */
  preview := left(btrim(new.body), 140);
  if char_length(btrim(new.body)) > 140 then preview := preview || '…'; end if;

  producer := public.client_producer_profile(new.client_id);
  if producer is not null and producer <> new.author_id then
    perform public.notify(producer, 'message', coalesce(author, 'הודעה חדשה'),
                          preview, '/app/clients/' || new.client_id);
  end if;

  for who in select public.client_couple_profiles(new.client_id) loop
    if who <> new.author_id then
      perform public.notify(who, 'message', coalesce(author, 'הודעה חדשה'),
                            preview, '/app/portal');
    end if;
  end loop;

  return new;
end $$;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_new_message();


-- ── live, like everything else ──────────────────────────────────────────────
alter table public.messages replica identity full;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

grant all on public.messages, public.message_reads to authenticated, service_role;


-- ── who is in this thread ───────────────────────────────────────────────────
--  profiles is self-read only, which is right: it carries the email address
--  and the role, and neither is anybody else's business. But a thread signed
--  "—" is not a thread, and the couple is supposed to see the face of the
--  person walking them through this.
--
--  So there is one narrow way through. It returns a display name and a picture
--  and nothing else — no email address, no role — and only for the people on a
--  workspace the caller can already read. Asked about anything else it returns
--  nothing at all.
create or replace function public.thread_people(p_client uuid)
returns table (id uuid, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)),
         p.avatar_url
    from public.profiles p
   where public.can_read_client(p_client)
     and (
       p.id = public.client_producer_profile(p_client)
       or p.id in (select public.client_couple_profiles(p_client))
     )
$$;

revoke all on function public.thread_people(uuid) from public;
grant execute on function public.thread_people(uuid) to authenticated, service_role;
