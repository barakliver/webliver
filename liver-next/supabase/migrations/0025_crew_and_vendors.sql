-- ============================================================================
--  0025 — the people who make the evening happen
-- ============================================================================
--  Everything in this platform so far is about the couple and their guests.
--  None of it is about the twenty other people who have to be somewhere at a
--  particular time with particular equipment, which is most of what a producer
--  actually spends the week doing.
--
--  Two different things, deliberately kept apart:
--
--  A vendor is a business the producer works with repeatedly. The florist who
--  was good last August is the same florist next August, and re-typing their
--  number for every event is how a phone number ends up wrong on the one sheet
--  somebody needed it on. So vendors belong to the producer, not to an event,
--  and an event books one.
--
--  Crew are the people working a specific evening. They are per event by
--  nature: the same person is a stage manager one week and nowhere the next,
--  and what matters about them is the call time and the phone number, not a
--  relationship to maintain.
--
--  Both are producer-only, and not by omission. `can_read_client` deliberately
--  does not appear below: a couple who can see which supplier was chosen and
--  what the crew is paid is a couple negotiating with the producer's costs on
--  the table, and that is the one boundary this business asked for by name.
-- ============================================================================

do $$ begin create type vendor_state as enum ('shortlist','booked','cancelled');
  exception when duplicate_object then null; end $$;


-- ── the producer's own directory ────────────────────────────────────────────
create table if not exists public.vendors (
  id           uuid primary key default gen_random_uuid(),
  producer_id  uuid not null references public.producers(id) on delete cascade,
  name         text not null,
  category     text not null default '',
  contact_name text not null default '',
  phone        text not null default '',
  email        text not null default '',
  area         text not null default '',
  notes        text not null default '',
  /* Retired rather than deleted. A vendor who is no longer used still appears
     on last year's events, and deleting the row would blank the supplier on a
     finished file rather than tidy anything. */
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint vendors_named check (btrim(name) <> '')
);

create index if not exists vendors_producer_idx
  on public.vendors (producer_id, category, name);

/* One business, once. Two rows for the same florist means two phone numbers,
   and the wrong one is always the one that gets called. Case folded, because
   nobody types a supplier's name the same way twice. */
create unique index if not exists vendors_producer_name_key
  on public.vendors (producer_id, lower(btrim(name)));

comment on table public.vendors is
  'Businesses a producer works with repeatedly. Producer-only: never readable by a couple.';


-- ── a vendor on one event ───────────────────────────────────────────────────
create table if not exists public.event_vendors (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  /* Nullable on purpose. Half the suppliers on an event are booked once and
     never again, and forcing every one of them into the directory first is the
     step that makes somebody write it on paper instead. */
  vendor_id  uuid references public.vendors(id) on delete set null,
  /* Written down at the moment of booking rather than read through the link.
     A directory entry renamed or retired next year must not rewrite what an
     old event says happened. */
  name       text not null,
  category   text not null default '',
  phone      text not null default '',
  status     vendor_state not null default 'shortlist',
  call_time  time,
  notes      text not null default '',
  created_at timestamptz not null default now(),
  constraint event_vendors_named check (btrim(name) <> '')
);

create index if not exists event_vendors_client_idx
  on public.event_vendors (client_id, status, category);

comment on table public.event_vendors is
  'A supplier booked on one event. Producer-only. Money lives in budget_items, '
  'which links here, so an agreed figure has exactly one home.';

/* Money has one home, and it is the budget. An `agreed` column here as well
   would drift from it within a week, and the two would disagree in front of a
   client. The link runs this way round so a budget line can name the supplier
   it belongs to without the supplier owning a second copy of the number. */
alter table public.budget_items
  add column if not exists event_vendor_id uuid references public.event_vendors(id) on delete set null;

create index if not exists budget_items_vendor_idx
  on public.budget_items (event_vendor_id) where event_vendor_id is not null;


-- ── who is working that evening ─────────────────────────────────────────────
create table if not exists public.crew (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  /* Set when the person has an account here; most of the time they do not. */
  profile_id uuid references public.profiles(id) on delete set null,
  name       text not null,
  role       text not null default '',
  phone      text not null default '',
  call_time  time,
  /* What this person is paid for the evening. Producer-only, like the row it
     sits on, and never summed into anything the couple can see. */
  fee        numeric(12,2) check (fee is null or fee >= 0),
  notes      text not null default '',
  created_at timestamptz not null default now(),
  constraint crew_named check (btrim(name) <> '')
);

create index if not exists crew_client_idx on public.crew (client_id, call_time);

comment on table public.crew is
  'People working one event, with call times and fees. Producer-only, by design '
  'rather than by omission: see 0025.';


-- ── who may see any of it ───────────────────────────────────────────────────
alter table public.vendors       enable row level security;
alter table public.event_vendors enable row level security;
alter table public.crew          enable row level security;

drop policy if exists vendors_all on public.vendors;
create policy vendors_all on public.vendors for all
  using      (public.owns_producer(producer_id) or public.is_super_admin())
  with check (public.owns_producer(producer_id) or public.is_super_admin());

/* owns_producer rather than can_read_client, which is the whole point: a
   couple is on the workspace and still gets nothing back from these tables. */
drop policy if exists event_vendors_all on public.event_vendors;
create policy event_vendors_all on public.event_vendors for all
  using      (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin())
  with check (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin());

drop policy if exists crew_all on public.crew;
create policy crew_all on public.crew for all
  using      (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin())
  with check (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin());

grant select, insert, update, delete on public.vendors, public.event_vendors, public.crew
  to authenticated;
grant select, insert, update, delete on public.vendors, public.event_vendors, public.crew
  to service_role;


-- ── booking a directory vendor onto an event ────────────────────────────────
--  A copy rather than a reference, for the reason on the table above. Doing it
--  in the database rather than in the app means the copy is taken the same way
--  from every screen that ever books one.
create or replace function public.book_vendor(p_client uuid, p_vendor uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v record; v_id uuid;
begin
  if not public.owns_producer(public.producer_of_client(p_client))
     and not public.is_super_admin() then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  select * into v from public.vendors
   where id = p_vendor
     and (public.owns_producer(producer_id) or public.is_super_admin());
  if not found then
    raise exception 'הספק לא נמצא' using errcode = 'no_data_found';
  end if;

  /* Already on this event. Answer with the row that exists rather than adding
     a second card for the same florist. */
  select id into v_id from public.event_vendors
   where client_id = p_client and vendor_id = p_vendor limit 1;
  if found then return v_id; end if;

  insert into public.event_vendors (client_id, vendor_id, name, category, phone, status)
  values (p_client, v.id, v.name, v.category, v.phone, 'shortlist')
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.book_vendor(uuid, uuid) from public;
grant execute on function public.book_vendor(uuid, uuid) to authenticated, service_role;


-- ── live, like everything else two people edit at once ──────────────────────
do $$
declare t text; live_tables text[] := array['vendors','event_vendors','crew'];
begin
  foreach t in array live_tables loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
