-- 0106  The run of show is built from the answers.
--
--  The day schedule is already the run sheet: rows with a time, a track,
--  an audience and a tick on the evening. What it could not carry was the
--  detail the day is actually run from - which song, from which minute,
--  who walks in with whom - and the one thing a run sheet must never do,
--  which is print a surprise in the version of the person it is for.
--
--  So the row gains a song, the people on it, a place, what it needs, a
--  source saying it was generated from the questionnaire, and `is_secret`
--  with `secret_from`. A secret row is the producer's alone: the couple's
--  policy excludes it, and the printed versions exclude it for every
--  audience but the producer's own. Nothing is renamed and no row moves.
--
--  Two columns are the evening's: `actual_at`, where a line really
--  started once the day slipped, and `note_live`, the line typed on the
--  phone between two things happening.

alter table public.day_schedule
  add column if not exists song_title  text not null default '',
  add column if not exists song_artist text not null default '',
  add column if not exists song_cue    text not null default '',
  add column if not exists people      jsonb not null default '[]'::jsonb,
  add column if not exists location    text not null default '',
  add column if not exists needs       text[] not null default '{}',
  add column if not exists is_secret   boolean not null default false,
  add column if not exists secret_from text[] not null default '{}',
  add column if not exists source      text not null default 'manual',
  add column if not exists actual_at   time,
  add column if not exists note_live   text not null default '';

alter table public.day_schedule drop constraint if exists day_schedule_extra_len;
alter table public.day_schedule add constraint day_schedule_extra_len check (
  char_length(song_title) <= 200 and char_length(song_artist) <= 120 and char_length(song_cue) <= 40
  and char_length(location) <= 120 and char_length(source) <= 60 and char_length(note_live) <= 2000
) not valid;

/* The couple built this with the producer and still does; what they no
   longer see is a row marked secret. One policy rather than two, so the
   producer's branch is written beside the couple's and cannot drift. */
drop policy if exists day_schedule_all on public.day_schedule;
create policy day_schedule_all on public.day_schedule for all
  using (
    public.can_read_client(client_id)
    and (not is_secret or public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin())
  )
  with check (
    public.can_read_client(client_id)
    and (not is_secret or public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin())
  );

-- ── the sheet's version and its lock ──────────────────────────────────────
-- Forty-eight hours before the evening the producer locks the sheet, and
-- a change after that is a new version the suppliers are told about. The
-- number is what a producer says on the phone: "you have version 3".
alter table public.clients
  add column if not exists runsheet_version   int not null default 1,
  add column if not exists runsheet_locked_at timestamptz;

comment on column public.day_schedule.is_secret is
  'A surprise. Never in the couple''s rows and never printed for anybody but the producer.';
comment on column public.day_schedule.source is
  'manual, template, or questionnaire:<key> when the generator wrote the line from an answer.';
