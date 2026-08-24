-- ============================================================================
--  Did the schema actually land?
--
--  Paste into the Supabase SQL Editor and press Run. It reads the catalog and
--  changes nothing: no table is written, no row is touched, and it is safe to
--  run at any time, including while people are using the app.
--
--  Every row comes back as ok or MISSING. One glance at the status column is
--  the whole report.
-- ============================================================================

with checks as (

  -- ── the tables this release added ─────────────────────────────────────────
  select 'table: ' || t as what,
         (to_regclass('public.' || t) is not null) as ok
    from unnest(array['vendors','event_vendors','crew','site_content']) as t

  union all
  -- ── the columns added to tables that already existed ──────────────────────
  select 'column: ' || c.tbl || '.' || c.col,
         exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name=c.tbl and column_name=c.col)
    from (values
      ('day_schedule','duration_min'), ('day_schedule','owner'),
      ('leads','external_id'),         ('leads','source'),
      ('budget_items','event_vendor_id'),
      ('profiles','phone'),            ('clients','archived_at')
    ) as c(tbl,col)

  union all
  -- ── the functions the app calls by name ──────────────────────────────────
  select 'function: ' || f,
         exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='public' and p.proname=f)
    from unnest(array[
      'ingest_lead','record_lead','book_vendor','set_site_content',
      'day_schedule_is_empty','normalize_phone','normalize_source',
      'submit_lead','public_site_producer','calendar_by_token',
      'platform_stats','producer_leaderboard','feature_on','transfer_client',
      'touch_seen'
    ]) as f

  union all
  -- ── row level security on, everywhere ────────────────────────────────────
  --  Not a formality. A table with RLS off is readable by anybody holding the
  --  publishable key, which is in every visitor's browser.
  select 'RLS on every table', not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  )

  union all
  -- ── the boundary this business asked for by name ─────────────────────────
  --  Crew, suppliers and their costs are the producer's side of the wall. A
  --  policy on any of these three that consulted can_read_client would let a
  --  couple on the workspace read them, which is the one thing that must not
  --  happen. Checked in the catalog rather than trusted.
  select 'couples cannot reach crew or suppliers', not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename in ('crew','event_vendors','vendors')
       and (coalesce(qual,'') || coalesce(with_check,'')) like '%can_read_client%'
  )

  union all
  select 'the three private tables have a policy', (
    select count(distinct tablename) = 3 from pg_policies
     where schemaname='public' and tablename in ('crew','event_vendors','vendors')
  )

  union all
  -- ── a workspace holds three people, not more ─────────────────────────────
  select 'the cap is three authorized people',
         coalesce(public.max_authorized_emails() = 3, false)

  union all
  -- ── the tenant boundary, read out of the catalog ─────────────────────────
  --  The whole of the old administrator override was one branch at the top of
  --  can_read_client. If it comes back, every check below it is decoration
  --  again, so the function's own body is the thing asserted.
  select 'the master key is gone from can_read_client', not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'can_read_client'
       and pg_get_functiondef(p.oid) like '%is_super_admin%'
  )

  union all
  --  And the doors that were cut around it. Any policy on a workspace table
  --  that still names is_super_admin is a way back in.
  select 'no workspace table admits the platform owner', not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename in (
         'clients','client_authorized_emails','tasks','budget_items','payments',
         'contracts','messages','guests_rsvp','day_schedule','moodboards',
         'tables_seating','crew','event_vendors','vendors','leads','sales_calls',
         'orders','site_settings'
       )
       and (coalesce(qual,'') || coalesce(with_check,'')) like '%is_super_admin%'
  )

  union all
  --  Governance is the exception, and it is meant to be there. If this one
  --  fails, root cannot approve anybody and the platform has no owner.
  select 'the platform owner still governs producers', exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'producers'
       and (coalesce(qual,'') || coalesce(with_check,'')) like '%is_super_admin%'
  )

  union all
  --  A security definer function without a caller check is the master key
  --  wearing a different hat.
  select 'the console functions check who is asking', (
    select bool_and(pg_get_functiondef(p.oid) like '%is_super_admin%')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('platform_stats','producer_leaderboard','set_feature_flag')
  )

  union all
  select 'feature gating exists', exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'feature_flags'
  )
)

select case when ok then 'ok' else 'MISSING' end as status, what
  from checks
 order by ok, what;
