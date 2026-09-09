-- ============================================================================
--  0067 — the envelopes, and the cars
-- ============================================================================
--  Two lists the couple keeps on paper the week of the wedding, and the two
--  the event manager most needs in hand on the night.
--
--  The envelopes: the cash that changes hands at a wedding — the rabbi, the
--  tip for the crew, the photographer's balance — each one an envelope the
--  couple has to remember to bring and the manager has to remember to
--  collect. Who it is for, how much, whether it has been handed over.
--
--  The cars: how everybody gets from wherever they are getting ready to the
--  hall, and home again. "Car 1" with a name the couple chooses, whose car it
--  is and their number, how many seats, and who is riding in it.
--
--  Both are shaped like event_vips, because they are the same kind of thing:
--  a short list on one event, written by either side, read on the night.
--  Fenced on the line after they are created, which is the rule this schema
--  learned the hard way in 0061.
-- ============================================================================

-- ── envelopes ──────────────────────────────────────────────────────────────
create table if not exists public.event_envelopes (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  /* Who it is for: 'רב', 'טיפ לצוות', 'צלם — יתרה'. Free text, because the
     list is different at every wedding and nobody wants to pick from a menu
     that does not have the mikveh attendant on it. */
  label        text not null,
  amount       numeric(12,2),
  /* Who actually receives it, when that is a person rather than a role. */
  recipient    text not null default '',
  cash         boolean not null default true,
  /* Set by whoever handed it over, on the night. Null means still in the
     bag. */
  delivered_at timestamptz,
  note         text not null default '',
  sort         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.event_envelopes enable row level security;

do $$ begin
  alter table public.event_envelopes add constraint event_envelopes_label_len
    check (char_length(label) between 1 and 80);
  alter table public.event_envelopes add constraint event_envelopes_recipient_len
    check (char_length(recipient) <= 80);
  alter table public.event_envelopes add constraint event_envelopes_note_len
    check (char_length(note) <= 400);
  alter table public.event_envelopes add constraint event_envelopes_amount_nonneg
    check (amount is null or amount >= 0);
exception when duplicate_object then null; end $$;

create index if not exists event_envelopes_client_idx on public.event_envelopes (client_id, sort);

drop policy if exists event_envelopes_all on public.event_envelopes;
create policy event_envelopes_all on public.event_envelopes for all
  using      (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

-- ── the cars ───────────────────────────────────────────────────────────────
create table if not exists public.event_vehicles (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  /* What the couple calls it. 'רכב 1', 'האוטו של אבא', 'הסעה מהצפון'. */
  name         text not null,
  driver       text not null default '',
  phone        text not null default '',
  seats        integer,
  /* Who is in it, as the couple would write it on a note: 'סבתא, דודה רחל,
     שני הילדים'. A free line rather than a join to the guest list, because
     the people in the car on the way to the hall are not always guests. */
  riders       text not null default '',
  /* Which way. Most cars do both; the shuttle from the north does one. */
  leg          text not null default 'both',
  note         text not null default '',
  sort         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.event_vehicles enable row level security;

do $$ begin
  alter table public.event_vehicles add constraint event_vehicles_name_len
    check (char_length(name) between 1 and 60);
  alter table public.event_vehicles add constraint event_vehicles_driver_len
    check (char_length(driver) <= 80);
  alter table public.event_vehicles add constraint event_vehicles_phone_len
    check (char_length(phone) <= 30);
  alter table public.event_vehicles add constraint event_vehicles_riders_len
    check (char_length(riders) <= 400);
  alter table public.event_vehicles add constraint event_vehicles_note_len
    check (char_length(note) <= 400);
  alter table public.event_vehicles add constraint event_vehicles_seats_range
    check (seats is null or (seats between 1 and 60));
  alter table public.event_vehicles add constraint event_vehicles_leg_known
    check (leg in ('to', 'from', 'both'));
exception when duplicate_object then null; end $$;

create index if not exists event_vehicles_client_idx on public.event_vehicles (client_id, sort);

drop policy if exists event_vehicles_all on public.event_vehicles;
create policy event_vehicles_all on public.event_vehicles for all
  using      (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

-- ── two more doors the couple's screen can have closed ─────────────────────
--  Gated like every other module the couple sees, so a plan that does not
--  include them does not quietly include them. Open on both plans.
insert into public.feature_flags (key, label, diy, managed) values
  ('envelopes', 'מעטפות', true, true),
  ('transport', 'הסעות ורכבים', true, true)
on conflict (key) do nothing;

-- ── comments ───────────────────────────────────────────────────────────────
comment on table public.event_envelopes is
  'Cash envelopes the couple brings on the night: who each is for, how much, '
  'and whether it has been handed over. Written by either side.';

comment on table public.event_vehicles is
  'How people get to the hall and home: each car with a name the couple '
  'chose, whose it is, seats, and who is riding. Written by either side.';

comment on column public.event_vehicles.leg is
  'to, from, or both. Which way this car runs.';
