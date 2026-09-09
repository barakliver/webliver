-- ============================================================================
--  0069 — the supplier lands in the event file
-- ============================================================================
--  0062 gave the checklist a form: tick "בחר DJ" and it asks who was hired
--  and for how much. What it wrote went into vendor_choices, a table that
--  nothing on the event file reads. The suppliers tab, the run sheet, the
--  day-of console, the production book, the numbers sheet and the copilot
--  all read event_vendors — so a DJ captured through the form was saved and
--  never seen again, which from the chair is the same as not saved.
--
--  Three things put that right:
--
--  1. A task remembers which event_vendors row it produced, so ticking the
--     same task twice edits one supplier rather than adding a second.
--  2. The couple may read and write the suppliers on their own event. They
--     are the ones hiring the DJ; a form they can fill in that lands in a
--     table they cannot read is a form that lies to them. The producer's
--     private money stays where it always was, in the budget and the crew.
--  3. Whatever the form captured since 0062 is copied across, once, into the
--     table the screens read. vendor_choices is left standing with its rows:
--     a version update never destroys data, and nothing writes there any
--     more.
-- ============================================================================

-- ── 1. the task keeps a pointer to what it produced ─────────────────────────
alter table public.tasks
  add column if not exists event_vendor_id uuid references public.event_vendors(id) on delete set null;

create index if not exists tasks_event_vendor_idx
  on public.tasks (event_vendor_id) where event_vendor_id is not null;

comment on column public.tasks.event_vendor_id is
  'The supplier this task captured when it was ticked, if it was a supplier '
  'task. Points at event_vendors, the table every screen reads.';

-- ── 2. the couple reads and writes their own suppliers ──────────────────────
--  can_read_client is the producer or an invited couple, the same line every
--  other panel on the couple's screen is behind.
drop policy if exists event_vendors_all on public.event_vendors;
create policy event_vendors_all on public.event_vendors for all
  using      (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

-- ── 3. what the form captured since 0062, copied across once ────────────────
--  The form's categories were the checklist's own ('dj', 'photography'); the
--  event file's are the production ones ('music', 'photo'). Mapped here the
--  same way the application maps them. Guarded so a second run of this file
--  adds nothing, and so a supplier the producer had already typed in by hand
--  under the same name is not doubled.
insert into public.event_vendors (client_id, name, category, phone, status, notes)
select
  e.client_id,
  v.name,
  case v.category
    when 'venue'       then 'venue'
    when 'catering'    then 'catering'
    when 'bar'         then 'catering'
    when 'photography' then 'photo'
    when 'video'       then 'photo'
    when 'magnets'     then 'photo'
    when 'photobooth'  then 'photo'
    when 'dj'          then 'music'
    when 'sound'       then 'light'
    when 'lighting'    then 'light'
    when 'decor'       then 'floral'
    when 'flowers'     then 'floral'
    when 'transport'   then 'transport'
    else 'other'
  end,
  v.phone,
  'booked',
  left(concat_ws(E'\n',
    nullif(concat_ws(': ', 'איש קשר', nullif(v.contact_name, '')), 'איש קשר'),
    nullif(concat_ws(': ', 'אימייל', nullif(v.email, '')), 'אימייל'),
    nullif(concat_ws(': ', 'מיקום', nullif(v.location, '')), 'מיקום'),
    nullif(v.notes, '')
  ), 500)
from public.vendor_choices v
join public.events e on e.id = v.event_id
where not exists (
  select 1 from public.event_vendors x
   where x.client_id = e.client_id and x.name = v.name
);

--  And the tasks that produced them point at the copies.
update public.tasks t
   set event_vendor_id = x.id
  from public.vendor_choices v
  join public.events e on e.id = v.event_id
  join public.event_vendors x on x.client_id = e.client_id and x.name = v.name
 where t.id = v.task_id
   and t.event_vendor_id is null;

comment on table public.vendor_choices is
  'Superseded by event_vendors in 0069. Kept with its rows because a release '
  'never destroys data; nothing writes here any more.';
