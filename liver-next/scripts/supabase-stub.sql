-- ============================================================================
--  Just enough Supabase for the schema to be tested against a real Postgres
-- ============================================================================
--  setup.sql and every migration are written for Supabase, so they reference
--  things Supabase provides and a bare Postgres does not: the auth and storage
--  schemas, auth.uid(), and the four roles the grants are written against.
--
--  This is not an imitation of Supabase and does not try to be. It is the
--  smallest set of objects that lets the real schema parse, plan and run, so
--  that `check-schema.mjs` can answer one question honestly: does this schema
--  apply, and does it apply twice.
--
--  Nothing here ships. It exists only inside a throwaway database.
-- ============================================================================

create extension if not exists pgcrypto;

do $$ begin create role anon                 nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated        nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role         nologin; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_auth_admin  nologin; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_storage_admin nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

/* The account table every profile hangs off. Only the columns the migrations
   actually name: an id to reference, and the pieces handle_new_user() reads
   off a new sign-up. */
create table if not exists auth.users (
  id                uuid primary key default gen_random_uuid(),
  email             text,
  /* handle_new_user() reads this off a new sign-up, so the column has to be
     here or the trigger fails on insert — which is how the first version of
     this stub made a data-safety test pass on zero rows. */
  phone             text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

/* The session, as a settable variable rather than a JWT. A policy asking
   auth.uid() gets whatever the test last claimed to be, which is exactly what
   a test of a policy needs and nothing more. */
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id       uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name     text,
  owner    uuid,
  metadata jsonb
);
alter table storage.objects enable row level security;

/* pgcrypto lives in `extensions` on Supabase and several migrations resolve
   gen_random_bytes through the caller's search_path. Same name, same place. */
create or replace function extensions.gen_random_bytes(integer) returns bytea
language sql volatile as $$ select public.gen_random_bytes($1) $$;
