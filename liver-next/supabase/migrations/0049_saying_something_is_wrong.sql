-- ============================================================================
--  0049 — saying something is wrong
-- ============================================================================
--  A couple could already tell their producer that something looked off; it
--  lands as a message on the event. Nobody could tell the platform. A button
--  that did not open, a screen that came up blank, a number that did not add
--  up: all of it went to WhatsApp, or nowhere.
--
--  One table, written by whoever is signed in, read by the person who wrote
--  it and by the root account that answers it. The screenshot goes to a
--  private bucket under the reporter's own folder, and the mail that goes out
--  carries a signed link to it rather than the file.
-- ============================================================================

alter type notice_kind add value if not exists 'ticket';

create table if not exists public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid references public.profiles(id) on delete set null,
  producer_id     uuid references public.producers(id) on delete set null,
  category        text not null default 'other',
  body            text not null,
  route           text not null default '',
  agent           text not null default '',
  screenshot_path text,
  status          text not null default 'open',
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  constraint support_tickets_category check (category in ('visual', 'auth', 'data', 'other')),
  constraint support_tickets_status   check (status in ('open', 'closed')),
  constraint support_tickets_body_len check (char_length(btrim(body)) between 2 and 2000),
  constraint support_tickets_route_len check (char_length(route) <= 300),
  constraint support_tickets_agent_len check (char_length(agent) <= 400)
);

create index if not exists support_tickets_open_idx
  on public.support_tickets (status, created_at desc);

alter table public.support_tickets enable row level security;

/* Signing your own name. A ticket filed as somebody else is a ticket the
   answer goes to the wrong person about. */
drop policy if exists support_tickets_write on public.support_tickets;
create policy support_tickets_write on public.support_tickets for insert
  with check (reporter_id = auth.uid());

drop policy if exists support_tickets_read on public.support_tickets;
create policy support_tickets_read on public.support_tickets for select
  using (reporter_id = auth.uid() or public.is_super_admin());

/* Only the account that answers tickets may close one. */
drop policy if exists support_tickets_update on public.support_tickets;
create policy support_tickets_update on public.support_tickets for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

grant all on public.support_tickets to authenticated, service_role;


-- ── the screenshot ──────────────────────────────────────────────────────────
--  Private. The folder is the reporter, the same rule the avatars use, and the
--  root account may read any of them because it is the one that looks.
insert into storage.buckets (id, name, public)
values ('support', 'support', false)
on conflict (id) do update set public = false;

drop policy if exists support_objects_read on storage.objects;
create policy support_objects_read on storage.objects for select
  using (
    bucket_id = 'support'
    and (public.storage_owner_id(name) = auth.uid() or public.is_super_admin())
  );

drop policy if exists support_objects_write on storage.objects;
create policy support_objects_write on storage.objects for insert
  with check (bucket_id = 'support' and public.storage_owner_id(name) = auth.uid());

drop policy if exists support_objects_delete on storage.objects;
create policy support_objects_delete on storage.objects for delete
  using (
    bucket_id = 'support'
    and (public.storage_owner_id(name) = auth.uid() or public.is_super_admin())
  );


-- ── the bell rings for the account that answers ─────────────────────────────
--  Mail can be missed; the bell inside the console cannot, and it is where the
--  root account already is. The reporter is not told they reported.
create or replace function public.notify_new_ticket() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  root_id uuid;
  author  text;
begin
  select p.id into root_id
    from public.profiles p
   where lower(p.email) = public.root_admin_email()
   limit 1;

  if root_id is null or root_id = new.reporter_id then
    return new;
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), p.email) into author
    from public.profiles p where p.id = new.reporter_id;

  perform public.notify(root_id, 'ticket', coalesce(author, 'דיווח חדש'),
                        left(new.body, 120), '/app/admin/tickets');
  return new;
end $$;

drop trigger if exists support_tickets_notify on public.support_tickets;
create trigger support_tickets_notify after insert on public.support_tickets
  for each row execute function public.notify_new_ticket();
