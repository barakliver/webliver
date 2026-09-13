-- ============================================================================
--  0088 — a check constraint cannot wedge every future release
-- ============================================================================
--  Every release since 2.5 failed, and none of them failed for a reason
--  anybody was looking for. The log said it in one line:
--
--      ERROR:  check constraint "meeting_kind" of relation "meeting_logs"
--              is violated by some row
--      FAIL    the schema could not be levelled. Nothing was deployed.
--
--  sync.sql runs with ON_ERROR_STOP, which is what makes it safe: one bad
--  statement and nothing else is attempted. So the deploy stopped at line
--  8591 of a 10,000 line file, every statement after it went unapplied, and
--  the build was never even reached. The card on /app/admin said exactly
--  that — "נכשל לפני שהגיע לקוד" — and it was right; I read it as a guess
--  rather than as the answer it was.
--
--  The row is older than the constraint. 0068 and 0080 each dropped and
--  re-added `meeting_kind` to widen the list of kinds, and on this database
--  neither add ever succeeded: something in `meeting_logs` carries a kind
--  outside the list, so every attempt since has failed on the same row, and
--  will keep failing every five minutes forever. A levelling file that can
--  be wedged permanently by one row is not a levelling file.
--
--  NOT VALID is the way out, and it is not a shrug. Postgres applies it to
--  everything written from now on and simply does not go back over what is
--  already there — so the rule holds for every future write while the rows
--  that predate it are left exactly as they are, which is the promise this
--  project makes about data. The validation is then attempted separately,
--  and a failure is a notice rather than the end of the run: a healthy
--  database ends with a fully valid constraint, and this one ends with a
--  working deploy and a line naming what still needs looking at.
--
--  Nothing here touches a row.
-- ============================================================================

alter table public.meeting_logs drop constraint if exists meeting_kind;
alter table public.meeting_logs add constraint meeting_kind
  check (kind in ('production', 'tasting', 'venue', 'design', 'intro', 'custom', 'note', 'other'))
  not valid;

/* Try to make it a full constraint, and say so when the rows will not have
   it. Inside a block because an exception caught here costs a notice, and
   the same exception raised at the top level costs every statement below it
   in a ten thousand line file. */
do $$
declare
  stray int;
begin
  alter table public.meeting_logs validate constraint meeting_kind;
  raise notice 'meeting_kind is valid over every row.';
exception when check_violation then
  select count(*) into stray from public.meeting_logs
   where kind is null
      or kind not in ('production', 'tasting', 'venue', 'design', 'intro', 'custom', 'note', 'other');
  raise notice 'meeting_kind now applies to new rows. % existing row(s) carry a kind outside the list and were left as they are; nothing was changed.', stray;
end $$;

comment on constraint meeting_kind on public.meeting_logs is
  'Which questions a log answered. Added NOT VALID and validated separately: '
  'a row older than the constraint must never be able to stop a release.';
