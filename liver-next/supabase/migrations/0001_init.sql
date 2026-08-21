-- ============================================================================
--  Liver Productions — initial schema
--  Multi-tenant by producer. Root super admin is pinned to a single address.
-- ============================================================================
create extension if not exists "pgcrypto";

-- ── enums ───────────────────────────────────────────────────────────────────
-- One block per type, deliberately.
--
-- These were a single do block with one `exception when duplicate_object`
-- handler at the end. In PL/pgSQL an exception unwinds everything since the
-- block began, so if any one type already existed — from a partial earlier
-- run — the handler swallowed the error and every type after it was silently
-- never created. The script then failed hundreds of lines later with
-- `type "producer_state" does not exist`, pointing at a table definition
-- rather than at the cause.
--
-- Separate blocks mean an existing type skips only itself.
do $$ begin create type app_role as enum ('super_admin','producer','client','staff');
  exception when duplicate_object then null; end $$;
do $$ begin create type producer_state as enum ('pending','approved','suspended','rejected');
  exception when duplicate_object then null; end $$;
do $$ begin create type event_class as enum ('wedding','corporate');
  exception when duplicate_object then null; end $$;
do $$ begin create type lead_state as enum ('new','contacted','meeting','won','lost');
  exception when duplicate_object then null; end $$;
do $$ begin create type rsvp_state as enum ('pending','attending','declined');
  exception when duplicate_object then null; end $$;
do $$ begin create type diet_pref as enum ('none','vegan','vegetarian','gluten_free','kosher');
  exception when duplicate_object then null; end $$;
do $$ begin create type task_owner as enum ('producer','client');
  exception when duplicate_object then null; end $$;
do $$ begin create type order_state as enum ('draft','pending','paid','refunded');
  exception when duplicate_object then null; end $$;

-- ── who is root ─────────────────────────────────────────────────────────────
create or replace function public.root_admin_email() returns text
language sql immutable as $$ select 'barakliver@gmail.com'::text $$;

-- ── profiles: one row per auth user ─────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        app_role not null default 'client',
  created_at  timestamptz not null default now(),
  constraint profiles_email_lower check (email = lower(email))
);
create unique index if not exists profiles_email_key on public.profiles(lower(email));

-- Only the root address may ever hold super_admin. Enforced in the database so
-- no client-side path, and no direct API call, can grant it to anyone else.
create or replace function public.guard_super_admin() returns trigger
language plpgsql as $$
begin
  if new.role = 'super_admin' and lower(new.email) <> public.root_admin_email() then
    raise exception 'super_admin is reserved for %', public.root_admin_email();
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_super_admin on public.profiles;
create trigger profiles_guard_super_admin
  before insert or update on public.profiles
  for each row execute function public.guard_super_admin();

-- new auth user -> profile, with the root address elevated automatically
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name',''),
    case when lower(new.email) = public.root_admin_email() then 'super_admin'::app_role
         else 'producer'::app_role end
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── producers ───────────────────────────────────────────────────────────────
create table if not exists public.producers (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  brand_name    text not null default '',
  contact_name  text not null default '',
  contact_email text not null default '',
  whatsapp      text not null default '',
  booking_url   text not null default '',
  logo_url      text,
  status        producer_state not null default 'pending',
  created_at    timestamptz not null default now()
);
create index if not exists producers_owner_idx on public.producers(owner_id);

-- ── clients (an event workspace) ────────────────────────────────────────────
create table if not exists public.clients (
  id           uuid primary key default gen_random_uuid(),
  producer_id  uuid not null references public.producers(id) on delete cascade,
  display_name text not null,
  kind         event_class not null default 'wedding',
  event_date   date,
  venue        text not null default '',
  guest_estimate int,
  created_at   timestamptz not null default now(),
  constraint clients_date_2026 check (event_date is null or event_date >= date '2026-01-01')
);
create index if not exists clients_producer_idx on public.clients(producer_id);

-- up to two authorised addresses per workspace (bride and groom)
create table if not exists public.client_authorized_emails (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  email      text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cae_email_lower check (email = lower(email))
);
create unique index if not exists cae_client_email_key on public.client_authorized_emails(client_id, lower(email));

create or replace function public.cap_authorized_emails() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.client_authorized_emails where client_id = new.client_id) >= 2 then
    raise exception 'a workspace accepts at most 2 authorized emails';
  end if;
  return new;
end $$;
drop trigger if exists cae_cap on public.client_authorized_emails;
create trigger cae_cap before insert on public.client_authorized_emails
  for each row execute function public.cap_authorized_emails();

