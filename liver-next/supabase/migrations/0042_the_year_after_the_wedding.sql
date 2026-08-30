-- ============================================================================
--  0042 — the year after the wedding
-- ============================================================================
--  Five things, and they are one thing: an event does not end when the band
--  stops. It gets closed, filed under the year it happened in, looked up two
--  summers later when a cousin asks who the photographer was, and remembered
--  on its first anniversary. Until now the platform could do the first half of
--  that and forgot the rest.
--
--  What is deliberately NOT here, because it already exists and rebuilding it
--  would risk the data in it:
--
--    producers, clients, and the approval flow            0001, 0002
--    three authorised addresses per event                 0020
--    the zero knowledge boundary and platform_stats()     0030
--    archived_at on a workspace, and the close button     0016
--
--  This extends those. `event_archives` in particular is NOT a second copy of
--  a closed event: `clients.archived_at` remains the single fact about whether
--  an event is closed, and this table holds only what closing *freezes* — the
--  supplier sheet and the money as they stood on the night, which nothing else
--  records and which a later edit to the live rows would otherwise rewrite.
-- ============================================================================

alter type notice_kind add value if not exists 'anniversary';
alter type notice_kind add value if not exists 'meeting';


-- ── who brought whom ────────────────────────────────────────────────────────
--  A referral is a governance fact, not a private one: it says which producer
--  arrived through whose link, and it is the only new thing the super admin is
--  allowed to learn. It carries no couple, no event and no money.
alter table public.producers add column if not exists referral_code text;
alter table public.producers add column if not exists referred_by uuid
  references public.producers(id) on delete set null;

create unique index if not exists producers_referral_code_idx
  on public.producers (lower(referral_code)) where referral_code is not null;

/* Short, unambiguous, and not sequential. Sequential would tell a stranger how
   many producers exist, which is exactly the kind of number this platform is
   built not to leak. */
create or replace function public.new_referral_code() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  code text;
begin
  for i in 1..10 loop
    /* No 0/O and no 1/I: this gets read aloud and typed from a screenshot. */
    code := translate(upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
                      '01', 'XY');
    exit when not exists (
      select 1 from public.producers where lower(referral_code) = lower(code)
    );
    code := null;
  end loop;
  return code;
end $$;

create or replace function public.stamp_referral_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.referral_code is null then
    new.referral_code := public.new_referral_code();
  end if;
  return new;
end $$;

drop trigger if exists producers_referral_code on public.producers;
create trigger producers_referral_code before insert on public.producers
  for each row execute function public.stamp_referral_code();

update public.producers set referral_code = public.new_referral_code()
 where referral_code is null;

/* Claiming one. Runs as the producer signing up, takes a code rather than an
   id, and refuses to point a producer at themselves — which is the only way
   this could be gamed and is worth ruling out in the database. */
