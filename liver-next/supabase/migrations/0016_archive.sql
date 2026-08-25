-- ============================================================================
--  0016 — an event that is over stops competing for attention
-- ============================================================================
--  Every screen so far treats the twelve events a producer has ever run and
--  the three they are actually working on as the same list. That gets worse
--  every season, and it gets worse fastest for the person doing well.
--
--  Archiving is deliberately not deletion. A wedding that happened is the
--  record of what was agreed, what was paid and who came, and it is wanted
--  years later — for a reference, a dispute, or the next couple asking what a
--  similar evening cost. So the row stays, its guests and payments stay, and
--  one timestamp says it is no longer live work.
--
--  Nullable rather than a boolean, because "when did we close this" is a
--  question that gets asked and a boolean cannot answer it.
-- ============================================================================

alter table public.clients
  add column if not exists archived_at timestamptz;

comment on column public.clients.archived_at is
  'When the producer closed the event. Null means live work. Never set automatically: a date passing is a prompt to close, not the closing itself.';

/* The board reads live events on every load and archived ones rarely, so the
   index covers the common half. Partial, because indexing the archived rows
   would be paying for the query nobody runs. */
create index if not exists clients_live_idx
  on public.clients (producer_id, event_date)
  where archived_at is null;

/* No policy change. clients_write already restricts every write on this table
   to the producer who owns the workspace or the root admin, so archiving is
   covered by the rule that was already there — and a couple cannot archive
   their own event, which is correct: it is the producer's record to close. */
