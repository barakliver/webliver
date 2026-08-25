-- ============================================================================
--  The root account cannot be locked out of its own platform
-- ============================================================================
--  Everything admin on this platform hangs off is_super_admin(), and that
--  function asked one question: is there a row in public.profiles for
--  auth.uid() carrying the role super_admin. Which means the root account's
--  rights depend on a cached row rather than on who is signed in — and a
--  profile row that is missing, or that was written before handle_new_user()
--  learned to elevate the root address, silently demotes the owner of the
--  platform to a couple. Nothing announces it. Screens simply stop working,
--  and row level security reports it as "you have no permission".
--
--  Two changes, both idempotent, neither of which touches anybody's data:
--
--    1. is_super_admin() also answers true for the root address as the token
--       itself states it. The rule does not change — public.root_admin_email()
--       has always been the single source of truth, and a trigger already
--       refuses the role to every other address — this only stops the answer
--       from depending on a row being present and correct.
--
--    2. Any auth user with no profile gets one, and the root address's profile
--       is set to super_admin if it is not already. Repair, not migration:
--       run it twice and the second run changes nothing.
-- ============================================================================

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
    -- The token's own email, for the case where the row is missing or wrong.
    -- Only ever true for the one address, which is the same rule the trigger
    -- on public.profiles enforces from the other direction.
    or lower(coalesce(auth.jwt() ->> 'email', '')) = public.root_admin_email()
$$;

-- ── repair ──────────────────────────────────────────────────────────────────
--  Insert only. No existing profile is overwritten, no role is downgraded and
--  no row is deleted, so this cannot cost anybody anything they already have.
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  lower(u.email),
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  case when lower(u.email) = public.root_admin_email()
       then 'super_admin'::app_role else 'producer'::app_role end
from auth.users u
where u.email is not null
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

--  And the one row whose role is not a matter of opinion.
update public.profiles
   set role = 'super_admin'
 where lower(email) = public.root_admin_email()
   and role <> 'super_admin';
