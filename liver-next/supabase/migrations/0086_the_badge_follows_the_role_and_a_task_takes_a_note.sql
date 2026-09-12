-- ── the producer's badge follows the role, not a leftover row ───────────────
--  A couple's post in the circle was arriving stamped "a producer's answer".
--  The stamp was earned by the existence of a producers row for the author,
--  and a couple who signed up, was guessed to be a producer, and was then
--  decided a couple in the console keeps that row: rejected, never approved,
--  and never theirs. The role on the profile is the decision the console
--  made; the row is the residue of the guess. The stamp now reads the role.

create or replace function public.forum_stamp_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.is_producer := exists (
    select 1 from public.profiles p
    where p.id = new.author_id
      and p.role in ('producer', 'super_admin')
  );
  return new;
end $$;

-- The rows already stamped wrong, restamped by the same rule. Only the flag
-- moves; no post and no reply is touched otherwise.
update public.forum_posts fp
   set is_producer = exists (
     select 1 from public.profiles p
     where p.id = fp.author_id and p.role in ('producer', 'super_admin'))
 where fp.is_producer <> exists (
     select 1 from public.profiles p
     where p.id = fp.author_id and p.role in ('producer', 'super_admin'));

update public.forum_comments fc
   set is_producer = exists (
     select 1 from public.profiles p
     where p.id = fc.author_id and p.role in ('producer', 'super_admin'))
 where fc.is_producer <> exists (
     select 1 from public.profiles p
     where p.id = fc.author_id and p.role in ('producer', 'super_admin'));

-- ── a task can carry a note ─────────────────────────────────────────────────
--  Editing a task after it was written: the title, the date, whose it is,
--  and a line of context that had nowhere to go before.
alter table public.tasks add column if not exists notes text not null default '';
alter table public.tasks drop constraint if exists tasks_notes_len;
alter table public.tasks add constraint tasks_notes_len check (char_length(notes) <= 1000);

comment on column public.tasks.notes is 'A line of context for the task, written by whoever edits it. Empty is the normal case.';