create or replace function public.claim_referral(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  mine   uuid;
  source uuid;
begin
  select id into mine from public.producers where owner_id = auth.uid();
  if mine is null then return false; end if;

  select id into source from public.producers
   where lower(referral_code) = lower(btrim(coalesce(p_code, ''))) and id <> mine;
  if source is null then return false; end if;

  /* Once. A producer's origin is a fact about their signup, and letting it be
     rewritten later turns a governance record into a leaderboard. */
  update public.producers set referred_by = source
   where id = mine and referred_by is null;

  return found;
end $$;

revoke all on function public.claim_referral(text) from public;
grant execute on function public.claim_referral(text) to authenticated;


-- ── what closing an event freezes ───────────────────────────────────────────
--  A snapshot, taken once, of the things that stop being editable when the
--  night is over. Not a copy of the event: the live rows stay where they are
--  and stay readable. This is the answer to "who was the photographer on that
--  wedding in 2025", asked in 2027, after the supplier's row has been renamed
--  twice and the budget reworked for somebody else.
create table if not exists public.event_archives (
  client_id    uuid primary key references public.clients(id) on delete cascade,
  producer_id  uuid not null references public.producers(id) on delete cascade,
  /* Denormalised on purpose. The year is what the shelf is organised by, and
     reading it off a joined event date every time is how a folder listing
     becomes a table scan. */
  event_year   integer,
  event_date   date,
  display_name text not null default '',
  venue        text not null default '',
  guests_final integer,
  /* The supplier sheet and the money, as they stood. jsonb because the shape
     of a finished event is not the shape of a live one and never will be:
     nothing writes into these again. */
  vendors      jsonb not null default '[]'::jsonb,
  crew         jsonb not null default '[]'::jsonb,
  money        jsonb not null default '{}'::jsonb,
  runsheet     jsonb not null default '[]'::jsonb,
  note         text not null default '',
  closed_at    timestamptz not null default now(),
  closed_by    uuid references public.profiles(id) on delete set null
);
create index if not exists event_archives_shelf_idx
  on public.event_archives (producer_id, event_year desc, event_date desc);

alter table public.event_archives enable row level security;

/* The producer's own shelf, and nobody else's — the super admin included.
   Deliberately not `can_read_client`: a couple has no use for a frozen
   supplier sheet with fees on it, and 0025 already decided cost is producer
   only. Closing an event must not quietly widen that. */
drop policy if exists event_archives_read on public.event_archives;
create policy event_archives_read on public.event_archives for select
  using (public.owns_producer(producer_id));

drop policy if exists event_archives_write on public.event_archives;
create policy event_archives_write on public.event_archives for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));

grant all on public.event_archives to authenticated, service_role;


/**
 *  Closing one, and taking the snapshot in the same statement.
 *
 *  Idempotent: closing a closed event refreshes nothing and raises nothing,
 *  because the button is on a row that realtime may redraw underneath a thumb
 *  and a double tap must not mean something different from a single one.
 */
create or replace function public.close_event(p_client uuid, p_note text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  select * into c from public.clients where id = p_client;
  if c is null or not public.owns_producer(c.producer_id) then
    raise exception 'אפשר לסגור רק אירוע שלך' using errcode = 'insufficient_privilege';
  end if;

  update public.clients set archived_at = coalesce(archived_at, now())
   where id = p_client;

  insert into public.event_archives as a (
    client_id, producer_id, event_year, event_date, display_name, venue,
    guests_final, vendors, crew, money, runsheet, note, closed_by
  )
  values (
    p_client, c.producer_id,
    extract(year from c.event_date)::int, c.event_date,
    c.display_name, coalesce(c.venue, ''),
    (select count(*)::int from public.guests_rsvp g
      where g.client_id = p_client and g.status = 'attending'),
    coalesce((select jsonb_agg(jsonb_build_object(
        'name', v.name, 'category', v.category, 'phone', v.phone, 'status', v.status))
       from public.event_vendors v where v.client_id = p_client), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
        'name', k.name, 'role', k.role, 'phone', k.phone, 'fee', k.fee))
       from public.crew k where k.client_id = p_client), '[]'::jsonb),
    jsonb_build_object(
      'budget', coalesce((select sum(b.amount) from public.budget_items b
                           where b.client_id = p_client), 0),
      'paid',   coalesce((select sum(p.amount) from public.payments p
                           where p.client_id = p_client and p.paid), 0)),
    coalesce((select jsonb_agg(jsonb_build_object(
        'at', d.at_time, 'title', d.title, 'owner', d.owner) order by d.at_time)
       from public.day_schedule d where d.client_id = p_client), '[]'::jsonb),
    left(coalesce(p_note, ''), 2000),
    auth.uid()
  )
  on conflict (client_id) do nothing;

  /* The reminders for the year to come are scheduled here rather than by a
     nightly sweep looking for events that ended: the moment an event is closed
     is the moment its anniversary becomes a fact, and a schedule written once
     is a schedule that can be looked at. */
  perform public.schedule_anniversary(p_client);
end $$;

revoke all on function public.close_event(uuid, text) from public;
grant execute on function public.close_event(uuid, text) to authenticated, service_role;