-- ── leads and sales calls ───────────────────────────────────────────────────
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid references public.producers(id) on delete set null,
  full_name   text not null,
  email       text not null default '',
  phone       text not null default '',
  kind        event_class not null default 'wedding',
  event_date  date,
  guest_count int,
  message     text not null default '',
  status      lead_state not null default 'new',
  source      text not null default 'site',
  note        text not null default '',
  created_at  timestamptz not null default now(),
  constraint leads_date_2026  check (event_date is null or event_date >= date '2026-01-01'),
  constraint leads_guest_cap  check (guest_count is null or (guest_count > 0 and guest_count <= 1500))
);
create index if not exists leads_producer_idx on public.leads(producer_id, created_at desc);

create table if not exists public.sales_calls (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  lead_id     uuid references public.leads(id) on delete set null,
  title       text not null,
  phone       text not null default '',
  scheduled_at timestamptz,
  remind_on   date,
  notes       text not null default '',
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists sales_calls_producer_idx on public.sales_calls(producer_id, remind_on);

-- ── orders ──────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete set null,
  number      text not null,
  buyer_name  text not null default '',
  buyer_email text not null default '',
  buyer_phone text not null default '',
  items       jsonb not null default '[]'::jsonb,
  total       numeric(12,2) not null default 0,
  status      order_state not null default 'pending',
  created_at  timestamptz not null default now()
);
create index if not exists orders_producer_idx on public.orders(producer_id, created_at desc);

-- ── tasks (either side may create) ──────────────────────────────────────────
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  phase      text not null default '',
  title      text not null,
  due_on     date,
  done       boolean not null default false,
  owner      task_owner not null default 'producer',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists tasks_client_idx on public.tasks(client_id, due_on);

