-- ============================================================================
--  0043 — a closed event that never reached the shelf
-- ============================================================================
--  0042 added close_event(), which marks a workspace closed *and* freezes the
--  snapshot the archive is built from. What it did not do was change the
--  button. The close control has set `archived_at` directly since 0016 and
--  went on doing so, which means every event closed since 0042 shipped is
--  closed, correct, and invisible on a shelf that reads snapshots.
--
--  Two halves, and both are needed. The screen is fixed in the same commit;
--  this fixes the rows that are already wrong, because a fix that only works
--  for events closed from tomorrow leaves somebody staring at an empty page
--  and no way to populate it.
--
--  It also splits the function that was doing two jobs. Taking a snapshot and
--  deciding who is allowed to take one are separate concerns, and the backfill
--  needs the first without the second: it runs from a SQL editor where there
--  is no signed-in person to own anything.
-- ============================================================================

/* The snapshot itself, with no opinion about who asked for it.
   Never granted to anybody: the only callers are close_event(), which checks
   first, and the backfill below, which runs as the owner of the schema. */
create or replace function public.snapshot_event(p_client uuid, p_note text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  select * into c from public.clients where id = p_client;
  if c is null then return; end if;

  insert into public.event_archives (
    client_id, producer_id, event_year, event_date, display_name, venue,
    guests_final, vendors, crew, money, runsheet, note, closed_by
  )
  values (
    p_client, c.producer_id,
    extract(year from c.event_date)::int, c.event_date,
    c.display_name, coalesce(c.venue, ''),
    (select count(*)::int from public.guests_rsvp g
      where g.client_id = p_client and g.status = 'attending'),
    coalesce((select jsonb_agg(jsonb_build_object(
        'name', v.name, 'category', v.category, 'phone', v.phone, 'status', v.status))
       from public.event_vendors v where v.client_id = p_client), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
        'name', k.name, 'role', k.role, 'phone', k.phone, 'fee', k.fee))
       from public.crew k where k.client_id = p_client), '[]'::jsonb),
    jsonb_build_object(
      'budget', coalesce((select sum(b.amount) from public.budget_items b
                           where b.client_id = p_client), 0),
      'paid',   coalesce((select sum(p.amount) from public.payments p
                           where p.client_id = p_client and p.paid), 0)),
    coalesce((select jsonb_agg(jsonb_build_object(
        'at', d.at_time, 'title', d.title, 'owner', d.owner) order by d.at_time)
       from public.day_schedule d where d.client_id = p_client), '[]'::jsonb),
    left(coalesce(p_note, ''), 2000),
    /* Null in a backfill, and that is the truth: nobody pressed a button.
       Writing the schema owner in here instead would be a lie in an audit
       column, which is the one place a plausible guess is worse than a gap. */
    auth.uid()
  )
  on conflict (client_id) do nothing;
end $$;

revoke all on function public.snapshot_event(uuid, text) from public;


/* The checked version, unchanged in behaviour and now three lines long. */
create or replace function public.close_event(p_client uuid, p_note text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare
  owner_ok boolean;
begin
  select public.owns_producer(c.producer_id) into owner_ok
    from public.clients c where c.id = p_client;

  if owner_ok is not true then
    raise exception 'אפשר לסגור רק אירוע שלך' using errcode = 'insufficient_privilege';
  end if;

  update public.clients set archived_at = coalesce(archived_at, now())
   where id = p_client;

  perform public.snapshot_event(p_client, p_note);
  perform public.schedule_anniversary(p_client);
end $$;

revoke all on function public.close_event(uuid, text) from public;
grant execute on function public.close_event(uuid, text) to authenticated, service_role;


-- ── the events that were already closed ─────────────────────────────────────
--  Everything with a closing date and no snapshot behind it. Runs once by
--  construction: `on conflict do nothing` inside snapshot_event means a second
--  run finds every row already filed and writes nothing.
--
--  The snapshot taken here is of the event *as it is now* rather than as it
--  was on the night, which is the honest best available. For a wedding closed
--  yesterday those are the same thing; for one closed months ago it is the
--  closest thing that exists, and an approximate supplier sheet beats an empty
--  shelf and no way to fill it.
do $$
declare r record; n integer := 0;
begin
  for r in
    select c.id from public.clients c
     where c.archived_at is not null
       and not exists (select 1 from public.event_archives a where a.client_id = c.id)
  loop
    perform public.snapshot_event(r.id, '');
    perform public.schedule_anniversary(r.id);
    n := n + 1;
  end loop;
  raise notice 'filed % events that were closed before the shelf existed', n;
end $$;