/* The shelf itself: which years this producer has events in, and how many.
   One query for the whole page rather than one per folder. */
create or replace function public.archive_years()
returns table (event_year integer, events integer)
language sql stable security definer set search_path = public as $$
  select coalesce(a.event_year, 0), count(*)::int
    from public.event_archives a
   where public.owns_producer(a.producer_id)
   group by 1
   order by 1 desc
$$;

revoke all on function public.archive_years() from public;
grant execute on function public.archive_years() to authenticated;


-- ── the workflows a producer works to ───────────────────────────────────────
--  0003 shipped one task template, compiled into the app, and it is a good
--  one. It is also Barak's. A second producer works differently, and a
--  template they cannot change is a template they will not use.
--
--  Steps are jsonb rather than a child table on purpose: a template is edited
--  as a whole and applied as a whole, never queried step by step, and a child
--  table would buy referential integrity for a list that is only ever read
--  back in one piece.
create table if not exists public.producer_workflow_templates (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  name        text not null,
  kind        text not null default 'tasks',
  /* [{ "title": "…", "offset_days": -90, "owner": "producer", "note": "…" }]
     Offsets are from the wedding date and are negative before it, which is
     where almost all of them are. */
  steps       jsonb not null default '[]'::jsonb,
  is_default  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint pwt_name_len check (char_length(btrim(name)) between 1 and 120),
  constraint pwt_kind     check (kind in ('tasks','meetings','budget','suppliers')),
  constraint pwt_steps    check (jsonb_typeof(steps) = 'array'
                                 and jsonb_array_length(steps) <= 200)
);
create index if not exists pwt_producer_idx
  on public.producer_workflow_templates (producer_id, sort_order, created_at);

alter table public.producer_workflow_templates enable row level security;

drop policy if exists pwt_all on public.producer_workflow_templates;
create policy pwt_all on public.producer_workflow_templates for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id) and public.is_approved_producer());

grant all on public.producer_workflow_templates to authenticated, service_role;


/**
 *  Applying one to an event, dated from the wedding.
 *
 *  Returns how many landed rather than raising on a duplicate: a producer who
 *  applies a template twice means "fill in what is missing", and a template
 *  that refuses because one of its ninety steps already exists is a template
 *  that has to be applied by hand.
 */
create or replace function public.apply_workflow_template(
  p_client uuid, p_template uuid
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  t     record;
  s     jsonb;
  due   date;
  added integer := 0;
  base  date;
begin
  select * into t from public.producer_workflow_templates where id = p_template;
  if t is null or not public.owns_producer(t.producer_id) then
    raise exception 'אין הרשאה לתבנית הזאת' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.clients c
     where c.id = p_client and c.producer_id = t.producer_id
  ) then
    raise exception 'התבנית שייכת למפיק אחר' using errcode = 'insufficient_privilege';
  end if;

  select event_date into base from public.clients where id = p_client;

  for s in select * from jsonb_array_elements(t.steps) loop
    /* An event with no date yet still gets its checklist, undated. Refusing
       would mean the one moment a producer most wants the list — the week they
       open the file, before a hall is booked — is the one moment it is
       unavailable. */
    due := case when base is null then null
                else base + coalesce((s->>'offset_days')::int, 0) end;

    if btrim(coalesce(s->>'title', '')) <> '' and not exists (
      select 1 from public.tasks k
       where k.client_id = p_client and k.title = left(btrim(s->>'title'), 200)
    ) then
      insert into public.tasks (client_id, title, due_on, owner, created_by, visible_to_client)
      values (
        p_client, left(btrim(s->>'title'), 200), due,
        (case when s->>'owner' = 'client' then 'client' else 'producer' end)::task_owner,
        auth.uid(),
        coalesce((s->>'visible_to_client')::boolean, true)
      );
      added := added + 1;
    end if;
  end loop;

  return added;
end $$;

