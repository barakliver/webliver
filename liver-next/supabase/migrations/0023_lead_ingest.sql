-- ============================================================================
--  0023 — enquiries that arrive from somewhere other than our own form
-- ============================================================================
--  Instagram, Meta lead ads, Google's lead form extension and whatever Zapier
--  is wired to this month all produce the same thing: somebody who wants an
--  event and left a way to reach them. Until now the only door into `leads`
--  was submit_lead(), which is the site's own form: it validates strictly,
--  rejects what it does not like, and stamps every row 'site'.
--
--  Strict is right for a form somebody is looking at. It is wrong for a
--  webhook. A person who is refused can fix the field and press send again; a
--  webhook that is refused loses the lead, and the advertising spend that
--  bought it, with nobody ever knowing it existed. So ingestion gets its own
--  door with the opposite instinct: coerce, cap, and keep. The only thing
--  worth refusing is a payload with no name and no way to reply.
--
--  Two other things a webhook needs and a form does not:
--
--  It says where it came from, because a lead worth twice as much as another
--  is invisible until the source is on the row.
--
--  It can be delivered twice. Meta retries on any non 200, Zapier replays, and
--  a network timeout after a successful insert looks exactly like a failure.
--  So a delivery carries whatever id its sender knows the lead by, and the
--  second arrival of that id is answered rather than stored.
-- ============================================================================

-- ── the sender's own id for this lead ───────────────────────────────────────
alter table public.leads add column if not exists external_id text;

comment on column public.leads.external_id is
  'The id the sending system knows this lead by, prefixed with that system. '
  'Unique, so a retried delivery is recognised rather than duplicated.';

/* Partial, because almost every lead is typed by a person into our own form
   and has no external id at all — and null is never a duplicate. */
create unique index if not exists leads_external_id_key
  on public.leads (external_id) where external_id is not null;

/* Reading the funnel by source is the entire point of recording one. */
create index if not exists leads_source_idx on public.leads (source, created_at desc);


-- ── one shape for a source name ─────────────────────────────────────────────
--  'Instagram', 'instagram ', 'IG' and 'instagram' are four rows in a report
--  that should have one. Nothing downstream should have to remember to fold
--  the case, so it is folded once, here, on the way in.
create or replace function public.normalize_source(raw text) returns text
language sql immutable set search_path = public as $$
  select coalesce(
           nullif(
             /* Trimmed at both ends after folding, because punctuation at the
                edge of a name becomes an underscore at the edge of a slug:
                'Instagram Lead Ad!!' was arriving as 'instagram_lead_ad_',
                which is a different row in a report from 'instagram_lead_ad'
                and would have been noticed only once the report was wrong. */
             btrim(
               left(regexp_replace(lower(btrim(coalesce(raw, ''))), '[^a-z0-9]+', '_', 'g'), 40),
               '_'
             ),
             ''
           ),
           'webhook'
         )
$$;

grant execute on function public.normalize_source(text) to anon, authenticated, service_role;


-- ── the ingestion door ──────────────────────────────────────────────────────
create or replace function public.ingest_lead(
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default '',
  p_source      text default 'webhook',
  p_external_id text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name   text := btrim(coalesce(p_full_name, ''));
  v_phone  text := btrim(coalesce(p_phone, ''));
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_ext    text := nullif(btrim(coalesce(p_external_id, '')), '');
  v_date   date := p_event_date;
  v_guests integer := p_guest_count;
  v_id     uuid;
begin
  /* The one refusal. Something with neither a name nor a way to answer is not
     a lead that arrived badly formed, it is not a lead. */
  if v_name = '' and v_phone = '' and v_email = '' then
    raise exception 'פנייה ריקה' using errcode = 'check_violation';
  end if;

  /* Already delivered. Answer with the row that exists rather than making a
     second one, so a sender that retries ten times still has one lead. */
  if v_ext is not null then
    select id into v_id from public.leads where external_id = v_ext;
    if found then return v_id; end if;
  end if;

  /* Everything below is coerced rather than rejected. A date the table would
     refuse, a guest count somebody typed as "about 250", an address that is
     not one: none of them are worth losing the enquiry over, and all of them
     are still readable in the message a producer opens. */
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then v_email := ''; end if;
  if v_date is not null and v_date < date '2026-01-01' then v_date := null; end if;
  if v_guests is not null and (v_guests <= 0 or v_guests > 1500) then v_guests := null; end if;
  if v_name = '' then v_name := coalesce(nullif(v_phone, ''), v_email); end if;

  insert into public.leads (
    full_name, phone, email, kind, event_date, guest_count, message, source, external_id
  ) values (
    left(v_name, 120),
    left(v_phone, 40),
    left(v_email, 160),
    (case when p_kind = 'corporate' then 'corporate' else 'wedding' end)::event_class,
    v_date,
    v_guests,
    left(coalesce(p_message, ''), 4000),
    public.normalize_source(p_source),
    v_ext
  )
  /* Two deliveries racing each other land here rather than on the floor.
     The predicate is repeated because the index is partial: without it
     Postgres cannot tell which unique index this clause means, and refuses
     with "no unique or exclusion constraint matching the ON CONFLICT
     specification" — at run time, from inside the function, which is a long
     way from the index three screens up. */
  on conflict (external_id) where external_id is not null do nothing
  returning id into v_id;

  if v_id is null and v_ext is not null then
    select id into v_id from public.leads where external_id = v_ext;
  end if;

  -- producer_id is filled by the leads_attribute trigger.
  return v_id;
end $$;

revoke all on function public.ingest_lead(text, text, text, text, date, integer, text, text, text) from public;
grant execute on function public.ingest_lead(text, text, text, text, date, integer, text, text, text)
  to anon, authenticated, service_role;


-- ── a lead a producer took down on the phone ────────────────────────────────
--  Typed into the app by somebody who is signed in, so it is attributed to
--  them rather than to whoever the public site belongs to. Without this it is
--  a lead in a notebook, and the funnel that the whole leads screen reports on
--  is missing every enquiry that came in by phone.
create or replace function public.record_lead(
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default '',
  p_source      text default 'phone'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_producer uuid;
  v_id       uuid;
begin
  select pr.id into v_producer
    from public.producers pr
   where pr.owner_id = auth.uid() and pr.status = 'approved'
   order by pr.created_at
   limit 1;

  /* An unapproved account has no workspace to file this under. Falling back
     to the site's producer would quietly hand somebody else's enquiry to the
     root account, which is worse than refusing. */
  if v_producer is null then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'שם מלא חסר' using errcode = 'check_violation';
  end if;
  if btrim(coalesce(p_phone, '')) = '' and btrim(coalesce(p_email, '')) = '' then
    raise exception 'צריך טלפון או אימייל' using errcode = 'check_violation';
  end if;

  insert into public.leads (
    producer_id, full_name, phone, email, kind, event_date, guest_count, message, source
  ) values (
    v_producer,
    left(btrim(p_full_name), 120),
    left(btrim(coalesce(p_phone, '')), 40),
    left(lower(btrim(coalesce(p_email, ''))), 160),
    (case when p_kind = 'corporate' then 'corporate' else 'wedding' end)::event_class,
    case when p_event_date is not null and p_event_date >= date '2026-01-01' then p_event_date end,
    case when p_guest_count between 1 and 1500 then p_guest_count end,
    left(coalesce(p_message, ''), 4000),
    public.normalize_source(p_source)
  )
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.record_lead(text, text, text, text, date, integer, text, text) from public;
grant execute on function public.record_lead(text, text, text, text, date, integer, text, text)
  to authenticated, service_role;
