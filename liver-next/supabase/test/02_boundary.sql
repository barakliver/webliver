-- ============================================================================
--  The tenant boundary, attacked rather than asserted
-- ============================================================================
--  Every check here is a thing root is not allowed to see, run as root against
--  a database holding another producer's real event. A count that is not zero
--  is a breach.
-- ============================================================================
\set ON_ERROR_STOP on
\pset border 2

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';  -- root

select
  case when bool_and(ok) then 'PASS — the boundary holds'
       else 'FAIL — root can read another tenant: ' ||
            string_agg(what, ', ') filter (where not ok) end as result
from (
  select public.is_super_admin() as ok, 'root is root' as what
  union all select not public.can_read_client('cccccccc-0000-0000-0000-000000000001'), 'no reach into her workspace'
  union all select (select count(*) = 0 from public.clients),        'no events'
  union all select (select count(*) = 0 from public.guests_rsvp),    'no guests'
  union all select (select count(*) = 0 from public.budget_items),   'no budget'
  union all select (select count(*) = 0 from public.payments),       'no payments'
  union all select (select count(*) = 0 from public.contracts),      'no contracts'
  union all select (select count(*) = 0 from public.messages),       'no messages'
  union all select (select count(*) = 0 from public.crew),           'no crew or their fees'
  union all select (select count(*) = 0 from public.event_vendors),  'no suppliers'
  union all select (select count(*) = 0 from public.leads),          'no leads'
  union all select (select count(*) = 0 from public.tasks),          'no tasks'
  union all select (select count(*) = 0 from public.profiles where role = 'client'), 'no couple profiles'
  -- and the governance that must survive, or nobody can run the platform
  union all select (select count(*) > 0 from public.producers),               'producers still governed'
  union all select (select count(*) > 0 from public.producer_leaderboard()),  'leaderboard still answers'
) checks;

reset role;
reset request.jwt.claim.sub;

-- ── the couple's own wall, which predates all of this ──────────────────────
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';  -- the bride

select
  case when bool_and(ok) then 'PASS — the couple sees their event and not the staffing'
       else 'FAIL — ' || string_agg(what, ', ') filter (where not ok) end as result
from (
  select public.can_read_client('cccccccc-0000-0000-0000-000000000001') as ok,
         'she is on her workspace' as what
  union all select (select count(*) > 0 from public.guests_rsvp),   'she sees her guests'
  union all select (select count(*) = 0 from public.crew),          'she never sees crew or fees'
  union all select (select count(*) = 0 from public.event_vendors), 'she never sees supplier bookings'
  union all select (select count(*) = 0 from public.tasks where not visible_to_client), 'she never sees private tasks'
) checks;

reset role;
reset request.jwt.claim.sub;
