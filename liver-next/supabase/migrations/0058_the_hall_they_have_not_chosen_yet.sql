-- ============================================================================
--  0058 — the halls they have not chosen yet
-- ============================================================================
--  Choosing a venue is the largest single decision on a wedding and the one
--  made with the worst information. A couple tours four halls over six weeks,
--  each hands them a number, and the numbers are not comparable: one quotes a
--  plate before VAT and charges the bar per head, the next quotes a plate
--  after VAT with the bar as a flat fee, and a third leaves out sound and
--  lighting entirely because "that is with your DJ". They pick the one whose
--  plate price sounded lowest and find the rest out in March.
--
--  So this holds each quote broken into the parts that differ, and the screen
--  does the arithmetic that makes them one number. Nothing here is a rate card
--  or a benchmark against other events — it is this couple's four quotes,
--  which is the only comparison that is ever true.
--
--  The guest count is deliberately NOT here. It is `clients.guest_estimate`,
--  the number the bar calculator and the budget already work from, because a
--  second copy of "how many people are coming" is a number that quietly
--  disagrees with the first one. Moving it on this screen moves it everywhere,
--  which is the point.
-- ============================================================================

do $$ begin create type venue_bar_kind as enum ('flat', 'per_person');
  exception when duplicate_object then null; end $$;

create table if not exists public.venue_comparisons (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,

  venue_name  text not null,
  location    text not null default '',
  contact     text not null default '',
  phone       text not null default '',
  toured_on   date,
  notes       text not null default '',

  /* Per guest. `is_vat_included` is not decoration: half the halls in this
     country quote before it and half after, and the difference is eighteen
     per cent of the largest line on the evening. The screen normalises to one
     of the two so the columns can be read against each other. */
  plate_price      numeric(12,2) not null default 0 check (plate_price >= 0),
  is_vat_included  boolean not null default false,

  bar_cost    numeric(12,2) not null default 0 check (bar_cost >= 0),
  bar_type    venue_bar_kind not null default 'flat',

  sound_lighting_cost numeric(12,2) not null default 0 check (sound_lighting_cost >= 0),
  /* Cleaning, security, air conditioning, a screen, the chuppah, an hour past
     midnight. One number because a couple comparing halls needs the sum;
     what it is made of belongs in `notes`, where they wrote it down. */
  ancillary_fees      numeric(12,2) not null default 0 check (ancillary_fees >= 0),

  /* Either a percentage of the food or a flat sum, never both. Producers in
     this market quote it both ways and a single numeric column would have
     silently meant one of them. */
  service_percent numeric(5,2) not null default 0 check (service_percent >= 0 and service_percent <= 100),
  service_flat    numeric(12,2) not null default 0 check (service_flat >= 0),

  /* The buffer this couple decided on, kept per venue because they change it
     while looking at one and expect it to still be there tomorrow. */
  contingency_percent numeric(5,2) not null default 10
    check (contingency_percent >= 0 and contingency_percent <= 100),

  /* A list of keys from a fixed set, so the labels can be written once in
     each language rather than typed into the database in one of them. */
  pros_cons   jsonb not null default '[]'::jsonb,

  /* The hall's own quote, in the private bucket like every other document. */
  quote_path  text not null default '',

  is_selected boolean not null default false,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

do $$ begin
  alter table public.venue_comparisons add constraint venue_name_len check (char_length(venue_name) between 1 and 120);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.venue_comparisons add constraint venue_notes_len check (char_length(notes) <= 2000);
exception when duplicate_object then null; end $$;

create index if not exists venue_comparisons_client_idx on public.venue_comparisons(client_id, sort, created_at);

/* One chosen hall, or none. Enforced here rather than in the action that
   clears the others, because "clear the rest then set this one" is two writes
   and the gap between them is where a second row survives. */
create unique index if not exists venue_comparisons_one_selected
  on public.venue_comparisons(client_id) where is_selected;

alter table public.venue_comparisons enable row level security;
drop policy if exists venue_comparisons_all on public.venue_comparisons;
create policy venue_comparisons_all on public.venue_comparisons for all
  using      (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

comment on table public.venue_comparisons is
  'One hall a couple toured, with its quote broken into the parts that differ '
  'between halls. Both sides own it: the producer knows what the ancillary '
  'fees usually hide, the couple knows which one their mother liked.';


-- ── choosing one ────────────────────────────────────────────────────────────
--  A single call, because the three things it does have to happen together or
--  not at all: the event gets its venue, the chosen row is marked and the
--  others unmarked, and the hall's own total lands in the budget as the line
--  everything else is planned around.
--
--  The total is computed here rather than passed in. A number the browser
--  sends is a number a browser can choose, and this one becomes the financial
--  baseline of somebody's wedding.
create or replace function public.choose_venue(p_venue uuid, p_guests int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v          public.venue_comparisons%rowtype;
  guests     int;
  food       numeric(14,2);
  bar        numeric(14,2);
  service    numeric(14,2);
  total      numeric(14,2);
begin
  select * into v from public.venue_comparisons where id = p_venue;
  if not found then
    raise exception 'no such venue';
  end if;

  /* The policy is the authority here too. A security definer function that
     forgets to ask is a function that lets anybody edit anybody's wedding. */
  if not public.can_read_client(v.client_id) then
    raise exception 'not yours';
  end if;

  guests := greatest(coalesce(nullif(p_guests, 0),
                              (select guest_estimate from public.clients where id = v.client_id),
                              0), 0);

  food    := v.plate_price * guests;
  bar     := case when v.bar_type = 'per_person' then v.bar_cost * guests else v.bar_cost end;
  service := v.service_flat + (food * v.service_percent / 100);
  total   := food + bar + v.sound_lighting_cost + v.ancillary_fees + service;

  update public.venue_comparisons set is_selected = false
   where client_id = v.client_id and is_selected;
  update public.venue_comparisons set is_selected = true where id = v.id;

  update public.clients
     set venue = v.venue_name,
         guest_estimate = case when guests > 0 then guests else guest_estimate end
   where id = v.client_id;

  /* The baseline, as one budget line rather than five. A couple reading their
     budget wants to see what the hall costs; the breakdown is on the screen
     they chose it from, and duplicating it here is two places to keep true. */
  delete from public.budget_items
   where client_id = v.client_id and category = 'אולם' and label = v.venue_name;

  insert into public.budget_items (client_id, category, label, estimate, agreed, vendor, notes)
  values (v.client_id, 'אולם', v.venue_name, total, total, v.venue_name,
          'נבחר מתוך השוואת האולמות. ' || guests || ' מוזמנים.');
end $$;

comment on function public.choose_venue(uuid, int) is
  'Marks one hall as chosen and writes its total into the budget as the '
  'baseline. The total is computed here because a number the browser sends '
  'is a number a browser can choose, and this one is the financial floor of '
  'somebody''s wedding.';

revoke all on function public.choose_venue(uuid, int) from public;
grant execute on function public.choose_venue(uuid, int) to authenticated;
