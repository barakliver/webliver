-- ============================================================================
--  Liver productions - full first-time setup
--
--  Paste this whole file into the Supabase SQL Editor and press Run. It is
--  every migration in order, so there is nothing to get wrong about which
--  runs first, and it is safe to run again when new migrations are added.
--  It is also safe to run over a database left half-built by a failed run.
-- ============================================================================

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

-- ============================================================================
--  0002 — who a new account becomes, and what it may do before approval
-- ============================================================================
--  0001 made every non-root signup a producer. That is wrong for an invited
--  couple: the address is already on a workspace, so the account belongs to
--  that workspace as a client, not to a producer of its own. It also left
--  producers with no workspace row at all, so there was nothing for the root
--  admin to approve.
--
--  House rule this file enforces: only barakliver@gmail.com is ever elevated,
--  and every other producer signup lands in 'pending' and can do nothing until
--  the root admin approves it.
-- ============================================================================

-- ── new account -> the right role, and a workspace to be approved ───────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  addr        text := lower(new.email);
  is_root     boolean := addr = public.root_admin_email();
  is_invited  boolean;
  new_role    app_role;
begin
  select exists (select 1 from public.client_authorized_emails e where lower(e.email) = addr)
    into is_invited;

  new_role := case
    when is_root    then 'super_admin'::app_role
    when is_invited then 'client'::app_role
    else 'producer'::app_role
  end;

  insert into public.profiles (id, email, full_name, role)
  values (new.id, addr, coalesce(new.raw_user_meta_data->>'full_name',''), new_role)
  on conflict (id) do nothing;

  -- an invited address is bound to the workspaces that invited it
  if is_invited then
    update public.client_authorized_emails
       set profile_id = new.id
     where lower(email) = addr and profile_id is null;
  end if;

  -- a producer gets a workspace immediately, but it starts unapproved;
  -- the root account is the one exception and is live from the first login
  if new_role in ('producer','super_admin') then
    insert into public.producers (owner_id, brand_name, contact_name, contact_email, status)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'brand_name',''),
      coalesce(new.raw_user_meta_data->>'full_name',''),
      addr,
      case when is_root then 'approved'::producer_state else 'pending'::producer_state end
    );
  end if;

  return new;
end $$;

-- ── an address invited after it already signed up ───────────────────────────
--  Without this, a couple who happened to have an account first would stay a
--  producer forever and never see the workspace they were invited to.
create or replace function public.bind_authorized_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  select id, role into p from public.profiles where lower(email) = lower(new.email);
  if found then
    new.profile_id := p.id;
    -- never demote the root admin, and never demote a producer who already
    -- owns an approved workspace of their own
    if p.role = 'producer'
       and not exists (select 1 from public.producers pr
                       where pr.owner_id = p.id and pr.status = 'approved') then
      update public.profiles set role = 'client' where id = p.id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists cae_bind on public.client_authorized_emails;
create trigger cae_bind before insert on public.client_authorized_emails
  for each row execute function public.bind_authorized_email();

-- ── "may this account actually do anything yet?" ────────────────────────────
create or replace function public.my_producer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.producers where owner_id = auth.uid() order by created_at limit 1
$$;

create or replace function public.is_approved_producer() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.producers pr
    where pr.owner_id = auth.uid() and pr.status = 'approved'
  )
$$;

-- A pending producer could previously create clients, leads and everything
-- hanging off them. Approval now gates writes across the workspace tables.
drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients for all
  using (public.can_read_client(id) and public.is_approved_producer())
  with check (public.owns_producer(producer_id) and public.is_approved_producer());

drop policy if exists producers_update on public.producers;
create policy producers_update on public.producers for update
  using (public.is_super_admin() or owner_id = auth.uid())
  with check (public.is_super_admin() or owner_id = auth.uid());

-- Status is the root admin's decision alone: an owner may edit their own brand
-- details but must not be able to approve themselves.
create or replace function public.guard_producer_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and not public.is_super_admin() then
    raise exception 'only % may change a producer status', public.root_admin_email();
  end if;
  return new;
end $$;
drop trigger if exists producers_guard_status on public.producers;
create trigger producers_guard_status before update on public.producers
  for each row execute function public.guard_producer_status();

-- Self-service signup must not be able to mint a producer row that is already
-- approved, nor one owned by somebody else.
drop policy if exists producers_insert on public.producers;
create policy producers_insert on public.producers for insert
  with check (
    public.is_super_admin()
    or (owner_id = auth.uid() and status = 'pending')
  );

-- ── a profile must not be able to promote itself ────────────────────────────
--  profiles_self_update let a signed-in user write any column on their row,
--  role included. The super_admin guard blocked the top of the ladder, but
--  nothing stopped a client from writing 'producer'.
create or replace function public.guard_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_super_admin() then
    raise exception 'a role is set by % only', public.root_admin_email();
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_role_change();

-- ============================================================================
--  0003 — a shared checklist that neither side can quietly rewrite
-- ============================================================================
--  tasks_all gave anyone who can read a workspace full rights over every task
--  on it. That is right for ticking and adding — the point of the list is that
--  both sides use it — but it also let a couple delete the producer's entire
--  checklist, and let either side claim a task had been written by the other.
--
--  So: authorship is recorded by the database rather than sent by the browser,
--  and deleting is limited to whoever wrote the task, plus the producer who
--  owns the workspace so they can still tidy up.
-- ============================================================================

-- ── who wrote this is not the browser's to say ──────────────────────────────
create or replace function public.stamp_task_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_by := auth.uid();
  return new;
end $$;
drop trigger if exists tasks_stamp_author on public.tasks;
create trigger tasks_stamp_author before insert on public.tasks
  for each row execute function public.stamp_task_author();

-- created_by is the record of who wrote it, so it must not drift afterwards
create or replace function public.freeze_task_author() returns trigger
language plpgsql as $$
begin
  new.created_by := old.created_by;
  return new;
end $$;
drop trigger if exists tasks_freeze_author on public.tasks;
create trigger tasks_freeze_author before update on public.tasks
  for each row execute function public.freeze_task_author();

-- ── read and write together, delete only your own ───────────────────────────
drop policy if exists tasks_all on public.tasks;

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select
  using (public.can_read_client(client_id));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert
  with check (public.can_read_client(client_id));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update
  using (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete
  using (
    public.can_read_client(client_id)
    and (
      created_by = auth.uid()
      or public.owns_producer(public.producer_of_client(client_id))
      or public.is_super_admin()
    )
  );

create index if not exists tasks_client_owner_idx on public.tasks(client_id, done, due_on);

-- ============================================================================
--  0004 — budget lines and payments
-- ============================================================================
--  Two different questions that kept being confused for one:
--    "what do we expect this wedding to cost"      -> budget_items
--    "what has the couple paid us, and what is due" -> payments
--
--  Who may write is not symmetric. A couple reading what they owe is the
--  point of the screen; a couple marking themselves as paid is not. So money
--  is written by the producer who owns the workspace, and read by both.
--
--  The old app hid the budget from the couple by default and let the producer
--  reveal it, so clients carry that switch rather than assuming either way.
-- ============================================================================

alter table public.clients
  add column if not exists budget_visible boolean not null default false;

create table if not exists public.budget_items (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  category   text not null default '',
  label      text not null,
  estimate   numeric(12,2) not null default 0 check (estimate >= 0),
  agreed     numeric(12,2) check (agreed is null or agreed >= 0),
  vendor     text not null default '',
  notes      text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists budget_items_client_idx on public.budget_items(client_id);

create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  title      text not null,
  amount     numeric(12,2) not null check (amount > 0),
  due_on     date,
  paid       boolean not null default false,
  paid_on    date,
  note       text not null default '',
  created_at timestamptz not null default now(),
  -- a payment marked paid must say when, and one that is not must not
  constraint payments_paid_date check ((paid and paid_on is not null) or (not paid and paid_on is null))
);
create index if not exists payments_client_idx on public.payments(client_id, paid, due_on);

alter table public.budget_items enable row level security;
alter table public.payments     enable row level security;

-- ── budget: the producer writes; the couple reads only once let in ──────────
drop policy if exists budget_read on public.budget_items;
create policy budget_read on public.budget_items for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or public.is_super_admin()
    or (
      public.can_read_client(client_id)
      and exists (select 1 from public.clients c where c.id = client_id and c.budget_visible)
    )
  );

drop policy if exists budget_write on public.budget_items;
create policy budget_write on public.budget_items for all
  using (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin())
  with check (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin());

-- ── payments: both sides read, only the producer writes ─────────────────────
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select
  using (public.can_read_client(client_id));

drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments for all
  using (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin())
  with check (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin());

-- ── keep paid and paid_on honest without making the caller remember ─────────
create or replace function public.stamp_payment_date() returns trigger
language plpgsql as $$
begin
  if new.paid and new.paid_on is null then
    new.paid_on := current_date;
  elsif not new.paid then
    new.paid_on := null;
  end if;
  return new;
end $$;
drop trigger if exists payments_stamp_date on public.payments;
create trigger payments_stamp_date before insert or update on public.payments
  for each row execute function public.stamp_payment_date();

-- ============================================================================
--  0005 — the winning board, and locking down the files behind it
-- ============================================================================
--  The row policy on moodboards was already per client. The storage policies
--  were not: they allowed
--
--    read   -> bucket_id = 'moodboards'                       (everybody)
--    write  -> bucket_id = 'moodboards' and auth.uid() is not null
--    delete -> bucket_id = 'moodboards' and auth.uid() is not null
--
--  so any signed-in person could read, overwrite and delete the photos of
--  every couple in the system, and read was not even limited to signed-in
--  people. The table said "your event only" while the images themselves were
--  open to the world.
--
--  Objects are stored as <client_id>/<file>, so the folder name is the
--  workspace and access can be decided by the same rule as everything else.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('moodboards', 'moodboards', false)
on conflict (id) do update set public = false;

-- the first path segment is the workspace this file belongs to
create or replace function public.storage_client_id(object_name text) returns uuid
language plpgsql immutable as $$
declare seg text;
begin
  seg := split_part(object_name, '/', 1);
  if seg !~ '^[0-9a-fA-F-]{36}$' then
    return null;
  end if;
  return seg::uuid;
exception when others then
  return null;
end $$;

drop policy if exists moodboard_objects_read on storage.objects;
create policy moodboard_objects_read on storage.objects for select
  using (
    bucket_id = 'moodboards'
    and public.can_read_client(public.storage_client_id(name))
  );

drop policy if exists moodboard_objects_write on storage.objects;
create policy moodboard_objects_write on storage.objects for insert
  with check (
    bucket_id = 'moodboards'
    and public.can_read_client(public.storage_client_id(name))
  );

drop policy if exists moodboard_objects_update on storage.objects;
create policy moodboard_objects_update on storage.objects for update
  using (
    bucket_id = 'moodboards'
    and public.can_read_client(public.storage_client_id(name))
  );

drop policy if exists moodboard_objects_delete on storage.objects;
create policy moodboard_objects_delete on storage.objects for delete
  using (
    bucket_id = 'moodboards'
    and public.can_read_client(public.storage_client_id(name))
  );

-- can_read_client answers false rather than raising for a null id, so a file
-- dropped at the root of the bucket belongs to nobody and is reachable by
-- nobody, which is the safe way for a malformed path to fail.

-- ============================================================================
--  0006 — guests answering their own invitation
-- ============================================================================
--  A guest has no account and never will, so the reply has to work from a
--  link alone. The tempting shortcut is to let anonymous callers read the
--  guest table filtered by token, but a policy like that is one mistaken
--  query away from handing over an entire guest list — names, phones and all.
--
--  So the table stays closed to anonymous callers entirely, and two
--  security definer functions are the only way in. Each takes a token,
--  touches exactly the row that token belongs to, and returns only what that
--  guest needs to see about their own invitation and the event.
-- ============================================================================

-- how many people this guest actually brings, for counting
alter table public.guests_rsvp
  add column if not exists reminded_at timestamptz;

-- ── what the guest sees when they open their link ───────────────────────────
create or replace function public.rsvp_lookup(p_token text)
returns table (
  guest_name  text,
  event_name  text,
  event_date  date,
  venue       text,
  status      rsvp_state,
  party_size  int,
  diet        diet_pref,
  note        text,
  responded   boolean
)
language sql stable security definer set search_path = public as $$
  select g.full_name, c.display_name, c.event_date, c.venue,
         g.status, g.party_size, g.diet, g.note,
         g.responded_at is not null
    from public.guests_rsvp g
    join public.clients c on c.id = g.client_id
   where g.invite_token = p_token
   limit 1
$$;

