-- ============================================================================
--  0111 — the conference counts itself while people arrive
-- ============================================================================
--  The conference screen was read at the moment it was opened, and the whole
--  use of it on the day is to watch a number go up. So the two tables behind
--  it go out over the socket, the way every other live screen's do.
--
--  Realtime still applies row level security per listener, and both tables are
--  readable by the root address alone, so this hands nobody a row they could
--  not already read: a producer or a stranger listening hears nothing.
--
--  Nothing here touches a row.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['contacts', 'signup_campaigns'] loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
exception when undefined_object then
  /* No realtime publication on this database, so nothing to add them to. */
  null;
end $$;
