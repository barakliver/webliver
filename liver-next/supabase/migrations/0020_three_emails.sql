-- ============================================================================
--  0020 — three addresses on a workspace, not two
-- ============================================================================
--  Two was the wrong number, chosen for the two people getting married. In
--  practice a third person is nearly always doing some of the work: a parent
--  paying for part of it, a sibling running the guest list, a co-organiser on
--  a corporate event. Today they either borrow somebody's login, which makes
--  every action on the workspace untraceable, or they get forwarded
--  screenshots, which is worse.
--
--  The number lives in one function so raising it again is one line. It stays
--  a hard cap rather than becoming unlimited: an account that anybody can be
--  added to is not a workspace, it is a mailing list, and the couple should be
--  able to name everyone who can see their budget.
-- ============================================================================

create or replace function public.max_authorized_emails() returns int
language sql immutable as $$ select 3 $$;

create or replace function public.cap_authorized_emails() returns trigger
language plpgsql set search_path = public as $$
declare
  cap  int := public.max_authorized_emails();
  used int;
begin
  select count(*) into used
    from public.client_authorized_emails
   where client_id = new.client_id;

  if used >= cap then
    /* The number is in the message because the screen shows this text and a
       person reading "at most 3" can count their own list and understand it. */
    raise exception 'a workspace accepts at most % authorized emails', cap;
  end if;
  return new;
end $$;

drop trigger if exists cae_cap on public.client_authorized_emails;
create trigger cae_cap before insert on public.client_authorized_emails
  for each row execute function public.cap_authorized_emails();

grant execute on function public.max_authorized_emails() to anon, authenticated, service_role;