-- ── the reply itself ────────────────────────────────────────────────────────
--  Returns whether a row was actually matched, so a wrong or expired link is
--  told plainly instead of appearing to succeed.
create or replace function public.rsvp_respond(
  p_token      text,
  p_status     rsvp_state,
  p_party_size int,
  p_diet       diet_pref,
  p_note       text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  hit int;
  size int;
begin
  if p_status not in ('attending','declined') then
    raise exception 'a reply is either attending or declined';
  end if;

  -- somebody who is not coming brings nobody, whatever the form said
  size := case when p_status = 'declined' then 0
               else greatest(1, least(coalesce(p_party_size, 1), 20)) end;

  update public.guests_rsvp
     set status = p_status,
         party_size = size,
         diet = coalesce(p_diet, 'none'),
         note = coalesce(left(p_note, 500), ''),
         responded_at = now()
   where invite_token = p_token;

  get diagnostics hit = row_count;
  return hit > 0;
end $$;

-- the functions are the whole public surface; the table itself stays shut
revoke all on function public.rsvp_lookup(text) from public;
revoke all on function public.rsvp_respond(text, rsvp_state, int, diet_pref, text) from public;
grant execute on function public.rsvp_lookup(text) to anon, authenticated;
grant execute on function public.rsvp_respond(text, rsvp_state, int, diet_pref, text) to anon, authenticated;

-- ── the token is a credential, so it must not be settable from outside ──────
create or replace function public.guard_invite_token() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.invite_token := encode(gen_random_bytes(16), 'hex');
  else
    new.invite_token := old.invite_token;
  end if;
  return new;
end $$;
drop trigger if exists guests_guard_token on public.guests_rsvp;
create trigger guests_guard_token before insert or update on public.guests_rsvp
  for each row execute function public.guard_invite_token();

create index if not exists guests_token_lookup on public.guests_rsvp(invite_token);

-- ============================================================================
--  0007 — seating that cannot quietly overfill a table
-- ============================================================================
--  A table has a number of seats and guests arrive in parties, so the count
--  that matters is people rather than rows. Nothing stopped a party of six
--  being dropped onto a table with two seats left, and the error would only
--  surface on the night, when somebody is standing.
--
--  Note on shape: releasing a seat and checking capacity are one trigger on
--  purpose. Split across two, PostgreSQL fires BEFORE triggers in name order,
--  so the capacity check ran first and rejected a guest who was cancelling —
--  the very update that was about to free their chair. One function has no
--  ordering to get wrong.
-- ============================================================================

-- how many people are already sitting at a table
create or replace function public.table_taken(p_table uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(party_size), 0)::int
    from public.guests_rsvp
   where table_id = p_table and status = 'attending'
$$;

create or replace function public.guard_seating() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cap   int;
  taken int;
  mine  int;
begin
  -- somebody who is not coming holds no chair, so withdrawing frees it
  -- rather than being refused
  if new.status <> 'attending' then
    new.table_id := null;
    return new;
  end if;

  if new.table_id is null then
    return new;
  end if;

  select seats into cap from public.tables_seating where id = new.table_id;
  if cap is null then
    raise exception 'that table does not exist';
  end if;

  -- what this guest already occupies there, so an edit is not counted twice
  mine := case
    when tg_op = 'UPDATE' and old.table_id = new.table_id and old.status = 'attending'
    then old.party_size else 0 end;

  taken := public.table_taken(new.table_id) - mine;

  if taken + new.party_size > cap then
    raise exception 'the table seats %, and % would be seated', cap, taken + new.party_size;
  end if;

  return new;
end $$;
drop trigger if exists guests_guard_seating on public.guests_rsvp;
drop trigger if exists guests_release_seat on public.guests_rsvp;
create trigger guests_guard_seating before insert or update on public.guests_rsvp
  for each row execute function public.guard_seating();

-- ── shrinking a table must not leave people sitting in seats that are gone ──
create or replace function public.guard_table_seats() returns trigger
language plpgsql security definer set search_path = public as $$
declare taken int;
begin
  if new.seats >= old.seats then
    return new;
  end if;
  taken := public.table_taken(new.id);
  if taken > new.seats then
    raise exception '% people are already seated here, so it cannot go down to %', taken, new.seats;
  end if;
  return new;
end $$;
drop trigger if exists tables_guard_seats on public.tables_seating;
create trigger tables_guard_seats before update on public.tables_seating
  for each row execute function public.guard_table_seats();

create index if not exists guests_table_idx on public.guests_rsvp(table_id);

-- ============================================================================
--  0008 — the running order for the day itself
-- ============================================================================
--  A wedding day is not one timeline. The couple spend the morning apart and
--  their hours look nothing alike: one is at hair and makeup while the other
--  is collecting suits. Holding that in a single list forces every line to
--  explain who it is for, and the two people who need it most end up reading
--  around each other's entries.
--
--  So a day has three tracks: what is shared, and one for each partner. The
--  labels are the couple's own words, because "bride" and "groom" do not fit
--  every event this app will be asked to run.
-- ============================================================================

do $$ begin
  create type day_track as enum ('shared','partner_a','partner_b');
exception when duplicate_object then null; end $$;

alter table public.clients
  add column if not exists track_a_label text not null default 'לוז כלה',
  add column if not exists track_b_label text not null default 'לוז חתן';

create table if not exists public.day_schedule (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  track      day_track not null default 'shared',
  at_time    time not null,
  title      text not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists day_schedule_client_idx
  on public.day_schedule(client_id, track, at_time);

alter table public.day_schedule enable row level security;

-- both sides build this together, the same way they build the checklist
drop policy if exists day_schedule_all on public.day_schedule;
create policy day_schedule_all on public.day_schedule for all
  using (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

-- ── the labels belong to the couple, the rest of the row does not ───────────
--  clients_write is producer-only for good reason: the row carries the date,
--  the venue and whether the budget is visible. But the two track labels are
--  the couple's own words for their own morning, and row level security has
--  no column granularity to express that. A narrow function does: it checks
--  the same read rule as everything else and touches nothing but the labels.
create or replace function public.set_day_track_labels(
  p_client uuid,
  p_a      text,
  p_b      text
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_read_client(p_client) then
    raise exception 'not your event';
  end if;

  update public.clients
     set track_a_label = coalesce(nullif(btrim(left(p_a, 40)), ''), track_a_label),
         track_b_label = coalesce(nullif(btrim(left(p_b, 40)), ''), track_b_label)
   where id = p_client;

  return true;
end $$;

revoke all on function public.set_day_track_labels(uuid, text, text) from public;
grant execute on function public.set_day_track_labels(uuid, text, text) to authenticated;

-- ============================================================================
--  0009 — leads that actually reach somebody, and the follow up after
-- ============================================================================
--  The public form writes through the service role and never set producer_id,
--  while leads_read requires "producer_id is not null and you own it". The
--  root admin saw every lead only because super_admin bypasses that clause —
--  luck, not design. Any other approved producer saw zero leads and always
--  would have, with the enquiries sitting in the table unread.
--
--  Attribution is fixed in the database rather than in the one code path that
--  happens to insert today, so no future form, import or script can drop a
--  lead into the void.
-- ============================================================================

-- whose enquiries the public site collects
create or replace function public.public_site_producer() returns uuid
language sql stable security definer set search_path = public as $$
  select pr.id
    from public.producers pr
    join public.profiles p on p.id = pr.owner_id
   where lower(p.email) = public.root_admin_email()
   order by pr.created_at
   limit 1
$$;

create or replace function public.attribute_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.producer_id is null then
    new.producer_id := public.public_site_producer();
  end if;
  return new;
end $$;
drop trigger if exists leads_attribute on public.leads;
create trigger leads_attribute before insert on public.leads
  for each row execute function public.attribute_lead();

-- leads already sitting unattributed belong to the site that collected them
update public.leads
   set producer_id = public.public_site_producer()
 where producer_id is null;

-- ── the follow up ───────────────────────────────────────────────────────────
--  A producer books the call from the lead, so the workspace is implied
--  rather than typed, and cannot end up pointing at somebody else's.
create or replace function public.attribute_sales_call() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner_of_lead uuid;
begin
  if new.producer_id is null then
    new.producer_id := public.my_producer_id();
  end if;

  -- A call may only hang off a lead in the same workspace. Without this a
  -- producer could file a call against somebody else's lead: nothing escapes,
  -- because the lead itself stays unreadable, but it leaves a reference
  -- pointing across tenants for a future join to trip over.
  if new.lead_id is not null then
    select producer_id into owner_of_lead from public.leads where id = new.lead_id;
    if owner_of_lead is distinct from new.producer_id then
      raise exception 'that lead belongs to another workspace';
    end if;
  end if;

  return new;
end $$;
drop trigger if exists sales_calls_attribute on public.sales_calls;
create trigger sales_calls_attribute before insert on public.sales_calls
  for each row execute function public.attribute_sales_call();

create index if not exists sales_calls_lead_idx on public.sales_calls(lead_id);

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

-- ============================================================================
--  Backfill profiles for accounts that registered before this schema existed
-- ============================================================================
-- handle_new_user() fires on insert into auth.users, so it only ever covers
-- accounts created after the trigger exists. An account registered earlier -
-- for instance by requesting a sign in code while the database was still empty
-- - has an auth row and no profile, and every read of its role then falls back
-- to whatever the application chose as a default. The root address landed in
-- the couple's portal because of exactly this.
--
-- Runs on every setup, and is a no-op once every account has a profile.

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  lower(u.email),
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  case when lower(u.email) = public.root_admin_email() then 'super_admin'::app_role
       else 'producer'::app_role end
from auth.users u
where u.email is not null
  and not exists (select 1 from public.profiles p where p.id = u.id);

-- The same rule applied to rows that already exist: the root address always
-- holds super_admin, and nobody else ever does. guard_super_admin already
-- refuses the second half on write; this repairs anything written before it.
update public.profiles
   set role = 'super_admin'::app_role
 where lower(email) = public.root_admin_email()
   and role <> 'super_admin';

update public.profiles
   set role = 'producer'::app_role
 where role = 'super_admin'
   and lower(email) <> public.root_admin_email();

-- A producer needs a producers row to have a workspace to sign in to.
insert into public.producers (owner_id, brand_name, contact_name, contact_email, status)
select
  p.id,
  coalesce(nullif(u.raw_user_meta_data->>'brand_name', ''), p.full_name, ''),
  p.full_name,
  p.email,
  case when p.role = 'super_admin' then 'approved'::producer_state
       else 'pending'::producer_state end
from public.profiles p
join auth.users u on u.id = p.id
where p.role in ('super_admin', 'producer')
  and not exists (select 1 from public.producers pr where pr.owner_id = p.id);

-- The root admin is approved by definition; nobody is above them to approve it.
update public.producers pr
   set status = 'approved'::producer_state
  from public.profiles p
 where p.id = pr.owner_id
   and p.role = 'super_admin'
   and pr.status <> 'approved';

-- ============================================================================
--  0012 — profile pictures
-- ============================================================================
--  A couple should be able to put their own face on their account, and see the
--  producer's. That makes the avatar the one image in the product that is
--  deliberately visible to people outside the account that owns it.
--
--  So this bucket is public for READ and strictly owned for WRITE. Anyone may
--  see an avatar; only its owner may add, replace or delete one. Objects are
--  stored as <user_id>/<file>, so the folder name is the owner and the rule is
--  the same shape as the winning board's, which keys on the first path segment.
--
--  Public read is a deliberate choice, not an oversight: it means an avatar can
--  be rendered with a plain URL that caches, instead of a signed URL minted per
--  request per viewer. Nothing private is ever put in this bucket.
-- ============================================================================

alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- the first path segment is the account that owns the file
create or replace function public.storage_owner_id(object_name text) returns uuid
language plpgsql immutable as $$
declare seg text;
begin
  seg := split_part(object_name, '/', 1);
  if seg !~ '^[0-9a-fA-F-]{36}$' then
    return null;
  end if;
  return seg::uuid;
exception when others then
  return null;
end $$;

drop policy if exists avatar_objects_read on storage.objects;
create policy avatar_objects_read on storage.objects for select
  using (bucket_id = 'avatars');

-- write, replace and remove: the owner alone. auth.uid() is null for an
-- anonymous caller and storage_owner_id is null for a path that is not a uuid
-- folder, and null = null is not true, so both are refused rather than allowed.
drop policy if exists avatar_objects_write on storage.objects;
create policy avatar_objects_write on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and public.storage_owner_id(name) = auth.uid()
  );

drop policy if exists avatar_objects_update on storage.objects;
create policy avatar_objects_update on storage.objects for update
  using (
    bucket_id = 'avatars'
    and public.storage_owner_id(name) = auth.uid()
  );

drop policy if exists avatar_objects_delete on storage.objects;
create policy avatar_objects_delete on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and public.storage_owner_id(name) = auth.uid()
  );

-- ── who may change a profile row ────────────────────────────────────────────
-- Everyone signed in can already read profiles they share an event with. This
-- lets a person edit their own name and avatar, and nobody else's. The role
-- column stays out of reach: guard_super_admin already refuses to let anyone
-- but the root address hold super_admin, and this policy does not widen that.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- A person may not change their own role by editing their profile.
create or replace function public.freeze_own_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() = old.id
     and lower(old.email) <> public.root_admin_email() then
    raise exception 'a role is not self-assigned';
  end if;
  return new;
end $$;

drop trigger if exists profiles_freeze_own_role on public.profiles;
create trigger profiles_freeze_own_role
  before update on public.profiles
  for each row execute function public.freeze_own_role();

-- ============================================================================
--  0013 — the enquiry form can actually save an enquiry
-- ============================================================================
--  A visitor filling in the form is anonymous, and `leads` has no policy that
--  lets anonymous insert. The code got around that by writing with the service
--  role, which meant the form worked only on a server that had been given
--  SUPABASE_SERVICE_ROLE_KEY. Nothing in the deploy asked for that key, so on
--  the live droplet every submission failed with "לא הצלחנו לשמור את הפנייה"
--  and the enquiry was simply lost.
--
--  Handing the server a key that bypasses row level security, for the sake of
--  one insert, is the wrong trade anyway. Instead there is exactly one way in:
--  a security definer function that can insert a lead and nothing else. The
--  public gets that one door, the table stays closed, and the deployment needs
--  no secret beyond the publishable key it already has.
--
--  Validation lives here too, so the limits hold no matter who calls it.
-- ============================================================================

create or replace function public.submit_lead(
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default ''
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name  text := btrim(coalesce(p_full_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if length(v_name) < 2 then
    raise exception 'שם מלא חסר' using errcode = 'check_violation';
  end if;
  if v_phone = '' and v_email = '' then
    raise exception 'צריך טלפון או אימייל' using errcode = 'check_violation';
  end if;
  if v_email <> '' and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'אימייל לא תקין' using errcode = 'check_violation';
  end if;
  if p_guest_count is not null and (p_guest_count <= 0 or p_guest_count > 5000) then
    raise exception 'כמות אורחים לא תקינה' using errcode = 'check_violation';
  end if;

  /* Lengths are capped rather than rejected: a visitor who pastes too much
     should still reach us, and a script that pastes a megabyte should not be
     able to fill the table. */
  insert into public.leads (full_name, phone, email, kind, event_date, guest_count, message, source)
  values (
    left(v_name, 120),
    left(v_phone, 40),
    left(v_email, 160),
    (case when p_kind = 'corporate' then 'corporate' else 'wedding' end)::event_class,
    p_event_date,
    p_guest_count,
    left(coalesce(p_message, ''), 4000),
    'site'
  );
  -- producer_id is filled by the leads_attribute trigger.
end $$;

revoke all on function public.submit_lead(text, text, text, text, date, integer, text) from public;
grant execute on function public.submit_lead(text, text, text, text, date, integer, text)
  to anon, authenticated, service_role;

-- ── the name on the workspace ───────────────────────────────────────────────
--  The 0011 backfill filled brand_name from the account's full name, because
--  that was the only name it had. For the root account that meant the header
--  read "barak liver" — the Google profile name, in lowercase Latin, on a
--  Hebrew right-to-left product. Set it to the actual brand, but only where it
--  was inherited rather than chosen, so a name typed on purpose survives.
update public.producers pr
   set brand_name = 'ברק ליור'
  from public.profiles p
 where p.id = pr.owner_id
   and lower(p.email) = public.root_admin_email()
   and (btrim(pr.brand_name) = '' or pr.brand_name = p.full_name);

-- ============================================================================
--  0014 — three defects found by auditing the invitation path end to end
-- ============================================================================
--  The invitation flow itself turned out to be sound: a couple invited before
--  or after they sign up ends as role 'client', bound to the workspace, seeing
--  their event and nothing else, and a third address is refused. That was
--  tested against a real Postgres with the policies on, both orderings.
--
--  These are the three things that were actually wrong.
-- ============================================================================


-- ── 1. the couple could see the money ───────────────────────────────────────
--  budget_items is gated on clients.budget_visible, so a producer who has not
--  chosen to share numbers keeps them private. payments was not gated at all:
--  the same couple read every instalment, its amount and its due date. Cost is
--  the producer's information until the producer decides otherwise, and one of
--  the two money tables was quietly ignoring that.
--
--  Note this is read only. Writing payments was already producer-only.

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select using (
  public.owns_producer(public.producer_of_client(client_id))
  or public.is_super_admin()
  or (
    public.can_read_client(client_id)
    and exists (select 1 from public.clients c
                 where c.id = payments.client_id and c.budget_visible)
  )
);


-- ── 2. couples were queuing for producer approval ───────────────────────────
--  Somebody who signs up before being invited is a producer until the invite
--  arrives, and gets a producers row on the way. bind_authorized_email() then
--  demotes the profile to 'client' but left that row behind, so the root admin
--  opened the approval queue and found couples waiting in it, and the couple's
--  own header showed their stale pending brand name instead of the producer's.
--
--  A demoted account has no business owning a workspace. The row goes when the
--  role does — but only when it is empty, because an account that has already
--  produced events is a real producer being invited to somebody else's wedding,
--  and deleting that would cascade their own clients away.

create or replace function public.bind_authorized_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  select id, role into p from public.profiles where lower(email) = lower(new.email);
  if found then
    new.profile_id := p.id;

    -- never demote the root admin, and never demote a producer who already
    -- owns an approved workspace of their own
    if p.role = 'producer'
       and not exists (select 1 from public.producers pr
                       where pr.owner_id = p.id and pr.status = 'approved') then
      update public.profiles set role = 'client' where id = p.id;

      -- and take the empty workspace with it, so the approval queue holds
      -- producers and only producers
      delete from public.producers pr
       where pr.owner_id = p.id
         and pr.status <> 'approved'
         and not exists (select 1 from public.clients c where c.producer_id = pr.id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists cae_bind on public.client_authorized_emails;
create trigger cae_bind before insert on public.client_authorized_emails
  for each row execute function public.bind_authorized_email();

-- clear the ones already sitting in the queue
delete from public.producers pr
 using public.profiles p
 where p.id = pr.owner_id
   and p.role = 'client'
   and pr.status <> 'approved'
   and not exists (select 1 from public.clients c where c.producer_id = pr.id);


-- ── 3. the schema assumed grants it never made ──────────────────────────────
--  Every table here is created without a single grant, on the assumption that
--  the public schema still carries the default privileges a new Supabase
--  project ships with. That assumption holds right up until the schema is
--  recreated — which our own reset script does — and then every table returns
--  "permission denied", before RLS is ever consulted. It is the exact symptom
--  that reads as "the couple cannot get in", and it is invisible in the SQL
--  editor, which runs as an owner that needs no grant.
--
--  Saying it out loud costs nothing and is idempotent.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;

alter default privileges in schema public grant all    on tables    to authenticated, service_role;
alter default privileges in schema public grant all    on sequences to authenticated, service_role;
alter default privileges in schema public grant select on tables    to anon;

--  RLS is what actually protects these tables; the grant only decides whether
--  the request gets as far as a policy. Every table in this schema has row
--  level security enabled, so a blanket grant hands nobody a row they were not
--  already entitled to. Guard that claim rather than trusting it:
do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    raise exception 'table public.% has no row level security, and was just granted to authenticated', t;
  end loop;
end $$;

-- ============================================================================
--  0015 — live updates across every device
-- ============================================================================
--  A producer edits a task on the laptop; the couple's phone should show it
--  without anybody pulling to refresh. Postgres already knows the row changed,
--  so the work is to let that change out over the socket, and to make sure it
--  leaves with enough information for Realtime to decide who may hear it.
--
--  Two settings matter, and the second is the one that is easy to miss:
--
--  1. The table has to be in the supabase_realtime publication, or no change
--     is broadcast at all.
--
--  2. The table needs `replica identity full`. By default an UPDATE or DELETE
--     writes only the primary key to the write-ahead log, and Realtime cannot
--     evaluate a row level security policy against a row it has never seen, so
--     it fails closed and drops the event for everybody. Our policies all key
--     on client_id or producer_id, never on the primary key, which means that
--     without this setting inserts would arrive while edits and deletions
--     silently vanished. That is worse than no realtime at all: the screen
--     would look live while quietly going stale.
--
--  The cost of `full` is a wider WAL record per write. At the volume of one
--  production company's events that is not a consideration.
--
--  Realtime still applies row level security per subscriber, so this grants
--  nobody a row they could not already read over the REST API. A couple
--  listening to `tasks` hears about their own event and no other.
-- ============================================================================

do $$ begin
  create publication supabase_realtime;
exception when duplicate_object then null; end $$;

do $$
declare
  t text;
  live_tables text[] := array[
    'clients',                  -- the event itself: date, venue, guest estimate
    'tasks',                    -- both sides tick these off
    'guests_rsvp',              -- replies land while somebody is looking at the list
    'tables_seating',           -- two people seating guests at once
    'moodboards',               -- an upload should appear on the producer's screen
    'day_schedule',             -- the run sheet on the day, on everybody's phone
    'leads',                    -- an enquiry arriving mid-conversation
    'sales_calls',
    'budget_items',
    'payments',
    'client_authorized_emails', -- the couple's access, as it is granted
    'notifications'             -- the bell, without a reload
  ];
begin
  foreach t in array live_tables loop
    -- fail loudly rather than silently skipping a table that was renamed away
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = t and c.relkind = 'r'
    ) then
      raise exception 'realtime: public.% does not exist', t;
    end if;

    execute format('alter table public.%I replica identity full', t);

    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============================================================================
--  0016 — an event that is over stops competing for attention
-- ============================================================================
--  Every screen so far treats the twelve events a producer has ever run and
--  the three they are actually working on as the same list. That gets worse
--  every season, and it gets worse fastest for the person doing well.
--
--  Archiving is deliberately not deletion. A wedding that happened is the
--  record of what was agreed, what was paid and who came, and it is wanted
--  years later — for a reference, a dispute, or the next couple asking what a
--  similar evening cost. So the row stays, its guests and payments stay, and
--  one timestamp says it is no longer live work.
--
--  Nullable rather than a boolean, because "when did we close this" is a
--  question that gets asked and a boolean cannot answer it.
-- ============================================================================

alter table public.clients
  add column if not exists archived_at timestamptz;

comment on column public.clients.archived_at is
  'When the producer closed the event. Null means live work. Never set automatically: a date passing is a prompt to close, not the closing itself.';

/* The board reads live events on every load and archived ones rarely, so the
   index covers the common half. Partial, because indexing the archived rows
   would be paying for the query nobody runs. */
create index if not exists clients_live_idx
  on public.clients (producer_id, event_date)
  where archived_at is null;

/* No policy change. clients_write already restricts every write on this table
   to the producer who owns the workspace or the root admin, so archiving is
   covered by the rule that was already there — and a couple cannot archive
   their own event, which is correct: it is the producer's record to close. */

-- ============================================================================
--  0017 — the run sheet, and who each line is for
-- ============================================================================
--  On the day, four different people need the same schedule and none of them
--  need all of it. The photographer needs to know when the couple gets ready
--  and when the light goes; the venue needs load-in, service and last call;
--  the couple needs where to stand and when. Handing all three the same
--  forty-line document means each of them reading past everything that is not
--  theirs, at the one moment nobody has time to read.
--
--  So a line can say who it is for. The default is everybody, because most
--  lines genuinely are, and because a field that must be filled in before a
--  schedule works is a field that will be left empty in a hurry.
--
--  A text array rather than columns per role: the roles will grow — a band, a
--  rabbi, a bus company — and adding one should not be a schema change. The
--  check constraint keeps that honest, so a typo cannot invent a silent role
--  whose lines then appear on nobody's sheet.
-- ============================================================================

alter table public.day_schedule
  add column if not exists audience text[] not null default '{}';

do $$ begin
  alter table public.day_schedule
    add constraint day_audience_known
    check (audience <@ array['couple','photo','vendors','crew']::text[]);
exception when duplicate_object then null; end $$;

comment on column public.day_schedule.audience is
  'Who this line is for. Empty means everyone, which is the common case and the default.';

/* Nothing changes about who may read or write the row: day_schedule_all
   already scopes every operation to the people on the workspace. A couple can
   still write their own run sheet, which is the point of it being shared. */

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

-- ============================================================================
--  0019 — contracts, and a signature that means something
-- ============================================================================
--  The whole value of signing something in an app rather than on paper is that
--  both sides can later agree on what was signed. That is one property, and
--  everything here exists to hold it: after a signature, the terms cannot
--  change.
--
--  Without that, an "e-signature" is worse than a scanned page — it looks
--  authoritative while the producer can quietly edit the amount afterwards and
--  nobody can tell. So the terms are frozen by a trigger, not by a screen that
--  hides the edit button, and the exact text signed is fingerprinted at the
--  moment of signing so any later tampering is detectable rather than a matter
--  of opinion.
-- ============================================================================

alter type notice_kind add value if not exists 'contract';

do $$ begin
  create type contract_state as enum ('draft','sent','signed','void');
exception when duplicate_object then null; end $$;

create table if not exists public.contracts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  title       text not null default '',
  /* The terms, as text. A producer who already has a PDF attaches it instead
     and leaves this short — but something readable has to exist on screen, or
     the couple is signing a filename. */
  body        text not null default '',
  file_path   text,
  amount      numeric(12,2),
  status      contract_state not null default 'draft',

  sent_at     timestamptz,
  signed_at   timestamptz,
  signed_by   uuid references public.profiles(id) on delete set null,
  /* The name typed at the moment of signing, kept verbatim. A profile can be
     renamed later; what somebody signed as cannot be. */
  signed_name text,
  /* Fingerprint of exactly what was on screen when they signed. */
  signed_hash text,

  created_at  timestamptz not null default now(),
  constraint contracts_title_len check (char_length(title) <= 200),
  constraint contracts_body_len  check (char_length(body) <= 60000),
  constraint contracts_amount_sane check (amount is null or (amount >= 0 and amount < 100000000)),
  /* A signed contract carries its whole signature or none of it. Half a
     signature is a bug that would otherwise be storable. */
  constraint contracts_signature_complete check (
    (status <> 'signed')
    or (signed_at is not null and signed_by is not null
        and coalesce(btrim(signed_name), '') <> '' and signed_hash is not null)
  )
);
create index if not exists contracts_client_idx on public.contracts (client_id, created_at desc);

alter table public.contracts enable row level security;


-- ── what a signature covers ─────────────────────────────────────────────────
--  Title, terms, attached file and amount: everything a person would read
--  before agreeing. Status and timestamps are deliberately outside it, since
--  they change as a consequence of signing rather than being part of the deal.
/* search_path names `extensions` as well as `public`, and that is not
   decoration. pgcrypto lives in `extensions` on Supabase and in `public` on a
   plain PostgreSQL install, so a function pinned to one of them works on
   exactly one of the two. This one is `language sql`, whose body is parsed
   when the function is created rather than when it runs, so the mismatch is
   not a latent runtime bug — it fails the whole setup script on the spot.
   Naming both schemas resolves it either way, and a schema that is absent is
   simply skipped. */
create or replace function public.contract_digest(
  p_title text, p_body text, p_file text, p_amount numeric
) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(
    digest(
      coalesce(p_title,'') || E'\n\x1e' ||
      coalesce(p_body,'')  || E'\n\x1e' ||
      coalesce(p_file,'')  || E'\n\x1e' ||
      coalesce(p_amount::text,''),
      'sha256'
    ), 'hex')
$$;


-- ── the terms stop moving once somebody has agreed to them ──────────────────
create or replace function public.freeze_signed_contract() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'signed' then
    return new;
  end if;

  if public.contract_digest(new.title, new.body, new.file_path, new.amount)
     is distinct from
     public.contract_digest(old.title, old.body, old.file_path, old.amount) then
    raise exception 'a signed contract cannot be edited';
  end if;

  /* Nor can the signature itself be rewritten or moved onto somebody else. */
  if new.signed_at   is distinct from old.signed_at
     or new.signed_by   is distinct from old.signed_by
     or new.signed_name is distinct from old.signed_name
     or new.signed_hash is distinct from old.signed_hash then
    raise exception 'a signature cannot be altered';
  end if;

  /* Voiding stays available — a deal really can be cancelled — but it is the
     only status a signed contract may move to, and it does not erase what was
     signed. */
  if new.status <> old.status and new.status <> 'void' then
    raise exception 'a signed contract can only be voided';
  end if;

  return new;
end $$;

drop trigger if exists contracts_freeze on public.contracts;
create trigger contracts_freeze before update on public.contracts
  for each row execute function public.freeze_signed_contract();

/* Deleting a signed contract would be the same hole by another route. */
create or replace function public.block_signed_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'signed' then
    raise exception 'a signed contract cannot be deleted, only voided';
  end if;
  return old;
end $$;

drop trigger if exists contracts_no_delete on public.contracts;
create trigger contracts_no_delete before delete on public.contracts
  for each row execute function public.block_signed_delete();


-- ── who sees and who writes ─────────────────────────────────────────────────
--  A draft is the producer's working copy: the couple has no business seeing
--  terms that are still being written, and being shown a draft that then
--  changes is how people stop trusting a document.
drop policy if exists contracts_read on public.contracts;
create policy contracts_read on public.contracts for select using (
  public.owns_producer(public.producer_of_client(client_id))
  or public.is_super_admin()
  or (public.can_read_client(client_id) and status <> 'draft')
);

drop policy if exists contracts_write on public.contracts;
create policy contracts_write on public.contracts for all using (
  public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin()
) with check (
  public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin()
);


-- ── signing ─────────────────────────────────────────────────────────────────
--  A function rather than an update policy, because signing is not an edit.
--  It is one transition, available to one kind of person, that records who and
--  when and exactly what — and a policy broad enough to allow it would also
--  allow the couple to change the amount on their way past.
create or replace function public.sign_contract(p_contract uuid, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c    public.contracts%rowtype;
  name text := btrim(coalesce(p_name, ''));
begin
  select * into c from public.contracts where id = p_contract;
  if not found then
    raise exception 'that contract does not exist';
  end if;
  if not public.can_read_client(c.client_id) then
    raise exception 'that contract does not exist';
  end if;

  /* The producer drafts it; the couple agrees to it. A producer signing their
     own contract on the couple's behalf is the one thing this must not allow,
     however convenient it would be on a phone call. */
  if public.owns_producer(public.producer_of_client(c.client_id)) then
    raise exception 'the couple signs this, not the producer';
  end if;

  if c.status = 'signed' then raise exception 'this is already signed'; end if;
  if c.status <> 'sent'   then raise exception 'this is not open for signature'; end if;
  if char_length(name) < 2 then raise exception 'נא לחתום בשם מלא'; end if;

  update public.contracts
     set status      = 'signed',
         signed_at   = now(),
         signed_by   = auth.uid(),
         signed_name = left(name, 120),
         signed_hash = public.contract_digest(c.title, c.body, c.file_path, c.amount)
   where id = p_contract;
end $$;

revoke all on function public.sign_contract(uuid, text) from public;
grant execute on function public.sign_contract(uuid, text) to authenticated, service_role;

/** Does the document still match what was signed? Anybody on the workspace can
    ask, which is the point — an integrity claim nobody can check is a slogan. */
create or replace function public.contract_intact(p_contract uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when c.status <> 'signed' then true
    else c.signed_hash = public.contract_digest(c.title, c.body, c.file_path, c.amount)
  end
  from public.contracts c
  where c.id = p_contract and public.can_read_client(c.client_id)
$$;
grant execute on function public.contract_intact(uuid) to authenticated, service_role;


-- ── telling people ──────────────────────────────────────────────────────────
create or replace function public.notify_contract() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid; producer uuid;
begin
  if tg_op = 'UPDATE' and old.status = 'draft' and new.status = 'sent' then
    for who in select public.client_couple_profiles(new.client_id) loop
      perform public.notify(who, 'contract', 'הסכם ממתין לחתימה',
        coalesce(nullif(new.title,''), 'הסכם הפקה'), '/app/portal');
    end loop;
  elsif tg_op = 'UPDATE' and old.status <> 'signed' and new.status = 'signed' then
    producer := public.client_producer_profile(new.client_id);
    perform public.notify(producer, 'contract', 'ההסכם נחתם',
      coalesce(new.signed_name,'') || ' · ' || coalesce(nullif(new.title,''), 'הסכם הפקה'),
      '/app/clients/' || new.client_id);
  end if;
  return new;
end $$;

drop trigger if exists contracts_notify on public.contracts;
create trigger contracts_notify after update on public.contracts
  for each row execute function public.notify_contract();


-- ── the attached document ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

drop policy if exists contract_objects_read on storage.objects;
create policy contract_objects_read on storage.objects for select
  using (bucket_id = 'contracts' and public.can_read_client(public.storage_client_id(name)));

/* Only the producer puts a document there; the couple reads it. */
drop policy if exists contract_objects_write on storage.objects;
create policy contract_objects_write on storage.objects for insert
  with check (bucket_id = 'contracts'
              and public.owns_producer(public.producer_of_client(public.storage_client_id(name))));

drop policy if exists contract_objects_delete on storage.objects;
create policy contract_objects_delete on storage.objects for delete
  using (bucket_id = 'contracts'
         and public.owns_producer(public.producer_of_client(public.storage_client_id(name))));


-- ── live, like everything else ──────────────────────────────────────────────
alter table public.contracts replica identity full;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contracts'
  ) then
    alter publication supabase_realtime add table public.contracts;
  end if;
end $$;

grant all on public.contracts to authenticated, service_role;

-- ============================================================================
--  0020 — three addresses on a workspace, not two
-- ============================================================================
--  Two was the wrong number, chosen for the two people getting married. In
--  practice a third person is nearly always doing some of the work: a parent
--  paying for part of it, a sibling running the guest list, a co-organiser on
--  a corporate event. Today they either borrow somebody's login, which makes
--  every action on the workspace untraceable, or they get forwarded
--  screenshots, which is worse.
--
--  The number lives in one function so raising it again is one line. It stays
--  a hard cap rather than becoming unlimited: an account that anybody can be
--  added to is not a workspace, it is a mailing list, and the couple should be
--  able to name everyone who can see their budget.
-- ============================================================================

create or replace function public.max_authorized_emails() returns int
language sql immutable as $$ select 3 $$;

create or replace function public.cap_authorized_emails() returns trigger
language plpgsql set search_path = public as $$
declare
  cap  int := public.max_authorized_emails();
  used int;
begin
  select count(*) into used
    from public.client_authorized_emails
   where client_id = new.client_id;

  if used >= cap then
    /* The number is in the message because the screen shows this text and a
       person reading "at most 3" can count their own list and understand it. */
    raise exception 'a workspace accepts at most % authorized emails', cap;
  end if;
  return new;
end $$;

drop trigger if exists cae_cap on public.client_authorized_emails;
create trigger cae_cap before insert on public.client_authorized_emails
  for each row execute function public.cap_authorized_emails();

grant execute on function public.max_authorized_emails() to anon, authenticated, service_role;

-- ============================================================================
--  0021 — the root admin can hand an event to another producer
-- ============================================================================
--  clients_write reads as though the super admin can do anything, because its
--  USING clause says so. Its WITH CHECK does not:
--
--      using      (can_read_client(id) and is_approved_producer())
--      with check (owns_producer(producer_id) and is_approved_producer())
--
--  owns_producer() has no super-admin clause — deliberately, since it answers
--  "is this yours", and the honest answer for the root account is usually no.
--  So the root admin could read every event and edit the ones already theirs,
--  and the single operation the admin screen exists for, moving an event to
--  somebody else, failed with "new row violates row-level security policy".
--
--  Found by trying it rather than by reading the policy, which had looked
--  right twice.
--
--  The producer's own rule is untouched: they may only put an event under a
--  producer they own, and only while approved. The super admin is added as a
--  separate branch rather than by loosening owns_producer(), which is used in
--  a dozen other policies where "is this yours" is exactly the question.
-- ============================================================================

drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients for all
  using (
    (public.can_read_client(id) and public.is_approved_producer())
    or public.is_super_admin()
  )
  with check (
    (public.owns_producer(producer_id) and public.is_approved_producer())
    or public.is_super_admin()
  );

-- ============================================================================
--  0022 — signing in by phone, without becoming a second person
-- ============================================================================
--  Supabase treats an email sign-in and a phone sign-in as two different
--  accounts. Left alone, that is not a feature with a rough edge, it is a
--  trap: the root admin signs in by phone one morning and arrives as a brand
--  new producer awaiting approval, with no events and no permissions; a bride
--  who was invited by email and signs in by phone lands in an empty portal and
--  concludes the app lost her wedding.
--
--  So the work here is not sending an SMS. It is making one person resolve to
--  one account whichever way they arrive, which means the workspace has to
--  recognise a phone number the same way it already recognises an address.
--
--  An invitation is now a contact rather than an email: it carries an address,
--  a number, or both, and the cap of three counts people rather than channels.
-- ============================================================================

-- ── one shape for a number ──────────────────────────────────────────────────
--  A phone is typed six different ways by the same person in the same week.
--  Everything is compared in E.164, and the raw form is never what is matched
--  on — that is how "050-123-4567" and "+972 50 123 4567" become two guests,
--  two invitations, or two accounts.
create or replace function public.normalize_phone(raw text) returns text
language plpgsql immutable set search_path = public as $$
declare d text;
begin
  if raw is null then return null; end if;
  d := regexp_replace(raw, '\D', '', 'g');
  if d = '' then return null; end if;

  /* Israeli numbers, in the forms people actually type. Anything already
     carrying a country code is left as it is, so this does not quietly mangle
     a number from somewhere else. */
  if d ~ '^0[5][0-9]{8}$'      then return '+972' || substring(d from 2); end if;
  if d ~ '^0[2-9][0-9]{7,8}$'  then return '+972' || substring(d from 2); end if;
  if d ~ '^972[0-9]{8,9}$'     then return '+' || d; end if;
  if length(d) between 8 and 15 then return '+' || d; end if;
  return null;
end $$;

grant execute on function public.normalize_phone(text) to anon, authenticated, service_role;


-- ── a person may have a number, an address, or both ─────────────────────────
alter table public.profiles add column if not exists phone text;

/* email stops being mandatory, because somebody who arrives by phone has none.
   It also stops being stored as an empty string: profiles_email_key is a
   unique index on lower(email), and '' is a value like any other — so the
   first phone-only signup took the empty slot and the second was refused with
   a duplicate key error. Found by signing two people up by phone in a test,
   which is the only way this shows. */
alter table public.profiles alter column email drop not null;
update public.profiles set email = null where btrim(coalesce(email, '')) = '';

drop index if exists profiles_email_key;
create unique index if not exists profiles_email_key
  on public.profiles (lower(email)) where email is not null;

do $$ begin
  alter table public.profiles
    add constraint profiles_has_a_contact
    check (coalesce(btrim(email), '') <> '' or coalesce(btrim(phone), '') <> '');
exception when duplicate_object then null; end $$;

comment on column public.profiles.phone is
  'E.164. The second way the same person can arrive; never a second person.';

/* A number belongs to one account, the same as an address does. Partial,
   because most accounts have no number and null is not a duplicate. */
create unique index if not exists profiles_phone_key
  on public.profiles (phone) where phone is not null;


-- ── an invitation is a contact, not an address ──────────────────────────────
alter table public.client_authorized_emails add column if not exists phone text;
alter table public.client_authorized_emails alter column email drop not null;

do $$ begin
  alter table public.client_authorized_emails
    add constraint cae_has_a_contact
    check (coalesce(btrim(email), '') <> '' or coalesce(btrim(phone), '') <> '');
exception when duplicate_object then null; end $$;

/* The old index assumed every row had an address. Two phone-only invitations
   would both carry an empty email and collide on it. */
drop index if exists cae_client_email_key;
create unique index if not exists cae_client_email_key
  on public.client_authorized_emails (client_id, lower(email)) where email is not null;
create unique index if not exists cae_client_phone_key
  on public.client_authorized_emails (client_id, phone) where phone is not null;

/* Numbers are stored normalised, so a match is a match. */
create or replace function public.cae_normalize() returns trigger
language plpgsql set search_path = public as $$
begin
  new.phone := public.normalize_phone(new.phone);
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  return new;
end $$;

drop trigger if exists cae_normalize on public.client_authorized_emails;
create trigger cae_normalize before insert or update on public.client_authorized_emails
  for each row execute function public.cae_normalize();


-- ── the workspace recognises either ─────────────────────────────────────────
create or replace function public.can_read_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_super_admin()
    or exists (select 1 from public.clients c join public.producers pr on pr.id = c.producer_id
               where c.id = cid and pr.owner_id = auth.uid())
    or exists (
      select 1
        from public.client_authorized_emails e
        join public.profiles p on p.id = auth.uid()
       where e.client_id = cid
         and (
           (e.email is not null and p.email is not null and lower(e.email) = lower(p.email))
           or (e.phone is not null and p.phone is not null and e.phone = p.phone)
         )
    )
$$;


-- ── arriving for the first time, by either door ─────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  addr       text := nullif(lower(btrim(coalesce(new.email, ''))), '');
  tel        text := public.normalize_phone(new.phone);
  is_root    boolean;
  is_invited boolean;
  existing   uuid;
  new_role   app_role;
begin
  /* If this number or address already belongs to somebody, the person is not
     new — they have walked in through the other door. Adopt the identity that
     exists rather than minting a rival one, and fill in whichever contact was
     missing so the next arrival by either route lands in the same place. */
  select id into existing from public.profiles
   where (tel is not null and phone = tel)
      or (addr is not null and lower(email) = addr)
   limit 1;

  if existing is not null then
    update public.profiles
       set phone = coalesce(phone, tel),
           email = coalesce(email, addr)
     where id = existing;
    return new;
  end if;

  /* Root is pinned to the address and only the address. A number can be
     changed at a phone shop; the address is the thing this platform's
     ownership is defined by, and it stays the only way in to that role. */
  is_root := addr is not null and addr = public.root_admin_email();

  is_invited := exists (
    select 1 from public.client_authorized_emails e
     where (addr is not null and e.email is not null and lower(e.email) = addr)
        or (tel is not null and e.phone is not null and e.phone = tel)
  );

  new_role := case
    when is_root    then 'super_admin'::app_role
    when is_invited then 'client'::app_role
    else 'producer'::app_role
  end;

  insert into public.profiles (id, email, full_name, role, phone)
  values (new.id, addr, coalesce(new.raw_user_meta_data->>'full_name',''), new_role, tel)
  on conflict (id) do nothing;

  if is_invited then
    update public.client_authorized_emails
       set profile_id = new.id
     where profile_id is null
       and ((addr is not null and email is not null and lower(email) = addr)
         or (tel is not null and phone is not null and phone = tel));
  end if;

  if new_role in ('producer','super_admin') then
    insert into public.producers (owner_id, brand_name, contact_name, contact_email, status)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'brand_name',''),
      coalesce(new.raw_user_meta_data->>'full_name',''),
      coalesce(addr, ''),
      case when is_root then 'approved'::producer_state else 'pending'::producer_state end
    );
  end if;

  return new;
end $$;


-- ── invited after they already signed up ────────────────────────────────────
create or replace function public.bind_authorized_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select id, role into p from public.profiles
   where (new.email is not null and lower(email) = lower(new.email))
      or (new.phone is not null and phone = new.phone)
   limit 1;

  if found then
    new.profile_id := p.id;

    if p.role = 'producer'
       and not exists (select 1 from public.producers pr
                       where pr.owner_id = p.id and pr.status = 'approved') then
      update public.profiles set role = 'client' where id = p.id;

      delete from public.producers pr
       where pr.owner_id = p.id
         and pr.status <> 'approved'
         and not exists (select 1 from public.clients c where c.producer_id = pr.id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists cae_bind on public.client_authorized_emails;
create trigger cae_bind before insert on public.client_authorized_emails
  for each row execute function public.bind_authorized_email();


-- ── existing numbers get the same shape ─────────────────────────────────────
update public.client_authorized_emails
   set phone = public.normalize_phone(phone)
 where phone is not null and phone <> public.normalize_phone(phone);


-- ── a name for somebody who has no address ──────────────────────────────────
--  thread_people fell back to the local part of the email. Somebody who signed
--  in by phone has none, and a message signed by nobody is the bug this
--  function was written to fix in the first place.
create or replace function public.thread_people(p_client uuid)
returns table (id uuid, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce(
           nullif(btrim(p.full_name), ''),
           nullif(split_part(coalesce(p.email, ''), '@', 1), ''),
           /* last four digits, which is how people refer to a number they
              have not saved, and never the whole thing on somebody's screen */
           case when p.phone is not null then '…' || right(p.phone, 4) end,
           'משתתף'
         ),
         p.avatar_url
    from public.profiles p
   where public.can_read_client(p_client)
     and (
       p.id = public.client_producer_profile(p_client)
       or p.id in (select public.client_couple_profiles(p_client))
     )
$$;
grant execute on function public.thread_people(uuid) to authenticated, service_role;

-- ============================================================================
--  0023 — enquiries that arrive from somewhere other than our own form
-- ============================================================================
--  Instagram, Meta lead ads, Google's lead form extension and whatever Zapier
--  is wired to this month all produce the same thing: somebody who wants an
--  event and left a way to reach them. Until now the only door into `leads`
--  was submit_lead(), which is the site's own form: it validates strictly,
--  rejects what it does not like, and stamps every row 'site'.
--
--  Strict is right for a form somebody is looking at. It is wrong for a
--  webhook. A person who is refused can fix the field and press send again; a
--  webhook that is refused loses the lead, and the advertising spend that
--  bought it, with nobody ever knowing it existed. So ingestion gets its own
--  door with the opposite instinct: coerce, cap, and keep. The only thing
--  worth refusing is a payload with no name and no way to reply.
--
--  Two other things a webhook needs and a form does not:
--
--  It says where it came from, because a lead worth twice as much as another
--  is invisible until the source is on the row.
--
--  It can be delivered twice. Meta retries on any non 200, Zapier replays, and
--  a network timeout after a successful insert looks exactly like a failure.
--  So a delivery carries whatever id its sender knows the lead by, and the
--  second arrival of that id is answered rather than stored.
-- ============================================================================

-- ── the sender's own id for this lead ───────────────────────────────────────
alter table public.leads add column if not exists external_id text;

comment on column public.leads.external_id is
  'The id the sending system knows this lead by, prefixed with that system. '
  'Unique, so a retried delivery is recognised rather than duplicated.';

/* Partial, because almost every lead is typed by a person into our own form
   and has no external id at all — and null is never a duplicate. */
create unique index if not exists leads_external_id_key
  on public.leads (external_id) where external_id is not null;

/* Reading the funnel by source is the entire point of recording one. */
create index if not exists leads_source_idx on public.leads (source, created_at desc);


-- ── one shape for a source name ─────────────────────────────────────────────
--  'Instagram', 'instagram ', 'IG' and 'instagram' are four rows in a report
--  that should have one. Nothing downstream should have to remember to fold
--  the case, so it is folded once, here, on the way in.
create or replace function public.normalize_source(raw text) returns text
language sql immutable set search_path = public as $$
  select coalesce(
           nullif(
             /* Trimmed at both ends after folding, because punctuation at the
                edge of a name becomes an underscore at the edge of a slug:
                'Instagram Lead Ad!!' was arriving as 'instagram_lead_ad_',
                which is a different row in a report from 'instagram_lead_ad'
                and would have been noticed only once the report was wrong. */
             btrim(
               left(regexp_replace(lower(btrim(coalesce(raw, ''))), '[^a-z0-9]+', '_', 'g'), 40),
               '_'
             ),
             ''
           ),
           'webhook'
         )
$$;

grant execute on function public.normalize_source(text) to anon, authenticated, service_role;


-- ── the ingestion door ──────────────────────────────────────────────────────
create or replace function public.ingest_lead(
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default '',
  p_source      text default 'webhook',
  p_external_id text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name   text := btrim(coalesce(p_full_name, ''));
  v_phone  text := btrim(coalesce(p_phone, ''));
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_ext    text := nullif(btrim(coalesce(p_external_id, '')), '');
  v_date   date := p_event_date;
  v_guests integer := p_guest_count;
  v_id     uuid;
begin
  /* The one refusal. Something with neither a name nor a way to answer is not
     a lead that arrived badly formed, it is not a lead. */
  if v_name = '' and v_phone = '' and v_email = '' then
    raise exception 'פנייה ריקה' using errcode = 'check_violation';
  end if;

  /* Already delivered. Answer with the row that exists rather than making a
     second one, so a sender that retries ten times still has one lead. */
  if v_ext is not null then
    select id into v_id from public.leads where external_id = v_ext;
    if found then return v_id; end if;
  end if;

  /* Everything below is coerced rather than rejected. A date the table would
     refuse, a guest count somebody typed as "about 250", an address that is
     not one: none of them are worth losing the enquiry over, and all of them
     are still readable in the message a producer opens. */
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then v_email := ''; end if;
  if v_date is not null and v_date < date '2026-01-01' then v_date := null; end if;
  if v_guests is not null and (v_guests <= 0 or v_guests > 1500) then v_guests := null; end if;
  if v_name = '' then v_name := coalesce(nullif(v_phone, ''), v_email); end if;

  insert into public.leads (
    full_name, phone, email, kind, event_date, guest_count, message, source, external_id
  ) values (
    left(v_name, 120),
    left(v_phone, 40),
    left(v_email, 160),
    (case when p_kind = 'corporate' then 'corporate' else 'wedding' end)::event_class,
    v_date,
    v_guests,
    left(coalesce(p_message, ''), 4000),
    public.normalize_source(p_source),
    v_ext
  )
  /* Two deliveries racing each other land here rather than on the floor.
     The predicate is repeated because the index is partial: without it
     Postgres cannot tell which unique index this clause means, and refuses
     with "no unique or exclusion constraint matching the ON CONFLICT
     specification" — at run time, from inside the function, which is a long
     way from the index three screens up. */
  on conflict (external_id) where external_id is not null do nothing
  returning id into v_id;

  if v_id is null and v_ext is not null then
    select id into v_id from public.leads where external_id = v_ext;
  end if;

  -- producer_id is filled by the leads_attribute trigger.
  return v_id;
end $$;

revoke all on function public.ingest_lead(text, text, text, text, date, integer, text, text, text) from public;
grant execute on function public.ingest_lead(text, text, text, text, date, integer, text, text, text)
  to anon, authenticated, service_role;


-- ── a lead a producer took down on the phone ────────────────────────────────
--  Typed into the app by somebody who is signed in, so it is attributed to
--  them rather than to whoever the public site belongs to. Without this it is
--  a lead in a notebook, and the funnel that the whole leads screen reports on
--  is missing every enquiry that came in by phone.
create or replace function public.record_lead(
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default '',
  p_source      text default 'phone'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_producer uuid;
  v_id       uuid;
begin
  select pr.id into v_producer
    from public.producers pr
   where pr.owner_id = auth.uid() and pr.status = 'approved'
   order by pr.created_at
   limit 1;

  /* An unapproved account has no workspace to file this under. Falling back
     to the site's producer would quietly hand somebody else's enquiry to the
     root account, which is worse than refusing. */
  if v_producer is null then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'שם מלא חסר' using errcode = 'check_violation';
  end if;
  if btrim(coalesce(p_phone, '')) = '' and btrim(coalesce(p_email, '')) = '' then
    raise exception 'צריך טלפון או אימייל' using errcode = 'check_violation';
  end if;

  insert into public.leads (
    producer_id, full_name, phone, email, kind, event_date, guest_count, message, source
  ) values (
    v_producer,
    left(btrim(p_full_name), 120),
    left(btrim(coalesce(p_phone, '')), 40),
    left(lower(btrim(coalesce(p_email, ''))), 160),
    (case when p_kind = 'corporate' then 'corporate' else 'wedding' end)::event_class,
    case when p_event_date is not null and p_event_date >= date '2026-01-01' then p_event_date end,
    case when p_guest_count between 1 and 1500 then p_guest_count end,
    left(coalesce(p_message, ''), 4000),
    public.normalize_source(p_source)
  )
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.record_lead(text, text, text, text, date, integer, text, text) from public;
grant execute on function public.record_lead(text, text, text, text, date, integer, text, text)
  to authenticated, service_role;

-- ============================================================================
--  0024 — the run sheet as a document somebody works from, not a list
-- ============================================================================
--  Three things were missing, and each of them was the kind of gap that only
--  shows on the day.
--
--  A line could be added and deleted but not corrected. A time typed as 19:00
--  instead of 09:00 had to be deleted and retyped, which on a forty line
--  schedule means the correction is deferred and then forgotten.
--
--  A line had a start and no length. "18:00 קבלת פנים" tells nobody whether
--  the reception is forty minutes or ninety, and the question the producer is
--  actually answering all evening is how long is left, not when it began. The
--  gap to the next line is a guess at this and a bad one: the last line of the
--  night has no next line, and two things can genuinely start at once.
--
--  A line had no owner. On the day, "who is doing this" is asked out loud
--  about every third line, and the answer lives in somebody's memory.
--
--  None of these change who may read or write anything: day_schedule_all
--  already scopes every operation to the people on the workspace.
-- ============================================================================

alter table public.day_schedule add column if not exists duration_min integer;
alter table public.day_schedule add column if not exists owner text not null default '';

comment on column public.day_schedule.duration_min is
  'How long this runs, in minutes. Null means nobody said, which is honest and '
  'common; the sheet then shows the gap to whatever is next instead of inventing one.';
comment on column public.day_schedule.owner is
  'Who is responsible for this line. A free text name, because on the day it is '
  'as often "אבא של הכלה" as it is a supplier with a row in a table.';

do $$ begin
  alter table public.day_schedule
    add constraint day_duration_sane
    /* Sixteen hours. Long enough for a load-in that starts the night before,
       short enough that a mistyped 6000 is caught while somebody is looking
       at the form rather than on the printed sheet. */
    check (duration_min is null or (duration_min > 0 and duration_min <= 960));
exception when duplicate_object then null; end $$;

/* The sheet is read in time order all evening, and every read of it sorts. */
create index if not exists day_schedule_time_idx
  on public.day_schedule (client_id, at_time);


-- ── a starting point instead of a blank page ────────────────────────────────
--  A schedule that starts empty gets written the week of the wedding, at
--  night, from memory. Starting from a standard evening and deleting what does
--  not apply is a different job: it takes ten minutes, and the lines nobody
--  remembers until they are missing are already on it.
--
--  The template itself lives in the app rather than here, because it is
--  wording that will be argued over and improved, and wording does not belong
--  in a migration. What belongs here is the guarantee that applying one cannot
--  quietly destroy a schedule somebody already wrote.
create or replace function public.day_schedule_is_empty(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_read_client(p_client)
     and not exists (select 1 from public.day_schedule where client_id = p_client)
$$;

grant execute on function public.day_schedule_is_empty(uuid) to authenticated, service_role;

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

-- ============================================================================
--  0026 — changing the words on the site without a deploy
-- ============================================================================
--  Every line of public copy lives in one file, which was the right call: it
--  gets reviewed in one place and it ships with the code that renders it. What
--  it does not do is let the person whose business it describes change a
--  sentence on a Tuesday.
--
--  So this is an override layer, not a replacement. The shipped copy stays the
--  default and stays in the repository; a row here says "this one line reads
--  differently now". Three things follow from that shape, and all three are the
--  reason for it:
--
--  A missing row is not a missing sentence. An empty table renders exactly the
--  site that ships today.
--
--  A database that is unreachable is not a blank homepage. The defaults are
--  compiled in, so the worst case is a visitor reading last month's wording.
--
--  An edit is reversible by deleting a row, which means "put it back the way it
--  was" is a button rather than a support conversation.
--
--  Anonymous may read it, because the public site is anonymous and this is the
--  public site's text. Only the producer it belongs to may write it.
-- ============================================================================

create table if not exists public.site_content (
  producer_id uuid not null references public.producers(id) on delete cascade,
  /* A dotted path into the copy object: 'hero.headline', 'about.body'. The app
     decides which paths are editable and refuses the rest, because a free-form
     key would let a typo write a line nothing ever reads and look like it
     worked. */
  key         text not null,
  value       text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null,
  primary key (producer_id, key),
  constraint site_content_key_shape check (key ~ '^[a-z][a-zA-Z0-9_]*(\.[a-z][a-zA-Z0-9_]*)*$'),
  constraint site_content_not_huge check (length(value) <= 4000)
);

comment on table public.site_content is
  'Overrides for the marketing copy. The shipped text in content/site.ts is the '
  'default and the fallback; a row here changes one line of it.';

create index if not exists site_content_producer_idx on public.site_content (producer_id);

alter table public.site_content enable row level security;

/* The public site reads this while signed out, so anon may select. There is
   nothing private here: every value is a sentence intended to be read by
   strangers on a marketing page. */
drop policy if exists site_content_read on public.site_content;
create policy site_content_read on public.site_content for select using (true);

drop policy if exists site_content_write on public.site_content;
create policy site_content_write on public.site_content for all
  using      (public.owns_producer(producer_id) or public.is_super_admin())
  with check (public.owns_producer(producer_id) or public.is_super_admin());

grant select on public.site_content to anon, authenticated, service_role;
grant insert, update, delete on public.site_content to authenticated, service_role;

/* Who changed a sentence and when, filled in by the database so it cannot be
   left out by a caller. */
create or replace function public.stamp_site_content() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists site_content_stamp on public.site_content;
create trigger site_content_stamp before insert or update on public.site_content
  for each row execute function public.stamp_site_content();


-- ── writing one line ────────────────────────────────────────────────────────
--  An upsert rather than an insert, because editing the same sentence twice is
--  the normal case and the second edit is not a conflict. An empty value
--  deletes the row rather than storing a blank: "put it back the way it was"
--  and "make this line empty" are different intentions, and only one of them is
--  ever meant here.
create or replace function public.set_site_content(p_key text, p_value text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_producer uuid;
begin
  select pr.id into v_producer
    from public.producers pr
   where pr.owner_id = auth.uid() and pr.status = 'approved'
   order by pr.created_at
   limit 1;

  if v_producer is null then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  if btrim(coalesce(p_value, '')) = '' then
    delete from public.site_content where producer_id = v_producer and key = p_key;
    return;
  end if;

  insert into public.site_content (producer_id, key, value)
  values (v_producer, p_key, left(p_value, 4000))
  on conflict (producer_id, key) do update set value = excluded.value;
end $$;

revoke all on function public.set_site_content(text, text) from public;
grant execute on function public.set_site_content(text, text) to authenticated, service_role;


-- ── the public site has to be able to ask whose copy this is ────────────────
--  public_site_producer() has been callable by anonymous since 0009 only
--  because nothing ever revoked the default. Stating it means the day somebody
--  tightens function privileges across the schema, the marketing page does not
--  quietly fall back to the shipped wording with no error anywhere.
grant execute on function public.public_site_producer() to anon, authenticated, service_role;

-- ============================================================================
--  0027 — a calendar subscription that a calendar can actually read
-- ============================================================================
--  Both .ics routes authenticate with a cookie, which works when a person
--  clicks a link in a browser they are signed into, and never works for the
--  thing those files exist for. Apple Calendar and Google Calendar fetch a
--  subscription from their own servers, on a schedule, with no cookies at all.
--  Handed a cookie-protected URL they get a redirect to the sign-in page and
--  subscribe to nothing.
--
--  This fails in the worst way available: the webcal:// link opens the
--  calendar app, the app says it subscribed, and the calendar is simply empty
--  forever. Nobody reports it, because it looks like it worked.
--
--  So a feed is addressed by a secret in its own URL. That is how every
--  calendar subscription on the internet works, and it has the property that
--  comes with it: the URL is the credential. Anyone holding it can read that
--  feed. Which is why it is long, random, revocable, and scoped to exactly one
--  producer's diary or one couple's event and nothing else.
-- ============================================================================

create table if not exists public.calendar_feeds (
  id         uuid primary key default gen_random_uuid(),
  /* The secret in the URL. Long enough that guessing is not a strategy, and
     url-safe so no mail client mangles it on the way. */
  token      text not null unique,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  /* Null means the whole diary. Set means one event, which is what a couple
     subscribes to. */
  client_id  uuid references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  /* Revoked rather than deleted, so a feed that leaked stops working and the
     row stays as a record that it existed. */
  revoked_at timestamptz,
  constraint calendar_feeds_token_len check (length(token) >= 32)
);

create index if not exists calendar_feeds_owner_idx
  on public.calendar_feeds (profile_id, client_id);

comment on table public.calendar_feeds is
  'A secret URL a calendar app can fetch without a session. The token is the '
  'credential: long, random, revocable, and scoped to one diary or one event.';

alter table public.calendar_feeds enable row level security;

/* A person may see and revoke their own feeds. Nobody reads anybody else's,
   including the root admin: a calendar subscription is a credential, and there
   is no reason for an administrator to hold somebody else's. */
drop policy if exists calendar_feeds_own on public.calendar_feeds;
create policy calendar_feeds_own on public.calendar_feeds for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

grant select, insert, update, delete on public.calendar_feeds to authenticated;
grant select on public.calendar_feeds to service_role;


-- ── asking for your own subscription link ───────────────────────────────────
--  One per person per scope, reused rather than piling up: pressing the button
--  twice should hand back the same address, or every press would leave another
--  working credential behind that nobody remembers to revoke.
create or replace function public.calendar_feed_token(p_client uuid default null)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_token text;
begin
  if auth.uid() is null then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  /* A feed for one event is only for somebody who may read that event. */
  if p_client is not null and not public.can_read_client(p_client) then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  select token into v_token
    from public.calendar_feeds
   where profile_id = auth.uid()
     and client_id is not distinct from p_client
     and revoked_at is null
   limit 1;

  if found then return v_token; end if;

  /* 32 bytes from the same source the rest of this schema trusts, in url-safe
     base64 so no mail client, QR code or calendar app mangles it. */
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');

  insert into public.calendar_feeds (token, profile_id, client_id)
  values (v_token, auth.uid(), p_client);

  return v_token;
end $$;

revoke all on function public.calendar_feed_token(uuid) from public;
grant execute on function public.calendar_feed_token(uuid) to authenticated, service_role;


-- ── turning a leaked link off ───────────────────────────────────────────────
create or replace function public.revoke_calendar_feed(p_client uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.calendar_feeds
     set revoked_at = now()
   where profile_id = auth.uid()
     and client_id is not distinct from p_client
     and revoked_at is null;
end $$;

revoke all on function public.revoke_calendar_feed(uuid) from public;
grant execute on function public.revoke_calendar_feed(uuid) to authenticated, service_role;


-- ── what a calendar app is allowed to read with that token ──────────────────
--  The one function anonymous may call. It takes the secret and returns dated
--  rows, and it is deliberately the narrowest thing that can produce a
--  calendar: no ids to follow, no money the couple should not see, and nothing
--  at all for a token that is unknown or revoked.
--
--  A producer's diary carries their events, their dated tasks and their dated
--  payments. A couple's feed carries their event and its run sheet, which is
--  what they actually want on the morning.
create or replace function public.calendar_by_token(p_token text)
returns table (starts_on date, at_time time, title text, detail text, kind text)
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
             coalesce(nullif(c.venue, ''), ''), 'event'
        from public.clients c
        join public.producers pr on pr.id = c.producer_id
       where pr.owner_id = f.profile_id
         and c.archived_at is null
         and c.event_date is not null;

    return query
      select t.due_on, null::time, t.title, coalesce(c.display_name, ''), 'task'
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
             'payment'
        from public.payments p
        join public.clients c on c.id = p.client_id
        join public.producers pr on pr.id = c.producer_id
       where pr.owner_id = f.profile_id
         and c.archived_at is null
         and p.due_on is not null
         and not p.paid;
  else
    -- one event, for the couple
    return query
      select c.event_date, null::time, c.display_name,
             coalesce(nullif(c.venue, ''), ''), 'event'
        from public.clients c
       where c.id = f.client_id and c.event_date is not null;

    return query
      select c.event_date, d.at_time, d.title, coalesce(d.note, ''), 'schedule'
        from public.day_schedule d
        join public.clients c on c.id = d.client_id
       where d.client_id = f.client_id
         and c.event_date is not null;
  end if;
end $$;

revoke all on function public.calendar_by_token(text) from public;
grant execute on function public.calendar_by_token(text) to anon, authenticated, service_role;

-- ============================================================================
--  0028 — a task the couple should not see
-- ============================================================================
--  Every task on an event has been visible to the couple, because tasks_read
--  asks can_read_client and nothing else. For most of them that is right: the
--  point of the shared workspace is that both sides see the same list.
--
--  Some of them are not for sharing, and the producer's own file makes that
--  obvious the moment it is read: "cash envelopes for the rabbi, the magnet
--  photographer and tips for the hall staff", "no extra bottles to the tables
--  without approval". Those are operating instructions. Put in front of a
--  couple three weeks before their wedding they read as a list of things that
--  might go wrong, which is the opposite of what this platform is for.
--
--  So a task carries whether it is shared, the producer decides per task, and
--  the default is shared. Defaulting the other way would quietly hide every
--  task that already exists, which is the kind of migration that loses trust
--  in one afternoon.
-- ============================================================================

alter table public.tasks
  add column if not exists visible_to_client boolean not null default true;

comment on column public.tasks.visible_to_client is
  'False keeps a task on the producer''s side of the wall. Default true, so '
  'nothing that already existed changes hands.';

/* The couple's half of the read: shared tasks only. The producer's half is
   unconditional, because it is their workspace. Written as two branches
   rather than one clever expression so the next person can see which is
   which. */
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or public.is_super_admin()
    or (public.can_read_client(client_id) and visible_to_client)
  );

/* A couple may still tick their own tasks off, and may not decide what they
   are allowed to see. Enforced in a trigger because row level security has no
   opinion about which column changed. */
create or replace function public.guard_task_visibility() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.visible_to_client is distinct from old.visible_to_client
     and not public.owns_producer(public.producer_of_client(new.client_id))
     and not public.is_super_admin() then
    raise exception 'רק המפיק קובע מה משותף' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

drop trigger if exists tasks_guard_visibility on public.tasks;
create trigger tasks_guard_visibility before update on public.tasks
  for each row execute function public.guard_task_visibility();

/* And a couple cannot create a hidden task either, which would otherwise be
   the way around the trigger: insert it already false. */
create or replace function public.default_task_visibility() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_producer(public.producer_of_client(new.client_id))
     and not public.is_super_admin() then
    new.visible_to_client := true;
  end if;
  return new;
end $$;

drop trigger if exists tasks_default_visibility on public.tasks;
create trigger tasks_default_visibility before insert on public.tasks
  for each row execute function public.default_task_visibility();

-- ============================================================================
--  0029 — the run sheet on the evening itself
-- ============================================================================
--  Everything about the schedule so far assumes somebody is planning it. On
--  the night the same forty lines are a different document: nobody reads it
--  top to bottom, they read the one line that is happening and the one that is
--  next, and the only question asked of it is "did that happen yet".
--
--  There was no way to answer that. A line could be written, corrected and
--  printed, and then on the evening the producer tracked what was done in
--  their head or with a pen on the printout, which is where it stays.
--
--  One column. Not a boolean: the time it was ticked is the thing worth
--  keeping, because "the chuppah started twenty minutes late" is the sentence
--  the next event is planned from, and a boolean throws it away.
--
--  Who may tick it is already decided. day_schedule_all scopes every operation
--  on this table to the people on the workspace, and this column rides on the
--  same row as the title and the time. Nothing here widens that.
-- ============================================================================

alter table public.day_schedule add column if not exists done_at timestamptz;

comment on column public.day_schedule.done_at is
  'When this line actually happened, ticked on the evening. Null means not yet. '
  'A timestamp rather than a flag, so the gap between what was planned and what '
  'happened survives the night and can be read afterwards.';

/* The evening view asks for one workspace ordered by time, over and over, for
   six hours. The planning index already covers it; this one adds the tick so
   the common "what is still open" read does not touch the table. */
create index if not exists day_schedule_open_idx
  on public.day_schedule (client_id, at_time)
  where done_at is null;

-- ============================================================================
--  0030 — the tenant boundary, with the master key removed
-- ============================================================================
--  Until now `can_read_client()` opened with `is_super_admin() or ...`. One
--  line, at the top of the function every policy on every workspace table
--  calls. It meant the root account could read any couple's guest list, any
--  producer's budget, any contract and every message on the platform, and the
--  fifty-five policies underneath it were decoration as far as root was
--  concerned.
--
--  That was deliberate, and it was asked for. It is now explicitly withdrawn:
--  a producer who brings their own couples onto this platform must be able to
--  say that nobody else, including whoever runs the platform, can read them.
--  A promise like that is worth exactly what enforces it, so it is enforced
--  here rather than by a policy in a document.
--
--  What root keeps is governance, and only governance:
--    · the producers table, so accounts can be approved and suspended
--    · the profiles of producer owners, so there is a name behind an approval
--    · the platform's own marketing site content
--    · aggregate counts, through functions that return numbers and never rows
--  and, unchanged, everything in root's *own* workspace, which he reaches the
--  same way every other producer reaches theirs: by owning it.
--
--  What root loses, and this is the cost, is support. Nobody can look at a
--  producer's event to work out why a screen is wrong for them. The answer to
--  "my budget looks broken" is now a screen share, not a lookup. That is the
--  trade this migration makes on purpose.
--
--  Safe to re-run, and it destroys no data: every statement here replaces a
--  policy or a function.
-- ============================================================================


-- ── the master key ──────────────────────────────────────────────────────────
--  The whole migration in one function. Everything below is closing the doors
--  that were cut around it.
create or replace function public.can_read_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.clients c join public.producers pr on pr.id = c.producer_id
             where c.id = cid and pr.owner_id = auth.uid())
    or exists (
      select 1
        from public.client_authorized_emails e
        join public.profiles p on p.id = auth.uid()
       where e.client_id = cid
         and (
           e.email = lower(p.email)
           or e.profile_id = p.id
         )
    )
$$;

comment on function public.can_read_client(uuid) is
  'Whether the signed-in account is on this workspace: its producer, or one of '
  'the authorised addresses. Deliberately has no administrator branch — the '
  'platform owner is not on a workspace they do not own.';


-- ── profiles: root sees the people it governs, and nobody else ──────────────
--  A producer owner's name and address are what an approval decision is made
--  against. A couple's are not root's business, and the aggregate functions
--  below count them without reading them.
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (
    id = auth.uid()
    or (
      public.is_super_admin()
      and exists (select 1 from public.producers pr where pr.owner_id = profiles.id)
    )
  );

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (
    id = auth.uid()
    or (
      public.is_super_admin()
      and exists (select 1 from public.producers pr where pr.owner_id = profiles.id)
    )
  )
  with check (
    id = auth.uid()
    or (
      public.is_super_admin()
      and exists (select 1 from public.producers pr where pr.owner_id = profiles.id)
    )
  );


-- ── the workspace tables ────────────────────────────────────────────────────
--  Each one restated without its administrator branch. Written out in full
--  rather than patched, because a policy is read to find out what is true and
--  a half-stated one is worse than none.

drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients for all
  using      (public.can_read_client(id) and public.is_approved_producer())
  with check (public.owns_producer(producer_id) and public.is_approved_producer());

drop policy if exists cae_write on public.client_authorized_emails;
create policy cae_write on public.client_authorized_emails for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));

--  Leads are a producer's commercial pipeline. If anything on this platform is
--  theirs alone, it is the list of people who have not signed yet.
drop policy if exists leads_read on public.leads;
create policy leads_read on public.leads for select
  using (producer_id is not null and public.owns_producer(producer_id));

drop policy if exists leads_write on public.leads;
create policy leads_write on public.leads for all
  using      (producer_id is not null and public.owns_producer(producer_id))
  with check (producer_id is not null and public.owns_producer(producer_id));

drop policy if exists sales_calls_all on public.sales_calls;
create policy sales_calls_all on public.sales_calls for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));

drop policy if exists orders_all on public.orders;
create policy orders_all on public.orders for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));

drop policy if exists site_settings_all on public.site_settings;
create policy site_settings_all on public.site_settings for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or (public.can_read_client(client_id) and visible_to_client)
  );

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete
  using (
    public.can_read_client(client_id)
    and (created_by = auth.uid() or public.owns_producer(public.producer_of_client(client_id)))
  );

drop policy if exists budget_read on public.budget_items;
create policy budget_read on public.budget_items for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or (
      public.can_read_client(client_id)
      and exists (select 1 from public.clients c where c.id = client_id and c.budget_visible)
    )
  );

