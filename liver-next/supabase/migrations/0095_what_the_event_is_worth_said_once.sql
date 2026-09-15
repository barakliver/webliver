-- ============================================================================
--  0095 — what the event is worth, said once
-- ============================================================================
--  The producer's margin is billed minus costs, and `billed` has always been
--  read off the couple's payment schedule: every milestone on the event, paid
--  or not. That is the right answer when the schedule exists, and it is a
--  perfectly wrong answer when it does not — which is most events for most of
--  their life, because the figure is agreed on a phone call months before
--  anybody sits down to break it into payments.
--
--  So the board reads ₪0 income, ₪0 margin, on an evening with three people
--  working it. Not a fault in the arithmetic. Nothing to add up.
--
--  `producer_fee` is that figure typed once: what this event is worth to the
--  business. When it is set it IS billed, everywhere — the season board and
--  the money tab both read `ledgerOf`, and `ledgerOf` prefers it over the
--  schedule. That is the whole design and the reason it is one column rather
--  than a second screen with its own number: money has one home in this
--  product, and two places that each answer "what is this event worth"
--  disagree within a week and then disagree in front of a client.
--
--  Null is a real value and is the default. Nothing set means the schedule
--  answers, exactly as it did before this file.
--
--  Producer-only, like every other figure of its kind: `clients` is already
--  fenced, and the couple's own screens read their payments, never this.
--
--  Nothing here touches a row.
-- ============================================================================

alter table public.clients
  add column if not exists producer_fee numeric(12,2);

alter table public.clients drop constraint if exists clients_producer_fee;
alter table public.clients add constraint clients_producer_fee
  check (producer_fee is null or producer_fee >= 0) not valid;

do $$
begin
  alter table public.clients validate constraint clients_producer_fee;
exception when check_violation then
  raise notice 'clients.producer_fee applies to new rows; some existing rows are outside the rule.';
end $$;

comment on column public.clients.producer_fee is
  'What this event is worth to the producer, typed once. When set it is the billed figure '
  'everywhere, because ledgerOf prefers it over the payment schedule; null means the schedule '
  'answers as it always did. Producer-only: the couple''s screens read their payments.';
