-- ============================================================================
--  0077 — the diary has its own entries, and a Google twin
-- ============================================================================
--  The calendar showed what other screens had put on it: weddings, tasks,
--  payments. It had no way to take a thing of its own, so "site visit with
--  the florist, Tuesday at ten" went into the phone's calendar instead, and
--  the two diaries drifted apart. And the phone's calendar could only
--  subscribe to this one, read-only, refreshing when it felt like it.
--
--  Three tables. diary_entries is the producer's own: a title on a day, with
--  a time when it has one, tied to an event when there is one. The other two
--  are the machinery of a two-way Google Calendar link: google_calendars
--  holds one row per connected producer with the tokens and the calendar
--  Google gave us, and google_links remembers which Google event stands for
--  which row here, so a change on either side finds its twin.
--
--  The tokens are written and read by the server alone. The producer's own
--  session may see that the link exists and drop it; it cannot read the
--  token columns, because a token that reaches a browser reaches a
--  screenshot. That is done with a view over the row rather than a policy,
--  since a policy cannot hide a column.
--
--  Nothing here touches a row.
-- ============================================================================

-- ── the producer's own entries ──────────────────────────────────────────────
create table if not exists public.diary_entries (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  /* Null for a thing that is nobody's wedding: a supplier meeting, a day off. */
  client_id   uuid references public.clients(id) on delete set null,
  title       text not null,
  on_date     date not null,
  at_time     time,
  /* Minutes, when the entry has a time. Sixty is a meeting. */
  duration_min int not null default 60,
  note        text not null default '',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint diary_entries_title    check (char_length(btrim(title)) between 1 and 160),
  constraint diary_entries_note     check (char_length(note) <= 1000),
  constraint diary_entries_duration check (duration_min between 5 and 1440)
);

alter table public.diary_entries enable row level security;

drop policy if exists diary_entries_own on public.diary_entries;
create policy diary_entries_own on public.diary_entries for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id) and public.is_approved_producer());

grant select, insert, update, delete on public.diary_entries to authenticated;

create index if not exists diary_entries_producer_idx on public.diary_entries (producer_id, on_date);

/* updated_at moves on every change, so the sync can tell a row that changed
   since it last looked from one that did not. */
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists diary_entries_touch on public.diary_entries;
create trigger diary_entries_touch before update on public.diary_entries
  for each row execute function public.touch_updated_at();

comment on table public.diary_entries is
  'The producer''s own diary: a title on a day, a time when it has one, an event when there is one.';


-- ── the Google link ─────────────────────────────────────────────────────────
create table if not exists public.google_calendars (
  producer_id      uuid primary key references public.producers(id) on delete cascade,
  /* The address the tokens act as, so the screen can say whose. */
  email            text not null default '',
  refresh_token    text not null,
  access_token     text not null default '',
  token_expires_at timestamptz,
  /* The secondary calendar this platform created in their Google account.
     Everything we write goes there and only there. */
  calendar_id      text not null default '',
  /* Google's cursor for "what changed since I last asked". */
  sync_token       text,
  connected_at     timestamptz not null default now(),
  last_sync_at     timestamptz,
  last_error       text not null default ''
);

alter table public.google_calendars enable row level security;

/* The row is the server's. A policy that admits nobody, the way
   password_resets is fenced, so the fence is written down rather than
   implied by an absence; the owner reads the harmless columns through the
   view below and disconnects through the function under it. */
drop policy if exists google_calendars_none on public.google_calendars;
create policy google_calendars_none on public.google_calendars for select using (false);
revoke all on public.google_calendars from authenticated, anon;

create or replace view public.my_google_calendar
with (security_invoker = false) as
  select g.producer_id, g.email, g.calendar_id <> '' as ready, g.connected_at, g.last_sync_at, g.last_error
    from public.google_calendars g
   where public.owns_producer(g.producer_id);
grant select on public.my_google_calendar to authenticated;

create or replace function public.disconnect_google_calendar()
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.google_calendars g where public.owns_producer(g.producer_id);
  delete from public.google_links l where public.owns_producer(l.producer_id);
end $$;
revoke all on function public.disconnect_google_calendar() from public;
grant execute on function public.disconnect_google_calendar() to authenticated;