revoke all on function public.apply_workflow_template(uuid, uuid) from public;
grant execute on function public.apply_workflow_template(uuid, uuid) to authenticated, service_role;


-- ── the meetings, and what was said in them ─────────────────────────────────
create table if not exists public.meeting_logs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  kind        text not null,
  title       text not null default '',
  held_on     date,
  /* The questionnaire, as answered. One object keyed by field id, so a
     template that grows a question does not need a migration and an old log
     does not grow an empty column. */
  answers     jsonb not null default '{}'::jsonb,
  summary     text not null default '',
  /* Whether the summary was written by the model or by a person. A summary
     nobody can tell the origin of is a summary nobody should rely on. */
  summary_by  text not null default 'none',
  /* False keeps a log on the producer's side, the same rule tasks use. */
  visible_to_client boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint meeting_kind check (kind in ('production','tasting','venue','design','other')),
  constraint meeting_summary_len check (char_length(summary) <= 20000),
  constraint meeting_summary_by check (summary_by in ('none','model','person'))
);
create index if not exists meeting_logs_client_idx
  on public.meeting_logs (client_id, held_on desc nulls last, created_at desc);

alter table public.meeting_logs enable row level security;

/* Producer always; the couple only for a log deliberately shared with them.
   Same two branches tasks uses, written out rather than collapsed so the next
   person can see which is which. */
drop policy if exists meeting_logs_read on public.meeting_logs;
create policy meeting_logs_read on public.meeting_logs for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or (public.can_read_client(client_id) and visible_to_client)
  );

/* Writing is the producer's. A meeting log is a record of what the producer
   heard and agreed; a couple editing one after the fact is not a correction,
   it is a different document. */
drop policy if exists meeting_logs_write on public.meeting_logs;
create policy meeting_logs_write on public.meeting_logs for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));

grant all on public.meeting_logs to authenticated, service_role;


/* Every save, kept. The spec word is "permanently": a meeting summary is
   something a supplier is paid against and a couple remembers differently, so
   what it said in March has to still be readable in September. Append only —
   there is no update policy and no delete policy at all, deliberately. */
create table if not exists public.meeting_log_versions (
  id         uuid primary key default gen_random_uuid(),
  log_id     uuid not null references public.meeting_logs(id) on delete cascade,
  answers    jsonb not null default '{}'::jsonb,
  summary    text not null default '',
  saved_by   uuid references public.profiles(id) on delete set null,
  saved_at   timestamptz not null default now()
);
create index if not exists meeting_versions_idx
  on public.meeting_log_versions (log_id, saved_at desc);

alter table public.meeting_log_versions enable row level security;

drop policy if exists meeting_versions_read on public.meeting_log_versions;
create policy meeting_versions_read on public.meeting_log_versions for select
  using (exists (
    select 1 from public.meeting_logs m
     where m.id = log_id
       and public.owns_producer(public.producer_of_client(m.client_id))
  ));

grant select on public.meeting_log_versions to authenticated, service_role;

/* Written by the database rather than by the caller, so a screen that forgets
   to record a version cannot exist.

   Two triggers, not one, and the split is not cosmetic: a row's own columns can
   only be changed BEFORE it is written, and a child row may only be inserted
   AFTER the parent exists. One function doing both would silently drop the
   timestamp, which is the sort of thing that looks fine until somebody sorts
   by it. */
create or replace function public.stamp_meeting_log() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists meeting_logs_stamped on public.meeting_logs;
create trigger meeting_logs_stamped before insert or update on public.meeting_logs
  for each row execute function public.stamp_meeting_log();

create or replace function public.keep_meeting_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
     or new.answers is distinct from old.answers
     or new.summary is distinct from old.summary then
    insert into public.meeting_log_versions (log_id, answers, summary, saved_by)
    values (new.id, new.answers, new.summary, auth.uid());
  end if;
  return null;
end $$;

drop trigger if exists meeting_logs_versioned on public.meeting_logs;
create trigger meeting_logs_versioned after insert or update on public.meeting_logs
  for each row execute function public.keep_meeting_version();


