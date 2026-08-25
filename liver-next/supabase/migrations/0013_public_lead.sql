-- ============================================================================
--  0013 — the enquiry form can actually save an enquiry
-- ============================================================================
--  A visitor filling in the form is anonymous, and `leads` has no policy that
--  lets anonymous insert. The code got around that by writing with the service
--  role, which meant the form worked only on a server that had been given
--  SUPABASE_SERVICE_ROLE_KEY. Nothing in the deploy asked for that key, so on
--  the live droplet every submission failed with "לא הצלחנו לשמור את הפנייה"
--  and the enquiry was simply lost.
--
--  Handing the server a key that bypasses row level security, for the sake of
--  one insert, is the wrong trade anyway. Instead there is exactly one way in:
--  a security definer function that can insert a lead and nothing else. The
--  public gets that one door, the table stays closed, and the deployment needs
--  no secret beyond the publishable key it already has.
--
--  Validation lives here too, so the limits hold no matter who calls it.
-- ============================================================================

create or replace function public.submit_lead(
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default ''
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name  text := btrim(coalesce(p_full_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if length(v_name) < 2 then
    raise exception 'שם מלא חסר' using errcode = 'check_violation';
  end if;
  if v_phone = '' and v_email = '' then
    raise exception 'צריך טלפון או אימייל' using errcode = 'check_violation';
  end if;
  if v_email <> '' and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'אימייל לא תקין' using errcode = 'check_violation';
  end if;
  if p_guest_count is not null and (p_guest_count <= 0 or p_guest_count > 5000) then
    raise exception 'כמות אורחים לא תקינה' using errcode = 'check_violation';
  end if;

  /* Lengths are capped rather than rejected: a visitor who pastes too much
     should still reach us, and a script that pastes a megabyte should not be
     able to fill the table. */
  insert into public.leads (full_name, phone, email, kind, event_date, guest_count, message, source)
  values (
    left(v_name, 120),
    left(v_phone, 40),
    left(v_email, 160),
    (case when p_kind = 'corporate' then 'corporate' else 'wedding' end)::event_class,
    p_event_date,
    p_guest_count,
    left(coalesce(p_message, ''), 4000),
    'site'
  );
  -- producer_id is filled by the leads_attribute trigger.
end $$;

revoke all on function public.submit_lead(text, text, text, text, date, integer, text) from public;
grant execute on function public.submit_lead(text, text, text, text, date, integer, text)
  to anon, authenticated, service_role;

-- ── the name on the workspace ───────────────────────────────────────────────
--  The 0011 backfill filled brand_name from the account's full name, because
--  that was the only name it had. For the root account that meant the header
--  read "barak liver" — the Google profile name, in lowercase Latin, on a
--  Hebrew right-to-left product. Set it to the actual brand, but only where it
--  was inherited rather than chosen, so a name typed on purpose survives.
update public.producers pr
   set brand_name = 'ברק ליור'
  from public.profiles p
 where p.id = pr.owner_id
   and lower(p.email) = public.root_admin_email()
   and (btrim(pr.brand_name) = '' or pr.brand_name = p.full_name);
