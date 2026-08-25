-- ============================================================================
--  Can the platform owner still open an event of his own?
-- ============================================================================
--  The zero-knowledge migration took `is_super_admin()` out of clients_write,
--  deliberately: root must not reach into another producer's workspace. What
--  this asks is the other half of that, which nothing was checking — that
--  taking the master key away did not also lock him out of his own.
-- ============================================================================
\set ON_ERROR_STOP on
\pset border 2

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';  -- root

select
  case when bool_and(ok) then 'PASS — the owner can open an event in his own workspace'
       else 'FAIL — root is locked out of his own workspace: ' ||
            string_agg(what, ', ') filter (where not ok) end as result
from (
  select public.is_super_admin() as ok, 'root is root' as what
  union all select public.is_approved_producer(),
    'root counts as an approved producer'
  union all select public.owns_producer('aaaaaaaa-0000-0000-0000-000000000001'),
    'root owns his own producer row'
) checks;

-- the write itself, exactly as the action performs it
insert into public.clients (producer_id, display_name, kind, event_date, venue)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'בדיקה', 'wedding', '2027-01-01', '');

select
  case when count(*) = 1 then 'PASS — the row was written and is readable back'
       else 'FAIL — the row was written and cannot be read back' end as result
from public.clients where display_name = 'בדיקה';

-- and the checklist seed that follows it in the same action
insert into public.tasks (client_id, phase, title, visible_to_client)
select id, 'צ׳ק ליסט', 'מקום', true from public.clients where display_name = 'בדיקה';

select
  case when count(*) = 1 then 'PASS — the standing checklist seeds alongside it'
       else 'FAIL — the checklist seed is refused' end as result
from public.tasks t
join public.clients c on c.id = t.client_id
where c.display_name = 'בדיקה';

reset role;
delete from public.clients where display_name = 'בדיקה';

-- ── whoami(), and the distinction it exists to make ────────────────────────
-- The failure this was written for looked exactly like a refusal and was not.
-- What matters is that the function answers as the caller: as a signed-in
-- user it returns that user, and with no session it returns null, which is
-- what lets the app say "sign in again" instead of "you have no permission".

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select
  case when public.whoami() = '11111111-1111-1111-1111-111111111111'
       then 'PASS — whoami reports the signed-in caller'
       else 'FAIL — whoami does not report the caller' end as result;

reset role;