-- ── the first anniversary, and only the first ───────────────────────────────
--  A producer who sends a message on the first anniversary is remembered. A
--  producer who sends one every year for a decade is a mailing list. The spec
--  says first year only and the schema says it too: three rows per event,
--  written once when the event is closed, and nothing that generates a fourth.
--
--  Rows rather than a nightly date calculation, for two reasons. A schedule
--  that exists can be looked at, moved and cancelled before it fires. And
--  `sent_at` on the row is what makes the sweep idempotent — a cron that runs
--  twice, or a server that restarts mid-run, cannot send the same greeting
--  twice.
create table if not exists public.anniversary_reminders (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  producer_id uuid not null references public.producers(id) on delete cascade,
  milestone  text not null,
  /* The day the reminder is for, not the anniversary itself. */
  due_on     date not null,
  /* The anniversary being celebrated, carried along so a notification can name
     the date without joining back to an event that may since have been
     renamed. */
  event_date date not null,
  couple     text not null default '',
  sent_at    timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint anniversary_milestone check (milestone in ('month','week','day')),
  unique (client_id, milestone)
);
create index if not exists anniversary_due_idx
  on public.anniversary_reminders (due_on)
  where sent_at is null and cancelled_at is null;

alter table public.anniversary_reminders enable row level security;

drop policy if exists anniversary_read on public.anniversary_reminders;
create policy anniversary_read on public.anniversary_reminders for select
  using (public.owns_producer(producer_id));

/* A producer may cancel one. Nothing may edit when it fires: a reminder that
   can be moved is a reminder that drifts, and the whole value here is that it
   arrives without anybody remembering to arrange it. */
drop policy if exists anniversary_write on public.anniversary_reminders;
create policy anniversary_write on public.anniversary_reminders for update
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));

grant select, update on public.anniversary_reminders to authenticated;
grant all on public.anniversary_reminders to service_role;


/**
 *  Scheduling the three, for the year after the event.
 *
 *  Called by close_event(), and safe to call again: the unique key on
 *  (client_id, milestone) means a re-close cannot double book. An event with
 *  no date, or whose first anniversary is already behind us, schedules
 *  nothing — a reminder that was due last month is not news, it is noise with
 *  a date on it.
 */
