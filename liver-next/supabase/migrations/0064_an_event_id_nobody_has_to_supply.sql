-- ============================================================================
--  0064 — an event_id nobody has to supply
-- ============================================================================
--  0061 gave six tables an event_id and made every one of them not null. That
--  was written as though the application already knew about events. It does
--  not: adding a task, a guest, a table, a schedule row, a budget line or a
--  hall to compare goes through nine insert statements, and not one of them
--  names an event. The column was not null from the moment the migration ran,
--  so every one of those writes would have been refused. A couple adding a
--  guest would have got an error, and nothing on the screen could have told
--  them why.
--
--  The same migration also assumed every workspace is a wedding. It seeds the
--  events table with `select id, kind::text ... from clients`, and clients.kind
--  is the event_class enum — 'wedding' or 'corporate'. There is no 'corporate'
--  row in event_types, so a single corporate client makes that insert fail on
--  a foreign key, and 0061 aborts partway through on exactly the databases
--  that have the most in them.
--
--  This migration is the repair, and it is written to be correct whether or
--  not 0061 ever finished:
--
--    1. corporate becomes a kind of event, so the seed has somewhere to land.
--    2. any workspace still without an event gets one, of its own kind.
--    3. the six columns become nullable again.
--    4. a trigger fills event_id in from the workspace's main event when the
--       writer did not name one, so those nine insert statements keep working
--       and their rows still belong to a celebration.
--
--  Not null can come back once every writer names its event. Until then a
--  constraint the code cannot satisfy is not a safeguard, it is an outage.
-- ============================================================================

-- ── 1. corporate is a kind of event ────────────────────────────────────────
insert into public.event_types (key, name, description) values
  ('corporate', 'אירוע חברה', 'A company event rather than a wedding')
on conflict (key) do nothing;

-- ── 2. every workspace has at least one event ──────────────────────────────
--  Covers both the rows 0061 skipped and any workspace opened since: the
--  client creation path does not make an event yet.
insert into public.events (client_id, event_type, display_name, event_date, location)
select c.id, c.kind::text, c.display_name, c.event_date, c.venue
from public.clients c
where not exists (select 1 from public.events e where e.client_id = c.id);

-- ── 3. the columns become nullable again ───────────────────────────────────
alter table public.tasks             alter column event_id drop not null;
alter table public.guests_rsvp       alter column event_id drop not null;
alter table public.tables_seating    alter column event_id drop not null;
alter table public.day_schedule      alter column event_id drop not null;
alter table public.budget_items      alter column event_id drop not null;
alter table public.venue_comparisons alter column event_id drop not null;

-- ── 4. the workspace's main event, when the writer did not name one ────────
--  The wedding first, then whichever event was opened earliest. That is what
--  every one of these rows meant before events existed, so a writer that has
--  not been taught about events yet keeps producing rows that mean the same
--  thing they used to.
create or replace function public.fill_event_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_id is null then
    select e.id into new.event_id
      from public.events e
     where e.client_id = new.client_id
     order by (e.event_type <> 'wedding'), e.created_at
     limit 1;
  end if;
  return new;
end $$;

comment on function public.fill_event_id() is
  'Fills event_id with the workspace''s main event when an insert does not name '
  'one. Lets writers that predate the events table keep working, and keeps '
  'their rows attached to a celebration rather than floating loose.';

do $$
declare t text;
begin
  foreach t in array array[
    'tasks', 'guests_rsvp', 'tables_seating',
    'day_schedule', 'budget_items', 'venue_comparisons'
  ]
  loop
    execute format('drop trigger if exists fill_event_id on public.%I', t);
    execute format(
      'create trigger fill_event_id before insert on public.%I '
      'for each row execute function public.fill_event_id()', t);
  end loop;
end $$;

-- ── and the rows 0061 could not reach ──────────────────────────────────────
--  0061 matched only on event_type = 'wedding', so a corporate workspace's
--  rows were left null and then refused by the not null it added next. Now
--  that every workspace has an event, they can be pointed at it.
update public.tasks t set event_id = (
  select e.id from public.events e where e.client_id = t.client_id
   order by (e.event_type <> 'wedding'), e.created_at limit 1)
 where t.event_id is null;

update public.guests_rsvp g set event_id = (
  select e.id from public.events e where e.client_id = g.client_id
   order by (e.event_type <> 'wedding'), e.created_at limit 1)
 where g.event_id is null;

update public.tables_seating s set event_id = (
  select e.id from public.events e where e.client_id = s.client_id
   order by (e.event_type <> 'wedding'), e.created_at limit 1)
 where s.event_id is null;

update public.day_schedule d set event_id = (
  select e.id from public.events e where e.client_id = d.client_id
   order by (e.event_type <> 'wedding'), e.created_at limit 1)
 where d.event_id is null;

update public.budget_items b set event_id = (
  select e.id from public.events e where e.client_id = b.client_id
   order by (e.event_type <> 'wedding'), e.created_at limit 1)
 where b.event_id is null;

update public.venue_comparisons v set event_id = (
  select e.id from public.events e where e.client_id = v.client_id
   order by (e.event_type <> 'wedding'), e.created_at limit 1)
 where v.event_id is null;
