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
