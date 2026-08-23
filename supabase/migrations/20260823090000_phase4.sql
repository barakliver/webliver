-- ============================================================================
-- Phase 4 — Multi-tenant white-label, platform governance, BI, day-of cockpit
--
-- The security model in one paragraph:
--   * A `producer` IS the tenant. Every client workspace belongs to exactly one.
--   * Producers cannot see each other's data — not workspaces, not couples,
--     not guests, not budgets.
--   * The platform admin is deliberately given NO row-level access to tenant
--     data. Their dashboard reads aggregate-only SECURITY DEFINER functions
--     that are incapable of returning a couple's name, a guest, or an amount.
--
-- Read the honest limitation note above `platform_admins` before relying on
-- the words "zero knowledge".
--
-- Safe to re-run.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------
create table if not exists public.producers (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null unique references auth.users (id) on delete cascade,
  brand_name     text not null,
  legal_name     text,
  -- Routing identity. `slug` powers <slug>.liver.app; `custom_domain` powers
  -- a producer's own hostname. Both are unique across the platform.
  slug           text not null unique
                 check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'),
  custom_domain  text unique
                 check (custom_domain is null or custom_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  domain_verified boolean not null default false,
  -- White-label surface. These replace every platform-owner reference.
  logo_url       text,
  color_ink      text not null default '#14130f',
  color_accent   text not null default '#a8874f',
  color_paper    text not null default '#f8f5ef',
  contact_email  text,
  contact_phone  text,
  contact_whatsapp text,
  website_url    text,
  status         text not null default 'pending'
                 check (status in ('pending', 'approved', 'suspended')),
  tier           text not null default 'managed'
                 check (tier in ('diy', 'managed', 'agency')),
  approved_at    timestamptz,
  suspended_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists producers_status_idx on public.producers (status);

drop trigger if exists producers_touch on public.producers;
create trigger producers_touch before update on public.producers
  for each row execute function public.touch_updated_at();

-- Attach every workspace to its tenant.
alter table public.clients add column if not exists tenant_id uuid references public.producers (id) on delete cascade;
create index if not exists clients_tenant_idx on public.clients (tenant_id);

-- Backfill: a workspace's existing producer_id is an auth user; map it across.
update public.clients c
   set tenant_id = p.id
  from public.producers p
 where c.tenant_id is null and p.owner_user_id = c.producer_id;

-- ---------------------------------------------------------------------------
-- Platform administration
--
-- HONEST LIMITATION — read before claiming "zero knowledge":
--   RLS constrains callers that authenticate through PostgREST. It does NOT
--   constrain the `service_role` key, the `postgres` superuser, or anyone with
--   direct database or backup access. The platform owner controls all three.
--   What this migration guarantees is that the admin *application surface*
--   cannot reach tenant rows, and that no admin-facing query returns couple
--   data. Genuine zero knowledge against the infrastructure owner requires
--   client-held encryption keys, which is a separate piece of work.
-- ---------------------------------------------------------------------------
create table if not exists public.platform_admins (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);

insert into public.platform_admins (email, note)
values ('barakliver@gmail.com', 'Root platform owner')
on conflict (email) do nothing;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- The tenant a signed-in producer owns.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id from public.producers p where p.owner_user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Feature gating
-- ---------------------------------------------------------------------------
create table if not exists public.feature_flags (
  key            text primary key,
  label_he       text not null,
  label_en       text not null,
  description_he text,
  -- Which tiers may use this module.
  enabled_diy     boolean not null default false,
  enabled_managed boolean not null default true,
  enabled_agency  boolean not null default true,
  updated_at     timestamptz not null default now()
);

drop trigger if exists feature_flags_touch on public.feature_flags;
create trigger feature_flags_touch before update on public.feature_flags
  for each row execute function public.touch_updated_at();

insert into public.feature_flags (key, label_he, label_en, description_he, enabled_diy, enabled_managed, enabled_agency) values
  ('moodboard',   'מודבורד',            'Moodboard',        'העלאת תמונות השראה לפי קטגוריה',            true,  true, true),
  ('rsvp',        'אישורי הגעה',        'RSVP',             'רשימת מוזמנים וקישורים אישיים',              true,  true, true),
  ('seating',     'סידור הושבה',        'Seating',          'מפת שולחנות בגרירה',                        false, true, true),
  ('bar',         'מחשבון בר',          'Bar estimator',    'הערכת כמויות אלכוהול וקרח',                  true,  true, true),
  ('receipts',    'סריקת קבלות',        'Receipt scanning', 'זיהוי אוטומטי של קבלות ספקים',               false, true, true),
  ('budget',      'מעקב תקציב',         'Budget tracker',   'תקציב מול תשלומים בפועל',                    false, true, true),
  ('day_of',      'חמ״ל יום האירוע',    'Day-of cockpit',   'צ׳ק־אין ספקים והתראות בזמן אמת',             false, true, true),
  ('bi',          'דוחות עסקיים',       'Business BI',      'משפך המרה ותזרים',                          false, true, true),
  ('white_label', 'מיתוג לבן',          'White label',      'דומיין ומיתוג עצמאי',                       false, false, true)
on conflict (key) do nothing;

create or replace function public.tier_allows(p_key text, p_tier text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case p_tier
           when 'diy'     then f.enabled_diy
           when 'managed' then f.enabled_managed
           when 'agency'  then f.enabled_agency
           else false
         end
  from public.feature_flags f where f.key = p_key;
$$;

-- ---------------------------------------------------------------------------
-- Funnel telemetry (BI)
--
-- Tenant-scoped, and deliberately free of couple identity: a funnel row
-- records that a stage happened, never who it happened to.
-- ---------------------------------------------------------------------------
create table if not exists public.funnel_events (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.producers (id) on delete cascade,
  stage      text not null check (stage in ('visit', 'lead', 'consult', 'signed', 'lost')),
  lead_ref   uuid,
  source     text,
  -- Minutes between the lead arriving and the producer's first reply.
  response_minutes integer check (response_minutes is null or response_minutes >= 0),
  value_ils  numeric(12, 2) check (value_ils is null or value_ils >= 0),
  occurred_at timestamptz not null default now()
);

create index if not exists funnel_tenant_idx on public.funnel_events (tenant_id, occurred_at desc);
create index if not exists funnel_stage_idx  on public.funnel_events (tenant_id, stage);

-- ---------------------------------------------------------------------------
-- Day-of operations: vendor check-ins and broadcasts
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_checkins (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  role         text not null check (role in
                 ('catering','sound','lighting','dj','band','photo','video','magnets',
                  'design','flowers','rabbi','security','transport','other')),
  vendor_name  text not null,
  phone        text,
  expected_at  timestamptz,
  arrived_at   timestamptz,
  status       text not null default 'expected'
               check (status in ('expected', 'arrived', 'late', 'no_show')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists vendor_checkins_client_idx on public.vendor_checkins (client_id);

drop trigger if exists vendor_checkins_touch on public.vendor_checkins;
create trigger vendor_checkins_touch before update on public.vendor_checkins
  for each row execute function public.touch_updated_at();

create table if not exists public.vendor_broadcasts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  message     text not null,
  channel     text not null default 'whatsapp' check (channel in ('whatsapp', 'sms')),
  recipients  integer not null default 0,
  delivered   integer not null default 0,
  sent_by     uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists vendor_broadcasts_client_idx on public.vendor_broadcasts (client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Tenant-aware membership
--
-- Replaces the Phase 3 helper: workspace access now also requires the caller's
-- tenant to match. A producer reaching another tenant's workspace fails here.
-- ---------------------------------------------------------------------------
create or replace function public.is_client_producer(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.clients c
    left join public.producers p on p.id = c.tenant_id
    where c.id = p_client_id
      and (
        c.producer_id = auth.uid()
        or (p.owner_user_id = auth.uid() and p.status = 'approved')
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.producers        enable row level security;
alter table public.platform_admins  enable row level security;
alter table public.feature_flags    enable row level security;
alter table public.funnel_events    enable row level security;
alter table public.vendor_checkins  enable row level security;
alter table public.vendor_broadcasts enable row level security;

-- A producer reads and edits only their own tenant row. The admin may read and
-- change status/tier (the approval pipeline) but holds no path to tenant data.
drop policy if exists producers_self on public.producers;
create policy producers_self on public.producers
  for all to authenticated
  using (owner_user_id = auth.uid() or public.is_platform_admin())
  with check (owner_user_id = auth.uid() or public.is_platform_admin());

-- Public brand lookup is handled by resolve_tenant() below, not by a policy,
-- so an anonymous visitor can never enumerate the producer list.

drop policy if exists platform_admins_read on public.platform_admins;
create policy platform_admins_read on public.platform_admins
  for select to authenticated
  using (public.is_platform_admin());

drop policy if exists feature_flags_read on public.feature_flags;
create policy feature_flags_read on public.feature_flags
  for select to authenticated using (true);

drop policy if exists feature_flags_write on public.feature_flags;
create policy feature_flags_write on public.feature_flags
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Funnel data is business-sensitive and stays inside the tenant. Note the
-- absence of any `or is_platform_admin()` — deliberate.
drop policy if exists funnel_tenant on public.funnel_events;
create policy funnel_tenant on public.funnel_events
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop policy if exists vendor_checkins_member on public.vendor_checkins;
create policy vendor_checkins_member on public.vendor_checkins
  for all to authenticated
  using (public.is_client_member(client_id))
  with check (public.is_client_member(client_id));

drop policy if exists vendor_broadcasts_member on public.vendor_broadcasts;
create policy vendor_broadcasts_member on public.vendor_broadcasts
  for all to authenticated
  using (public.is_client_member(client_id))
  with check (public.is_client_member(client_id));

grant select, insert, update, delete on
  public.producers, public.funnel_events, public.vendor_checkins, public.vendor_broadcasts
  to authenticated;
grant select on public.feature_flags, public.platform_admins to authenticated;
grant update on public.feature_flags to authenticated;

alter table public.vendor_checkins replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vendor_checkins'
  ) then
    alter publication supabase_realtime add table public.vendor_checkins;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tenant resolution for the edge middleware
--
-- Returns public brand identity only. Safe for anon: it exposes exactly what a
-- visitor would see on the producer's own marketing site, and nothing that
-- identifies a couple, a guest, or a number.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_tenant(p_host text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p.id,
    'slug', p.slug,
    'brand_name', p.brand_name,
    'logo_url', p.logo_url,
    'color_ink', p.color_ink,
    'color_accent', p.color_accent,
    'color_paper', p.color_paper,
    'contact_email', p.contact_email,
    'contact_phone', p.contact_phone,
    'contact_whatsapp', p.contact_whatsapp,
    'website_url', p.website_url,
    'tier', p.tier
  )
  from public.producers p
  where p.status = 'approved'
    and (
      (p.custom_domain is not null and p.domain_verified and lower(p.custom_domain) = lower(p_host))
      or lower(p.slug) = lower(split_part(p_host, '.', 1))
    )
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Admin telemetry — aggregates only
--
-- Every function here is incapable of returning a couple's name, a guest, a
-- budget line or a contract. They return counts. That is the whole point.
-- ---------------------------------------------------------------------------
create or replace function public.admin_platform_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'users_total',       (select count(*) from auth.users),
    'users_active_30d',  (select count(*) from auth.users
                           where last_sign_in_at > now() - interval '30 days'),
    'producers_total',   (select count(*) from public.producers),
    'producers_pending', (select count(*) from public.producers where status = 'pending'),
    'producers_approved',(select count(*) from public.producers where status = 'approved'),
    'producers_suspended',(select count(*) from public.producers where status = 'suspended'),
    'tier_diy',          (select count(*) from public.producers where tier = 'diy'),
    'tier_managed',      (select count(*) from public.producers where tier = 'managed'),
    'tier_agency',       (select count(*) from public.producers where tier = 'agency'),
    'workspaces_total',  (select count(*) from public.clients),
    'workspaces_unassigned', (select count(*) from public.clients where tenant_id is null)
  ) into result;

  return result;
end;
$$;

-- Leaderboard: brand name and volume. No workspace names, no couples.
create or replace function public.admin_producer_leaderboard()
returns table (
  producer_id     uuid,
  brand_name      text,
  status          text,
  tier            text,
  workspace_count bigint,
  activity_30d    bigint,
  created_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select p.id, p.brand_name, p.status, p.tier,
         (select count(*) from public.clients c where c.tenant_id = p.id),
         (select count(*) from public.funnel_events f
           where f.tenant_id = p.id and f.occurred_at > now() - interval '30 days'),
         p.created_at
  from public.producers p
  order by 5 desc, p.created_at desc;
end;
$$;

create or replace function public.admin_set_producer_status(p_producer_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row public.producers;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  if p_status not in ('pending', 'approved', 'suspended') then
    raise exception 'Invalid status: %', p_status;
  end if;

  update public.producers
     set status = p_status,
         approved_at  = case when p_status = 'approved'  then now() else approved_at  end,
         suspended_at = case when p_status = 'suspended' then now() else null end
   where id = p_producer_id
   returning * into row;

  if not found then raise exception 'Producer not found'; end if;
  return jsonb_build_object('ok', true, 'status', row.status);
end;
$$;

-- ---------------------------------------------------------------------------
-- Producer BI — scoped to the caller's own tenant by construction
-- ---------------------------------------------------------------------------
create or replace function public.producer_funnel(p_days integer default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  t uuid := public.current_tenant_id();
  since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 730)));
  result jsonb;
begin
  if t is null then raise exception 'No tenant for the current user'; end if;

  select jsonb_build_object(
    'visits',   count(*) filter (where stage = 'visit'),
    'leads',    count(*) filter (where stage = 'lead'),
    'consults', count(*) filter (where stage = 'consult'),
    'signed',   count(*) filter (where stage = 'signed'),
    'lost',     count(*) filter (where stage = 'lost'),
    'signed_value', coalesce(sum(value_ils) filter (where stage = 'signed'), 0),
    'avg_response_minutes',
      (select round(avg(response_minutes))::int from public.funnel_events
        where tenant_id = t and response_minutes is not null and occurred_at >= since)
  ) into result
  from public.funnel_events
  where tenant_id = t and occurred_at >= since;

  return result;
end;
$$;

create or replace function public.producer_cashflow()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  t uuid := public.current_tenant_id();
  result jsonb;
begin
  if t is null then raise exception 'No tenant for the current user'; end if;

  select jsonb_build_object(
    'planned',   coalesce(sum(b.amount_planned), 0),
    'collected', coalesce(sum(b.amount_paid), 0),
    'pending',   greatest(0, coalesce(sum(b.amount_planned) - sum(b.amount_paid), 0)),
    'overdue_items', count(*) filter (where b.status <> 'paid' and b.due_date < current_date)
  ) into result
  from public.budget_items b
  join public.clients c on c.id = b.client_id
  where c.tenant_id = t;

  return result;
end;
$$;

revoke all on function public.resolve_tenant(text) from public;
grant execute on function public.resolve_tenant(text) to anon, authenticated;
grant execute on function public.admin_platform_stats(),
                        public.admin_producer_leaderboard(),
                        public.admin_set_producer_status(uuid, text),
                        public.producer_funnel(integer),
                        public.producer_cashflow(),
                        public.is_platform_admin(),
                        public.current_tenant_id(),
                        public.tier_allows(text, text)
  to authenticated;
