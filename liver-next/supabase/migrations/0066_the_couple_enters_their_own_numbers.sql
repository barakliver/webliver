-- ============================================================================
--  0066 — the couple enters their own numbers
-- ============================================================================
--  The budget and the payments were the producer's, shown to the couple only
--  when the producer chose to, and never theirs to write. That was the right
--  default for a producer keeping a client at arm's length from the money.
--  It is the wrong default for this business, where the couple is the one
--  who knows what the hall quoted and what the deposit was, and a screen they
--  can look at but not type into sends the number back to WhatsApp.
--
--  Two changes, both additive:
--
--    1. The budget is visible to the couple unless the producer hides it,
--       rather than hidden unless the producer shows it. Existing rows are
--       switched on too. That is a backfill over a column somebody could have
--       set on purpose — so it is said plainly: every one of those rows is
--       false because false was the default, not because anybody decided; the
--       switch is still there in the console, and a producer who wants the
--       numbers back out of sight presses it once.
--
--    2. The couple may write. budget_write and payments_write were
--       owns_producer only; they follow can_read_client now, which is the
--       producer or the invited couple and nobody else. Reads are unchanged,
--       still gated on budget_visible for the couple.
-- ============================================================================

-- ── 1. visible unless hidden ────────────────────────────────────────────────
alter table public.clients alter column budget_visible set default true;

update public.clients set budget_visible = true where budget_visible = false;

-- ── 2. the couple may write ─────────────────────────────────────────────────
drop policy if exists budget_write on public.budget_items;
create policy budget_write on public.budget_items for all
  using      (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments for all
  using      (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

comment on column public.clients.budget_visible is
  'Whether the couple sees the budget and the payments. On by default since '
  '0066: the couple is the one entering these numbers. The producer''s switch '
  'in the console hides them again for one event.';
