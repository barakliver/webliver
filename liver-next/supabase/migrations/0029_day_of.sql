-- ============================================================================
--  0029 — the run sheet on the evening itself
-- ============================================================================
--  Everything about the schedule so far assumes somebody is planning it. On
--  the night the same forty lines are a different document: nobody reads it
--  top to bottom, they read the one line that is happening and the one that is
--  next, and the only question asked of it is "did that happen yet".
--
--  There was no way to answer that. A line could be written, corrected and
--  printed, and then on the evening the producer tracked what was done in
--  their head or with a pen on the printout, which is where it stays.
--
--  One column. Not a boolean: the time it was ticked is the thing worth
--  keeping, because "the chuppah started twenty minutes late" is the sentence
--  the next event is planned from, and a boolean throws it away.
--
--  Who may tick it is already decided. day_schedule_all scopes every operation
--  on this table to the people on the workspace, and this column rides on the
--  same row as the title and the time. Nothing here widens that.
-- ============================================================================

alter table public.day_schedule add column if not exists done_at timestamptz;

comment on column public.day_schedule.done_at is
  'When this line actually happened, ticked on the evening. Null means not yet. '
  'A timestamp rather than a flag, so the gap between what was planned and what '
  'happened survives the night and can be read afterwards.';

/* The evening view asks for one workspace ordered by time, over and over, for
   six hours. The planning index already covers it; this one adds the tick so
   the common "what is still open" read does not touch the table. */
create index if not exists day_schedule_open_idx
  on public.day_schedule (client_id, at_time)
  where done_at is null;
