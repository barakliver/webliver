-- ============================================================================
--  Moving a run sheet line, and what the move is allowed to disturb
-- ============================================================================
--  The sheet has no order column: it is ordered by the time each thing
--  happens. So moving a line earlier trades start times with the line above
--  it, and the action does that in two writes through PostgREST. What follows
--  proves the shape those two writes depend on, against the real schema:
--  the neighbour is found inside the same track and nowhere else, and the
--  swap leaves the sheet ordered with no two lines on the same minute.
-- ============================================================================
\set ON_ERROR_STOP on
\pset border 2


insert into public.day_schedule (client_id, track, at_time, title) values
  ('cccccccc-0000-0000-0000-000000000001','shared','17:15','צילומי הכנות'),
  ('cccccccc-0000-0000-0000-000000000001','shared','17:45','First Look'),
  ('cccccccc-0000-0000-0000-000000000001','shared','18:05','צילומי זוג'),
  -- Nearer in time than any of the above, and in another track. A move must
  -- never pick it up: the tracks are read as separate columns, and a line
  -- hopping between them is not a reorder, it is a different edit.
  ('cccccccc-0000-0000-0000-000000000001','partner_a','17:50','איפור');

-- What the action looks up before it writes anything: the line above
-- 'צילומי זוג' inside its own track. Recorded here rather than asserted after
-- the swap, because after the swap 18:05 belongs to the other line and the
-- question no longer has the same answer. The first draft of this test asked
-- it too late and reported the correct code as broken.
create temporary table found_neighbour as
select
  (select title from public.day_schedule
    where client_id = 'cccccccc-0000-0000-0000-000000000001'
      and track = 'shared' and at_time < '18:05'
    order by at_time desc limit 1) as above,
  (select count(*) from public.day_schedule
    where client_id = 'cccccccc-0000-0000-0000-000000000001'
      and track = 'shared' and title = 'איפור') as other_track_picked_up;

-- the swap the action performs, written the same way round
update public.day_schedule set at_time = '17:45'
  where client_id = 'cccccccc-0000-0000-0000-000000000001' and title = 'צילומי זוג';
update public.day_schedule set at_time = '18:05'
  where client_id = 'cccccccc-0000-0000-0000-000000000001' and title = 'First Look';

select
  case when bool_and(ok) then 'PASS — a line moves by trading times with its neighbour'
       else 'FAIL — the run sheet move is wrong: ' ||
            string_agg(what, ', ') filter (where not ok) end as result
from (
  select
    (select above from found_neighbour) = 'First Look' as ok,
    'the neighbour above is inside the same track' as what

  union all select
    (select other_track_picked_up from found_neighbour) = 0,
    'a nearer line in another track is not the neighbour'

  union all select
    (select string_agg(title, ' > ' order by at_time) from public.day_schedule
      where client_id = 'cccccccc-0000-0000-0000-000000000001' and track = 'shared')
      = 'צילומי הכנות > צילומי זוג > First Look',
    'the sheet reads in the new order'

  union all select
    (select count(distinct at_time) from public.day_schedule
      where client_id = 'cccccccc-0000-0000-0000-000000000001' and track = 'shared') = 3,
    'no two lines were left on the same minute'

  union all select
    (select at_time from public.day_schedule
      where client_id = 'cccccccc-0000-0000-0000-000000000001' and track = 'partner_a') = '17:50',
    'the other track was not touched'
) checks;

delete from public.day_schedule
  where client_id = 'cccccccc-0000-0000-0000-000000000001';
