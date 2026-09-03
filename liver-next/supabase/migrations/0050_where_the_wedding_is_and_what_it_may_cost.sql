-- ============================================================================
--  0050 — where the wedding is, and what it may cost
-- ============================================================================
--  Two columns that were missing from the two conversations that matter most.
--
--  The first question a producer asks an enquiry is "where", because the
--  answer decides whether they can take it at all: a producer in the north
--  does not drive to Eilat for a Thursday. The lead form never asked, so the
--  first call was spent finding out. Now the visitor says, in a tap.
--
--  The first question a couple asks about money is "how much can we spend",
--  and the budget screen only knew what things cost. A target is the figure
--  everything else is measured against, and it lives on the event.
-- ============================================================================

alter table public.leads add column if not exists location text not null default '';
do $$ begin
  alter table public.leads add constraint leads_location_len check (char_length(location) <= 120);
exception when duplicate_object then null; end $$;

comment on column public.leads.location is
  'Region or venue as the enquirer put it. Free text; the form offers the '
  'regions as chips and stores the label.';

alter table public.clients add column if not exists budget_target numeric(12,2);
do $$ begin
  alter table public.clients add constraint clients_budget_target_sane
    check (budget_target is null or budget_target >= 0);
exception when duplicate_object then null; end $$;

comment on column public.clients.budget_target is
  'The ceiling the couple and producer agreed on, in shekels. Null until set.';


-- ── the three doors a lead comes through, each learning the location ────────
--  A function's parameter list cannot grow in place: the old signature would
--  survive as an overload and the RPC call would be ambiguous. Each is
--  dropped and written again with the location appended and defaulted, so a
--  caller that does not send it still works.

drop function if exists public.submit_lead(text, text, text, text, date, integer, text);
create or replace function public.submit_lead(
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default '',
  p_location    text default ''
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

  insert into public.leads (full_name, phone, email, kind, event_date, guest_count, message, source, location)
  values (
    left(v_name, 120),
    left(v_phone, 40),
    left(v_email, 160),
    (case when p_kind = 'corporate' then 'corporate' else 'wedding' end)::event_class,
    p_event_date,
    p_guest_count,
    left(coalesce(p_message, ''), 4000),
    'site',
    left(btrim(coalesce(p_location, '')), 120)
  );
end $$;

revoke all on function public.submit_lead(text, text, text, text, date, integer, text, text) from public;
grant execute on function public.submit_lead(text, text, text, text, date, integer, text, text)
  to anon, authenticated, service_role;


drop function if exists public.record_lead(text, text, text, text, date, integer, text, text);
create or replace function public.record_lead(
  p_full_name   text,
  p_phone       text default '',
  p_email       text default '',
  p_kind        text default 'wedding',
  p_event_date  date default null,
  p_guest_count integer default null,
  p_message     text default '',
  p_source      text default 'phone',
  p_location    text default ''
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
    producer_id, full_name, phone, email, kind, event_date, guest_count, message, source, location
  ) values (
    v_producer,
    left(btrim(p_full_name), 120),
    left(btrim(coalesce(p_phone, '')), 40),
    left(lower(btrim(coalesce(p_email, ''))), 160),
    (case when p_kind = 'corporate' then 'corporate' else 'wedding' end)::event_class,
    case when p_event_date is not null and p_event_date >= date '2026-01-01' then p_event_date end,
    case when p_guest_count between 1 and 1500 then p_guest_count end,
    left(coalesce(p_message, ''), 4000),
    public.normalize_source(p_source),
    left(btrim(coalesce(p_location, '')), 120)
  )
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.record_lead(text, text, text, text, date, integer, text, text, text) from public;
grant execute on function public.record_lead(text, text, text, text, date, integer, text, text, text)
  to authenticated, service_role;


drop function if exists public.ingest_lead(text, text, text, text, date, integer, text, text, text);
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
declare
  v_name   text := btrim(coalesce(p_full_name, ''));
  v_phone  text := btrim(coalesce(p_phone, ''));
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_ext    text := nullif(btrim(coalesce(p_external_id, '')), '');
  v_date   date := p_event_date;
  v_guests integer := p_guest_count;
  v_id     uuid;
begin
  if v_name = '' and v_phone = '' and v_email = '' then
    raise exception 'פנייה ריקה' using errcode = 'check_violation';
  end if;

  if v_ext is not null then
    select id into v_id from public.leads where external_id = v_ext;
    if found then return v_id; end if;
  end if;

  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then v_email := ''; end if;
  if v_date is not null and v_date < date '2026-01-01' then v_date := null; end if;
  if v_guests is not null and (v_guests <= 0 or v_guests > 1500) then v_guests := null; end if;
  if v_name = '' then v_name := coalesce(nullif(v_phone, ''), v_email); end if;

  insert into public.leads (
    full_name, phone, email, kind, event_date, guest_count, message, source, external_id, location
  ) values (
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

revoke all on function public.ingest_lead(text, text, text, text, date, integer, text, text, text, text) from public;
grant execute on function public.ingest_lead(text, text, text, text, date, integer, text, text, text, text)
  to anon, authenticated, service_role;