create or replace function public.schedule_anniversary(p_client uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  c     record;
  first date;
  made  integer := 0;
begin
  select cl.*, pr.id as pid into c
    from public.clients cl
    join public.producers pr on pr.id = cl.producer_id
   where cl.id = p_client;

  if c is null or c.event_date is null then return 0; end if;

  /* One year on, to the day. February 29th lands on March 1st in a common
     year, which is what `+ interval` does and is the answer a person would
     give. */
  first := (c.event_date + interval '1 year')::date;
  if first <= current_date then return 0; end if;

  insert into public.anniversary_reminders
    (client_id, producer_id, milestone, due_on, event_date, couple)
  values
    (p_client, c.pid, 'month', (first - interval '1 month')::date, c.event_date, c.display_name),
    (p_client, c.pid, 'week',  (first - interval '7 days')::date,  c.event_date, c.display_name),
    (p_client, c.pid, 'day',   (first - interval '1 day')::date,   c.event_date, c.display_name)
  on conflict (client_id, milestone) do nothing;

  get diagnostics made = row_count;

  /* A reminder whose day has already passed at scheduling time is cancelled
     rather than left to fire late. Closing an event eleven months after it
     happened is normal, and the month-before reminder for it is already
     history. */
  update public.anniversary_reminders
     set cancelled_at = now()
   where client_id = p_client and sent_at is null and cancelled_at is null
     and due_on < current_date;

  return made;
end $$;

revoke all on function public.schedule_anniversary(uuid) from public;
grant execute on function public.schedule_anniversary(uuid) to authenticated, service_role;


/**
 *  The sweep. Everything due today or overdue and not yet sent.
 *
 *  Marks and returns in one statement, so two runs overlapping cannot both
 *  claim the same row — the second finds nothing, which is the behaviour a
 *  cron that occasionally runs twice needs from a table that sends email.
 */
create or replace function public.fire_due_anniversaries()
returns table (
  client_id   uuid,
  producer_id uuid,
  owner_id    uuid,
  milestone   text,
  couple      text,
  event_date  date,
  kind        text
)
language plpgsql volatile security definer set search_path = public as $$
begin
  return query
  with due as (
    update public.anniversary_reminders r
       set sent_at = now()
     where r.sent_at is null
       and r.cancelled_at is null
       and r.due_on <= current_date
       /* A month of grace. Older than that and a server that was down for a
          season would wake up and send a year of greetings at once. */
       and r.due_on > current_date - interval '31 days'
     returning r.client_id, r.producer_id, r.milestone, r.couple, r.event_date
  )
  select d.client_id, d.producer_id, pr.owner_id, d.milestone, d.couple, d.event_date,
         c.kind::text
    from due d
    join public.producers pr on pr.id = d.producer_id
    left join public.clients c on c.id = d.client_id;
end $$;

revoke all on function public.fire_due_anniversaries() from public;
grant execute on function public.fire_due_anniversaries() to service_role;


/**
 *  Closing what the calendar has already closed.
 *
 *  An event whose date is a fortnight behind us and which nobody pressed the
 *  button on. The delay is deliberate: the week after a wedding is when the
 *  last supplier invoice arrives and the run sheet gets its final correction,
 *  and freezing the snapshot on the Sunday morning would freeze it wrong.
 */
create or replace function public.archive_past_events(p_grace integer default 14)
returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  r     record;
  count integer := 0;
begin
  for r in
    select c.id, pr.owner_id
      from public.clients c
      join public.producers pr on pr.id = c.producer_id
     where c.archived_at is null
       and c.event_date is not null
       and c.event_date < current_date - make_interval(days => greatest(1, p_grace))
  loop
    update public.clients set archived_at = now() where id = r.id;
    perform public.schedule_anniversary(r.id);
    count := count + 1;
  end loop;
  return count;
end $$;

revoke all on function public.archive_past_events(integer) from public;
grant execute on function public.archive_past_events(integer) to service_role;


-- ── what the super admin may learn about referrals ──────────────────────────
--  Counts and a brand name. The same boundary 0030 drew, extended by exactly
--  one column: who arrived through whose link. No couple, no event, no money.
create or replace function public.referral_stats()
returns table (
  producer_id    uuid,
  brand          text,
  referral_code  text,
  referred_by    uuid,
  referred_brand text,
  invited_total  integer,
  clients_total  integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    pr.id,
    coalesce(nullif(pr.brand_name, ''), nullif(pr.contact_name, ''), pr.contact_email),
    pr.referral_code,
    pr.referred_by,
    (select coalesce(nullif(s.brand_name, ''), s.contact_email)
       from public.producers s where s.id = pr.referred_by),
    (select count(*)::int from public.producers x where x.referred_by = pr.id),
    /* A number, and only a number. This is the line the whole zero knowledge
       design is about: root may know that Keren manages nine events and may
       not know one thing about any of them. */
    (select count(*)::int from public.clients c where c.producer_id = pr.id)
  from public.producers pr
  order by 6 desc, 7 desc;
end $$;

revoke all on function public.referral_stats() from public;
grant execute on function public.referral_stats() to authenticated;


-- ── the one grant the sweep depends on ──────────────────────────────────────
--  notify() has been callable since 0010 only because nothing ever revoked the
--  default execute privilege on functions. The nightly sweep runs as the
--  service role and calls it, so stating the grant means the day somebody
--  tightens function privileges across the schema, the anniversary reminders
--  do not quietly stop arriving with no error anywhere. Same lesson 0026
--  wrote down about the marketing page.
grant execute on function public.notify(uuid, notice_kind, text, text, text)
  to authenticated, service_role;
