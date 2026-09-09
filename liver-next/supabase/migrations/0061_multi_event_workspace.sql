-- ============================================================================
--  0061 — a workspace holds multiple events, and every event is a checklist
-- ============================================================================
--  A couple planning may have more than one celebration: a henna, a bachelor
--  party, a wedding, a post-party. Each has its own date, location, guest
--  list, budget and checklist. Today everything is forced into one event row,
--  and couples working on multiple occasions are second-class.
--
--  This migration splits: the workspace (clients table) becomes the container
--  for a couple's season, and events become the individual celebrations.
--  Tasks, guests, seating, budget and day_schedule move to being per-event.
--
--  Everything existing becomes one event under the workspace, dated as the
--  workspace was and located where the workspace said.
-- ============================================================================

-- ── new table: event_types, a registry of what a celebration can be ────────
create table if not exists public.event_types (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  name       text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

insert into public.event_types (key, name, description) values
  ('wedding', 'חתונה', 'The primary celebration'),
  ('henna', 'חינה', 'Pre-wedding henna party'),
  ('groom_party', 'שבת חתן', 'Groom or groom and bride party'),
  ('rehearsal', 'חזרה', 'Rehearsal dinner'),
  ('post_party', 'ארוחת הערב', 'Post-wedding celebration'),
  /* Not a celebration anybody adds from the portal, but a workspace kind that
     already exists. The seed below reads clients.kind, which is the
     event_class enum — 'wedding' or 'corporate' — straight into this table's
     foreign key. Without a row here, one corporate client on the books makes
     that insert fail and takes the whole migration down with it, on precisely
     the databases that have the most in them. */
  ('corporate', 'אירוע חברה', 'A company event rather than a wedding')
on conflict (key) do nothing;

-- ── new table: events, the unit of planning ────────────────────────────────
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  event_type   text not null references public.event_types(key),
  display_name text not null,
  event_date   date,
  location     text not null default '',
  guest_estimate int,
  created_at   timestamptz not null default now(),
  constraint events_date_2026 check (event_date is null or event_date >= date '2026-01-01')
);

create index if not exists events_client_idx on public.events(client_id, event_date);
create index if not exists events_type_idx on public.events(event_type);

-- ── clients: migrate venue and event_date to the primary event ─────────────
--  These columns stay on clients because they may be queried for sorting or
--  filtering the workspace list. They represent the workspace's primary event,
--  which is almost always the wedding. The production book and timelines read
--  from the primary event; so does the portal workspace card.

-- Migrate existing data: every client becomes one event of their kind
insert into public.events (client_id, event_type, display_name, event_date, location)
select id, kind::text, display_name, event_date, venue
from public.clients
where not exists (select 1 from public.events where events.client_id = clients.id)
on conflict do nothing;

-- ── task table: add event_id, and a category beside phase ──────────────────
alter table public.tasks add column if not exists event_id uuid references public.events(id) on delete cascade;
alter table public.tasks add column if not exists category text not null default '';

-- For existing tasks, assign them to the primary (wedding) event of their client
update public.tasks set event_id = (
  select e.id from public.events e
  where e.client_id = tasks.client_id
  order by (e.event_type <> 'wedding'), e.created_at limit 1
)
where event_id is null and client_id in (select id from public.clients);


/* `phase` stays. An earlier draft of this migration dropped it here, on the
   theory that `category` replaces it. Two things were wrong with that.

   The first is that it destroys data. A DROP COLUMN is DDL, so it lands in
   sync.sql, which the agent runs over the live database on every single
   release — and nothing in this file copies the column anywhere before
   removing it. Every task on every wedding ever run would have lost the
   checklist heading it was filed under, silently, with the backup taken
   moments earlier being the only copy left.

   The second is that they are not the same field. `phase` is the group a task
   sits under on the producer's standing checklist, written in Hebrew and set
   by createClient. `category` is which kind of supplier a task books, from a
   fixed list, and it is what decides whether ticking the task opens the vendor
   form. Folding one into the other would put 'אורחים' where 'venue' belongs.

   So both columns exist, holding the two different things they hold. If phase
   is ever genuinely finished with, retiring it is its own change, made after a
   release has proved nothing writes it — not a line inside a migration about
   something else. */

