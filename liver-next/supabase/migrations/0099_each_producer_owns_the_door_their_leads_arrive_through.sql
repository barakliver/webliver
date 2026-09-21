-- ============================================================================
--  0099 — each producer owns the door their enquiries arrive through
-- ============================================================================
--  The webhook worked, and it worked for exactly one producer.
--
--  `ingest_lead` never took a producer. It inserted, and the `leads_attribute`
--  trigger filled the gap with `public_site_producer()` — the platform's own
--  workspace. That was correct while there was one producer and the platform
--  was him. It stopped being correct the moment a second producer signed in:
--  connect their Instagram today and every enquiry their advertising buys
--  lands in somebody else's inbox, silently, and the only person who could
--  notice is the one producer who already has too many leads to count.
--
--  The second half of the same problem is the key. `LEAD_WEBHOOK_KEY` is one
--  value in the server's environment. One key shared by every producer is not
--  a key: revoking it for the producer who pasted their URL into a Zapier
--  account they no longer control revokes it for everybody, and no delivery
--  ever says which producer it was meant for.
--
--  So a channel becomes a row. A producer names it — "אינסטגרם", "גוגל אדס",
--  "הקמפיין של הסתיו" — picks what it is, and gets a URL with a token nobody
--  else holds. Deliveries through that URL land in their workspace, stamped
--  with that channel's source, and switching it off is one row, one producer,
--  one afternoon's advertising.
--
--  Three things this deliberately does NOT do:
--
--  It does not change `ingest_lead`'s signature or behaviour. The platform's
--  own Meta and Google connections are live and posting today; a migration
--  that quietly retires the key they present is an outage nobody scheduled.
--  The old door stays open and keeps going to the same place.
--
--  It does not let a caller name a producer. `store_lead` below takes one,
--  which is the whole point, and it is reachable only from the two functions
--  that establish which producer they are allowed to write for. Granting it
--  to anon would turn one leaked key into write access to every inbox on the
--  platform.
--
--  It does not hash the token. This is a bearer secret in a URL a producer
--  pastes into Meta's console — it must be readable back to them, because a
--  token they cannot re-read is a token they must rotate every time they set
--  up a second ad account. Rotation is one call, and it is the answer to a
--  leak rather than a hash they could never have shown anybody.
-- ============================================================================


-- ── the channel ─────────────────────────────────────────────────────────────
create table if not exists public.lead_channels (
  id           uuid primary key default gen_random_uuid(),
  producer_id  uuid not null references public.producers(id) on delete cascade,
  /* What the producer calls it. Two Instagram accounts are two channels and
     "אינסטגרם" twice tells them nothing, so this is theirs to write. */
  label        text not null,
  /* What every lead through this door is stamped with, folded by
     normalize_source so the funnel report has one row per channel rather than
     four spellings of one. Not unique per producer on purpose: two ad
     accounts on the same platform are two channels reading as one source,
     which is exactly how a producer wants to read them. */
  source       text not null,
  /* The secret in the URL. Hex rather than base64: this value is pasted by
     hand into consoles that treat '+' as a space, and a token that arrives
     mangled fails as "unauthorized" with nothing to show why. */
  token        text not null unique,
  /* Switched off rather than deleted, so the advertising that is still
     pointing here stops arriving without the row that explains what it was
     disappearing from the funnel's history. */
  enabled      boolean not null default true,
  /* Read by the screen, so a producer who wired something up an hour ago can
     tell "no leads yet" from "this was never connected". */
  last_lead_at timestamptz,
  lead_count   integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint lead_channels_label check (char_length(btrim(label)) between 1 and 40),
  constraint lead_channels_token check (char_length(token) between 24 and 80)
);

/* One name once per producer. Two channels called "אינסטגרם" is a producer
   guessing which of two URLs they pasted where. Case folded, because nobody
   types their own label the same way twice. */
create unique index if not exists lead_channels_name_unique
  on public.lead_channels (producer_id, lower(btrim(label)));

create index if not exists lead_channels_list
  on public.lead_channels (producer_id, created_at desc);

alter table public.lead_channels enable row level security;

