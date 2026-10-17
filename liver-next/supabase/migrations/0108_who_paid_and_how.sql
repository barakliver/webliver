-- ============================================================================
--  0108 — who paid an instalment, and how
-- ============================================================================
--  A payment carried what it was for, how much, when it was due, and whether
--  and on what day it was paid. It could not say who of the two paid it, or
--  through what, and those are the two questions a producer is asked on the
--  phone when a couple is working out what the wedding costs month by month:
--  how much went out before the evening, from whose account, by what, and how
--  much is still to go after it.
--
--  Two columns, both text and both empty by default, so every existing row
--  reads as "not said" rather than as something it never was. `paid_by` is
--  free text on purpose: it holds one of the couple's own names, or the word
--  for joint, and a name changes (a couple's display name is typed by hand),
--  so a closed set would refuse the row the day somebody corrected a spelling.
--  `method` is a closed set because the cash-flow screen groups by it.
--
--  The constraint is written not valid, for the reason every one since 0068 is:
--  sync.sql replays this file on every deploy.
--
--  Nothing here touches a row.
-- ============================================================================

alter table public.payments
  add column if not exists paid_by text not null default '',
  add column if not exists method  text not null default '';

alter table public.payments drop constraint if exists payments_method_known;
alter table public.payments add constraint payments_method_known
  check (method in ('', 'transfer', 'card', 'cash', 'check', 'app', 'other')) not valid;

alter table public.payments drop constraint if exists payments_paid_by_len;
alter table public.payments add constraint payments_paid_by_len
  check (char_length(paid_by) <= 60) not valid;

comment on column public.payments.paid_by is
  'Who of the couple paid this instalment: one of their names as typed, or the word for joint. Empty means not said.';
comment on column public.payments.method is
  'How it was paid: transfer, card, cash, check, app (Bit, PayBox) or other. Empty means not said.';
