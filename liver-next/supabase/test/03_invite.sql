-- ============================================================================
--  Inviting a couple whose address already has an account
-- ============================================================================
--  This threw "a role is set by barakliver@gmail.com only" and failed the
--  whole insert, for every couple who ever made an account before being
--  invited. Reproduced here so it cannot come back quietly.
-- ============================================================================
\set ON_ERROR_STOP on

insert into auth.users (id, email)
values ('99999999-9999-9999-9999-999999999999','already@example.com')
on conflict (id) do nothing;

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';  -- an ordinary producer

insert into public.client_authorized_emails (client_id, email)
values ('cccccccc-0000-0000-0000-000000000001','already@example.com');

reset role;
reset request.jwt.claim.sub;

select case
  when (select role from public.profiles where id='99999999-9999-9999-9999-999999999999') = 'client'
   and (select count(*) from public.producers where owner_id='99999999-9999-9999-9999-999999999999') = 0
   and coalesce(current_setting('liver.binding_invite', true),'') = ''
  then 'PASS — invited, demoted, placeholder cleared, permission not left on'
  else 'FAIL' end as result;