-- ── moodboards ──────────────────────────────────────────────────────────────
create table if not exists public.moodboards (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  category   text not null default 'other',
  caption    text not null default '',
  image_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists moodboards_client_idx on public.moodboards(client_id);

-- ── guests, RSVP and seating ────────────────────────────────────────────────
create table if not exists public.tables_seating (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  name       text not null,
  seats      int not null default 12 check (seats > 0),
  pos_x      numeric(5,2) not null default 50,
  pos_y      numeric(5,2) not null default 50,
  shape      text not null default 'round',
  created_at timestamptz not null default now()
);
create index if not exists tables_client_idx on public.tables_seating(client_id);

create table if not exists public.guests_rsvp (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  table_id    uuid references public.tables_seating(id) on delete set null,
  full_name   text not null,
  side        text not null default '',
  phone       text not null default '',
  email       text not null default '',
  invite_token text not null default encode(gen_random_bytes(16),'hex'),
  status      rsvp_state not null default 'pending',
  party_size  int not null default 1 check (party_size >= 0 and party_size <= 20),
  diet        diet_pref not null default 'none',
  note        text not null default '',
  responded_at timestamptz,
  created_at  timestamptz not null default now()
);
create unique index if not exists guests_token_key on public.guests_rsvp(invite_token);
create index if not exists guests_client_idx on public.guests_rsvp(client_id, status);

-- ── password reset codes ────────────────────────────────────────────────────
create table if not exists public.password_resets (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  code_hash  text not null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  attempts   int not null default 0,
  created_at timestamptz not null default now(),
  constraint pr_email_lower check (email = lower(email))
);
create index if not exists password_resets_email_idx on public.password_resets(lower(email), expires_at desc);

-- ── site settings (per producer) ────────────────────────────────────────────
create table if not exists public.site_settings (
  producer_id   uuid primary key references public.producers(id) on delete cascade,
  brand_name    text not null default '',
  notify_email  text not null default '',
  whatsapp_hook text not null default '',
  booking_url   text not null default '',
  store_enabled boolean not null default false,
  updated_at    timestamptz not null default now()
);

-- ============================================================================
--  helpers used by policies
-- ============================================================================
create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
$$;

create or replace function public.owns_producer(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.producers pr
    where pr.id = pid and pr.owner_id = auth.uid()
  )
$$;

-- a client workspace this signed-in user is authorised on
create or replace function public.can_read_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_super_admin()
    or exists (select 1 from public.clients c join public.producers pr on pr.id = c.producer_id
               where c.id = cid and pr.owner_id = auth.uid())
    or exists (select 1 from public.client_authorized_emails e join public.profiles p on p.id = auth.uid()
               where e.client_id = cid and lower(e.email) = lower(p.email))
$$;

create or replace function public.producer_of_client(cid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select producer_id from public.clients where id = cid
$$;

-- ============================================================================
--  row level security
-- ============================================================================
alter table public.profiles                enable row level security;
alter table public.producers               enable row level security;
alter table public.clients                 enable row level security;
alter table public.client_authorized_emails enable row level security;
alter table public.leads                   enable row level security;
alter table public.sales_calls             enable row level security;
alter table public.orders                  enable row level security;
alter table public.tasks                   enable row level security;
alter table public.moodboards              enable row level security;
alter table public.tables_seating          enable row level security;
alter table public.guests_rsvp             enable row level security;
alter table public.password_resets         enable row level security;
alter table public.site_settings           enable row level security;

-- profiles: read your own, super admin reads all; role changes are guarded above
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or public.is_super_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

-- producers
drop policy if exists producers_read on public.producers;
create policy producers_read on public.producers for select
  using (owner_id = auth.uid() or public.is_super_admin());
drop policy if exists producers_insert on public.producers;
create policy producers_insert on public.producers for insert
  with check (owner_id = auth.uid());
drop policy if exists producers_update on public.producers;
create policy producers_update on public.producers for update
  using (owner_id = auth.uid() or public.is_super_admin())
  with check (owner_id = auth.uid() or public.is_super_admin());
drop policy if exists producers_delete on public.producers;
create policy producers_delete on public.producers for delete
  using (public.is_super_admin());

-- clients
drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients for select using (public.can_read_client(id));
drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients for all
  using (public.owns_producer(producer_id) or public.is_super_admin())
  with check (public.owns_producer(producer_id) or public.is_super_admin());

drop policy if exists cae_read on public.client_authorized_emails;
create policy cae_read on public.client_authorized_emails for select using (public.can_read_client(client_id));
drop policy if exists cae_write on public.client_authorized_emails;
create policy cae_write on public.client_authorized_emails for all
  using (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin())
  with check (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin());

-- leads: the public site inserts them through a server action using the
-- service role, so no anonymous insert policy is granted here
drop policy if exists leads_read on public.leads;
create policy leads_read on public.leads for select
  using (public.is_super_admin() or (producer_id is not null and public.owns_producer(producer_id)));
drop policy if exists leads_write on public.leads;
create policy leads_write on public.leads for all
  using (public.is_super_admin() or (producer_id is not null and public.owns_producer(producer_id)))
  with check (public.is_super_admin() or (producer_id is not null and public.owns_producer(producer_id)));

drop policy if exists sales_calls_all on public.sales_calls;
create policy sales_calls_all on public.sales_calls for all
  using (public.owns_producer(producer_id) or public.is_super_admin())
  with check (public.owns_producer(producer_id) or public.is_super_admin());

drop policy if exists orders_all on public.orders;
create policy orders_all on public.orders for all
  using (public.owns_producer(producer_id) or public.is_super_admin())
  with check (public.owns_producer(producer_id) or public.is_super_admin());

-- tasks and moodboards: both sides of a workspace may read and write
drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks for all
  using (public.can_read_client(client_id)) with check (public.can_read_client(client_id));

drop policy if exists moodboards_all on public.moodboards;
create policy moodboards_all on public.moodboards for all
  using (public.can_read_client(client_id)) with check (public.can_read_client(client_id));

drop policy if exists tables_all on public.tables_seating;
create policy tables_all on public.tables_seating for all
  using (public.can_read_client(client_id)) with check (public.can_read_client(client_id));

drop policy if exists guests_all on public.guests_rsvp;
create policy guests_all on public.guests_rsvp for all
  using (public.can_read_client(client_id)) with check (public.can_read_client(client_id));

-- password_resets is written and read only by the service role
drop policy if exists password_resets_none on public.password_resets;
create policy password_resets_none on public.password_resets for select using (false);

drop policy if exists site_settings_all on public.site_settings;
create policy site_settings_all on public.site_settings for all
  using (public.owns_producer(producer_id) or public.is_super_admin())
  with check (public.owns_producer(producer_id) or public.is_super_admin());

-- ── storage for moodboard images ────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('moodboards','moodboards', true)
on conflict (id) do nothing;

drop policy if exists moodboard_objects_read on storage.objects;
create policy moodboard_objects_read on storage.objects for select
  using (bucket_id = 'moodboards');
drop policy if exists moodboard_objects_write on storage.objects;
create policy moodboard_objects_write on storage.objects for insert
  with check (bucket_id = 'moodboards' and auth.uid() is not null);
drop policy if exists moodboard_objects_delete on storage.objects;
create policy moodboard_objects_delete on storage.objects for delete
  using (bucket_id = 'moodboards' and auth.uid() is not null);
