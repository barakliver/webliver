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
create or replace function public.contract_digest(
  p_title text, p_body text, p_file text, p_amount numeric
) returns text
language sql immutable set search_path = public as $$
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
