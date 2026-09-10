-- ============================================================================
--  0075 — every supplier relationship has a status
-- ============================================================================
--  A supplier on an event was a name, a category, a phone and "booked". What
--  the last two months before a wedding actually turn on is the rest: was
--  the contract signed, was the deposit paid, when is the balance due, when
--  did we last speak, and whose turn is it. Those lived in the producer's
--  head and in WhatsApp, which is where a balance due on Thursday gets
--  discovered on Friday.
--
--  Six columns on the row the screens already read, all nullable or
--  defaulted, so a supplier booked last year is untouched and simply has
--  nothing to say yet. Money the couple owes the producer stays in
--  payments; this is what the event owes the supplier.
--
--  And one date on the event for the Monday letter, so a sweep that runs
--  twice in a week writes once.
-- ============================================================================

alter table public.event_vendors
  add column if not exists deposit         numeric(12,2),
  add column if not exists deposit_paid_on date,
  add column if not exists balance_due_on  date,
  add column if not exists last_contact_on date,
  add column if not exists waiting_on      text,
  add column if not exists next_action     text not null default '';

do $$ begin
  alter table public.event_vendors add constraint event_vendors_waiting_on
    check (waiting_on is null or waiting_on in ('me', 'them'));
  alter table public.event_vendors add constraint event_vendors_deposit_nonneg
    check (deposit is null or deposit >= 0);
  alter table public.event_vendors add constraint event_vendors_next_action_len
    check (char_length(next_action) <= 200);
exception when duplicate_object then null; end $$;

comment on column public.event_vendors.waiting_on is
  'Whose turn it is: me (the producer owes a reply) or them (the supplier does). Null when nothing is open.';

alter table public.clients
  add column if not exists vendor_digest_on date;

comment on column public.clients.vendor_digest_on is
  'The last Monday the supplier letter went out for this event.';
