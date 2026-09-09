-- ============================================================================
--  0024 — the run sheet as a document somebody works from, not a list
-- ============================================================================
--  Three things were missing, and each of them was the kind of gap that only
--  shows on the day.
--
--  A line could be added and deleted but not corrected. A time typed as 19:00
--  instead of 09:00 had to be deleted and retyped, which on a forty line
--  schedule means the correction is deferred and then forgotten.
--
--  A line had a start and no length. "18:00 קבלת פנים" tells nobody whether
--  the reception is forty minutes or ninety, and the question the producer is
--  actually answering all evening is how long is left, not when it began. The
--  gap to the next line is a guess at this and a bad one: the last line of the
--  night has no next line, and two things can genuinely start at once.
--
--  A line had no owner. On the day, "who is doing this" is asked out loud
--  about every third line, and the answer lives in somebody's memory.
--
--  None of these change who may read or write anything: day_schedule_all
--  already scopes every operation to the people on the workspace.
-- ============================================================================

alter table public.day_schedule add column if not exists duration_min integer;
alter table public.day_schedule add column if not exists owner text not null default '';

comment on column public.day_schedule.duration_min is
  'How long this runs, in minutes. Null means nobody said, which is honest and '
  'common; the sheet then shows the gap to whatever is next instead of inventing one.';
comment on column public.day_schedule.owner is
  'Who is responsible for this line. A free text name, because on the day it is '
  'as often "אבא של הכלה" as it is a supplier with a row in a table.';

do $$ begin
  alter table public.day_schedule
    add constraint day_duration_sane
    /* Sixteen hours. Long enough for a load-in that starts the night before,
       short enough that a mistyped 6000 is caught while somebody is looking
       at the form rather than on the printed sheet. */
    check (duration_min is null or (duration_min > 0 and duration_min <= 960));
exception when duplicate_object then null; end $$;

/* The sheet is read in time order all evening, and every read of it sorts. */
create index if not exists day_schedule_time_idx
  on public.day_schedule (client_id, at_time);


-- ── a starting point instead of a blank page ────────────────────────────────
--  A schedule that starts empty gets written the week of the wedding, at
--  night, from memory. Starting from a standard evening and deleting what does
--  not apply is a different job: it takes ten minutes, and the lines nobody
--  remembers until they are missing are already on it.
--
--  The template itself lives in the app rather than here, because it is
--  wording that will be argued over and improved, and wording does not belong
--  in a migration. What belongs here is the guarantee that applying one cannot
--  quietly destroy a schedule somebody already wrote.
create or replace function public.day_schedule_is_empty(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_read_client(p_client)
     and not exists (select 1 from public.day_schedule where client_id = p_client)
$$;

grant execute on function public.day_schedule_is_empty(uuid) to authenticated, service_role;
