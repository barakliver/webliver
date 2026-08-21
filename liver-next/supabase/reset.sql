-- ============================================================================
--  Liver productions - clear a half-built database before setup.sql
--
--  Run this ONLY when setup.sql fails on a type or table left behind by an
--  earlier attempt, and ONLY on a project with no real data yet.
--
--  Why it is needed. Enums cannot be repaired in place: a value added with
--  ALTER TYPE cannot be used until it is committed, and the SQL Editor runs
--  a script as one transaction, so a stale enum such as event_class without
--  'wedding' cannot be widened and used in the same run. Dropping and
--  recreating the schema is the only thing that works in one pass.
--
--  WHAT THIS DELETES: everything in the public schema - the seventeen tables
--  and their rows.
--
--  WHAT THIS KEEPS: the auth schema, so every account already registered,
--  including yours, survives. Storage buckets and their files survive too.
-- ============================================================================

drop schema if exists public cascade;
create schema public;

-- The grants Supabase expects on a fresh public schema. Without them the
-- API roles cannot see anything the next script creates.
grant usage  on schema public to postgres, anon, authenticated, service_role;
grant create on schema public to postgres, service_role;

alter default privileges in schema public
  grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
