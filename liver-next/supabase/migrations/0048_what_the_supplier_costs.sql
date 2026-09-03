-- ============================================================================
--  0048 — what the supplier costs
-- ============================================================================
--  The directory held who a supplier is and how to reach them, and nothing
--  about money. The spreadsheet every producer already keeps holds exactly
--  two more columns: the price agreed and the deposit already paid. Importing
--  that sheet without those two would drop the half the producer opens it for.
--
--  On the directory rather than the event, because that is where the sheet
--  keeps them: the florist's usual price, the retainer she asks for. An
--  event's own figures stay in budget_items, where they always were.
-- ============================================================================

alter table public.vendors add column if not exists agreed_price numeric(12,2);
alter table public.vendors add column if not exists deposit_paid numeric(12,2);

do $$ begin
  alter table public.vendors add constraint vendors_money_sane
    check (
      (agreed_price is null or agreed_price >= 0)
      and (deposit_paid is null or deposit_paid >= 0)
    );
exception when duplicate_object then null; end $$;

comment on column public.vendors.agreed_price is
  'The usual agreed price, in shekels. Null when it was never written down.';
comment on column public.vendors.deposit_paid is
  'The deposit already paid against that price, in shekels.';