drop policy if exists budget_write on public.budget_items;
create policy budget_write on public.budget_items for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or (
      public.can_read_client(client_id)
      and exists (select 1 from public.clients c
                   where c.id = payments.client_id and c.budget_visible)
    )
  );

drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));

drop policy if exists contracts_read on public.contracts;
create policy contracts_read on public.contracts for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or (public.can_read_client(client_id) and status <> 'draft')
  );

drop policy if exists contracts_write on public.contracts;
create policy contracts_write on public.contracts for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));

--  A retraction is the author's to make. Root retracting somebody else's
--  message was a way to edit a conversation root cannot even read.
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete
  using (author_id = auth.uid());

drop policy if exists vendors_all on public.vendors;
create policy vendors_all on public.vendors for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));

drop policy if exists event_vendors_all on public.event_vendors;
create policy event_vendors_all on public.event_vendors for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));

drop policy if exists crew_all on public.crew;
create policy crew_all on public.crew for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));


-- ── the functions that took the same shortcut ───────────────────────────────
create or replace function public.book_vendor(p_client uuid, p_vendor uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v record; v_id uuid;
begin
  if not public.owns_producer(public.producer_of_client(p_client)) then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  select * into v from public.vendors
   where id = p_vendor and public.owns_producer(producer_id);
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

create or replace function public.guard_task_visibility() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.visible_to_client is distinct from old.visible_to_client
     and not public.owns_producer(public.producer_of_client(new.client_id)) then
    raise exception 'רק המפיק קובע מה משותף' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create or replace function public.default_task_visibility() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_producer(public.producer_of_client(new.client_id)) then
    new.visible_to_client := true;
  end if;
  return new;
end $$;


-- ============================================================================
--  governance: numbers, not rows
-- ============================================================================
--  Root can no longer select from the workspace tables, which is the point.
--  So the console is served by functions that run as the definer, count what
--  they were asked to count, and return no identifying row of anybody's
--  event. Each one refuses outright unless the caller is root — a security
--  definer function without that check is the master key again, wearing a
--  different hat.


-- ── a real activity signal, rather than a guessed one ───────────────────────
--  "Active users" was going to be derived from whether an account happened to
--  be attached to something, which measures setup and calls it usage. One
--  column, stamped at most once a day, measures the actual thing.
alter table public.profiles add column if not exists last_seen_at timestamptz;

comment on column public.profiles.last_seen_at is
  'Last time this account opened the app, to the day. Stamped by touch_seen() '
  'and never more than once every 24 hours, so it costs one write a day rather '
  'than one per page.';

create or replace function public.touch_seen() returns void
language sql volatile security definer set search_path = public as $$
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '20 hours')
$$;

