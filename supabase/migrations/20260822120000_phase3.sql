-- ============================================================================
-- Phase 3 — Advanced interactive tool suite
--
-- Extends the existing schema (leads, site_settings) with the tables behind
-- Bride Mode, the RSVP & seating engine, the smart bar estimator, the budget
-- tracker with AI receipt scanning, and the day-of operations exports.
--
-- Safe to re-run: every object is created IF NOT EXISTS / OR REPLACE, and
-- policies are dropped before being recreated.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Anchor tables
--
-- `clients` is one event workspace. It may already exist from an earlier
-- migration; the guarded ALTERs below backfill the columns Phase 3 needs
-- without disturbing existing data.
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id           uuid primary key default gen_random_uuid(),
  producer_id  uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  event_date   date,
  venue        text,
  guest_count  integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.clients add column if not exists event_date  date;
alter table public.clients add column if not exists venue       text;
alter table public.clients add column if not exists guest_count integer;

-- Phase 1 shipped "up to 3 authorized emails per workspace". This is the
-- server-side counterpart: membership drives every RLS policy below.
create table if not exists public.client_members (
  client_id  uuid not null references public.clients (id) on delete cascade,
  email      text not null,
  role       text not null default 'couple' check (role in ('couple', 'planner', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (client_id, email)
);

create index if not exists client_members_email_idx on public.client_members (lower(email));

-- ---------------------------------------------------------------------------
-- Membership helpers
--
-- SECURITY DEFINER so a policy can test membership without the caller needing
-- read access to client_members itself (which would be circular).
-- ---------------------------------------------------------------------------
create or replace function public.is_client_producer(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.producer_id = auth.uid()
  );
$$;

create or replace function public.is_client_member(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_client_producer(p_client_id)
    or exists (
      select 1 from public.client_members m
      where m.client_id = p_client_id
        and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

-- Cap authorized emails at 3 per workspace, matching the Phase 1 client rule.
create or replace function public.enforce_client_member_cap()
returns trigger
language plpgsql
as $$
declare
  n integer;
begin
  select count(*) into n from public.client_members where client_id = new.client_id;
  if n >= 3 then
    raise exception 'A workspace supports at most 3 authorized emails';
  end if;
  return new;
end;
$$;

drop trigger if exists client_members_cap on public.client_members;
create trigger client_members_cap
  before insert on public.client_members
  for each row execute function public.enforce_client_member_cap();

-- Keep updated_at honest on every table that has one.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1 · Bride Mode — the visual moodboard vault
-- ---------------------------------------------------------------------------
create table if not exists public.moodboards (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  category     text not null default 'other'
               check (category in ('chuppah', 'floral', 'table', 'lighting', 'attire', 'other')),
  storage_path text,
  image_url    text not null,
  caption      text,
  tags         text[] not null default '{}',
  position     integer not null default 0,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists moodboards_client_idx     on public.moodboards (client_id, position);
create index if not exists moodboards_category_idx   on public.moodboards (client_id, category);

drop trigger if exists moodboards_touch on public.moodboards;
create trigger moodboards_touch before update on public.moodboards
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2 · RSVP & seating
-- ---------------------------------------------------------------------------
create table if not exists public.tables_seating (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  label      text not null,
  shape      text not null default 'round' check (shape in ('round', 'rectangle', 'head')),
  capacity   integer not null default 12 check (capacity between 1 and 40),
  pos_x      numeric not null default 0,
  pos_y      numeric not null default 0,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tables_seating_client_idx on public.tables_seating (client_id);

drop trigger if exists tables_seating_touch on public.tables_seating;
create trigger tables_seating_touch before update on public.tables_seating
  for each row execute function public.touch_updated_at();

create table if not exists public.guests_rsvp (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients (id) on delete cascade,
  full_name       text not null,
  email           text,
  phone           text,
  side            text not null default 'shared' check (side in ('partner_a', 'partner_b', 'shared')),
  -- 0 is legal and meaningful: a declined guest occupies no seats.
  party_size      integer not null default 1 check (party_size between 0 and 20),
  status          text not null default 'pending'
                  check (status in ('pending', 'attending', 'declined', 'maybe')),
  meal_preference text not null default 'regular'
                  check (meal_preference in ('regular', 'vegan', 'vegetarian', 'gluten_free', 'kosher', 'child')),
  allergies       text,
  -- Personalized RSVP link. Unguessable, unique, and the only credential an
  -- anonymous guest presents.
  token           text not null unique default encode(gen_random_bytes(16), 'hex'),
  responded_at    timestamptz,
  -- Digital gifting, captured in the RSVP flow itself.
  gift_method     text check (gift_method in ('paybox', 'bit', 'card', 'none')),
  gift_amount     numeric(10, 2) check (gift_amount is null or gift_amount >= 0),
  blessing        text,
  table_id        uuid references public.tables_seating (id) on delete set null,
  seat_index      integer,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Pre-existing deployments carry the older `between 1 and 20` constraint;
-- rewrite it so a decline (party_size 0) is accepted.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'guests_rsvp_party_size_check') then
    alter table public.guests_rsvp drop constraint guests_rsvp_party_size_check;
  end if;
  alter table public.guests_rsvp
    add constraint guests_rsvp_party_size_check check (party_size between 0 and 20);
end;
$$;

create index if not exists guests_rsvp_client_idx on public.guests_rsvp (client_id);
create index if not exists guests_rsvp_table_idx  on public.guests_rsvp (table_id);
create index if not exists guests_rsvp_status_idx on public.guests_rsvp (client_id, status);

drop trigger if exists guests_rsvp_touch on public.guests_rsvp;
create trigger guests_rsvp_touch before update on public.guests_rsvp
  for each row execute function public.touch_updated_at();

-- A guest may only be seated at a table belonging to the same event.
create or replace function public.guests_rsvp_check_table()
returns trigger
language plpgsql
as $$
begin
  if new.table_id is not null then
    if not exists (
      select 1 from public.tables_seating t
      where t.id = new.table_id and t.client_id = new.client_id
    ) then
      raise exception 'Table % does not belong to client %', new.table_id, new.client_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guests_rsvp_table_guard on public.guests_rsvp;
create trigger guests_rsvp_table_guard
  before insert or update of table_id, client_id on public.guests_rsvp
  for each row execute function public.guests_rsvp_check_table();

-- ---------------------------------------------------------------------------
-- 3 · Budget tracker + AI receipt scanning
-- ---------------------------------------------------------------------------
create table if not exists public.budget_items (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients (id) on delete cascade,
  category       text not null default 'other',
  vendor         text,
  description    text,
  amount_planned numeric(12, 2) not null default 0 check (amount_planned >= 0),
  amount_paid    numeric(12, 2) not null default 0 check (amount_paid >= 0),
  currency       text not null default 'ILS',
  status         text not null default 'planned' check (status in ('planned', 'deposit', 'paid')),
  due_date       date,
  paid_at        timestamptz,
  source         text not null default 'manual' check (source in ('manual', 'receipt_scan')),
  receipt_id     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists budget_items_client_idx on public.budget_items (client_id);

drop trigger if exists budget_items_touch on public.budget_items;
create trigger budget_items_touch before update on public.budget_items
  for each row execute function public.touch_updated_at();

create table if not exists public.receipts (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients (id) on delete cascade,
  storage_path   text not null,
  image_url      text,
  vendor         text,
  amount         numeric(12, 2) check (amount is null or amount >= 0),
  currency       text default 'ILS',
  category       text,
  receipt_date   date,
  -- Full model output, kept so an extraction can be audited or re-parsed.
  raw_extraction jsonb,
  confidence     numeric(4, 3) check (confidence is null or confidence between 0 and 1),
  status         text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  error          text,
  budget_item_id uuid references public.budget_items (id) on delete set null,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists receipts_client_idx on public.receipts (client_id, created_at desc);

drop trigger if exists receipts_touch on public.receipts;
create trigger receipts_touch before update on public.receipts
  for each row execute function public.touch_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'budget_items_receipt_id_fkey'
  ) then
    alter table public.budget_items
      add constraint budget_items_receipt_id_fkey
      foreign key (receipt_id) references public.receipts (id) on delete set null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4 · Per-event settings — digital gift links and the calendar feed token
-- ---------------------------------------------------------------------------
create table if not exists public.event_settings (
  client_id      uuid primary key references public.clients (id) on delete cascade,
  gift_paybox_url text,
  gift_bit_url    text,
  gift_card_url   text,
  gift_message    text,
  calendar_token  text not null unique default encode(gen_random_bytes(16), 'hex'),
  event_start     timestamptz,
  event_end       timestamptz,
  venue_name      text,
  venue_address   text,
  timezone        text not null default 'Asia/Jerusalem',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists event_settings_touch on public.event_settings;
create trigger event_settings_touch before update on public.event_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Producers reach their own workspaces; authorized couple emails reach theirs.
-- Anonymous guests reach nothing directly — they go through the SECURITY
-- DEFINER RPCs below, which accept a token and nothing else.
-- ---------------------------------------------------------------------------
alter table public.clients        enable row level security;
alter table public.client_members enable row level security;
alter table public.moodboards     enable row level security;
alter table public.guests_rsvp    enable row level security;
alter table public.tables_seating enable row level security;
alter table public.budget_items   enable row level security;
alter table public.receipts       enable row level security;
alter table public.event_settings enable row level security;

drop policy if exists clients_rw on public.clients;
create policy clients_rw on public.clients
  for all to authenticated
  using (producer_id = auth.uid() or public.is_client_member(id))
  with check (producer_id = auth.uid());

drop policy if exists client_members_rw on public.client_members;
create policy client_members_rw on public.client_members
  for all to authenticated
  using (public.is_client_member(client_id))
  with check (public.is_client_producer(client_id));

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'moodboards', 'guests_rsvp', 'tables_seating', 'budget_items', 'receipts', 'event_settings'
  ]
  loop
    execute format('drop policy if exists %I_member_rw on public.%I', tbl, tbl);
    execute format($f$
      create policy %I_member_rw on public.%I
        for all to authenticated
        using (public.is_client_member(client_id))
        with check (public.is_client_member(client_id))
    $f$, tbl, tbl);
  end loop;
end;
$$;

-- Supabase configures default privileges for these roles, but granting
-- explicitly keeps the migration correct on any project. RLS above is what
-- actually restricts the rows; `anon` gets no table access at all.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.clients, public.client_members, public.moodboards, public.guests_rsvp,
  public.tables_seating, public.budget_items, public.receipts, public.event_settings
  to authenticated;

-- ---------------------------------------------------------------------------
-- Anonymous guest RSVP surface
--
-- One read RPC and one write RPC, both keyed on the guest's token. Nothing
-- else is exposed to `anon`, so the token cannot be used to enumerate the
-- guest list or reach any other table.
-- ---------------------------------------------------------------------------
create or replace function public.rsvp_get(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'guest', jsonb_build_object(
      'id', g.id,
      'full_name', g.full_name,
      'party_size', g.party_size,
      'status', g.status,
      'meal_preference', g.meal_preference,
      'allergies', g.allergies,
      'gift_method', g.gift_method,
      'blessing', g.blessing,
      'responded_at', g.responded_at
    ),
    'event', jsonb_build_object(
      'display_name', c.display_name,
      'event_date', c.event_date,
      'venue', c.venue,
      'venue_name', s.venue_name,
      'venue_address', s.venue_address,
      'event_start', s.event_start
    ),
    'gifts', jsonb_build_object(
      'paybox', s.gift_paybox_url,
      'bit', s.gift_bit_url,
      'card', s.gift_card_url,
      'message', s.gift_message
    )
  )
  from public.guests_rsvp g
  join public.clients c on c.id = g.client_id
  left join public.event_settings s on s.client_id = g.client_id
  where g.token = p_token;
$$;

create or replace function public.rsvp_submit(
  p_token      text,
  p_status     text,
  p_party_size integer default null,
  p_meal       text default null,
  p_allergies  text default null,
  p_gift_method text default null,
  p_gift_amount numeric default null,
  p_blessing   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  g public.guests_rsvp;
begin
  if p_status not in ('attending', 'declined', 'maybe') then
    raise exception 'Invalid RSVP status: %', p_status;
  end if;
  if p_meal is not null and p_meal not in
     ('regular', 'vegan', 'vegetarian', 'gluten_free', 'kosher', 'child') then
    raise exception 'Invalid meal preference: %', p_meal;
  end if;
  if p_gift_method is not null and p_gift_method not in ('paybox', 'bit', 'card', 'none') then
    raise exception 'Invalid gift method: %', p_gift_method;
  end if;

  update public.guests_rsvp g0
     set status          = p_status,
         -- A declined guest never occupies seats, and is released from a table.
         party_size      = case
                             when p_status = 'declined' then 0
                             else greatest(1, least(coalesce(p_party_size, g0.party_size), 20))
                           end,
         meal_preference = coalesce(p_meal, g0.meal_preference),
         allergies       = coalesce(p_allergies, g0.allergies),
         gift_method     = coalesce(p_gift_method, g0.gift_method),
         gift_amount     = coalesce(p_gift_amount, g0.gift_amount),
         blessing        = coalesce(nullif(btrim(p_blessing), ''), g0.blessing),
         table_id        = case when p_status = 'declined' then null else g0.table_id end,
         responded_at    = now()
   where g0.token = p_token
   returning * into g;

  if not found then
    raise exception 'Unknown RSVP token';
  end if;

  return jsonb_build_object('ok', true, 'status', g.status, 'party_size', g.party_size);
end;
$$;

-- Read-only calendar feed, addressed by its own token.
create or replace function public.calendar_feed(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'display_name', c.display_name,
    'event_date', c.event_date,
    'event_start', s.event_start,
    'event_end', s.event_end,
    'venue_name', coalesce(s.venue_name, c.venue),
    'venue_address', s.venue_address,
    'timezone', s.timezone
  )
  from public.event_settings s
  join public.clients c on c.id = s.client_id
  where s.calendar_token = p_token;
$$;

revoke all on function public.rsvp_get(text)      from public;
revoke all on function public.rsvp_submit(text, text, integer, text, text, text, numeric, text) from public;
revoke all on function public.calendar_feed(text) from public;

grant execute on function public.rsvp_get(text)      to anon, authenticated;
grant execute on function public.rsvp_submit(text, text, integer, text, text, text, numeric, text) to anon, authenticated;
grant execute on function public.calendar_feed(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
--
-- REPLICA IDENTITY FULL makes UPDATE/DELETE payloads carry the old row, which
-- is what lets a subscriber reconcile a delete it did not originate.
-- ---------------------------------------------------------------------------
alter table public.moodboards     replica identity full;
alter table public.guests_rsvp    replica identity full;
alter table public.tables_seating replica identity full;
alter table public.budget_items   replica identity full;
alter table public.receipts       replica identity full;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'moodboards', 'guests_rsvp', 'tables_seating', 'budget_items', 'receipts'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage buckets for moodboard photos and receipt scans (both private).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('moodboards', 'moodboards', false), ('receipts', 'receipts', false)
on conflict (id) do nothing;

do $$
declare
  b text;
begin
  foreach b in array array['moodboards', 'receipts']
  loop
    execute format('drop policy if exists %I_member_objects on storage.objects', b);
    -- Object paths are "<client_id>/<file>", so the first path segment is the
    -- membership check.
    execute format($f$
      create policy %I_member_objects on storage.objects
        for all to authenticated
        using (
          bucket_id = %L
          and public.is_client_member(nullif(split_part(name, '/', 1), '')::uuid)
        )
        with check (
          bucket_id = %L
          and public.is_client_member(nullif(split_part(name, '/', 1), '')::uuid)
        )
    $f$, b, b, b);
  end loop;
end;
$$;
