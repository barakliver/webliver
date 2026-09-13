-- ============================================================================
--  0087 — the producer keeps a list of his own
-- ============================================================================
--  Every task in this product belonged to a wedding. That is right for "chase
--  the florist's contract" and wrong for the half of the work that is not
--  anybody's wedding: file the VAT, renew the insurance, call the lighting
--  company back, empty the van. Those were being kept on paper and in the
--  phone's own reminders, which is the same drift the diary was built to stop
--  — a second list that the screen he actually opens knows nothing about.
--
--  One table, scoped to the producer and not to a client. Two things about it
--  are worth writing down.
--
--  The first is `repeat_every`. He asked for the things he has to do
--  "באופן שוטף" — routinely — and a routine written as a one-off task is a
--  task somebody retypes every month until they stop. A repeating row is
--  never finished: ticking it writes the day it was done and moves `due_on`
--  forward to the next occurrence. So there is one row per routine for its
--  whole life, and `done_on` is the answer to "when did I last do this",
--  which is the question a routine actually raises.
--
--  The second is that `due_on` is nullable on purpose. A standing intention
--  with no date is a real thing on a list like this, and forcing a date onto
--  it produces either a lie or an item that is permanently overdue.
--
--  Nothing here touches a row.
-- ============================================================================

create table if not exists public.producer_tasks (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  title       text not null,
  /* A line of context. The same size the wedding tasks got in 0086. */
  note        text not null default '',
  /* When it is next due. Null is a standing intention with no date. */
  due_on      date,
  /* How often it comes back. 'none' is a one-off, and is the normal case. */
  repeat_every text not null default 'none',
  /* A one-off that is finished. A repeating task is never finished: ticking
     it moves due_on forward instead, so this stays false for its whole life. */
  done        boolean not null default false,
  /* The day it was last ticked, for either kind. On a routine this is the
     only record that it happened at all. */
  done_on     date,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint producer_tasks_title  check (char_length(btrim(title)) between 1 and 200),
  constraint producer_tasks_note   check (char_length(note) <= 1000),
  constraint producer_tasks_repeat check (repeat_every in ('none', 'daily', 'weekly', 'monthly'))
);

alter table public.producer_tasks enable row level security;

/* His own and nobody else's, by the same helper every other producer-scoped
   table uses. A list of what somebody has not done yet is about as private as
   this product gets. */
drop policy if exists producer_tasks_own on public.producer_tasks;
create policy producer_tasks_own on public.producer_tasks for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id) and public.is_approved_producer());

grant select, insert, update, delete on public.producer_tasks to authenticated;

/* The open ones in date order is the only read this table gets. */
create index if not exists producer_tasks_open_idx
  on public.producer_tasks (producer_id, done, due_on);

drop trigger if exists producer_tasks_touch on public.producer_tasks;
create trigger producer_tasks_touch before update on public.producer_tasks
  for each row execute function public.touch_updated_at();

comment on table public.producer_tasks is
  'The producer''s own to-do list: work that belongs to the business rather than to any one wedding. A row with repeat_every other than none is a routine and is never done — ticking it moves due_on to the next occurrence.';
comment on column public.producer_tasks.repeat_every is
  'none | daily | weekly | monthly. Anything but none makes the row a routine that comes back.';
comment on column public.producer_tasks.done_on is
  'The day it was last ticked. On a routine it is the only record that it happened.';