revoke all on function public.touch_seen() from public;
grant execute on function public.touch_seen() to authenticated;


-- ── who is on the platform ──────────────────────────────────────────────────
create or replace function public.platform_stats()
returns table (
  users_total        integer,
  users_active_30d   integer,
  users_never_seen   integer,
  producers_total    integer,
  producers_approved integer,
  producers_pending  integer,
  producers_blocked  integer,
  couples_total      integer,
  couples_managed    integer,
  couples_diy        integer,
  events_total       integer,
  events_live        integer,
  leads_total        integer,
  leads_30d          integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    (select count(*)::int from public.profiles),
    (select count(*)::int from public.profiles
      where last_seen_at is not null and last_seen_at > now() - interval '30 days'),
    (select count(*)::int from public.profiles where last_seen_at is null),

    (select count(*)::int from public.producers),
    (select count(*)::int from public.producers where status = 'approved'),
    (select count(*)::int from public.producers where status = 'pending'),
    (select count(*)::int from public.producers where status in ('suspended','rejected')),

    /* A couple is an authorised address on a workspace, counted once even
       when a bride and groom both have logins on the same event. */
    (select count(distinct lower(e.email))::int from public.client_authorized_emails e),
    (select count(distinct lower(e.email))::int
       from public.client_authorized_emails e
       join public.clients c on c.id = e.client_id where c.plan = 'managed'),
    (select count(distinct lower(e.email))::int
       from public.client_authorized_emails e
       join public.clients c on c.id = e.client_id where c.plan = 'diy'),

    (select count(*)::int from public.clients),
    (select count(*)::int from public.clients where archived_at is null),

    (select count(*)::int from public.leads),
    (select count(*)::int from public.leads where created_at > now() - interval '30 days');
end $$;

revoke all on function public.platform_stats() from public;
grant execute on function public.platform_stats() to authenticated;


-- ── who is actually working ─────────────────────────────────────────────────
--  A producer's own brand name is governance: it is what an approval decision
--  is made against. Everything else here is a count. No couple, no event name
--  and no money crosses this boundary.
create or replace function public.producer_leaderboard()
returns table (
  producer_id   uuid,
  brand         text,
  contact_email text,
  status        text,
  last_seen_at  timestamptz,
  events_live   integer,
  events_total  integer,
  leads_total   integer,
  leads_30d     integer,
  signed_total  integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    pr.id,
    coalesce(nullif(pr.brand_name, ''), nullif(pr.contact_name, ''), pr.contact_email),
    pr.contact_email,
    pr.status::text,
    p.last_seen_at,
    (select count(*)::int from public.clients c
      where c.producer_id = pr.id and c.archived_at is null),
    (select count(*)::int from public.clients c where c.producer_id = pr.id),
    (select count(*)::int from public.leads l where l.producer_id = pr.id),
    (select count(*)::int from public.leads l
      where l.producer_id = pr.id and l.created_at > now() - interval '30 days'),
    (select count(distinct ct.client_id)::int
       from public.contracts ct
       join public.clients c on c.id = ct.client_id
      where c.producer_id = pr.id and ct.signed_at is not null)
  from public.producers pr
  left join public.profiles p on p.id = pr.owner_id
  order by 6 desc, 8 desc;
end $$;

revoke all on function public.producer_leaderboard() from public;
grant execute on function public.producer_leaderboard() to authenticated;


-- ============================================================================
--  feature gating
-- ============================================================================
--  Two kinds of couple use this platform and they are not the same customer.
--  One is handed a finished workspace by a producer who is doing the work.
--  The other signed up themselves and is planning their own wedding with the
--  tools. Which modules the second one gets is a commercial decision, and it
--  belongs on a screen rather than in a deploy.

do $$ begin create type client_plan as enum ('managed','diy');
  exception when duplicate_object then null; end $$;

alter table public.clients add column if not exists plan client_plan not null default 'managed';

comment on column public.clients.plan is
  'managed = a producer is running this event. diy = the couple signed up '
  'themselves and is using the tools alone. Decides which modules are open.';


create table if not exists public.feature_flags (
  key         text primary key,
  label       text not null default '',
  /* Open for a couple planning it themselves. */
  diy         boolean not null default true,
  /* Open for a couple whose producer is running it. */
  managed     boolean not null default true,
  updated_at  timestamptz not null default now()
);

comment on table public.feature_flags is
  'Which modules each kind of couple may open. A missing row means open to '
  'everyone: a feature must be switched off deliberately, never by having been '
  'forgotten here.';

alter table public.feature_flags enable row level security;

/* Everyone signed in reads them, because every screen has to know whether it
   is allowed to render. Only root writes them. */
drop policy if exists feature_flags_read on public.feature_flags;
create policy feature_flags_read on public.feature_flags for select using (true);

drop policy if exists feature_flags_write on public.feature_flags;
create policy feature_flags_write on public.feature_flags for all
  using (public.is_super_admin()) with check (public.is_super_admin());

grant select on public.feature_flags to authenticated;
grant select, insert, update, delete on public.feature_flags to service_role;


create or replace function public.set_feature_flag(
  p_key text, p_label text, p_diy boolean, p_managed boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  insert into public.feature_flags (key, label, diy, managed, updated_at)
  values (p_key, coalesce(p_label, ''), p_diy, p_managed, now())
  on conflict (key) do update
    set label = excluded.label, diy = excluded.diy,
        managed = excluded.managed, updated_at = now();
end $$;

revoke all on function public.set_feature_flag(text, text, boolean, boolean) from public;
grant execute on function public.set_feature_flag(text, text, boolean, boolean) to authenticated;


/* Whether one workspace may open one module.
   A producer's own screens are never gated: the gate is about what a *couple*
   is sold, and locking a producer out of their own tooling would be a support
   ticket rather than a business model. */
create or replace function public.feature_on(p_client uuid, p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when not public.can_read_client(p_client) then false
    when public.owns_producer(public.producer_of_client(p_client)) then true
    else coalesce(
      (select case when c.plan = 'diy' then f.diy else f.managed end
         from public.clients c
         left join public.feature_flags f on f.key = p_key
        where c.id = p_client),
      true)
  end
$$;

revoke all on function public.feature_on(uuid, text) from public;
grant execute on function public.feature_on(uuid, text) to authenticated;


-- ── handing an event to another producer ────────────────────────────────────
--  Reassignment used to work across the whole platform, because root could
--  read every workspace. It cannot now, and moving somebody else's event
--  between two other tenants is not an operation this platform should have.
--
--  What survives is the honest version: an owner giving away their own event.
--  Root moving a wedding from their own books to Keren's is root handing over
--  data root already holds, which is a real thing a production business does.
--  The source must be owned by the caller; the destination must be approved.
create or replace function public.transfer_client(p_client uuid, p_to_producer uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_producer(public.producer_of_client(p_client)) then
    raise exception 'אפשר להעביר רק אירוע שלך' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.producers pr
     where pr.id = p_to_producer and pr.status = 'approved'
  ) then
    raise exception 'אפשר להעביר רק למפיק מאושר' using errcode = 'check_violation';
  end if;

  update public.clients set producer_id = p_to_producer where id = p_client;
end $$;

revoke all on function public.transfer_client(uuid, uuid) from public;
grant execute on function public.transfer_client(uuid, uuid) to authenticated;


-- ── the modules there are ───────────────────────────────────────────────────
--  Seeded so the console has something to show on the first open rather than
--  an empty screen that looks broken. Everything starts open: a feature is
--  switched off deliberately, never by having been forgotten here.
insert into public.feature_flags (key, label, diy, managed) values
  ('budget',    'תקציב',            true,  true),
  ('guests',    'אורחים ו-RSVP',    true,  true),
  ('seating',   'סידור הושבה',      true,  true),
  ('moodboard', 'לוח השראה',        true,  true),
  ('runsheet',  'לוז יום האירוע',   true,  true),
  ('bar',       'מחשבון בר',        true,  true),
  ('messages',  'הודעות עם המפיק',  false, true),
  ('contracts', 'חוזים',            false, true),
  ('files',     'קבצים ותמונות',    true,  true)
on conflict (key) do nothing;

-- ============================================================================
--  0031 — a producer's own identity, and the host that leads to it
-- ============================================================================
--  Three columns and one function.
--
--  `accent` is a key rather than a colour. The palette in this app was
--  measured rather than judged by eye, and two tones were darkened on the way
--  in because the measurement said so and both looked fine. A free hex field
--  would hand a producer the ability to make their own couples' text
--  unreadable, and neither of them would find out by looking at it. So the
--  choice is a shortlist, every entry of which is checked by a script that
--  refuses to pass a preset that fails.
--
--  `slug` and `domain` are how a request finds a tenant. Nothing here connects
--  a domain to anything: setting up DNS is a separate act, done deliberately,
--  and this only records what to do with a request once one arrives.
-- ============================================================================

alter table public.producers add column if not exists accent text not null default 'slate';
alter table public.producers add column if not exists slug   text;
alter table public.producers add column if not exists domain text;
alter table public.producers add column if not exists tagline text not null default '';

comment on column public.producers.accent is
  'Key into the shortlist in src/content/brand.ts, never a hex value. An '
  'unknown key falls back to the base palette rather than to nothing.';
comment on column public.producers.slug is
  'The subdomain this producer answers on. Lowercase letters, digits and '
  'hyphens; short enough to say out loud.';
comment on column public.producers.domain is
  'A custom domain this producer has pointed here. Recorded only — the DNS is '
  'a separate, deliberate act and this column does not perform it.';

/* Lowercased and trimmed on the way in, so a host lookup is a plain equality
   test rather than a function call the index cannot use. */
create or replace function public.normalize_producer_host() returns trigger
language plpgsql set search_path = public as $$
begin
  new.slug := nullif(lower(btrim(coalesce(new.slug, ''))), '');
  new.domain := nullif(lower(btrim(coalesce(new.domain, ''))), '');
  /* A pasted address rather than a hostname is the common mistake. Strip the
     parts a host does not have instead of refusing the row. */
  if new.domain is not null then
    new.domain := regexp_replace(new.domain, '^https?://', '');
    new.domain := regexp_replace(new.domain, '/.*$', '');
    new.domain := regexp_replace(new.domain, '^www\.', '');
  end if;
  return new;
end $$;

drop trigger if exists producers_normalize_host on public.producers;
create trigger producers_normalize_host before insert or update on public.producers
  for each row execute function public.normalize_producer_host();

do $$ begin
  alter table public.producers add constraint producers_slug_shape
    check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$');
exception when duplicate_object then null; end $$;

create unique index if not exists producers_slug_key   on public.producers (slug)   where slug is not null;
create unique index if not exists producers_domain_key on public.producers (domain) where domain is not null;


-- ── resolving a request to a tenant ─────────────────────────────────────────
--  Called before anybody has signed in, so it is granted to anon, and it
--  therefore returns only what a visitor to that producer's public page is
--  meant to see: how they are called, how they look, and how to reach them.
--  No status, no counts, no address, no id of anything owned.
create or replace function public.producer_by_host(p_host text)
returns table (brand text, tagline text, accent text, logo_url text, whatsapp text, booking_url text)
language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(pr.brand_name, ''), nullif(pr.contact_name, ''), ''),
    pr.tagline,
    pr.accent,
    pr.logo_url,
    pr.whatsapp,
    pr.booking_url
  from public.producers pr
  where pr.status = 'approved'
    and (
      pr.domain = lower(btrim(p_host))
      or pr.slug = split_part(lower(btrim(p_host)), '.', 1)
    )
  /* An exact custom domain always beats a subdomain that happens to share a
     first label. Without the ordering the OR above could answer either way on
     two different days, which is the worst kind of routing bug. */
  order by (pr.domain = lower(btrim(p_host))) desc
  limit 1
$$;

revoke all on function public.producer_by_host(text) from public;
grant execute on function public.producer_by_host(text) to anon, authenticated, service_role;


-- ── the brand a couple sees ─────────────────────────────────────────────────
--  A couple cannot read the producers table, and should not be able to: it
--  carries approval status and contact details for every producer on the
--  platform. But the couple must see whose business they are inside, or the
--  workspace is white-labelled to nobody.
--
--  So the same narrow shape as producer_by_host, reached from the other
--  direction: the producer running an event this caller is actually on.
create or replace function public.my_workspace_brand()
returns table (brand text, tagline text, accent text, logo_url text, whatsapp text, booking_url text)
language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(pr.brand_name, ''), nullif(pr.contact_name, ''), ''),
    pr.tagline,
    pr.accent,
    pr.logo_url,
    pr.whatsapp,
    pr.booking_url
  from public.clients c
  join public.producers pr on pr.id = c.producer_id
  where public.can_read_client(c.id)
    and c.archived_at is null
  /* A couple is normally on exactly one workspace. When somebody is on two,
     the nearer event wins, which is the one they opened the app to look at. */
  order by c.event_date asc nulls last
  limit 1
$$;

revoke all on function public.my_workspace_brand() from public;
grant execute on function public.my_workspace_brand() to authenticated;

-- ============================================================================
--  0032 — who has actually turned up, and what is about to happen
-- ============================================================================
--  The evening screen could say what was scheduled and what had been ticked
--  off. It could not answer the question a producer asks most between four and
--  six: has the sound engineer arrived.
--
--  That was tracked by looking around the room, which works until there are
--  two rooms. Two columns, one on each side of the call sheet, and a timestamp
--  rather than a flag for the same reason the run sheet uses one: "the caterer
--  came forty minutes late" is a fact about a supplier that is worth having
--  next year, and a boolean throws it away.
--
--  And one flag on the schedule. Not every line deserves a countdown — a run
--  sheet has forty of them and an alert before each is an alert before none.
--  The producer marks the handful that matter: the chuppah, the first dance,
--  the moment the food goes out.
-- ============================================================================

alter table public.event_vendors add column if not exists arrived_at timestamptz;
alter table public.crew          add column if not exists arrived_at timestamptz;

comment on column public.event_vendors.arrived_at is
  'When this supplier actually turned up. Null means not yet. A timestamp so '
  'the gap between the call time and the arrival survives the night.';
comment on column public.crew.arrived_at is
  'When this person actually turned up. Null means not yet.';

alter table public.day_schedule add column if not exists key_moment boolean not null default false;

comment on column public.day_schedule.key_moment is
  'Worth a countdown. A run sheet has forty lines and an alert before every '
  'one of them is an alert before none, so this marks the handful that move '
  'the evening: the chuppah, the first dance, the food going out.';

/* The evening asks "who is still out" over and over for two hours. */
create index if not exists event_vendors_waiting_idx
  on public.event_vendors (client_id) where arrived_at is null;
create index if not exists crew_waiting_idx
  on public.crew (client_id) where arrived_at is null;


-- ── marking somebody in ─────────────────────────────────────────────────────
--  One function for both tables, because on the screen they are one list and
--  the producer tapping a name does not know or care which table it came from.
--  The time is the server's: a phone with a wrong clock would otherwise record
--  a florist arriving at four in the afternoon, and that timestamp is the
--  whole reason the column is not a boolean.
create or replace function public.mark_arrival(
  p_kind text, p_id uuid, p_undo boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare v_client uuid;
begin
  if p_kind = 'crew' then
    select client_id into v_client from public.crew where id = p_id;
  elsif p_kind = 'vendor' then
    select client_id into v_client from public.event_vendors where id = p_id;
  else
    raise exception 'לא ידוע מי זה' using errcode = 'invalid_parameter_value';
  end if;

  if v_client is null then
    raise exception 'לא נמצא' using errcode = 'no_data_found';
  end if;

  /* Crew and suppliers are the producer's side of the wall everywhere else in
     this schema, and a security definer function is exactly where that wall
     would quietly stop existing. */
  if not public.owns_producer(public.producer_of_client(v_client)) then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  if p_kind = 'crew' then
    update public.crew
       set arrived_at = case when p_undo then null else now() end
     where id = p_id;
  else
    update public.event_vendors
       set arrived_at = case when p_undo then null else now() end
     where id = p_id;
  end if;
end $$;

revoke all on function public.mark_arrival(text, uuid, boolean) from public;
grant execute on function public.mark_arrival(text, uuid, boolean) to authenticated;

-- ============================================================================
--  0033 — inviting somebody who already has an account
-- ============================================================================
--  Reproduced against a real database, as an ordinary producer:
--
--      insert into client_authorized_emails (client_id, email) values (…);
--      ERROR:  a role is set by barakliver@gmail.com only
--      CONTEXT:  PL/pgSQL function guard_role_change() …
--                SQL statement "update public.profiles set role = 'client' …"
--                PL/pgSQL function bind_authorized_email() …
--
--  The whole insert fails. A producer cannot invite a couple whose address
--  already signed up — which is most couples who ever visited the site and
--  made an account before being invited.
--
--  Two correct pieces fighting each other. bind_authorized_email demotes such
--  an account from 'producer' to 'client' so they see the workspace they were
--  invited to. guard_role_change refuses any role change not made by root.
--  Being security definer does not help: that changes the database role, and
--  the guard reads auth.uid(), which is still the producer doing the inviting.
--
--  The fix is not to weaken the guard. Escalation is what it exists to stop,
--  and it keeps stopping it. What is allowed is one specific reduction —
--  producer to client — and only while bind_authorized_email is the thing
--  making it, marked by a transaction-local setting that function sets and
--  clears around its own update.
--
--  Nothing else can reach it: the flag is local to the transaction, no role
--  other than the definer can set it through the API, and even holding it the
--  guard still refuses anything except that one downward step.
-- ============================================================================

create or replace function public.guard_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  if public.is_super_admin() then
    return new;
  end if;

  /* The one exception: an account being turned into a couple because it was
     just invited onto a workspace. A reduction, never a promotion, and only
     while the function that performs it says so. */
  if old.role = 'producer'
     and new.role = 'client'
     and coalesce(current_setting('liver.binding_invite', true), '') = 'on' then
    return new;
  end if;

  raise exception 'a role is set by % only', public.root_admin_email();
end $$;


-- ── stricter about what counts as an empty workspace ────────────────────────
--  The existing cleanup asked only whether the workspace had clients. A
--  producer whose application is still pending may well have leads, suppliers
--  or booked calls and no events yet, and deleting that row throws away real
--  work. A named business is not empty either, whatever else is true of it.
/* Dropped first rather than replaced. `create or replace` cannot change a
   function's return type, so a signature that ever differed — between two
   deploys, or between a database that ran an earlier build and one that did
   not — turns a re-runnable file into one that fails halfway. */
drop function if exists public.drop_empty_producer(uuid);

create or replace function public.drop_empty_producer(p_owner uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.producers pr
   where pr.owner_id = p_owner
     and pr.status in ('pending','rejected')
     and coalesce(btrim(pr.brand_name), '') = ''
     and not exists (select 1 from public.clients     c where c.producer_id = pr.id)
     and not exists (select 1 from public.leads       l where l.producer_id = pr.id)
     and not exists (select 1 from public.vendors     v where v.producer_id = pr.id)
     and not exists (select 1 from public.sales_calls s where s.producer_id = pr.id);
  get diagnostics n = row_count;
  return n;
end $$;

comment on function public.drop_empty_producer(uuid) is
  'Removes the placeholder workspace left behind when somebody who signed up '
  'as a producer turns out to be a couple. Refuses to touch anything approved, '
  'named, or holding a single lead, supplier, call or event.';


create or replace function public.bind_authorized_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  select id, role into p from public.profiles where lower(email) = lower(new.email);
  if not found then
    return new;
  end if;

  new.profile_id := p.id;

  -- never demote the root admin, and never demote a producer who already owns
  -- an approved workspace of their own
  if p.role = 'producer'
     and not exists (select 1 from public.producers pr
                     where pr.owner_id = p.id and pr.status = 'approved') then

    /* Local to this transaction and cleared straight after, so the permission
       exists for exactly the length of one update and cannot be left on. */
    perform set_config('liver.binding_invite', 'on', true);
    update public.profiles set role = 'client' where id = p.id;
    perform set_config('liver.binding_invite', '', true);

    perform public.drop_empty_producer(p.id);
  end if;

  return new;
end $$;


-- ── root reads a profile because of what the person is ──────────────────────
--  0030 scoped root to "profiles of people who own a producers row". That is
--  the right idea keyed to the wrong table: a placeholder workspace left on
--  somebody's account makes them a producer owner by that definition, and a
--  couple's profile leaks to root through it.
--
--  Caught by seeding a couple whose row was created in a different order than
--  the app creates it. The order was unrealistic; the fragility it exposed is
--  not. A boundary whose safety depends on a second table being tidy is a
--  boundary that fails the first time it is not.
--
--  The role column is the platform's own statement of what somebody is, and it
--  is guarded by two triggers already. Read that instead.
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (
    id = auth.uid()
    or (public.is_super_admin() and role in ('producer','super_admin'))
  );

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (
    id = auth.uid()
    or (public.is_super_admin() and role in ('producer','super_admin'))
  )
  with check (
    id = auth.uid()
    or (public.is_super_admin() and role in ('producer','super_admin'))
  );

-- ============================================================================
--  whoami() — who the database thinks is asking
-- ============================================================================
--  Opening an event failed with "new row violates row-level security policy",
--  and the screen said "אין לך הרשאה לפעולה הזאת". Every condition in that
--  policy was true for the account: it owned the producer, the producer was
--  approved, the profile was super_admin. Checked by impersonating the user
--  in SQL, all three returned true.
--
--  The write still failed, because `auth.uid()` was null in that request. The
--  session had gone stale, reads were being carried by the middleware's
--  refresh on navigation, and the action's write was not.
--
--  A policy cannot tell those two apart, and neither could the app: "you are
--  not allowed" and "the database does not know who you are" arrive as the
--  same error code. This is how the app asks.
--
--  Deliberately NOT security definer. The whole value is that it answers as
--  the caller; a definer function would report the owner and always be
--  useful-looking and always wrong.
-- ============================================================================

create or replace function public.whoami() returns uuid
language sql stable as $$
  select auth.uid()
$$;

comment on function public.whoami() is
  'The caller''s uid as row level security sees it, or null when the session '
  'did not reach the database. Used to tell a stale session apart from a '
  'genuine refusal, which arrive as the same error.';

grant execute on function public.whoami() to anon, authenticated;

-- ============================================================================
--  The root account cannot be locked out of its own platform
-- ============================================================================
--  Everything admin on this platform hangs off is_super_admin(), and that
--  function asked one question: is there a row in public.profiles for
--  auth.uid() carrying the role super_admin. Which means the root account's
--  rights depend on a cached row rather than on who is signed in — and a
--  profile row that is missing, or that was written before handle_new_user()
--  learned to elevate the root address, silently demotes the owner of the
--  platform to a couple. Nothing announces it. Screens simply stop working,
--  and row level security reports it as "you have no permission".
--
--  Two changes, both idempotent, neither of which touches anybody's data:
--
--    1. is_super_admin() also answers true for the root address as the token
--       itself states it. The rule does not change — public.root_admin_email()
--       has always been the single source of truth, and a trigger already
--       refuses the role to every other address — this only stops the answer
--       from depending on a row being present and correct.
--
--    2. Any auth user with no profile gets one, and the root address's profile
--       is set to super_admin if it is not already. Repair, not migration:
--       run it twice and the second run changes nothing.
-- ============================================================================

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
    -- The token's own email, for the case where the row is missing or wrong.
    -- Only ever true for the one address, which is the same rule the trigger
    -- on public.profiles enforces from the other direction.
    or lower(coalesce(auth.jwt() ->> 'email', '')) = public.root_admin_email()
$$;

-- ── repair ──────────────────────────────────────────────────────────────────
--  Insert only. No existing profile is overwritten, no role is downgraded and
--  no row is deleted, so this cannot cost anybody anything they already have.
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  lower(u.email),
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  case when lower(u.email) = public.root_admin_email()
       then 'super_admin'::app_role else 'producer'::app_role end
from auth.users u
where u.email is not null
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

--  And the one row whose role is not a matter of opinion.
update public.profiles
   set role = 'super_admin'
 where lower(email) = public.root_admin_email()
   and role <> 'super_admin';

-- ============================================================================
--  0036 — a new event could not be read back, so it could not be created
-- ============================================================================
--  The symptom: "אין לך הרשאה לפעולה הזאת" on opening an event, for the
--  account that owns the workspace, whose producer is approved, and whose
--  every condition in clients_write evaluates true. Asked directly, in the
--  same request and under the same session, the database agreed:
--
--      uid=48505dc7-…  owns=true  approved=true  root=true
--
--  Which means the row passed the write policy. The refusal was on the way
--  back out.
--
--  The app inserts and asks for the new id in one statement, so PostgreSQL
--  runs `insert into clients (…) returning id`. A RETURNING clause makes the
--  table's SELECT policy apply to the row being inserted, and clients_read was
--
--      using (public.can_read_client(id))
--
--  which answers by looking the row up in public.clients. That function is
--  STABLE, so it sees the snapshot taken when the statement began — a snapshot
--  from before the row existed. It looks for the new event, does not find it,
--  and says no. Postgres then raises the USING-expression form of 42501, whose
--  message is a row level security violation like any other.
--
--  So the policy was asking "may this account read a row with this id", when
--  the only question a new row can answer is "may this account read a row with
--  these columns". The fix is to ask that instead: the producer_id is right
--  there on the row, and owns_producer() reads public.producers, a table the
--  statement is not inserting into.
--
--  Why it worked before and stopped: until 0030, can_read_client() opened with
--  `is_super_admin() or …`, which short-circuited to true for the root account
--  and never reached the lookup. Removing the master key was correct and
--  stands. It simply also removed the only reason this ever returned true.
--
--  Replaces two policies and adds one function. No data is touched, and it is
--  safe to run more than once.
-- ============================================================================


-- The half of can_read_client() that is about the couple, on its own, so both
-- the row-based and the column-based policy can use the same words for it.
create or replace function public.is_authorized_on_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.client_authorized_emails e
      join public.profiles p on p.id = auth.uid()
     where e.client_id = cid
       and (e.email = lower(p.email) or e.profile_id = p.id)
  )
$$;

comment on function public.is_authorized_on_client(uuid) is
  'Whether the signed-in account is one of the addresses invited to this '
  'workspace. Reads client_authorized_emails, never public.clients, so it is '
  'safe to evaluate against a row that is still being inserted.';


-- ── the read, stated in the row''s own columns ──────────────────────────────
--  producer_id is on the row. A couple''s invitation is not, so that branch
--  still needs the id — but a couple never inserts a workspace, so it is never
--  reached with a row the snapshot cannot see.
drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients for select
  using (
    public.owns_producer(producer_id)
    or public.is_authorized_on_client(id)
  );

--  Restated the same way. The write side already tested owns_producer() in its
--  WITH CHECK; using it on both sides removes the lookup from the UPDATE and
--  DELETE paths too, and says plainly what was already true: a couple is not an
--  approved producer, so this policy was never about them.
drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients for all
  using      (public.owns_producer(producer_id) and public.is_approved_producer())
  with check (public.owns_producer(producer_id) and public.is_approved_producer());


-- ── and the shared helper, kept as one truth ────────────────────────────────
--  Every other workspace table calls this with a client_id whose row already
--  exists, where the lookup is correct and necessary. Rewritten in terms of the
--  two pieces above so the rule cannot drift between here and the policy on
--  public.clients.
create or replace function public.can_read_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.owns_producer(public.producer_of_client(cid))
      or public.is_authorized_on_client(cid)
$$;

-- ============================================================================
--  0037 — a supplier signs from a link, with no account
-- ============================================================================
--  0019 built a signature that means something: the terms freeze on signature
--  by a trigger rather than by a screen that hides a button, and the exact text
--  is fingerprinted so later tampering is detectable rather than a matter of
--  opinion. All of that stands and none of it is loosened here.
--
--  What it could not do was reach anybody outside the workspace. A DJ, a
--  caterer or a rabbi is not going to open an account to agree a price, and a
--  contract that requires one is a contract that goes back to WhatsApp.
--
--  So: the same door 0006 opened for a guest confirming attendance. A long
--  random token, security definer functions that take it, and no other way in.
--  The token is the credential; there is no account, no password and nothing
--  to guess.
--
--  Three properties this keeps, and each one is a way an e-signature is
--  normally worse than paper:
--
--    · A link can be withdrawn. Revoking it does not un-sign anything already
--      signed, because that is a record, but it closes the door.
--    · Signing through a link records that it was a link. A signature whose
--      provenance is unknown is a signature somebody can argue with later.
--    · The producer still cannot sign for the other side. That was true for
--      the couple in 0019 and it is true here.
-- ============================================================================

-- ── who the other side is, and how they get in ──────────────────────────────
alter table public.contracts
  add column if not exists party_name  text not null default '',
  add column if not exists party_role  text not null default '',
  add column if not exists party_phone text not null default '',
  add column if not exists party_email text not null default '',
  /* Null until a link is made, and set back to null to withdraw one. */
  add column if not exists sign_token  text,
  /* How it was signed. 'account' is the couple in the portal, 'link' is
     somebody who opened a URL. Recorded because provenance is part of what a
     signature is worth. */
  add column if not exists signed_via  text;

do $$ begin
  alter table public.contracts add constraint contracts_party_len
    check (char_length(party_name) <= 120 and char_length(party_role) <= 80
           and char_length(party_phone) <= 40 and char_length(party_email) <= 200);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.contracts add constraint contracts_signed_via
    check (signed_via is null or signed_via in ('account', 'link'));
exception when duplicate_object then null; end $$;

/* A token is long enough that guessing is not a strategy, and unique so a
   collision cannot hand one supplier another's contract. Partial, so the many
   contracts with no link do not all collide on null. */
create unique index if not exists contracts_sign_token_key
  on public.contracts (sign_token) where sign_token is not null;

--  The completeness rule from 0019 said a signed contract must name an account.
--  A supplier has no account, so the rule becomes: a signed contract must name
--  *somebody*, by profile or by having come through a link. Half a signature is
--  still not storable.
alter table public.contracts drop constraint if exists contracts_signature_complete;
alter table public.contracts add constraint contracts_signature_complete check (
  (status <> 'signed')
  or (signed_at is not null
      and coalesce(btrim(signed_name), '') <> ''
      and signed_hash is not null
      and (signed_by is not null or signed_via = 'link'))
);


-- ── the freeze, extended to the new columns ─────────────────────────────────
--  Not decoration: without this a producer could change the supplier's name on
--  a signed agreement, which is the same class of edit the freeze exists to
--  prevent. The token is deliberately left editable so a link can be withdrawn
--  after signature without touching the record.
create or replace function public.freeze_signed_contract() returns trigger
language plpgsql as $$
begin
  if old.status = 'signed' then
    if new.title      is distinct from old.title
    or new.body       is distinct from old.body
    or new.file_path  is distinct from old.file_path
    or new.amount     is distinct from old.amount
    or new.party_name is distinct from old.party_name
    or new.party_role is distinct from old.party_role
    or new.signed_at   is distinct from old.signed_at
    or new.signed_by   is distinct from old.signed_by
    or new.signed_name is distinct from old.signed_name
    or new.signed_hash is distinct from old.signed_hash
    or new.signed_via  is distinct from old.signed_via
    then
      raise exception 'a signed agreement cannot be changed';
    end if;
  end if;
  return new;
end $$;


-- ── reading one, with nothing but the token ─────────────────────────────────
--  Returns the document and who it is for, and nothing about the workspace it
--  belongs to. A supplier is being shown their own agreement, not given a
--  window into a wedding.
--
--  A draft is never returned. Somebody reading terms that are still being
--  written, which then change, is how people stop trusting a document.
create or replace function public.contract_by_token(p_token text)
returns table (
  id uuid, title text, body text, file_path text, amount numeric,
  party_name text, party_role text, status contract_state,
  signed_at timestamptz, signed_name text, brand text
)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.body, c.file_path, c.amount,
         c.party_name, c.party_role, c.status,
         c.signed_at, c.signed_name,
         coalesce(pr.brand_name, '')
    from public.contracts c
    join public.clients   cl on cl.id = c.client_id
    join public.producers pr on pr.id = cl.producer_id
   where c.sign_token = p_token
     and char_length(coalesce(p_token, '')) >= 32
     and c.status in ('sent', 'signed')
$$;
grant execute on function public.contract_by_token(text) to anon, authenticated, service_role;


-- ── signing with it ─────────────────────────────────────────────────────────
--  One transition, and every refusal says the same thing to somebody holding a
--  wrong token: this does not exist. A message that distinguishes "no such
--  contract" from "already signed" is a message that confirms a guess.
create or replace function public.sign_contract_by_token(p_token text, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c    public.contracts%rowtype;
  name text := btrim(coalesce(p_name, ''));
begin
  if char_length(coalesce(p_token, '')) < 32 then
    raise exception 'that agreement does not exist';
  end if;

  select * into c from public.contracts where sign_token = p_token;
  if not found then
    raise exception 'that agreement does not exist';
  end if;
  if c.status = 'signed' then
    raise exception 'this is already signed';
  end if;
  if c.status <> 'sent' then
    raise exception 'that agreement does not exist';
  end if;
  if char_length(name) < 2 then
    raise exception 'נא לחתום בשם מלא';
  end if;

  update public.contracts
     set status      = 'signed',
         signed_at   = now(),
         /* No account behind this signature, deliberately. What is recorded is
            the name typed, the moment, the fingerprint of what was on screen,
            and that it came through a link. */
         signed_by   = null,
         signed_via  = 'link',
         signed_name = left(name, 120),
         signed_hash = public.contract_digest(c.title, c.body, c.file_path, c.amount)
   where id = c.id;
end $$;
grant execute on function public.sign_contract_by_token(text, text) to anon, authenticated, service_role;


-- ── making and withdrawing a link ───────────────────────────────────────────
--  The producer's side. Making a link also moves a draft to sent, because a
--  link to a draft is a link to terms that can still change underneath it.
/* `extensions` is named alongside `public`, and it is not decoration: this
   function calls gen_random_bytes, pgcrypto lives in `extensions` on Supabase
   and in `public` on a plain PostgreSQL install, and a plpgsql body is resolved
   when it runs rather than when it is created. Pinned to `public` alone it
   creates without complaint and then fails on the first click, which is exactly
   what it did. 0019 wrote that warning down; this is it happening again. */
create or replace function public.issue_sign_link(p_contract uuid)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  c   public.contracts%rowtype;
  tok text;
begin
  select * into c from public.contracts where id = p_contract;
  if not found or not public.owns_producer(public.producer_of_client(c.client_id)) then
    raise exception 'that agreement does not exist';
  end if;
  if c.status = 'void' then raise exception 'this agreement was withdrawn'; end if;

  /* An existing link is returned rather than replaced. Issuing twice from two
     screens must not quietly kill the link already sitting in somebody's
     WhatsApp. */
  if c.sign_token is not null then return c.sign_token; end if;

  tok := encode(gen_random_bytes(24), 'hex');
  update public.contracts
     set sign_token = tok,
         status     = case when status = 'draft' then 'sent'::contract_state else status end,
         sent_at    = coalesce(sent_at, now())
   where id = p_contract;
  return tok;
end $$;
grant execute on function public.issue_sign_link(uuid) to authenticated, service_role;

create or replace function public.revoke_sign_link(p_contract uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare c public.contracts%rowtype;
begin
  select * into c from public.contracts where id = p_contract;
  if not found or not public.owns_producer(public.producer_of_client(c.client_id)) then
    raise exception 'that agreement does not exist';
  end if;
  /* Withdrawing a link never un-signs anything. What was signed is a record. */
  update public.contracts set sign_token = null where id = p_contract;
end $$;
grant execute on function public.revoke_sign_link(uuid) to authenticated, service_role;

-- ============================================================================
--  0038 — the link button failed on the first click
-- ============================================================================
--  `issue_sign_link` was created with `set search_path = public`, and it calls
--  gen_random_bytes. pgcrypto lives in `extensions` on Supabase and in `public`
--  on a plain PostgreSQL install, so pinned to `public` alone the name does not
--  resolve there.
--
--  It did not fail on the way in. A `language plpgsql` body is parsed when the
--  function runs rather than when it is created, so 0037 applied cleanly and
--  the button then reported "we could not make a link" every time it was
--  pressed. 0019 wrote this warning down in a comment for exactly this reason,
--  and the warning was not enough.
--
--  Nothing else changes. Same function, same rules, one clause longer.
-- ============================================================================

create or replace function public.issue_sign_link(p_contract uuid)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  c   public.contracts%rowtype;
  tok text;
begin
  select * into c from public.contracts where id = p_contract;
  if not found or not public.owns_producer(public.producer_of_client(c.client_id)) then
    raise exception 'that agreement does not exist';
  end if;
  if c.status = 'void' then raise exception 'this agreement was withdrawn'; end if;

  /* An existing link is returned rather than replaced. Issuing twice from two
     screens must not quietly kill the link already sitting in somebody's
     WhatsApp. */
  if c.sign_token is not null then return c.sign_token; end if;

  tok := encode(gen_random_bytes(24), 'hex');
  update public.contracts
     set sign_token = tok,
         status     = case when status = 'draft' then 'sent'::contract_state else status end,
         sent_at    = coalesce(sent_at, now())
   where id = p_contract;
  return tok;
end $$;
grant execute on function public.issue_sign_link(uuid) to authenticated, service_role;

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

-- ============================================================================
--  0040 — a shop, and a till that adds up on this side of the wire
-- ============================================================================
--  `orders` has been in the schema since 0001 and has never had a row in it,
--  because there was nothing to order: no catalogue, no storefront, and no way
--  for a visitor to place one. This is the other three quarters of it.
--
--  Two things decide the shape.
--
--  The first is that a producer sells two different things out of the same
--  page. A product is a thing (a bar package, a set of lanterns, a printed
--  seating chart). A service is time (an extra hour of the band, a rehearsal
--  visit, a second photographer). They differ in the sentence under the price
--  and in nothing else, so they are one table with a kind rather than two
--  tables that drift apart.
--
--  The second is that the price the buyer sees is a *claim*, and the total is
--  computed here from the catalogue rather than accepted from the browser.
--  Every storefront that has ever trusted a posted price has eventually sold
--  something for a shekel. place_order() reads the products itself, sums them
--  itself, and ignores whatever arrived alongside them.
-- ============================================================================

alter type notice_kind add value if not exists 'order';


-- ── the catalogue ───────────────────────────────────────────────────────────
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  name        text not null,
  blurb       text not null default '',
  body        text not null default '',
  price       numeric(12,2) not null default 0,
  /* What the price buys. Only the sentence under it differs, which is why this
     is a column and not a second table. */
  kind        text not null default 'product',
  image_path  text not null default '',
  active      boolean not null default true,
  /* Where it sits on the page. The producer drags the rows into the order they
     want customers to read them in, and reorder_products() writes the result
     in one statement so a half-applied drag cannot exist. */
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint products_name_len  check (char_length(btrim(name)) between 1 and 160),
  constraint products_blurb_len check (char_length(blurb) <= 300),
  constraint products_body_len  check (char_length(body) <= 6000),
  constraint products_kind      check (kind in ('product','service')),
  constraint products_price     check (price >= 0 and price <= 1000000)
);
create index if not exists products_producer_idx
  on public.products (producer_id, sort_order, created_at);

alter table public.products enable row level security;

/* A visitor reads the shop while signed out, so anon may select — but only
   what is actually for sale. A draft the producer has switched off is not a
   private secret, and it is also not something a stranger should be able to
   list, price and order. The producer sees their own either way. */
drop policy if exists products_read on public.products;
create policy products_read on public.products for select
  using (active or public.owns_producer(producer_id));

drop policy if exists products_write on public.products;
create policy products_write on public.products for all
  using      (public.owns_producer(producer_id) and public.is_approved_producer())
  with check (public.owns_producer(producer_id) and public.is_approved_producer());

grant select on public.products to anon, authenticated, service_role;
grant insert, update, delete on public.products to authenticated, service_role;


-- ── the pictures ────────────────────────────────────────────────────────────
--  Public, unlike every other bucket here, and deliberately: this is a photo
--  of something for sale on a page anybody may read. A signed link would
--  expire in the middle of somebody browsing, and there is nothing to protect.
--  Writing is still the producer's own folder only.
insert into storage.buckets (id, name, public)
values ('store', 'store', true)
on conflict (id) do update set public = true;

/* The first path segment is the producer, which is the same shape the other
   buckets use — but producer_id rather than client_id, so it gets its own
   reader rather than borrowing storage_client_id() and asking the wrong
   question of the answer. */
create or replace function public.storage_producer_id(object_name text) returns uuid
language plpgsql immutable as $$
declare seg text;
begin
  seg := split_part(object_name, '/', 1);
  if seg !~ '^[0-9a-fA-F-]{36}$' then return null; end if;
  return seg::uuid;
exception when others then
  return null;
end $$;

drop policy if exists store_objects_read on storage.objects;
create policy store_objects_read on storage.objects for select
  using (bucket_id = 'store');

drop policy if exists store_objects_write on storage.objects;
create policy store_objects_write on storage.objects for insert
  with check (bucket_id = 'store' and public.owns_producer(public.storage_producer_id(name)));

drop policy if exists store_objects_update on storage.objects;
create policy store_objects_update on storage.objects for update
  using (bucket_id = 'store' and public.owns_producer(public.storage_producer_id(name)));

drop policy if exists store_objects_delete on storage.objects;
create policy store_objects_delete on storage.objects for delete
  using (bucket_id = 'store' and public.owns_producer(public.storage_producer_id(name)));


-- ── dragging the rows into order ────────────────────────────────────────────
--  One statement, so a reorder either lands whole or does not land. A loop of
--  updates from the browser leaves the page in an order that exists nowhere
--  the moment one of them fails, and the row that moved is the one that looks
--  right while the four around it are wrong.
create or replace function public.reorder_products(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_ids is null or array_length(p_ids, 1) is null then return; end if;

  update public.products p
     set sort_order = x.pos
    from unnest(p_ids) with ordinality as x(id, pos)
   where p.id = x.id
     and public.owns_producer(p.producer_id)
     and public.is_approved_producer();
end $$;

revoke all on function public.reorder_products(uuid[]) from public;
grant execute on function public.reorder_products(uuid[]) to authenticated, service_role;


-- ── the order itself ────────────────────────────────────────────────────────
alter table public.orders add column if not exists note       text not null default '';
alter table public.orders add column if not exists updated_at timestamptz not null default now();

create or replace function public.stamp_order() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists orders_stamp on public.orders;
create trigger orders_stamp before update on public.orders
  for each row execute function public.stamp_order();

/* A number a person can read out on the phone. The date is the useful half —
   "the one from Tuesday" is how anybody actually refers to an order — and four
   random characters are enough to separate two on the same day without turning
   it into a serial number that leaks how many have been sold. */
create or replace function public.next_order_number() returns text
language sql volatile set search_path = public, extensions as $$
  select 'LP-' || to_char(now() at time zone 'Asia/Jerusalem', 'YYMMDD')
      || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 4))
$$;


/**
 *  Placing one, from a page with nobody signed in.
 *
 *  The items arrive as [{"id": "<uuid>", "qty": 2}, …] and every price in the
 *  request is thrown away. What is stored is what the catalogue says right
 *  now, read here, under this function's own rights — which is the entire
 *  reason this is a function and not an insert policy.
 */
create or replace function public.place_order(
  p_producer uuid,
  p_items    jsonb,
  p_name     text,
  p_phone    text default '',
  p_email    text default '',
  p_note     text default ''
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_name   text := btrim(coalesce(p_name, ''));
  v_phone  text := btrim(coalesce(p_phone, ''));
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_lines  jsonb := '[]'::jsonb;
  v_total  numeric(12,2) := 0;
  v_number text;
  v_owner  uuid;
  r        record;
begin
  if length(v_name) < 2 then
    raise exception 'שם מלא חסר' using errcode = 'check_violation';
  end if;
  if v_phone = '' and v_email = '' then
    raise exception 'צריך טלפון או אימייל' using errcode = 'check_violation';
  end if;
  if v_email <> '' and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'אימייל לא תקין' using errcode = 'check_violation';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'הסל ריק' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'יותר מדי פריטים בהזמנה' using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.producers where id = p_producer and status = 'approved') then
    raise exception 'החנות הזאת לא פעילה' using errcode = 'check_violation';
  end if;

  /* Joined against the catalogue rather than looked up per line, so a product
     that is not this producer's, or is switched off, simply is not in the
     result — and an order made entirely of those comes out empty and is
     refused below rather than saved as a zero. */
  for r in
    select p.id, p.name, p.kind, p.price,
           least(greatest(coalesce((i->>'qty')::int, 1), 1), 99) as qty
      from jsonb_array_elements(p_items) as i
      join public.products p
        on p.id = (i->>'id')::uuid
       and p.producer_id = p_producer
       and p.active
  loop
    v_total := v_total + (r.price * r.qty);
    v_lines := v_lines || jsonb_build_object(
      'id', r.id, 'name', r.name, 'kind', r.kind,
      'price', r.price, 'qty', r.qty, 'line', r.price * r.qty
    );
  end loop;

  if jsonb_array_length(v_lines) = 0 then
    raise exception 'הפריטים בסל כבר לא זמינים' using errcode = 'check_violation';
  end if;

  v_number := public.next_order_number();

  insert into public.orders
    (producer_id, number, buyer_name, buyer_email, buyer_phone, items, total, status, note)
  values
    (p_producer, v_number, left(v_name, 120), left(v_email, 160), left(v_phone, 40),
     v_lines, v_total, 'pending', left(coalesce(p_note, ''), 2000));

  select owner_id into v_owner from public.producers where id = p_producer;
  if v_owner is not null then
    perform public.notify(v_owner, 'order', 'הזמנה חדשה',
                          v_name || ' · ' || v_number, '/app/store');
  end if;

  return v_number;
end $$;

revoke all on function public.place_order(uuid, jsonb, text, text, text, text) from public;
grant execute on function public.place_order(uuid, jsonb, text, text, text, text)
  to anon, authenticated, service_role;


-- ── live, like everything else ──────────────────────────────────────────────
alter table public.products replica identity full;
alter table public.orders   replica identity full;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- ============================================================================
--  0041 — a list you can put in your own order
-- ============================================================================
--  A task list is sorted by whether it is done and then by when it is due,
--  which is a reasonable guess and is not how anybody works. The three things
--  that matter this week are not the three with the earliest dates; they are
--  the three the producer decided matter, and until now there was nowhere to
--  record that decision.
--
--  So: a position, and one call that writes a whole new order at once.
--
--  Written as a single statement on purpose. A loop of updates sent from a
--  browser leaves the list in an order that exists nowhere the moment one of
--  them fails, and the row that moved is the one that looks right while the
--  four around it are wrong.
-- ============================================================================

alter table public.tasks add column if not exists sort_order integer not null default 0;

/* Existing rows get the order they are already being shown in, so the first
   drag moves one row rather than shuffling the whole list. Runs once: every
   row is at zero exactly until this has been applied. */
do $$ begin
  if not exists (select 1 from public.tasks where sort_order <> 0) then
    update public.tasks t
       set sort_order = x.pos
      from (
        select id, row_number() over (
                 partition by client_id
                 order by done, due_on nulls last, created_at
               ) as pos
          from public.tasks
      ) x
     where t.id = x.id;
  end if;
end $$;

create index if not exists tasks_order_idx on public.tasks (client_id, sort_order);


/**
 *  The result of a drag, in one statement.
 *
 *  Deliberately not "the caller owns these": a couple reorders their own
 *  checklist too, and the question this asks is the same one the read policy
 *  asks. What it will not do is move a task between workspaces — every row is
 *  matched by id and left where it is if the caller cannot reach it, so an
 *  array with somebody else's task id in it reorders everything except that.
 */
create or replace function public.reorder_tasks(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_ids is null or array_length(p_ids, 1) is null then return; end if;

  update public.tasks t
     set sort_order = x.pos
    from unnest(p_ids) with ordinality as x(id, pos)
   where t.id = x.id
     and public.can_read_client(t.client_id);
end $$;

revoke all on function public.reorder_tasks(uuid[]) from public;
grant execute on function public.reorder_tasks(uuid[]) to authenticated, service_role;

-- ============================================================================
--  0042 — the year after the wedding
-- ============================================================================
--  Five things, and they are one thing: an event does not end when the band
--  stops. It gets closed, filed under the year it happened in, looked up two
--  summers later when a cousin asks who the photographer was, and remembered
--  on its first anniversary. Until now the platform could do the first half of
--  that and forgot the rest.
--
--  What is deliberately NOT here, because it already exists and rebuilding it
--  would risk the data in it:
--
--    producers, clients, and the approval flow            0001, 0002
--    three authorised addresses per event                 0020
--    the zero knowledge boundary and platform_stats()     0030
--    archived_at on a workspace, and the close button     0016
--
--  This extends those. `event_archives` in particular is NOT a second copy of
--  a closed event: `clients.archived_at` remains the single fact about whether
--  an event is closed, and this table holds only what closing *freezes* — the
--  supplier sheet and the money as they stood on the night, which nothing else
--  records and which a later edit to the live rows would otherwise rewrite.
-- ============================================================================

alter type notice_kind add value if not exists 'anniversary';
alter type notice_kind add value if not exists 'meeting';


-- ── who brought whom ────────────────────────────────────────────────────────
--  A referral is a governance fact, not a private one: it says which producer
--  arrived through whose link, and it is the only new thing the super admin is
--  allowed to learn. It carries no couple, no event and no money.
alter table public.producers add column if not exists referral_code text;
alter table public.producers add column if not exists referred_by uuid
  references public.producers(id) on delete set null;

create unique index if not exists producers_referral_code_idx
  on public.producers (lower(referral_code)) where referral_code is not null;

/* Short, unambiguous, and not sequential. Sequential would tell a stranger how
   many producers exist, which is exactly the kind of number this platform is
   built not to leak. */
create or replace function public.new_referral_code() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  code text;
begin
  for i in 1..10 loop
    /* No 0/O and no 1/I: this gets read aloud and typed from a screenshot. */
    code := translate(upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
                      '01', 'XY');
    exit when not exists (
      select 1 from public.producers where lower(referral_code) = lower(code)
    );
    code := null;
  end loop;
  return code;
end $$;

create or replace function public.stamp_referral_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.referral_code is null then
    new.referral_code := public.new_referral_code();
  end if;
  return new;
end $$;

drop trigger if exists producers_referral_code on public.producers;
create trigger producers_referral_code before insert on public.producers
  for each row execute function public.stamp_referral_code();

update public.producers set referral_code = public.new_referral_code()
 where referral_code is null;

/* Claiming one. Runs as the producer signing up, takes a code rather than an
   id, and refuses to point a producer at themselves — which is the only way
   this could be gamed and is worth ruling out in the database. */
create or replace function public.claim_referral(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  mine   uuid;
  source uuid;
begin
  select id into mine from public.producers where owner_id = auth.uid();
  if mine is null then return false; end if;

  select id into source from public.producers
   where lower(referral_code) = lower(btrim(coalesce(p_code, ''))) and id <> mine;
  if source is null then return false; end if;

  /* Once. A producer's origin is a fact about their signup, and letting it be
     rewritten later turns a governance record into a leaderboard. */
  update public.producers set referred_by = source
   where id = mine and referred_by is null;

  return found;
end $$;

revoke all on function public.claim_referral(text) from public;
grant execute on function public.claim_referral(text) to authenticated;


-- ── what closing an event freezes ───────────────────────────────────────────
--  A snapshot, taken once, of the things that stop being editable when the
--  night is over. Not a copy of the event: the live rows stay where they are
--  and stay readable. This is the answer to "who was the photographer on that
--  wedding in 2025", asked in 2027, after the supplier's row has been renamed
--  twice and the budget reworked for somebody else.
create table if not exists public.event_archives (
  client_id    uuid primary key references public.clients(id) on delete cascade,
  producer_id  uuid not null references public.producers(id) on delete cascade,
  /* Denormalised on purpose. The year is what the shelf is organised by, and
     reading it off a joined event date every time is how a folder listing
     becomes a table scan. */
  event_year   integer,
  event_date   date,
  display_name text not null default '',
  venue        text not null default '',
  guests_final integer,
  /* The supplier sheet and the money, as they stood. jsonb because the shape
     of a finished event is not the shape of a live one and never will be:
     nothing writes into these again. */
  vendors      jsonb not null default '[]'::jsonb,
  crew         jsonb not null default '[]'::jsonb,
  money        jsonb not null default '{}'::jsonb,
  runsheet     jsonb not null default '[]'::jsonb,
  note         text not null default '',
  closed_at    timestamptz not null default now(),
  closed_by    uuid references public.profiles(id) on delete set null
);
create index if not exists event_archives_shelf_idx
  on public.event_archives (producer_id, event_year desc, event_date desc);

alter table public.event_archives enable row level security;

/* The producer's own shelf, and nobody else's — the super admin included.
   Deliberately not `can_read_client`: a couple has no use for a frozen
   supplier sheet with fees on it, and 0025 already decided cost is producer
   only. Closing an event must not quietly widen that. */
drop policy if exists event_archives_read on public.event_archives;
create policy event_archives_read on public.event_archives for select
  using (public.owns_producer(producer_id));

drop policy if exists event_archives_write on public.event_archives;
create policy event_archives_write on public.event_archives for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));

grant all on public.event_archives to authenticated, service_role;


/**
 *  Closing one, and taking the snapshot in the same statement.
 *
 *  Idempotent: closing a closed event refreshes nothing and raises nothing,
 *  because the button is on a row that realtime may redraw underneath a thumb
 *  and a double tap must not mean something different from a single one.
 */
create or replace function public.close_event(p_client uuid, p_note text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  select * into c from public.clients where id = p_client;
  if c is null or not public.owns_producer(c.producer_id) then
    raise exception 'אפשר לסגור רק אירוע שלך' using errcode = 'insufficient_privilege';
  end if;

  update public.clients set archived_at = coalesce(archived_at, now())
   where id = p_client;

  insert into public.event_archives as a (
    client_id, producer_id, event_year, event_date, display_name, venue,
    guests_final, vendors, crew, money, runsheet, note, closed_by
  )
  values (
    p_client, c.producer_id,
    extract(year from c.event_date)::int, c.event_date,
    c.display_name, coalesce(c.venue, ''),
    (select count(*)::int from public.guests_rsvp g
      where g.client_id = p_client and g.status = 'attending'),
    coalesce((select jsonb_agg(jsonb_build_object(
        'name', v.name, 'category', v.category, 'phone', v.phone, 'status', v.status))
       from public.event_vendors v where v.client_id = p_client), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
        'name', k.name, 'role', k.role, 'phone', k.phone, 'fee', k.fee))
       from public.crew k where k.client_id = p_client), '[]'::jsonb),
    jsonb_build_object(
      /* What was agreed, falling back to what was estimated. There is no
         `amount` on this table and never was — it carries an estimate and an
         agreed price, and for a closed event the agreed one is the number that
         actually happened. Getting this wrong is what made 0043 fail on its
         first call: a plpgsql body resolves its column names at run time, so
         it created cleanly and broke the moment somebody used it. */
      'budget', coalesce((select sum(coalesce(b.agreed, b.estimate))
                            from public.budget_items b
                           where b.client_id = p_client), 0),
      'paid',   coalesce((select sum(p.amount) from public.payments p
                           where p.client_id = p_client and p.paid), 0)),
    coalesce((select jsonb_agg(jsonb_build_object(
        'at', d.at_time, 'title', d.title, 'owner', d.owner) order by d.at_time)
       from public.day_schedule d where d.client_id = p_client), '[]'::jsonb),
    left(coalesce(p_note, ''), 2000),
    auth.uid()
  )
  on conflict (client_id) do nothing;

  /* The reminders for the year to come are scheduled here rather than by a
     nightly sweep looking for events that ended: the moment an event is closed
     is the moment its anniversary becomes a fact, and a schedule written once
     is a schedule that can be looked at. */
  perform public.schedule_anniversary(p_client);
end $$;

revoke all on function public.close_event(uuid, text) from public;
grant execute on function public.close_event(uuid, text) to authenticated, service_role;


/* The shelf itself: which years this producer has events in, and how many.
   One query for the whole page rather than one per folder. */
create or replace function public.archive_years()
returns table (event_year integer, events integer)
language sql stable security definer set search_path = public as $$
  select coalesce(a.event_year, 0), count(*)::int
    from public.event_archives a
   where public.owns_producer(a.producer_id)
   group by 1
   order by 1 desc
$$;

revoke all on function public.archive_years() from public;
grant execute on function public.archive_years() to authenticated;


-- ── the workflows a producer works to ───────────────────────────────────────
--  0003 shipped one task template, compiled into the app, and it is a good
--  one. It is also Barak's. A second producer works differently, and a
--  template they cannot change is a template they will not use.
--
--  Steps are jsonb rather than a child table on purpose: a template is edited
--  as a whole and applied as a whole, never queried step by step, and a child
--  table would buy referential integrity for a list that is only ever read
--  back in one piece.
create table if not exists public.producer_workflow_templates (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  name        text not null,
  kind        text not null default 'tasks',
  /* [{ "title": "…", "offset_days": -90, "owner": "producer", "note": "…" }]
     Offsets are from the wedding date and are negative before it, which is
     where almost all of them are. */
  steps       jsonb not null default '[]'::jsonb,
  is_default  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint pwt_name_len check (char_length(btrim(name)) between 1 and 120),
  constraint pwt_kind     check (kind in ('tasks','meetings','budget','suppliers')),
  constraint pwt_steps    check (jsonb_typeof(steps) = 'array'
                                 and jsonb_array_length(steps) <= 200)
);
create index if not exists pwt_producer_idx
  on public.producer_workflow_templates (producer_id, sort_order, created_at);

alter table public.producer_workflow_templates enable row level security;

drop policy if exists pwt_all on public.producer_workflow_templates;
create policy pwt_all on public.producer_workflow_templates for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id) and public.is_approved_producer());

