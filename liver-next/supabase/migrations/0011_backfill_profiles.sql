-- ============================================================================
--  Backfill profiles for accounts that registered before this schema existed
-- ============================================================================
-- handle_new_user() fires on insert into auth.users, so it only ever covers
-- accounts created after the trigger exists. An account registered earlier -
-- for instance by requesting a sign in code while the database was still empty
-- - has an auth row and no profile, and every read of its role then falls back
-- to whatever the application chose as a default. The root address landed in
-- the couple's portal because of exactly this.
--
-- Runs on every setup, and is a no-op once every account has a profile.

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  lower(u.email),
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  case when lower(u.email) = public.root_admin_email() then 'super_admin'::app_role
       else 'producer'::app_role end
from auth.users u
where u.email is not null
  and not exists (select 1 from public.profiles p where p.id = u.id);

-- The same rule applied to rows that already exist: the root address always
-- holds super_admin, and nobody else ever does. guard_super_admin already
-- refuses the second half on write; this repairs anything written before it.
update public.profiles
   set role = 'super_admin'::app_role
 where lower(email) = public.root_admin_email()
   and role <> 'super_admin';

update public.profiles
   set role = 'producer'::app_role
 where role = 'super_admin'
   and lower(email) <> public.root_admin_email();

-- A producer needs a producers row to have a workspace to sign in to.
insert into public.producers (owner_id, brand_name, contact_name, contact_email, status)
select
  p.id,
  coalesce(nullif(u.raw_user_meta_data->>'brand_name', ''), p.full_name, ''),
  p.full_name,
  p.email,
  case when p.role = 'super_admin' then 'approved'::producer_state
       else 'pending'::producer_state end
from public.profiles p
join auth.users u on u.id = p.id
where p.role in ('super_admin', 'producer')
  and not exists (select 1 from public.producers pr where pr.owner_id = p.id);

-- The root admin is approved by definition; nobody is above them to approve it.
update public.producers pr
   set status = 'approved'::producer_state
  from public.profiles p
 where p.id = pr.owner_id
   and p.role = 'super_admin'
   and pr.status <> 'approved';
