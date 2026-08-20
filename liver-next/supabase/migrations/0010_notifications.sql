-- ============================================================================
--  0010 — knowing something happened without opening every screen
-- ============================================================================
--  Everything built so far is only seen by somebody who goes looking. A lead
--  arrives, a guest replies, the couple adds a task, a payment is marked
--  settled — and none of it surfaces until the right screen is opened.
--
--  Notifications are written by database triggers rather than by the actions
--  that happen to perform these writes today. An action can be bypassed by an
--  import, a fix applied by hand, or a second code path added later; a trigger
--  cannot. If the row lands, the people who care are told.
-- ============================================================================

do $$ begin
  create type notice_kind as enum ('lead','rsvp','task','payment','invite');
exception when duplicate_object then null; end $$;

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind       notice_kind not null,
  title      text not null,
  body       text not null default '',
  href       text not null default '',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_inbox_idx
  on public.notifications(profile_id, read_at, created_at desc);

alter table public.notifications enable row level security;

-- yours and nobody else's, and the only thing you may change is having read it
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select
  using (profile_id = auth.uid());

drop policy if exists notifications_mark on public.notifications;
create policy notifications_mark on public.notifications for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists notifications_clear on public.notifications;
create policy notifications_clear on public.notifications for delete
  using (profile_id = auth.uid());

-- nobody writes their own notifications; the triggers below do
create or replace function public.notify(
  p_profile uuid, p_kind notice_kind, p_title text, p_body text, p_href text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_profile is null then return; end if;
  insert into public.notifications (profile_id, kind, title, body, href)
  values (p_profile, p_kind, p_title, coalesce(p_body,''), coalesce(p_href,''));
end $$;

-- ── who cares about a given workspace ───────────────────────────────────────
create or replace function public.client_producer_profile(cid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select pr.owner_id from public.clients c join public.producers pr on pr.id = c.producer_id
   where c.id = cid
$$;

create or replace function public.client_couple_profiles(cid uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select e.profile_id from public.client_authorized_emails e
   where e.client_id = cid and e.profile_id is not null
$$;

-- ── a new enquiry ───────────────────────────────────────────────────────────
create or replace function public.notify_new_lead() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid;
begin
  select owner_id into who from public.producers where id = new.producer_id;
  perform public.notify(who, 'lead', 'פנייה חדשה מהאתר',
    new.full_name || coalesce(' · ' || nullif(new.phone,''), ''), '/app/leads');
  return new;
end $$;
drop trigger if exists leads_notify on public.leads;
create trigger leads_notify after insert on public.leads
  for each row execute function public.notify_new_lead();

-- ── a guest answers ─────────────────────────────────────────────────────────
--  Only when the answer actually changes, so editing a phone number on a
--  guest does not tell everybody they replied again.
create or replace function public.notify_rsvp() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid; msg text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'pending' then return new; end if;

  msg := new.full_name || ' · ' ||
         case when new.status = 'attending'
              then 'מגיעים' || ' (' || new.party_size || ')'
              else 'לא מגיעים' end;

  perform public.notify(public.client_producer_profile(new.client_id), 'rsvp', 'אישור הגעה', msg, '/app/clients/' || new.client_id);
  for who in select public.client_couple_profiles(new.client_id) loop
    perform public.notify(who, 'rsvp', 'אישור הגעה', msg, '/app/portal');
  end loop;
  return new;
end $$;
drop trigger if exists guests_notify on public.guests_rsvp;
create trigger guests_notify after insert or update on public.guests_rsvp
  for each row execute function public.notify_rsvp();

-- ── the other side adds a task ──────────────────────────────────────────────
create or replace function public.notify_task() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid; prod uuid;
begin
  prod := public.client_producer_profile(new.client_id);
  -- tell everybody on the workspace except whoever just wrote it
  if prod is distinct from new.created_by then
    perform public.notify(prod, 'task', 'משימה חדשה', new.title, '/app/clients/' || new.client_id);
  end if;
  for who in select public.client_couple_profiles(new.client_id) loop
    if who is distinct from new.created_by then
      perform public.notify(who, 'task', 'משימה חדשה', new.title, '/app/portal');
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists tasks_notify on public.tasks;
create trigger tasks_notify after insert on public.tasks
  for each row execute function public.notify_task();

-- ── a payment is settled ────────────────────────────────────────────────────
create or replace function public.notify_payment() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid;
begin
  if not new.paid or (tg_op = 'UPDATE' and old.paid) then
    return new;
  end if;
  for who in select public.client_couple_profiles(new.client_id) loop
    perform public.notify(who, 'payment', 'תשלום נרשם',
      new.title || ' · ₪' || trim(to_char(new.amount, 'FM999,999,999')), '/app/portal');
  end loop;
  return new;
end $$;
drop trigger if exists payments_notify on public.payments;
create trigger payments_notify after insert or update on public.payments
  for each row execute function public.notify_payment();

-- ── an address is authorised on a workspace ─────────────────────────────────
--  An address is usually authorised before that person has an account, so
--  profile_id is null at insert and filled in later, when they sign up and
--  handle_new_user binds them. Firing on insert alone meant the couple this
--  notice exists for were the one group who never received it.
create or replace function public.notify_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.profile_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.profile_id is not distinct from new.profile_id then
    return new;
  end if;

  perform public.notify(new.profile_id, 'invite', 'נפתח לכם אזור אישי',
    (select display_name from public.clients where id = new.client_id), '/app/portal');
  return new;
end $$;
drop trigger if exists cae_notify on public.client_authorized_emails;
create trigger cae_notify after insert or update on public.client_authorized_emails
  for each row execute function public.notify_invite();
