-- ============================================================================
--  0051 — the producer's own words, and their own colours
-- ============================================================================
--  Two lists that were the platform's and should have been the producer's.
--
--  The first is how an enquiry arrived. The list was six values in the code:
--  phone, whatsapp, instagram, facebook, referral, walk in. A producer whose
--  work comes from TikTok, or from one designer who sends them four weddings
--  a year, had nowhere to put that — and the funnel report then measured the
--  channels we guessed rather than the ones they use.
--
--  The second is colour. A diary of thirty events in one accent is a diary
--  nobody scans; every producer already colours their own paper one, and
--  every one of them colours it differently.
--
--  One table for both, because they are the same shape: a producer's own
--  label, with an order and a colour, in a named taxonomy. `kind` is what
--  separates them, and adding a third taxonomy later is a value rather than
--  a migration.
-- ============================================================================

create table if not exists public.producer_labels (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  kind        text not null,
  label       text not null,
  /* A hex value, because the producer picks one. The screen offers a measured
     palette rather than a free wheel, for the reason the accent does; this
     column holds whatever was picked and the shape is all the database can
     honestly enforce. */
  color       text not null default '#64748B',
  sort_order  int  not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint producer_labels_kind  check (kind in ('event_tag', 'lead_channel')),
  constraint producer_labels_label check (char_length(btrim(label)) between 1 and 40),
  constraint producer_labels_color check (color ~* '^#[0-9a-f]{6}$')
);

/* One label once per taxonomy. Two rows called "טעימות" is two colours for
   one thing, and the diary then means nothing. Case folded, because nobody
   types their own label the same way twice. */
create unique index if not exists producer_labels_unique
  on public.producer_labels (producer_id, kind, lower(btrim(label)));
create index if not exists producer_labels_list
  on public.producer_labels (producer_id, kind, sort_order);

alter table public.producer_labels enable row level security;

drop policy if exists producer_labels_all on public.producer_labels;
create policy producer_labels_all on public.producer_labels for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));

grant all on public.producer_labels to authenticated, service_role;

comment on table public.producer_labels is
  'A producer''s own taxonomies: the colours their diary is read by, and the '
  'channels their enquiries arrive through. Never shared between producers.';


-- ── the colour on an event ──────────────────────────────────────────────────
--  Null is the ordinary case and stays the accent. A label that is deleted
--  takes its colour off the events rather than the events with it.
alter table public.clients add column if not exists label_id uuid
  references public.producer_labels(id) on delete set null;

create index if not exists clients_label_idx on public.clients (label_id)
  where label_id is not null;


-- ── a first set, so the toolbar is not empty on the first visit ─────────────
--  Four colours every producer's paper diary already has, in the words they
--  use for them. Seeded once per producer and never again: a producer who
--  deletes "טעימות" because they do not do tastings must not find it back
--  next deploy, so the insert is skipped where the producer has any tag at
--  all rather than where this particular one is missing.
do $$
declare pr record;
begin
  for pr in select id from public.producers loop
    if not exists (
      select 1 from public.producer_labels
       where producer_id = pr.id and kind = 'event_tag'
    ) then
      insert into public.producer_labels (producer_id, kind, label, color, sort_order)
      values
        (pr.id, 'event_tag', 'חתונות פעילות',  '#2F6F5E', 1),
        (pr.id, 'event_tag', 'פגישות זוג',     '#7C5CBF', 2),
        (pr.id, 'event_tag', 'טעימות וסיורים', '#C2762B', 3),
        (pr.id, 'event_tag', 'תשלומים דחופים', '#2563EB', 4);
    end if;
  end loop;
end $$;
