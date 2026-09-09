-- Enough of Supabase for setup.sql to run: the roles, the auth schema, the
-- storage tables and the extensions schema. Nothing here is a claim about how
-- Supabase behaves; it exists so the migrations can be executed rather than
-- read.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default extensions.gen_random_uuid(),
  email text,
  phone text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- The session's user id. A settable so tests can become somebody.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

create or replace function auth.email() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.email', true), '')
$$;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  created_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default extensions.gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now(),
  metadata jsonb
);
alter table storage.objects enable row level security;

grant usage on schema extensions, auth, storage, public to anon, authenticated, service_role;
