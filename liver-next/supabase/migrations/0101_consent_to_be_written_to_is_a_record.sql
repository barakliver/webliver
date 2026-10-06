-- ============================================================================
--  0101 — consent to be written to is a record, and so is withdrawing it
-- ============================================================================
--  No marketing mail goes out of this product today. This exists because of
--  what happens if it starts before this does.
--
--  Section 30א of the Communications Law lets somebody who was sent
--  unsolicited marketing claim up to ₪1,000 per message with no proof of
--  damage, and the burden of showing consent is on the sender. A tick box
--  with nothing behind it does not discharge that: what discharges it is a
--  record of what was ticked, when, and on which page. So the row carries
--  three fields rather than one.
--
--  Doing it now rather than later is the whole point. Retrofitting consent
--  onto a list of several hundred people means writing to all of them to ask
--  — which is itself a marketing message to people who never agreed to one.
--  The cheap moment is before the list exists.
--
--  Three rules are built in rather than left to whoever writes the form.
--
--  Consent defaults to false. A column that defaulted to true would make
--  every lead that ever arrived through a webhook — Meta, Google, anything
--  that posts to the channel address — look like somebody who agreed, and
--  those people agreed to nothing in this product.
--
--  The stamp and the source are written by the database at the moment the
--  flag goes true, not passed in. A caller that could set the timestamp
--  could set it to any time, and the timestamp is the evidence.
--
--  Withdrawing is a token in a link and nothing else. Asking somebody to
--  sign in to stop hearing from you is how a one-press opt-out becomes a
--  complaint, and this product already knows that pattern: it is how the
--  guests' page works and how a supplier signs.
--
--  Nothing here touches a row. Three nullable-or-defaulted columns on
--  `leads`, one function replacing another, and one new door for anon.
-- ============================================================================

alter table public.leads
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz,
  /* Which page it was given on. "The form on the Tel Aviv landing page" is
     the sentence that answers a complaint; "true" is not. */
  add column if not exists marketing_consent_source text not null default '',
  /* Minted only when consent is given, so a lead who never agreed has no
     unsubscribe link to leak and nothing to guess at. */
  add column if not exists unsubscribe_token text;

create unique index if not exists leads_unsubscribe_token_idx
  on public.leads (unsubscribe_token) where unsubscribe_token is not null;


-- ── the enquiry form, which may now carry a tick ────────────────────────────
--  Dropped before it is created. Adding a parameter to a function does not
--  replace it, it overloads it — and two submit_leads differing by one
--  defaulted argument is an ambiguous call waiting for the first caller who
--  omits it. The signature is named in full for the same reason.
drop function if exists public.submit_lead(text, text, text, text, date, integer, text, text);
drop function if exists public.submit_lead(text, text, text, text, date, integer, text, text, boolean, text);

create function public.submit_lead(
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default '',
  p_location    text default '',
  p_marketing_consent boolean default false,
  p_consent_source    text default ''
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name  text := btrim(coalesce(p_full_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_yes   boolean := coalesce(p_marketing_consent, false);
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

  insert into public.leads (
    full_name, phone, email, kind, event_date, guest_count, message, source, location,
    marketing_consent, marketing_consent_at, marketing_consent_source, unsubscribe_token
  )
  values (
    left(v_name, 120),
    left(v_phone, 40),
    left(v_email, 160),
    (case when p_kind = 'corporate' then 'corporate' else 'wedding' end)::event_class,
    p_event_date,
    p_guest_count,
    left(coalesce(p_message, ''), 4000),
    'site',
    left(btrim(coalesce(p_location, '')), 120),
    v_yes,
    /* Written here and never passed in: a caller that could choose the
       moment could choose any moment, and the moment is the evidence. */
    case when v_yes then now() else null end,
    case when v_yes then left(btrim(coalesce(p_consent_source, '')), 200) else '' end,
    case when v_yes then encode(gen_random_bytes(24), 'hex') else null end
  );
end $$;

revoke all on function public.submit_lead(text, text, text, text, date, integer, text, text, boolean, text) from public;
grant execute on function public.submit_lead(text, text, text, text, date, integer, text, text, boolean, text)
  to anon, authenticated, service_role;


-- ── stopping, in one press and with no account ──────────────────────────────
--  Returns true whether or not it found anything. That is deliberate and it
--  is the opposite of the rule everywhere else in this schema: here a
--  truthful "no such token" would turn the unsubscribe page into an oracle
--  for whether an address is on the list. The person pressing the link wants
--  one thing, and they get it either way.
--
--  The flag goes false and the token is cleared, so the link is single use.
--  `marketing_consent_at` is left standing: it is the record that consent
--  was once given, and erasing it would erase the evidence that the mail
--  already sent was lawful.
create or replace function public.lead_unsubscribe(p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(p_token, '')) < 32 then
    return true;
  end if;

  update public.leads
     set marketing_consent = false,
         unsubscribe_token = null
   where unsubscribe_token = p_token;

  return true;
end $$;

revoke all on function public.lead_unsubscribe(text) from public;
grant execute on function public.lead_unsubscribe(text) to anon, authenticated, service_role;