-- Index for the new column
create index if not exists tasks_event_idx on public.tasks(event_id, done, sort_order);

-- ── guests_rsvp: ties to an event ──────────────────────────────────────────
alter table public.guests_rsvp add column if not exists event_id uuid references public.events(id) on delete cascade;

update public.guests_rsvp set event_id = (
  select e.id from public.events e
  where e.client_id = guests_rsvp.client_id
  order by (e.event_type <> 'wedding'), e.created_at limit 1
)
where event_id is null and client_id in (select id from public.clients);

create index if not exists guests_event_idx on public.guests_rsvp(event_id, status);

-- ── tables_seating: ties to an event ───────────────────────────────────────
alter table public.tables_seating add column if not exists event_id uuid references public.events(id) on delete cascade;

update public.tables_seating set event_id = (
  select e.id from public.events e
  where e.client_id = tables_seating.client_id
  order by (e.event_type <> 'wedding'), e.created_at limit 1
)
where event_id is null and client_id in (select id from public.clients);

create index if not exists tables_event_idx on public.tables_seating(event_id);

-- ── day_schedule: ties to an event ─────────────────────────────────────────
alter table public.day_schedule add column if not exists event_id uuid references public.events(id) on delete cascade;

update public.day_schedule set event_id = (
  select e.id from public.events e
  where e.client_id = day_schedule.client_id
  order by (e.event_type <> 'wedding'), e.created_at limit 1
)
where event_id is null and client_id in (select id from public.clients);

create index if not exists day_event_idx on public.day_schedule(event_id, at_time);

-- ── budget_items: ties to an event ────────────────────────────────────────
alter table public.budget_items add column if not exists event_id uuid references public.events(id) on delete cascade;

update public.budget_items set event_id = (
  select e.id from public.events e
  where e.client_id = budget_items.client_id
  order by (e.event_type <> 'wedding'), e.created_at limit 1
)
where event_id is null and client_id in (select id from public.clients);

create index if not exists budget_event_idx on public.budget_items(event_id);

-- ── venue_comparisons: ties to an event ────────────────────────────────────
alter table public.venue_comparisons add column if not exists event_id uuid references public.events(id) on delete cascade;

update public.venue_comparisons set event_id = (
  select e.id from public.events e
  where e.client_id = venue_comparisons.client_id
  order by (e.event_type <> 'wedding'), e.created_at limit 1
)
where event_id is null and client_id in (select id from public.clients);

create index if not exists venue_comparisons_event_idx on public.venue_comparisons(event_id);

-- ── RLS: events inherit workspace permissions ──────────────────────────────
alter table public.events enable row level security;

drop policy if exists events_read on public.events;
create policy events_read on public.events for select
  using (public.can_read_client(client_id));

drop policy if exists events_write on public.events;
create policy events_write on public.events for all
  using (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

-- Couple and producer may both create events, but cannot edit each other's
drop policy if exists events_create_couple on public.events;
create policy events_create_couple on public.events for insert
  with check (
    public.can_read_client(client_id)
    and (auth.uid() in (select profile_id from public.client_authorized_emails where client_id = events.client_id)
         or public.owns_producer((select producer_id from public.clients where id = events.client_id)))
  );

-- ── comments ───────────────────────────────────────────────────────────────
comment on table public.events is
  'One celebration in a couple''s season. A workspace (clients) may hold '
  'multiple events — a henna, a wedding, a post-party. Each has its own date, '
  'location, guest list and checklist. The workspace''s event_date and venue '
  'reflect the primary (usually wedding) event.';

comment on column public.events.event_type is
  'The kind of celebration: wedding, henna, etc. Determines which task '
  'templates are offered and which features apply.';

comment on column public.tasks.event_id is
  'The event this task belongs to. Allows one workspace to checklist multiple '
  'celebrations without mixing them.';

comment on column public.guests_rsvp.event_id is
  'The event this guest''s RSVP applies to. A guest may attend multiple events.';

comment on column public.tables_seating.event_id is
  'The event this seating plan applies to.';

comment on column public.day_schedule.event_id is
  'The event this schedule entry applies to.';

comment on column public.budget_items.event_id is
  'The event this budget line applies to.';

comment on column public.venue_comparisons.event_id is
  'The event this venue comparison applies to.';
