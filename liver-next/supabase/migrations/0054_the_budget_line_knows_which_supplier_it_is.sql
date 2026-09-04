-- ============================================================================
--  0054 — a budget line knows which supplier it is
-- ============================================================================
--  Money about one supplier is written down in two places that have never been
--  connected. `event_vendors` holds who they are, how to reach them and when
--  they arrive, and no money at all. `budget_items` holds the money, and names
--  the supplier as `vendor text` — a string somebody typed.
--
--  So the two questions a producer asks about a caterer are answerable from
--  different tables and cannot be joined: "when does the caterer arrive" from
--  one, "what am I paying the caterer" from the other, with nothing but an
--  exactly-matching spelling holding them together. Rename the supplier, or
--  type "צלם" on one screen and "צלם סטילס" on the other, and the connection
--  that was never really there stops appearing to be there.
--
--  One nullable column fixes it. Nullable because it must be: plenty of budget
--  lines are not a supplier at all — a venue deposit, a licence, a contingency
--  — and forcing every line to point at a vendor row would be the change that
--  makes somebody keep the real numbers in a spreadsheet again.
--
--  The `vendor` text column stays exactly where it is and keeps working. It is
--  what a line says when it is not one of the suppliers on this event, and it
--  is what every existing row still has. Nothing is migrated away from.
-- ============================================================================

alter table public.budget_items
  add column if not exists vendor_id uuid;

do $$ begin
  alter table public.budget_items
    add constraint budget_items_vendor_fk foreign key (vendor_id)
    references public.event_vendors(id) on delete set null;
exception when duplicate_object then null; end $$;

/* Summing an event's lines per supplier, which is the query this exists for. */
create index if not exists budget_items_vendor_idx
  on public.budget_items(vendor_id) where vendor_id is not null;

comment on column public.budget_items.vendor_id is
  'The supplier on this event that this line is money for, when it is one. '
  'Null for a line that is not a supplier at all — a deposit, a licence, a '
  'contingency — which is a real and common kind of line rather than missing '
  'data. The `vendor` text column beside it stays the label for those.';

-- ── joining up what is already there ────────────────────────────────────────
-- A one-off, and deliberately timid: it fills only lines that have no vendor_id
-- yet, whose typed name matches exactly one supplier on the same event, once
-- whitespace and case are taken out of it. An ambiguous match is left alone.
--
-- Guessing harder would be worse than leaving it. A budget line pointed at the
-- wrong supplier is a number attributed to somebody who is not owed it, and
-- unlike an unlinked line, nothing about it looks wrong on the screen.
update public.budget_items b
   set vendor_id = v.id
  from public.event_vendors v
 where b.vendor_id is null
   and btrim(b.vendor) <> ''
   and v.client_id = b.client_id
   and lower(btrim(v.name)) = lower(btrim(b.vendor))
   and (
     select count(*) from public.event_vendors v2
      where v2.client_id = b.client_id
        and lower(btrim(v2.name)) = lower(btrim(b.vendor))
   ) = 1;