grant all on public.producer_workflow_templates to authenticated, service_role;


/**
 *  Applying one to an event, dated from the wedding.
 *
 *  Returns how many landed rather than raising on a duplicate: a producer who
 *  applies a template twice means "fill in what is missing", and a template
 *  that refuses because one of its ninety steps already exists is a template
 *  that has to be applied by hand.
 */
create or replace function public.apply_workflow_template(
  p_client uuid, p_template uuid
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  t     record;
  s     jsonb;
  due   date;
  added integer := 0;
  base  date;
begin
  select * into t from public.producer_workflow_templates where id = p_template;
  if t is null or not public.owns_producer(t.producer_id) then
    raise exception 'אין הרשאה לתבנית הזאת' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.clients c
     where c.id = p_client and c.producer_id = t.producer_id
  ) then
    raise exception 'התבנית שייכת למפיק אחר' using errcode = 'insufficient_privilege';
  end if;

  select event_date into base from public.clients where id = p_client;

  for s in select * from jsonb_array_elements(t.steps) loop
    /* An event with no date yet still gets its checklist, undated. Refusing
       would mean the one moment a producer most wants the list — the week they
       open the file, before a hall is booked — is the one moment it is
       unavailable. */
    due := case when base is null then null
                else base + coalesce((s->>'offset_days')::int, 0) end;

    if btrim(coalesce(s->>'title', '')) <> '' and not exists (
      select 1 from public.tasks k
       where k.client_id = p_client and k.title = left(btrim(s->>'title'), 200)
    ) then
      insert into public.tasks (client_id, title, due_on, owner, created_by, visible_to_client)
      values (
        p_client, left(btrim(s->>'title'), 200), due,
        (case when s->>'owner' = 'client' then 'client' else 'producer' end)::task_owner,
        auth.uid(),
        coalesce((s->>'visible_to_client')::boolean, true)
      );
      added := added + 1;
    end if;
  end loop;

  return added;
