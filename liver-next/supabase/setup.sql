-- ============================================================================
--  Liver productions - full first-time setup
--
--  Paste this whole file into the Supabase SQL Editor and press Run. It is
--  every migration in order, so there is nothing to get wrong about which
--  runs first, and it is safe to run again when new migrations are added.
-- ============================================================================

-- ============================================================================
--  Liver Productions — initial schema
--  Multi-tenant by producer. Root super admin is pinned to a single address.
-- ============================================================================
create extension if not exists "pgcrypto";

-- ── enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type app_role      as enum ('super_admin','producer','client','staff');
  create type producer_state as enum ('pending','approved','suspended','rejected');
  create type event_class   as enum ('wedding','corporate');
  create type lead_state    as enum ('new','contacted','meeting','won','lost');
  create type rsvp_state    as enum ('pending','attending','declined');
  create type diet_pref     as enum ('none','vegan','vegetarian','gluten_free','kosher');
  create type task_owner    as enum ('producer','client');
  create type order_state   as enum ('draft','pending','paid','refunded');
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