drop policy if exists lead_channels_all on public.lead_channels;
create policy lead_channels_all on public.lead_channels for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));

grant all on public.lead_channels to authenticated, service_role;

comment on table public.lead_channels is
  'One advertising source a producer receives enquiries from, with the token '
  'that routes a delivery to their workspace. Never shared between producers.';


-- ── writing a lead down, once ───────────────────────────────────────────────
--  The coercion below was ingest_lead's body and is now shared, because the
--  alternative was a second copy that drifts. The rule it encodes is the one
--  0023 argued for: the advertising was paid for whether or not the delivery
--  is well formed, so coerce, cap and keep, and refuse only a payload with
--  nobody to call back.
--
--  Not granted to anon, and that is the security boundary of this whole
--  migration. It takes a producer id; its two callers each prove which
--  producer they may write for before they get here.
create or replace function public.store_lead(
  p_producer_id uuid,
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default '',
  p_source      text default 'webhook',
  p_external_id text default null,
  p_location    text default ''
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
  if p_producer_id is null then
    raise exception 'פנייה בלי מפיק' using errcode = 'check_violation';
  end if;

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

  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then v_email := ''; end if;
  if v_date is not null and v_date < date '2026-01-01' then v_date := null; end if;
  if v_guests is not null and (v_guests <= 0 or v_guests > 1500) then v_guests := null; end if;
  if v_name = '' then v_name := coalesce(nullif(v_phone, ''), v_email); end if;

  insert into public.leads (
    producer_id, full_name, phone, email, kind, event_date, guest_count,
    message, source, external_id, location
  ) values (
    p_producer_id,
    left(v_name, 120),
    left(v_phone, 40),
    left(v_email, 160),
    (case when p_kind = 'corporate' then 'corporate' else 'wedding' end)::event_class,
    v_date,
    v_guests,
    left(coalesce(p_message, ''), 4000),
    public.normalize_source(p_source),
    v_ext,
    left(btrim(coalesce(p_location, '')), 120)
  )
  on conflict (external_id) where external_id is not null do nothing
  returning id into v_id;

  if v_id is null and v_ext is not null then
    select id into v_id from public.leads where external_id = v_ext;
  end if;

  return v_id;
end $$;

revoke all on function public.store_lead(uuid, text, text, text, text, date, integer, text, text, text, text) from public;

comment on function public.store_lead(uuid, text, text, text, text, date, integer, text, text, text, text) is
  'Writes one enquiry into a named producer''s workspace. Internal: reachable '
  'only from the functions that establish which producer the caller may write '
  'for. Never grant to anon.';


-- ── the door that was already open ──────────────────────────────────────────
--  Same name, same arguments, same destination. Only the body moved.
create or replace function public.ingest_lead(
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default '',
  p_source      text default 'webhook',
  p_external_id text default null,
  p_location    text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  return public.store_lead(
    public.public_site_producer(),
    p_full_name, p_phone, p_email, p_kind, p_event_date,
    p_guest_count, p_message, p_source, p_external_id, p_location
  );
end $$;

revoke all on function public.ingest_lead(text, text, text, text, date, integer, text, text, text, text) from public;
grant execute on function public.ingest_lead(text, text, text, text, date, integer, text, text, text, text)
  to anon, authenticated, service_role;


-- ── the door each producer opens for themselves ─────────────────────────────
--  Anon may execute this, and holding a token is the whole of the
--  authorisation: the token names the channel, the channel names the producer,
--  and a caller who does not hold one cannot name either.
--
--  The sender's own id is prefixed with the channel before it is stored. The
--  unique index on `leads.external_id` is platform wide, so two producers
--  whose form builder numbers its submissions from one would otherwise have
--  the second producer's lead silently swallowed as a duplicate of the first.
create or replace function public.ingest_lead_via_channel(
  p_token       text,
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default '',
  p_external_id text default null,
  p_location    text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  ch    public.lead_channels%rowtype;
  v_ext text;
  v_id  uuid;
begin
  select * into ch from public.lead_channels
   where token = btrim(coalesce(p_token, '')) and enabled;

  /* One message for "no such token" and for "switched off", because the
     difference is only useful to somebody probing for live tokens. */
  if not found then
    raise exception 'ערוץ לא מוכר' using errcode = 'insufficient_privilege';
  end if;

  v_ext := case
             when nullif(btrim(coalesce(p_external_id, '')), '') is null then null
             else ch.id::text || ':' || btrim(p_external_id)
           end;

  /* A retry is answered with the row it already made, and is not counted
     twice. Meta retries on any non 200 and Zapier replays; a channel whose
     tally climbs on every retry tells a producer their Tuesday was better
     than it was. */
  if v_ext is not null then
    select id into v_id from public.leads where external_id = v_ext;
    if found then return v_id; end if;
  end if;

  v_id := public.store_lead(
    ch.producer_id,
    p_full_name, p_phone, p_email, p_kind, p_event_date,
    p_guest_count, p_message, ch.source, v_ext, p_location
  );

  if v_id is not null then
    update public.lead_channels
       set last_lead_at = now(), lead_count = lead_count + 1
     where id = ch.id;
  end if;

  return v_id;
end $$;

revoke all on function public.ingest_lead_via_channel(text, text, text, text, text, date, integer, text, text, text) from public;
grant execute on function public.ingest_lead_via_channel(text, text, text, text, text, date, integer, text, text, text)
  to anon, authenticated, service_role;


-- ── opening one, and closing it again ───────────────────────────────────────
--  The token is made here rather than defaulted on the column, so the one
--  place it is generated is the one place `extensions` is on the search path.
--  pgcrypto lives in `extensions` on Supabase and in `public` on a plain
--  install; 0038 is the afternoon that lesson cost.
create or replace function public.new_lead_channel(p_label text, p_source text)
returns public.lead_channels
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_producer uuid := public.my_producer_id();
  v_label    text := btrim(coalesce(p_label, ''));
  v_row      public.lead_channels%rowtype;
begin
  if v_producer is null then
    raise exception 'צריך להתחבר כמפיק' using errcode = 'insufficient_privilege';
  end if;
  if v_label = '' or char_length(v_label) > 40 then
    raise exception 'שם הערוץ חייב להיות בין תו אחד ל-40' using errcode = 'check_violation';
  end if;

  insert into public.lead_channels (producer_id, label, source, token)
  values (
    v_producer,
    v_label,
    public.normalize_source(coalesce(nullif(btrim(coalesce(p_source, '')), ''), v_label)),
    encode(gen_random_bytes(24), 'hex')
  )
  returning * into v_row;

  return v_row;
end $$;

grant execute on function public.new_lead_channel(text, text) to authenticated, service_role;

--  A token that leaked is replaced rather than deleted: the channel keeps its
--  name, its source and everything it has already collected, and only the URL
--  the producer re-pastes changes.
create or replace function public.rotate_lead_channel(p_id uuid)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_producer uuid;
  tok        text;
begin
  select producer_id into v_producer from public.lead_channels where id = p_id;
  if not found or not public.owns_producer(v_producer) then
    raise exception 'ערוץ לא מוכר' using errcode = 'insufficient_privilege';
  end if;

  tok := encode(gen_random_bytes(24), 'hex');
  update public.lead_channels set token = tok where id = p_id;
  return tok;
end $$;

grant execute on function public.rotate_lead_channel(uuid) to authenticated, service_role;


-- ── the handshake ───────────────────────────────────────────────────────────
--  Meta refuses to deliver to a URL until it has GET one with a challenge and
--  been echoed the value back, and it compares a verify token the producer
--  typed. That happens before any lead exists, so it needs one question
--  answered without a session: is this token a live channel.
--
--  Yes or no, and nothing else — not the producer, not the label, not the
--  source. Answering it costs nothing to somebody who already holds the
--  token, and tells somebody who does not exactly what an ingest attempt
--  would have told them anyway.
create or replace function public.lead_channel_exists(p_token text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lead_channels
     where token = btrim(coalesce(p_token, '')) and enabled
  )
$$;

revoke all on function public.lead_channel_exists(text) from public;
grant execute on function public.lead_channel_exists(text) to anon, authenticated, service_role;