end $$;

revoke all on function public.apply_workflow_template(uuid, uuid) from public;
grant execute on function public.apply_workflow_template(uuid, uuid) to authenticated, service_role;


-- ── the meetings, and what was said in them ─────────────────────────────────
create table if not exists public.meeting_logs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  kind        text not null,
  title       text not null default '',
  held_on     date,
  /* The questionnaire, as answered. One object keyed by field id, so a
     template that grows a question does not need a migration and an old log
     does not grow an empty column. */
  answers     jsonb not null default '{}'::jsonb,
  summary     text not null default '',
  /* Whether the summary was written by the model or by a person. A summary
     nobody can tell the origin of is a summary nobody should rely on. */
  summary_by  text not null default 'none',
  /* False keeps a log on the producer's side, the same rule tasks use. */
  visible_to_client boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint meeting_kind check (kind in ('production','tasting','venue','design','other')),
  constraint meeting_summary_len check (char_length(summary) <= 20000),
  constraint meeting_summary_by check (summary_by in ('none','model','person'))
);
create index if not exists meeting_logs_client_idx
  on public.meeting_logs (client_id, held_on desc nulls last, created_at desc);

alter table public.meeting_logs enable row level security;

/* Producer always; the couple only for a log deliberately shared with them.
   Same two branches tasks uses, written out rather than collapsed so the next
   person can see which is which. */
