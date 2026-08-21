-- ============================================================================
--  0017 — the run sheet, and who each line is for
-- ============================================================================
--  On the day, four different people need the same schedule and none of them
--  need all of it. The photographer needs to know when the couple gets ready
--  and when the light goes; the venue needs load-in, service and last call;
--  the couple needs where to stand and when. Handing all three the same
--  forty-line document means each of them reading past everything that is not
--  theirs, at the one moment nobody has time to read.
--
--  So a line can say who it is for. The default is everybody, because most
--  lines genuinely are, and because a field that must be filled in before a
--  schedule works is a field that will be left empty in a hurry.
--
--  A text array rather than columns per role: the roles will grow — a band, a
--  rabbi, a bus company — and adding one should not be a schema change. The
--  check constraint keeps that honest, so a typo cannot invent a silent role
--  whose lines then appear on nobody's sheet.
-- ============================================================================

alter table public.day_schedule
  add column if not exists audience text[] not null default '{}';

do $$ begin
  alter table public.day_schedule
    add constraint day_audience_known
    check (audience <@ array['couple','photo','vendors','crew']::text[]);
exception when duplicate_object then null; end $$;

comment on column public.day_schedule.audience is
  'Who this line is for. Empty means everyone, which is the common case and the default.';

/* Nothing changes about who may read or write the row: day_schedule_all
   already scopes every operation to the people on the workspace. A couple can
   still write their own run sheet, which is the point of it being shared. */