comment on table public.google_calendars is
  'One row per producer who connected Google Calendar: the tokens (server only) and the calendar this platform writes to.';


-- ── which Google event stands for which row ─────────────────────────────────
create table if not exists public.google_links (
  producer_id     uuid not null references public.producers(id) on delete cascade,
  /* event (a wedding''s date), task, payment, entry (a diary entry). */
  kind            text not null,
  item_id         uuid not null,
  google_event_id text not null,
  /* What was last written, so an unchanged row costs no call. */
  fingerprint     text not null default '',
  synced_at       timestamptz not null default now(),
  primary key (producer_id, kind, item_id),
  constraint google_links_kind check (kind in ('event', 'task', 'payment', 'entry'))
);
create unique index if not exists google_links_event_idx on public.google_links (producer_id, google_event_id);

alter table public.google_links enable row level security;
drop policy if exists google_links_none on public.google_links;
create policy google_links_none on public.google_links for select using (false);
revoke all on public.google_links from authenticated, anon;

comment on table public.google_links is
  'The twin of each dated row in the producer''s Google calendar. Server only.';


-- ── the phone's subscription carries the entries too ────────────────────────
--  Same return type as 0071, so a plain replace; the body gains the diary
--  entries in the producer's own feed. The couple's feed is unchanged: an
--  entry is the producer's, and the couple sees only what is on their event
--  through their own screens.
create or replace function public.calendar_by_token(p_token text)
returns table (starts_on date, at_time time, title text, detail text, kind text, remind_days integer)
language plpgsql security definer set search_path = public as $$
declare f record;
begin
  select cf.profile_id, cf.client_id into f
    from public.calendar_feeds cf
   where cf.token = p_token and cf.revoked_at is null
   limit 1;

  if not found then return; end if;

  if f.client_id is null then
    -- the producer's whole diary
    return query
      select c.event_date, null::time, c.display_name,
             coalesce(nullif(c.venue, ''), ''), 'event', null::integer
        from public.clients c
        join public.producers pr on pr.id = c.producer_id
       where pr.owner_id = f.profile_id
         and c.archived_at is null
         and c.event_date is not null;

    return query
      select t.due_on, null::time, t.title, coalesce(c.display_name, ''), 'task', t.remind_days::integer
        from public.tasks t
        join public.clients c on c.id = t.client_id
        join public.producers pr on pr.id = c.producer_id
       where pr.owner_id = f.profile_id
         and c.archived_at is null
         and t.due_on is not null
         and not t.done;

    return query
      select p.due_on, null::time, p.title,
             coalesce(c.display_name, '') ||
               case when p.amount is not null then ' · ₪' || round(p.amount)::text else '' end,
             'payment', null::integer
        from public.payments p
        join public.clients c on c.id = p.client_id
        join public.producers pr on pr.id = c.producer_id
       where pr.owner_id = f.profile_id
         and c.archived_at is null
         and p.due_on is not null
         and not p.paid;

    return query
      select de.on_date, de.at_time, de.title,
             coalesce(c.display_name, '') || case when de.note <> '' then case when c.display_name is null then '' else ' · ' end || de.note else '' end,
             'entry', null::integer
        from public.diary_entries de
        join public.producers pr on pr.id = de.producer_id
        left join public.clients c on c.id = de.client_id
       where pr.owner_id = f.profile_id;

    return;
  end if;

  -- one event, for the couple, exactly as 0071 wrote it: the day, the
  -- schedule, and the open dated tasks the producer shares with them
  return query
    select c.event_date, null::time, c.display_name,
           coalesce(nullif(c.venue, ''), ''), 'event', null::integer
      from public.clients c
     where c.id = f.client_id and c.event_date is not null;

  return query
    select c.event_date, d.at_time, d.title, coalesce(d.note, ''), 'schedule', null::integer
      from public.day_schedule d
      join public.clients c on c.id = d.client_id
     where d.client_id = f.client_id
       and c.event_date is not null;

  return query
    select t.due_on, null::time, t.title, '', 'task', t.remind_days::integer
      from public.tasks t
     where t.client_id = f.client_id
       and t.visible_to_client
       and t.due_on is not null
       and not t.done;
end $$;

revoke all on function public.calendar_by_token(text) from public;
grant execute on function public.calendar_by_token(text) to anon, authenticated, service_role;