drop policy if exists meeting_logs_read on public.meeting_logs;
create policy meeting_logs_read on public.meeting_logs for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or (public.can_read_client(client_id) and visible_to_client)
  );

/* Writing is the producer's. A meeting log is a record of what the producer
   heard and agreed; a couple editing one after the fact is not a correction,
   it is a different document. */
drop policy if exists meeting_logs_write on public.meeting_logs;
create policy meeting_logs_write on public.meeting_logs for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));

grant all on public.meeting_logs to authenticated, service_role;


/* Every save, kept. The spec word is "permanently": a meeting summary is
   something a supplier is paid against and a couple remembers differently, so
   what it said in March has to still be readable in September. Append only —
   there is no update policy and no delete policy at all, deliberately. */
create table if not exists public.meeting_log_versions (
  id         uuid primary key default gen_random_uuid(),
  log_id     uuid not null references public.meeting_logs(id) on delete cascade,
  answers    jsonb not null default '{}'::jsonb,
  summary    text not null default '',
  saved_by   uuid references public.profiles(id) on delete set null,
  saved_at   timestamptz not null default now()
);
create index if not exists meeting_versions_idx
  on public.meeting_log_versions (log_id, saved_at desc);

alter table public.meeting_log_versions enable row level security;

drop policy if exists meeting_versions_read on public.meeting_log_versions;
create policy meeting_versions_read on public.meeting_log_versions for select
  using (exists (
    select 1 from public.meeting_logs m
     where m.id = log_id
       and public.owns_producer(public.producer_of_client(m.client_id))
  ));

grant select on public.meeting_log_versions to authenticated, service_role;

/* Written by the database rather than by the caller, so a screen that forgets
   to record a version cannot exist.

   Two triggers, not one, and the split is not cosmetic: a row's own columns can
   only be changed BEFORE it is written, and a child row may only be inserted
   AFTER the parent exists. One function doing both would silently drop the
   timestamp, which is the sort of thing that looks fine until somebody sorts
   by it. */
create or replace function public.stamp_meeting_log() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists meeting_logs_stamped on public.meeting_logs;
create trigger meeting_logs_stamped before insert or update on public.meeting_logs
  for each row execute function public.stamp_meeting_log();

create or replace function public.keep_meeting_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
     or new.answers is distinct from old.answers
     or new.summary is distinct from old.summary then
    insert into public.meeting_log_versions (log_id, answers, summary, saved_by)
    values (new.id, new.answers, new.summary, auth.uid());
  end if;
  return null;
end $$;

drop trigger if exists meeting_logs_versioned on public.meeting_logs;
create trigger meeting_logs_versioned after insert or update on public.meeting_logs
  for each row execute function public.keep_meeting_version();


-- ── the first anniversary, and only the first ───────────────────────────────
--  A producer who sends a message on the first anniversary is remembered. A
--  producer who sends one every year for a decade is a mailing list. The spec
--  says first year only and the schema says it too: three rows per event,
--  written once when the event is closed, and nothing that generates a fourth.
--
--  Rows rather than a nightly date calculation, for two reasons. A schedule
--  that exists can be looked at, moved and cancelled before it fires. And
--  `sent_at` on the row is what makes the sweep idempotent — a cron that runs
--  twice, or a server that restarts mid-run, cannot send the same greeting
--  twice.
create table if not exists public.anniversary_reminders (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  producer_id uuid not null references public.producers(id) on delete cascade,
  milestone  text not null,
  /* The day the reminder is for, not the anniversary itself. */
  due_on     date not null,
  /* The anniversary being celebrated, carried along so a notification can name
     the date without joining back to an event that may since have been
     renamed. */
  event_date date not null,
  couple     text not null default '',
  sent_at    timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint anniversary_milestone check (milestone in ('month','week','day')),
  unique (client_id, milestone)
);
create index if not exists anniversary_due_idx
  on public.anniversary_reminders (due_on)
  where sent_at is null and cancelled_at is null;

alter table public.anniversary_reminders enable row level security;

drop policy if exists anniversary_read on public.anniversary_reminders;
create policy anniversary_read on public.anniversary_reminders for select
  using (public.owns_producer(producer_id));

/* A producer may cancel one. Nothing may edit when it fires: a reminder that
   can be moved is a reminder that drifts, and the whole value here is that it
   arrives without anybody remembering to arrange it. */
drop policy if exists anniversary_write on public.anniversary_reminders;
create policy anniversary_write on public.anniversary_reminders for update
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));

grant select, update on public.anniversary_reminders to authenticated;
grant all on public.anniversary_reminders to service_role;


/**
 *  Scheduling the three, for the year after the event.
 *
 *  Called by close_event(), and safe to call again: the unique key on
 *  (client_id, milestone) means a re-close cannot double book. An event with
 *  no date, or whose first anniversary is already behind us, schedules
 *  nothing — a reminder that was due last month is not news, it is noise with
 *  a date on it.
 */
create or replace function public.schedule_anniversary(p_client uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  c     record;
  first date;
  made  integer := 0;
begin
  select cl.*, pr.id as pid into c
    from public.clients cl
    join public.producers pr on pr.id = cl.producer_id
   where cl.id = p_client;

  if c is null or c.event_date is null then return 0; end if;

  /* One year on, to the day. February 29th lands on March 1st in a common
     year, which is what `+ interval` does and is the answer a person would
     give. */
  first := (c.event_date + interval '1 year')::date;
  if first <= current_date then return 0; end if;

  insert into public.anniversary_reminders
    (client_id, producer_id, milestone, due_on, event_date, couple)
  values
    (p_client, c.pid, 'month', (first - interval '1 month')::date, c.event_date, c.display_name),
    (p_client, c.pid, 'week',  (first - interval '7 days')::date,  c.event_date, c.display_name),
    (p_client, c.pid, 'day',   (first - interval '1 day')::date,   c.event_date, c.display_name)
  on conflict (client_id, milestone) do nothing;

  get diagnostics made = row_count;

  /* A reminder whose day has already passed at scheduling time is cancelled
     rather than left to fire late. Closing an event eleven months after it
     happened is normal, and the month-before reminder for it is already
     history. */
  update public.anniversary_reminders
     set cancelled_at = now()
   where client_id = p_client and sent_at is null and cancelled_at is null
     and due_on < current_date;

  return made;
end $$;

revoke all on function public.schedule_anniversary(uuid) from public;
grant execute on function public.schedule_anniversary(uuid) to authenticated, service_role;


/**
 *  The sweep. Everything due today or overdue and not yet sent.
 *
 *  Marks and returns in one statement, so two runs overlapping cannot both
 *  claim the same row — the second finds nothing, which is the behaviour a
 *  cron that occasionally runs twice needs from a table that sends email.
 */
create or replace function public.fire_due_anniversaries()
returns table (
  client_id   uuid,
  producer_id uuid,
  owner_id    uuid,
  milestone   text,
  couple      text,
  event_date  date,
  kind        text
)
language plpgsql volatile security definer set search_path = public as $$
begin
  return query
  with due as (
    update public.anniversary_reminders r
       set sent_at = now()
     where r.sent_at is null
       and r.cancelled_at is null
       and r.due_on <= current_date
       /* A month of grace. Older than that and a server that was down for a
          season would wake up and send a year of greetings at once. */
       and r.due_on > current_date - interval '31 days'
     returning r.client_id, r.producer_id, r.milestone, r.couple, r.event_date
  )
  select d.client_id, d.producer_id, pr.owner_id, d.milestone, d.couple, d.event_date,
         c.kind::text
    from due d
    join public.producers pr on pr.id = d.producer_id
    left join public.clients c on c.id = d.client_id;
end $$;

revoke all on function public.fire_due_anniversaries() from public;
grant execute on function public.fire_due_anniversaries() to service_role;


/**
 *  Closing what the calendar has already closed.
 *
 *  An event whose date is a fortnight behind us and which nobody pressed the
 *  button on. The delay is deliberate: the week after a wedding is when the
 *  last supplier invoice arrives and the run sheet gets its final correction,
 *  and freezing the snapshot on the Sunday morning would freeze it wrong.
 */
create or replace function public.archive_past_events(p_grace integer default 14)
returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  r     record;
  count integer := 0;
begin
  for r in
    select c.id, pr.owner_id
      from public.clients c
      join public.producers pr on pr.id = c.producer_id
     where c.archived_at is null
       and c.event_date is not null
       and c.event_date < current_date - make_interval(days => greatest(1, p_grace))
  loop
    update public.clients set archived_at = now() where id = r.id;
    perform public.schedule_anniversary(r.id);
    count := count + 1;
  end loop;
  return count;
end $$;

revoke all on function public.archive_past_events(integer) from public;
grant execute on function public.archive_past_events(integer) to service_role;


-- ── what the super admin may learn about referrals ──────────────────────────
--  Counts and a brand name. The same boundary 0030 drew, extended by exactly
--  one column: who arrived through whose link. No couple, no event, no money.
create or replace function public.referral_stats()
returns table (
  producer_id    uuid,
  brand          text,
  referral_code  text,
  referred_by    uuid,
  referred_brand text,
  invited_total  integer,
  clients_total  integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    pr.id,
    coalesce(nullif(pr.brand_name, ''), nullif(pr.contact_name, ''), pr.contact_email),
    pr.referral_code,
    pr.referred_by,
    (select coalesce(nullif(s.brand_name, ''), s.contact_email)
       from public.producers s where s.id = pr.referred_by),
    (select count(*)::int from public.producers x where x.referred_by = pr.id),
    /* A number, and only a number. This is the line the whole zero knowledge
       design is about: root may know that Keren manages nine events and may
       not know one thing about any of them. */
    (select count(*)::int from public.clients c where c.producer_id = pr.id)
  from public.producers pr
  order by 6 desc, 7 desc;
end $$;

revoke all on function public.referral_stats() from public;
grant execute on function public.referral_stats() to authenticated;


-- ── the one grant the sweep depends on ──────────────────────────────────────
--  notify() has been callable since 0010 only because nothing ever revoked the
--  default execute privilege on functions. The nightly sweep runs as the
--  service role and calls it, so stating the grant means the day somebody
--  tightens function privileges across the schema, the anniversary reminders
--  do not quietly stop arriving with no error anywhere. Same lesson 0026
--  wrote down about the marketing page.
grant execute on function public.notify(uuid, notice_kind, text, text, text)
  to authenticated, service_role;

-- ============================================================================
--  0043 — a closed event that never reached the shelf
-- ============================================================================
--  0042 added close_event(), which marks a workspace closed *and* freezes the
--  snapshot the archive is built from. What it did not do was change the
--  button. The close control has set `archived_at` directly since 0016 and
--  went on doing so, which means every event closed since 0042 shipped is
--  closed, correct, and invisible on a shelf that reads snapshots.
--
--  Two halves, and both are needed. The screen is fixed in the same commit;
--  this fixes the rows that are already wrong, because a fix that only works
--  for events closed from tomorrow leaves somebody staring at an empty page
--  and no way to populate it.
--
--  It also splits the function that was doing two jobs. Taking a snapshot and
--  deciding who is allowed to take one are separate concerns, and the backfill
--  needs the first without the second: it runs from a SQL editor where there
--  is no signed-in person to own anything.
-- ============================================================================

/* The snapshot itself, with no opinion about who asked for it.
   Never granted to anybody: the only callers are close_event(), which checks
   first, and the backfill below, which runs as the owner of the schema. */
create or replace function public.snapshot_event(p_client uuid, p_note text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  select * into c from public.clients where id = p_client;
  if c is null then return; end if;

  insert into public.event_archives (
    client_id, producer_id, event_year, event_date, display_name, venue,
    guests_final, vendors, crew, money, runsheet, note, closed_by
  )
  values (
    p_client, c.producer_id,
    extract(year from c.event_date)::int, c.event_date,
    c.display_name, coalesce(c.venue, ''),
    (select count(*)::int from public.guests_rsvp g
      where g.client_id = p_client and g.status = 'attending'),
    coalesce((select jsonb_agg(jsonb_build_object(
        'name', v.name, 'category', v.category, 'phone', v.phone, 'status', v.status))
       from public.event_vendors v where v.client_id = p_client), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
        'name', k.name, 'role', k.role, 'phone', k.phone, 'fee', k.fee))
       from public.crew k where k.client_id = p_client), '[]'::jsonb),
    jsonb_build_object(
      /* What was agreed, falling back to what was estimated. There is no
         `amount` on this table and never was — it carries an estimate and an
         agreed price, and for a closed event the agreed one is the number that
         actually happened. Getting this wrong is what made 0043 fail on its
         first call: a plpgsql body resolves its column names at run time, so
         it created cleanly and broke the moment somebody used it. */
      'budget', coalesce((select sum(coalesce(b.agreed, b.estimate))
                            from public.budget_items b
                           where b.client_id = p_client), 0),
      'paid',   coalesce((select sum(p.amount) from public.payments p
                           where p.client_id = p_client and p.paid), 0)),
    coalesce((select jsonb_agg(jsonb_build_object(
        'at', d.at_time, 'title', d.title, 'owner', d.owner) order by d.at_time)
       from public.day_schedule d where d.client_id = p_client), '[]'::jsonb),
    left(coalesce(p_note, ''), 2000),
    /* Null in a backfill, and that is the truth: nobody pressed a button.
       Writing the schema owner in here instead would be a lie in an audit
       column, which is the one place a plausible guess is worse than a gap. */
    auth.uid()
  )
  on conflict (client_id) do nothing;
end $$;

revoke all on function public.snapshot_event(uuid, text) from public;


/* The checked version, unchanged in behaviour and now three lines long. */
create or replace function public.close_event(p_client uuid, p_note text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare
  owner_ok boolean;
begin
  select public.owns_producer(c.producer_id) into owner_ok
    from public.clients c where c.id = p_client;

  if owner_ok is not true then
    raise exception 'אפשר לסגור רק אירוע שלך' using errcode = 'insufficient_privilege';
  end if;

  update public.clients set archived_at = coalesce(archived_at, now())
   where id = p_client;

  perform public.snapshot_event(p_client, p_note);
  perform public.schedule_anniversary(p_client);
end $$;

revoke all on function public.close_event(uuid, text) from public;
grant execute on function public.close_event(uuid, text) to authenticated, service_role;


-- ── the events that were already closed ─────────────────────────────────────
--  Everything with a closing date and no snapshot behind it. Runs once by
--  construction: `on conflict do nothing` inside snapshot_event means a second
--  run finds every row already filed and writes nothing.
--
--  The snapshot taken here is of the event *as it is now* rather than as it
--  was on the night, which is the honest best available. For a wedding closed
--  yesterday those are the same thing; for one closed months ago it is the
--  closest thing that exists, and an approximate supplier sheet beats an empty
--  shelf and no way to fill it.
do $$
declare r record; n integer := 0;
begin
  for r in
    select c.id from public.clients c
     where c.archived_at is not null
       and not exists (select 1 from public.event_archives a where a.client_id = c.id)
  loop
    perform public.snapshot_event(r.id, '');
    perform public.schedule_anniversary(r.id);
    n := n + 1;
  end loop;
  raise notice 'filed % events that were closed before the shelf existed', n;
end $$;

-- ============================================================================
--  0044 — the three lists that were never wired
-- ============================================================================
--  His music table, his equipment checklist and the personal details he keeps
--  about each couple were read out of his own documents and written into
--  `content/eventFile.ts` a while ago. They have sat there since, reaching no
--  screen and having nowhere to be stored. Third time this shape has turned up
--  in a week: the work was done and nothing could get to it.
--
--  Who fills each one in is what decides its policy, and the three differ:
--
--    the songs        the couple chooses them, the producer tells the DJ
--    the equipment    the producer's own logistics
--    the details      the couple writes them, the producer reads them
--
--  So they are three tables rather than one with a `kind`, because a single
--  table would need one policy for three different answers to "who may write
--  this", and that is exactly the sort of clever which ends with a couple
--  editing the generator.
-- ============================================================================


-- ── the seven moments that need a song ──────────────────────────────────────
--  One row per moment per event, and the moment is a string from the shipped
--  list rather than an enum: adding an eighth moment should be a line in a
--  content file, not a migration and a deploy.
create table if not exists public.event_music (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  moment     text not null,
  song       text not null default '',
  artist     text not null default '',
  note       text not null default '',
  updated_at timestamptz not null default now(),
  unique (client_id, moment),
  constraint music_moment_len check (char_length(btrim(moment)) between 1 and 120),
  constraint music_song_len   check (char_length(song) <= 200),
  constraint music_artist_len check (char_length(artist) <= 160),
  constraint music_note_len   check (char_length(note) <= 500)
);
create index if not exists event_music_client_idx on public.event_music (client_id);

alter table public.event_music enable row level security;

/* Both sides, both ways. The couple picks the songs and the producer is the
   one who has to hand the list to a DJ, and a screen where only one of them
   can type turns into a screen where the other one sends a WhatsApp instead. */
drop policy if exists event_music_all on public.event_music;
create policy event_music_all on public.event_music for all
  using      (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

grant all on public.event_music to authenticated, service_role;


-- ── the equipment ───────────────────────────────────────────────────────────
--  Production logistics. A generator, a sound system and a set of screens are
--  the producer's problem, and 0025 already decided that side of the wall.
--  Readable by the couple deliberately, though: there is nothing sensitive in
--  "there is a generator", and a couple who can see it stops asking.
create table if not exists public.event_equipment (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  item       text not null,
  needed     boolean not null default false,
  sorted     boolean not null default false,
  note       text not null default '',
  updated_at timestamptz not null default now(),
  unique (client_id, item),
  constraint equipment_item_len check (char_length(btrim(item)) between 1 and 120),
  constraint equipment_note_len check (char_length(note) <= 500)
);
create index if not exists event_equipment_client_idx on public.event_equipment (client_id);

alter table public.event_equipment enable row level security;

drop policy if exists event_equipment_read on public.event_equipment;
create policy event_equipment_read on public.event_equipment for select
  using (public.can_read_client(client_id));

drop policy if exists event_equipment_write on public.event_equipment;
create policy event_equipment_write on public.event_equipment for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));

grant all on public.event_equipment to authenticated, service_role;


-- ── what he writes down about each of them ──────────────────────────────────
--  Two people per event, and the fields are the ones from his own file: what
--  she likes to drink, who is walking her in, what must not be forgotten. The
--  values are a jsonb object rather than a column each, for the same reason
--  the template steps are: the shape is edited and read as a whole, and a
--  field added to the list should not need a migration.
create table if not exists public.couple_details (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  /* 'a' and 'b' rather than bride and groom. Not every event this platform
     serves is a wedding, and not every wedding has one of each. */
  person     text not null,
  name       text not null default '',
  fields     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (client_id, person),
  constraint couple_person check (person in ('a', 'b')),
  constraint couple_name_len check (char_length(name) <= 120),
  constraint couple_fields check (jsonb_typeof(fields) = 'object')
);
create index if not exists couple_details_client_idx on public.couple_details (client_id);

alter table public.couple_details enable row level security;

/* The couple writes these about themselves. Producer reads and may correct,
   because half of them arrive over the phone and get typed by whoever is
   holding it. */
