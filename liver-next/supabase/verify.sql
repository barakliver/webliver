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
      'submit_lead','public_site_producer'
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
)

select case when ok then 'ok' else 'MISSING' end as status, what
  from checks
 order by ok, what;
