-- ============================================================================
--  0074 — the producer's own pocket
-- ============================================================================
--  The money screens are per event: the couple's payments, the suppliers'
--  lines, the crew's fees. What had no home was the producer's own small
--  money that happens between and around events: a hundred shekels of tip
--  on the night, a deposit a couple paid before their file was opened, a
--  parking receipt, a referral fee. It went into WhatsApp notes to self,
--  which is where money goes to be forgotten.
--
--  One table, one row per entry, tied to an event when there is one and to
--  the producer always. It records; it does not invoice. A receipt is still
--  a receipt, issued elsewhere, and the screen says so.
-- ============================================================================

create table if not exists public.producer_ledger (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  /* Null for money that belongs to no file yet: "closed 5000 with Dana and
     Yoav" the week before their event is opened. */
  client_id   uuid references public.clients(id) on delete set null,
  kind        text not null,
  amount      numeric(12,2) not null,
  label       text not null,
  /* Who it was with, when there is no file to point at. */
  party       text not null default '',
  note        text not null default '',
  on_date     date not null default (now() at time zone 'Asia/Jerusalem')::date,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint producer_ledger_kind   check (kind in ('income', 'expense')),
  constraint producer_ledger_amount check (amount > 0),
  constraint producer_ledger_label  check (char_length(btrim(label)) between 1 and 120),
  constraint producer_ledger_party  check (char_length(party) <= 120),
  constraint producer_ledger_note   check (char_length(note) <= 500)
);

alter table public.producer_ledger enable row level security;

/* The producer's own, and nobody else's: not the couple, not the root. */
drop policy if exists producer_ledger_own on public.producer_ledger;
create policy producer_ledger_own on public.producer_ledger for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id) and public.is_approved_producer());

grant select, insert, update, delete on public.producer_ledger to authenticated;

create index if not exists producer_ledger_producer_idx on public.producer_ledger (producer_id, on_date desc);
create index if not exists producer_ledger_client_idx on public.producer_ledger (client_id) where client_id is not null;

comment on table public.producer_ledger is
  'The producer''s own income and expenses, entered in a press from any screen. '
  'A record, not an invoice.';