drop policy if exists couple_details_all on public.couple_details;
create policy couple_details_all on public.couple_details for all
  using      (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

grant all on public.couple_details to authenticated, service_role;


-- ── stamps ──────────────────────────────────────────────────────────────────
create or replace function public.stamp_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists event_music_stamped on public.event_music;
create trigger event_music_stamped before insert or update on public.event_music
  for each row execute function public.stamp_updated_at();

drop trigger if exists event_equipment_stamped on public.event_equipment;
create trigger event_equipment_stamped before insert or update on public.event_equipment
  for each row execute function public.stamp_updated_at();

drop trigger if exists couple_details_stamped on public.couple_details;
create trigger couple_details_stamped before insert or update on public.couple_details
  for each row execute function public.stamp_updated_at();


-- ── live, like everything else ──────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['event_music', 'event_equipment', 'couple_details'] loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============================================================================
--  0045 — the guests' site
-- ============================================================================
--  The one thing every consumer planner ships and this platform did not: a
--  page the couple can send to everyone they invited. When, where, how to get
--  there, the order of the evening, a few words from the couple, and a way to
--  confirm. Until now a guest only ever got a personal RSVP link, one at a
--  time, and the couple had nothing to paste into the family WhatsApp group.
--
--  Three columns on the event rather than a table of their own: the page is a
--  property of the event, it has no rows of its own, and a join for three
--  fields is a join for nothing.
--
--    guest_token     the unguessable address of the page, minted by trigger
--                    like the RSVP token in 0006, never settable from outside
--    guest_site_on   the switch; a minted token with the switch off is a page
--                    that does not exist, so every event can carry one safely
--    guest_note      the couple's words: dress code, parking, whatever matters
--
--  Two functions are the whole public surface. The table stays shut, exactly
--  as 0006 did for replies: an anonymous visitor can read one event's public
--  face by its token, and can find their own invitation by their own phone
--  number, and nothing else.
-- ============================================================================


-- ── the columns ─────────────────────────────────────────────────────────────
alter table public.clients
  add column if not exists guest_token   text,
  add column if not exists guest_site_on boolean not null default false,
  add column if not exists guest_note    text not null default '';

alter table public.clients
  drop constraint if exists clients_guest_note_len;
alter table public.clients
  add constraint clients_guest_note_len check (char_length(guest_note) <= 1200);

/* Every existing event gets an address now, switched off. Minting on demand
   would mean a page whose URL changes the first time it is switched on, and
   a link already pasted somewhere would then point at nothing. */
update public.clients
   set guest_token = encode(gen_random_bytes(16), 'hex')
 where guest_token is null;

create unique index if not exists clients_guest_token_idx on public.clients (guest_token);


-- ── the token is a credential, so it must not be settable from outside ──────
--  The same shape as guard_invite_token in 0006: minted on insert, frozen on
--  update. No search_path pin on purpose - it calls pgcrypto, which lives in
--  `extensions` on Supabase, and resolves through the caller's path.
create or replace function public.guard_guest_token() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.guest_token := encode(gen_random_bytes(16), 'hex');
  else
    new.guest_token := old.guest_token;
  end if;
  return new;
end $$;
drop trigger if exists clients_guard_guest_token on public.clients;
create trigger clients_guard_guest_token before insert or update on public.clients
  for each row execute function public.guard_guest_token();


-- ── what a guest sees when they open the link ───────────────────────────────
--  Only the public face: names, date, venue, the couple's note, the producer's
--  brand for the footer, and the key moments of the schedule. Not the guest
--  list, not the budget, not the run sheet's staffing lines. A switched-off
--  page returns no row, which the route renders as "not found" - the same
--  answer a wrong token gets, so the two are indistinguishable from outside.
create or replace function public.guest_site(p_token text)
returns table (
  event_name text,
  event_date date,
  venue      text,
  note       text,
  producer   text,
  moments    jsonb
)
language sql stable security definer set search_path = public as $$
  select c.display_name,
         c.event_date,
         c.venue,
         c.guest_note,
         p.brand_name,
         coalesce((
           select jsonb_agg(jsonb_build_object('at', d.at_time, 'title', d.title) order by d.at_time)
             from public.day_schedule d
            where d.client_id = c.id
              and d.key_moment
         ), '[]'::jsonb)
    from public.clients c
    join public.producers p on p.id = c.producer_id
   where c.guest_token = p_token
     and c.guest_site_on
   limit 1
$$;


-- ── a guest finds their own invitation ──────────────────────────────────────
--  By the phone number the invitation was addressed to. Compared on the last
--  nine digits so 050-123-4567 and +972501234567 are the same person, which
--  they are. Hands back only the invitation token, and only on a page that is
--  switched on: the token opens that one guest's own reply and nothing else.
--  The route in front of this rate limits by visitor, so a page's token is
--  not a licence to walk the phone book.
create or replace function public.guest_find(p_token text, p_phone text)
returns text
language sql stable security definer set search_path = public as $$
  select g.invite_token
    from public.guests_rsvp g
    join public.clients c on c.id = g.client_id
   where c.guest_token = p_token
     and c.guest_site_on
     and length(regexp_replace(p_phone, '\D', '', 'g')) >= 9
     and right(regexp_replace(g.phone, '\D', '', 'g'), 9)
         = right(regexp_replace(p_phone, '\D', '', 'g'), 9)
   limit 1
$$;

revoke all on function public.guest_site(text) from public;
revoke all on function public.guest_find(text, text) from public;
grant execute on function public.guest_site(text) to anon, authenticated;
grant execute on function public.guest_find(text, text) to anon, authenticated;

-- ============================================================================
--  0046 — the producer's own mark on the home screen
-- ============================================================================
--  The installed app carried the producer's name and the platform's icon. A
--  home screen is the one place a brand is looked at forty times a day, and an
--  icon that belongs to somebody else's business undoes every other line of
--  the white label.
--
--  Three pictures, one bucket. The logo (already a column, never uploadable
--  from the branding screen until now), the app icon the phone shows, and a
--  cover the front door and the share card can carry. Public for read, since
--  every one of them is drawn on a page a stranger may open; writable by the
--  producer who owns the folder and nobody else.
-- ============================================================================

alter table public.producers add column if not exists icon_url  text;
alter table public.producers add column if not exists cover_url text;

comment on column public.producers.icon_url is
  'The square icon an installed app shows. A public URL in the brand bucket.';
comment on column public.producers.cover_url is
  'A wide photograph for the front door and the share card. Public URL.';


-- ── the bucket ──────────────────────────────────────────────────────────────
--  Laid out as <producer_id>/<file>, the same shape as avatars: the folder is
--  the owner. storage_owner_id() reads the first segment as a uuid and answers
--  null for anything else, and owns_producer(null) is false, so a file dropped
--  at the root of the bucket belongs to nobody and cannot be written.
insert into storage.buckets (id, name, public)
values ('brand', 'brand', true)
on conflict (id) do update set public = true;

drop policy if exists brand_objects_read on storage.objects;
create policy brand_objects_read on storage.objects for select
  using (bucket_id = 'brand');

drop policy if exists brand_objects_write on storage.objects;
create policy brand_objects_write on storage.objects for insert
  with check (bucket_id = 'brand' and public.owns_producer(public.storage_owner_id(name)));

drop policy if exists brand_objects_update on storage.objects;
create policy brand_objects_update on storage.objects for update
  using (bucket_id = 'brand' and public.owns_producer(public.storage_owner_id(name)));

drop policy if exists brand_objects_delete on storage.objects;
create policy brand_objects_delete on storage.objects for delete
  using (bucket_id = 'brand' and public.owns_producer(public.storage_owner_id(name)));


-- ── the two lookups learn the two new pictures ──────────────────────────────
--  A function's return shape cannot be changed in place, so both are dropped
--  and written again with the same body plus two columns. Everything that
--  called them reads by name, so the extra columns cost nobody anything.
drop function if exists public.producer_by_host(text);
create or replace function public.producer_by_host(p_host text)
returns table (
  brand text, tagline text, accent text, logo_url text, whatsapp text, booking_url text,
  icon_url text, cover_url text
)
language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(pr.brand_name, ''), nullif(pr.contact_name, ''), ''),
    pr.tagline,
    pr.accent,
    pr.logo_url,
    pr.whatsapp,
    pr.booking_url,
    pr.icon_url,
    pr.cover_url
  from public.producers pr
  where pr.status = 'approved'
    and (
      pr.domain = lower(btrim(p_host))
      or pr.slug = split_part(lower(btrim(p_host)), '.', 1)
    )
  order by (pr.domain = lower(btrim(p_host))) desc
  limit 1
$$;

revoke all on function public.producer_by_host(text) from public;
grant execute on function public.producer_by_host(text) to anon, authenticated, service_role;

drop function if exists public.my_workspace_brand();
create or replace function public.my_workspace_brand()
returns table (
  brand text, tagline text, accent text, logo_url text, whatsapp text, booking_url text,
  icon_url text, cover_url text
)
language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(pr.brand_name, ''), nullif(pr.contact_name, ''), ''),
    pr.tagline,
    pr.accent,
    pr.logo_url,
    pr.whatsapp,
    pr.booking_url,
    pr.icon_url,
    pr.cover_url
  from public.clients c
  join public.producers pr on pr.id = c.producer_id
  where public.can_read_client(c.id)
    and c.archived_at is null
  order by c.event_date asc nulls last
  limit 1
$$;

revoke all on function public.my_workspace_brand() from public;
grant execute on function public.my_workspace_brand() to authenticated;

-- ============================================================================
--  0047 — a tag on every picture
-- ============================================================================
--  The shared folder took photographs from the first day and showed them as
--  one grid. By the third site visit that grid is sixty pictures with no
--  order: the hall, the florist's samples, a screenshot of somebody else's
--  wedding, a supplier's price list photographed off a desk. Four words sort
--  all of it, and the same four words are what the producer says out loud
--  when asked what a picture is.
--
--  A column rather than a table. A file has one tag or none; a join table
--  would let it have three, and then the question "where is the picture of
--  the hall" has three answers.
-- ============================================================================

alter table public.client_files add column if not exists tag text not null default '';

do $$ begin
  alter table public.client_files add constraint client_files_tag_known
    check (tag in ('', 'venue', 'design', 'inspiration', 'vendors'));
exception when duplicate_object then null; end $$;

comment on column public.client_files.tag is
  'One of venue, design, inspiration, vendors, or empty. The keys are fixed; '
  'the words for them live in src/content/site.ts.';

/* The tag is the second thing worth changing after the fact, next to the
   note. The provenance trigger from 0039 lists the columns it freezes and this
   is not one of them, so the existing update policy already lets it move. */
create index if not exists client_files_tag_idx
  on public.client_files (client_id, tag);

-- ============================================================================
--  0048 — what the supplier costs
-- ============================================================================
--  The directory held who a supplier is and how to reach them, and nothing
--  about money. The spreadsheet every producer already keeps holds exactly
--  two more columns: the price agreed and the deposit already paid. Importing
--  that sheet without those two would drop the half the producer opens it for.
--
--  On the directory rather than the event, because that is where the sheet
--  keeps them: the florist's usual price, the retainer she asks for. An
--  event's own figures stay in budget_items, where they always were.
-- ============================================================================

alter table public.vendors add column if not exists agreed_price numeric(12,2);
alter table public.vendors add column if not exists deposit_paid numeric(12,2);

do $$ begin
  alter table public.vendors add constraint vendors_money_sane
    check (
      (agreed_price is null or agreed_price >= 0)
      and (deposit_paid is null or deposit_paid >= 0)
    );
exception when duplicate_object then null; end $$;

comment on column public.vendors.agreed_price is
  'The usual agreed price, in shekels. Null when it was never written down.';
comment on column public.vendors.deposit_paid is
  'The deposit already paid against that price, in shekels.';

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


-- ── live, like everything else ──────────────────────────────────────────────
--  The root account's list refreshes as reports arrive, without a reload.
alter table public.support_tickets replica identity full;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_tickets'
  ) then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
end $$;

-- ============================================================================
--  0050 — where the wedding is, and what it may cost
-- ============================================================================
--  Two columns that were missing from the two conversations that matter most.
--
--  The first question a producer asks an enquiry is "where", because the
--  answer decides whether they can take it at all: a producer in the north
--  does not drive to Eilat for a Thursday. The lead form never asked, so the
--  first call was spent finding out. Now the visitor says, in a tap.
--
--  The first question a couple asks about money is "how much can we spend",
--  and the budget screen only knew what things cost. A target is the figure
--  everything else is measured against, and it lives on the event.
-- ============================================================================

alter table public.leads add column if not exists location text not null default '';
do $$ begin
  alter table public.leads add constraint leads_location_len check (char_length(location) <= 120);
exception when duplicate_object then null; end $$;

comment on column public.leads.location is
  'Region or venue as the enquirer put it. Free text; the form offers the '
  'regions as chips and stores the label.';

alter table public.clients add column if not exists budget_target numeric(12,2);
do $$ begin
  alter table public.clients add constraint clients_budget_target_sane
    check (budget_target is null or budget_target >= 0);
exception when duplicate_object then null; end $$;

comment on column public.clients.budget_target is
  'The ceiling the couple and producer agreed on, in shekels. Null until set.';


-- ── the three doors a lead comes through, each learning the location ────────
--  A function's parameter list cannot grow in place: the old signature would
--  survive as an overload and the RPC call would be ambiguous. Each is
--  dropped and written again with the location appended and defaulted, so a
--  caller that does not send it still works.

drop function if exists public.submit_lead(text, text, text, text, date, integer, text);
create or replace function public.submit_lead(
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default '',
  p_location    text default ''
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name  text := btrim(coalesce(p_full_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if length(v_name) < 2 then
    raise exception 'שם מלא חסר' using errcode = 'check_violation';
  end if;
  if v_phone = '' and v_email = '' then
    raise exception 'צריך טלפון או אימייל' using errcode = 'check_violation';
  end if;
  if v_email <> '' and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'אימייל לא תקין' using errcode = 'check_violation';
  end if;
  if p_guest_count is not null and (p_guest_count <= 0 or p_guest_count > 5000) then
    raise exception 'כמות אורחים לא תקינה' using errcode = 'check_violation';
  end if;

  insert into public.leads (full_name, phone, email, kind, event_date, guest_count, message, source, location)
  values (
    left(v_name, 120),
    left(v_phone, 40),
    left(v_email, 160),
    (case when p_kind = 'corporate' then 'corporate' else 'wedding' end)::event_class,
    p_event_date,
    p_guest_count,
    left(coalesce(p_message, ''), 4000),
    'site',
    left(btrim(coalesce(p_location, '')), 120)
  );
end $$;

revoke all on function public.submit_lead(text, text, text, text, date, integer, text, text) from public;
grant execute on function public.submit_lead(text, text, text, text, date, integer, text, text)
  to anon, authenticated, service_role;


drop function if exists public.record_lead(text, text, text, text, date, integer, text, text);
create or replace function public.record_lead(
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default '',
  p_source      text default 'phone',
  p_location    text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_producer uuid;
  v_id       uuid;
begin
  select pr.id into v_producer
    from public.producers pr
   where pr.owner_id = auth.uid() and pr.status = 'approved'
   order by pr.created_at
   limit 1;

  if v_producer is null then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'שם מלא חסר' using errcode = 'check_violation';
  end if;
  if btrim(coalesce(p_phone, '')) = '' and btrim(coalesce(p_email, '')) = '' then
    raise exception 'צריך טלפון או אימייל' using errcode = 'check_violation';
  end if;

  insert into public.leads (
    producer_id, full_name, phone, email, kind, event_date, guest_count, message, source, location
  ) values (
    v_producer,
    left(btrim(p_full_name), 120),
    left(btrim(coalesce(p_phone, '')), 40),
    left(lower(btrim(coalesce(p_email, ''))), 160),
    (case when p_kind = 'corporate' then 'corporate' else 'wedding' end)::event_class,
    case when p_event_date is not null and p_event_date >= date '2026-01-01' then p_event_date end,
    case when p_guest_count between 1 and 1500 then p_guest_count end,
    left(coalesce(p_message, ''), 4000),
    public.normalize_source(p_source),
    left(btrim(coalesce(p_location, '')), 120)
  )
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.record_lead(text, text, text, text, date, integer, text, text, text) from public;
grant execute on function public.record_lead(text, text, text, text, date, integer, text, text, text)
  to authenticated, service_role;


drop function if exists public.ingest_lead(text, text, text, text, date, integer, text, text, text);
create or replace function public.ingest_lead(
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default '',
  p_source      text default 'webhook',
  p_external_id text default null,
  p_location    text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name   text := btrim(coalesce(p_full_name, ''));
  v_phone  text := btrim(coalesce(p_phone, ''));
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_ext    text := nullif(btrim(coalesce(p_external_id, '')), '');
  v_date   date := p_event_date;
  v_guests integer := p_guest_count;
  v_id     uuid;
begin
  if v_name = '' and v_phone = '' and v_email = '' then
    raise exception 'פנייה ריקה' using errcode = 'check_violation';
  end if;

  if v_ext is not null then
    select id into v_id from public.leads where external_id = v_ext;
    if found then return v_id; end if;
  end if;

  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then v_email := ''; end if;
  if v_date is not null and v_date < date '2026-01-01' then v_date := null; end if;
  if v_guests is not null and (v_guests <= 0 or v_guests > 1500) then v_guests := null; end if;
  if v_name = '' then v_name := coalesce(nullif(v_phone, ''), v_email); end if;

  insert into public.leads (
    full_name, phone, email, kind, event_date, guest_count, message, source, external_id, location
  ) values (
    left(v_name, 120),
    left(v_phone, 40),
    left(v_email, 160),
    (case when p_kind = 'corporate' then 'corporate' else 'wedding' end)::event_class,
    v_date,
    v_guests,
    left(coalesce(p_message, ''), 4000),
    public.normalize_source(p_source),
    v_ext,
    left(btrim(coalesce(p_location, '')), 120)
  )
  on conflict (external_id) where external_id is not null do nothing
  returning id into v_id;

  if v_id is null and v_ext is not null then
    select id into v_id from public.leads where external_id = v_ext;
  end if;

  return v_id;
end $$;

revoke all on function public.ingest_lead(text, text, text, text, date, integer, text, text, text, text) from public;
grant execute on function public.ingest_lead(text, text, text, text, date, integer, text, text, text, text)
  to anon, authenticated, service_role;

-- ============================================================================
--  0051 — the producer's own words, and their own colours
-- ============================================================================
--  Two lists that were the platform's and should have been the producer's.
--
--  The first is how an enquiry arrived. The list was six values in the code:
--  phone, whatsapp, instagram, facebook, referral, walk in. A producer whose
--  work comes from TikTok, or from one designer who sends them four weddings
--  a year, had nowhere to put that — and the funnel report then measured the
--  channels we guessed rather than the ones they use.
--
--  The second is colour. A diary of thirty events in one accent is a diary
--  nobody scans; every producer already colours their own paper one, and
--  every one of them colours it differently.
--
--  One table for both, because they are the same shape: a producer's own
--  label, with an order and a colour, in a named taxonomy. `kind` is what
--  separates them, and adding a third taxonomy later is a value rather than
--  a migration.
-- ============================================================================

create table if not exists public.producer_labels (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  kind        text not null,
  label       text not null,
  /* A hex value, because the producer picks one. The screen offers a measured
     palette rather than a free wheel, for the reason the accent does; this
     column holds whatever was picked and the shape is all the database can
     honestly enforce. */
  color       text not null default '#64748B',
  sort_order  int  not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint producer_labels_kind  check (kind in ('event_tag', 'lead_channel')),
  constraint producer_labels_label check (char_length(btrim(label)) between 1 and 40),
  constraint producer_labels_color check (color ~* '^#[0-9a-f]{6}$')
);

/* One label once per taxonomy. Two rows called "טעימות" is two colours for
   one thing, and the diary then means nothing. Case folded, because nobody
   types their own label the same way twice. */
create unique index if not exists producer_labels_unique
  on public.producer_labels (producer_id, kind, lower(btrim(label)));
create index if not exists producer_labels_list
  on public.producer_labels (producer_id, kind, sort_order);

alter table public.producer_labels enable row level security;

drop policy if exists producer_labels_all on public.producer_labels;
create policy producer_labels_all on public.producer_labels for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));

grant all on public.producer_labels to authenticated, service_role;

comment on table public.producer_labels is
  'A producer''s own taxonomies: the colours their diary is read by, and the '
  'channels their enquiries arrive through. Never shared between producers.';


-- ── the colour on an event ──────────────────────────────────────────────────
--  Null is the ordinary case and stays the accent. A label that is deleted
--  takes its colour off the events rather than the events with it.
alter table public.clients add column if not exists label_id uuid
  references public.producer_labels(id) on delete set null;

create index if not exists clients_label_idx on public.clients (label_id)
  where label_id is not null;


-- ── a first set, so the toolbar is not empty on the first visit ─────────────
--  Four colours every producer's paper diary already has, in the words they
--  use for them. Seeded once per producer and never again: a producer who
--  deletes "טעימות" because they do not do tastings must not find it back
--  next deploy, so the insert is skipped where the producer has any tag at
--  all rather than where this particular one is missing.
do $$
declare pr record;
begin
  for pr in select id from public.producers loop
    if not exists (
      select 1 from public.producer_labels
       where producer_id = pr.id and kind = 'event_tag'
    ) then
      insert into public.producer_labels (producer_id, kind, label, color, sort_order)
      values
        (pr.id, 'event_tag', 'חתונות פעילות',  '#2F6F5E', 1),
        (pr.id, 'event_tag', 'פגישות זוג',     '#7C5CBF', 2),
        (pr.id, 'event_tag', 'טעימות וסיורים', '#C2762B', 3),
        (pr.id, 'event_tag', 'תשלומים דחופים', '#2563EB', 4);
    end if;
  end loop;
end $$;

-- ============================================================================
--  0052 — the enquiry survives becoming an event
-- ============================================================================
--  A lead carries the phone number, the address, what the couple wrote, and
--  where they came from. Converting it built an event out of the name, the
--  kind, the date, the guest count and the location — and dropped the rest.
--
--  The comment above that code said "everything already gathered travels
--  across", which was not true and had not been true for as long as the
--  function existed. What it cost is small and constant: the producer converts
--  an enquiry, then goes back to the leads screen to find the phone number of
--  the couple whose event they are now standing in.
--
--  Five columns, and the last of them is the one that matters most. `lead_id`
--  is the join that makes a question answerable that could not be asked
--  before: how many enquiries became events, from which source, and how long
--  it took. Without it the two tables are strangers and the funnel on the
--  insights screen stops at the lead.
--
--  Nothing is destroyed and nothing is moved. The lead keeps its own copy of
--  everything; these are the event's, and the producer edits them there as the
--  facts change without rewriting history on the enquiry.
-- ============================================================================

alter table public.clients add column if not exists contact_email text not null default '';
alter table public.clients add column if not exists contact_phone text not null default '';
alter table public.clients add column if not exists brief         text not null default '';
alter table public.clients add column if not exists source        text not null default '';
alter table public.clients add column if not exists lead_id       uuid;

do $$ begin
  alter table public.clients
    add constraint clients_lead_fk foreign key (lead_id)
    references public.leads(id) on delete set null;
exception when duplicate_object then null; end $$;

/* Lengths that match the columns these are copied from, so a value that fits
   on the lead cannot fail to fit on the event it becomes. */
do $$ begin
  alter table public.clients add constraint clients_contact_email_len check (char_length(contact_email) <= 200);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.clients add constraint clients_contact_phone_len check (char_length(contact_phone) <= 40);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.clients add constraint clients_brief_len check (char_length(brief) <= 4000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.clients add constraint clients_source_len check (char_length(source) <= 60);
exception when duplicate_object then null; end $$;

comment on column public.clients.contact_email is
  'How to reach the couple, from the enquiry. Not the same as client_users, '
  'which is who may sign in: a couple has a phone number long before either '
  'of them has an account, and the producer needs it on the file either way.';
comment on column public.clients.contact_phone is
  'The number the producer actually calls. Carried from the lead.';
comment on column public.clients.brief is
  'What the couple wrote when they enquired, kept verbatim. It is the only '
  'thing on the file in their own words.';
comment on column public.clients.source is
  'Where the business came from, carried from the lead so the answer survives '
  'the enquiry being marked won.';
comment on column public.clients.lead_id is
  'The enquiry this event grew out of, when there was one. Null for an event '
  'the producer opened directly, which is a real and common case rather than '
  'missing data.';

/* Answering "how many enquiries became events" means scanning clients by
   lead, and the funnel does it per producer per period. */
create index if not exists clients_lead_idx on public.clients(lead_id) where lead_id is not null;

-- ── the ingest functions gain nothing here ──────────────────────────────────
-- The three public lead RPCs are untouched on purpose. These columns live on
-- the event, and an event is never created by a stranger from the site.

-- ============================================================================
--  0053 — the flags are for people who signed in
-- ============================================================================
--  The comment above this policy has always said "everyone signed in reads
--  them". The policy said `using (true)` with no role, which is everyone,
--  full stop: a stranger holding the publishable key — and that key is in
--  every browser that has ever loaded the site — could read the list of
--  modules and which kind of couple may open each one.
--
--  That is configuration rather than anybody's wedding, so this is a tidy
--  rather than an incident. It is worth doing anyway, for the reason the
--  mismatch existed at all: nobody had a way to see it. `check-rls.mjs` reads
--  every policy in this directory and refuses one open to strangers on a table
--  that is not on a short list of deliberately public ones, and this is the
--  single thing it found across thirty-eight tables and a hundred policies.
--
--  Nothing reads these outside the root console, which is server-side, so the
--  narrower rule changes no behaviour. The intent and the code now agree,
--  which is the part that keeps being the difference between a system that is
--  safe and a system that is only believed to be.
-- ============================================================================

drop policy if exists feature_flags_read on public.feature_flags;
create policy feature_flags_read on public.feature_flags
  for select to authenticated using (true);

comment on table public.feature_flags is
  'Which modules each kind of couple may open. A missing row means open to '
  'everyone: a feature must be switched off deliberately, never by having been '
  'forgotten here. Readable by anybody signed in, which is what the policy '
  'always said it was and, until 0053, not what it did.';
