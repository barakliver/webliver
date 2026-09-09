-- ============================================================================
--  0062 — task templates auto-populate events, vendors capture supplier data
-- ============================================================================
--  When a couple creates a new event (e.g., a henna), they need a starter
--  checklist. Each event type comes with expected tasks. Rather than offer a
--  modal picker, tasks are created from a template keyed by the event type.
--
--  When they mark a "choose venue", "hire catering", "book DJ" task done,
--  that done flag should trigger a form: "Which venue? How much? Phone number?"
--  The answers go into a vendors table, which becomes the event summary card
--  and feeds into the budget.
--
--  Vendor table unifies how all suppliers are recorded — one table rather than
--  scattered columns like clients.venue. A vendor belongs to an event and
--  sometimes to a task (the "choose DJ" task stores its link to the DJ row).
-- ============================================================================

-- ── task_templates: one row per (event_type, task) combo ───────────────────
create table if not exists public.task_templates (
  id           uuid primary key default gen_random_uuid(),
  event_type   text not null references public.event_types(key),
  title        text not null,
  description  text not null default '',
  is_vendor_task boolean not null default false,
  vendor_category text,
  -- When is_vendor_task is true, these fields guide the sub-task form:
  ask_name     boolean not null default true,
  ask_cost     boolean not null default true,
  ask_phone    boolean not null default true,
  ask_contact_name boolean not null default false,
  ask_location boolean not null default false,
  ask_notes    boolean not null default false,
  sort_order   int not null default 999,
  created_at   timestamptz not null default now(),
  constraint vendor_task_check check (
    (is_vendor_task = false) or
    (is_vendor_task = true and vendor_category is not null)
  )
);

create index if not exists task_templates_type_idx on public.task_templates(event_type, sort_order);

-- ── populate templates for wedding event type ──────────────────────────────
insert into public.task_templates (event_type, title, description, is_vendor_task, vendor_category, ask_name, ask_cost, ask_phone, ask_notes, sort_order)
values
  ('wedding', 'בחר אולם', 'אולם או גן לחתונה', true, 'venue', true, true, true, true, 10),
  ('wedding', 'בחר קייטרינג', 'מזון ושתייה', true, 'catering', true, true, true, true, 20),
  ('wedding', 'בחר צילום', 'צלם וידאו', true, 'photography', true, true, true, false, 30),
  ('wedding', 'בחר DJ/מוזיקה', 'DJ ומקור קול', true, 'dj', true, true, true, false, 40),
  ('wedding', 'בחר פרחים', 'עיצוב פרחים', true, 'flowers', true, true, true, false, 50),
  ('wedding', 'בחר תחרוזת', 'קישוטים וציוד', true, 'decor', true, true, true, false, 60),
  ('wedding', 'בחר הלבשה', 'שמלה, חליפה, שרות הלבשה', true, 'attire', true, false, true, false, 70),
  ('wedding', 'בחר תעודים', 'הזמנות, חיתוכים וכו', true, 'printing', true, true, false, false, 80),
  ('wedding', 'תיאום אירוע', 'יום האירוע', false, null, false, false, false, false, 90),
  ('wedding', 'ערוך את רשימת האורחים', 'שם וטלפון', false, null, false, false, false, false, 100),
  ('wedding', 'כתב את הביוגרפיה שלך', 'הגידול של זוג', false, null, false, false, false, false, 110)
on conflict do nothing;

-- ── henna event templates
insert into public.task_templates (event_type, title, description, is_vendor_task, vendor_category, ask_name, ask_cost, ask_phone, sort_order)
values
  ('henna', 'בחר מיקום', 'בית או אולם לחינה', true, 'venue', true, true, true, 10),
  ('henna', 'בחר חלנית/קוסמטיקה', 'חלנית או דיוקן', true, 'henna', true, true, true, 20),
  ('henna', 'בחר מוזיקה', 'DJ או רדיו', true, 'dj', true, true, true, 30),
  ('henna', 'בחר קייטרינג', 'אוכל ושתייה', true, 'catering', true, true, true, 40)
on conflict do nothing;

-- ── groom_party templates
insert into public.task_templates (event_type, title, description, is_vendor_task, vendor_category, ask_name, ask_cost, ask_phone, sort_order)
values
  ('groom_party', 'בחר מיקום', 'בר או אולם', true, 'venue', true, true, true, 10),
  ('groom_party', 'בחר מוזיקה', 'DJ או הדברה', true, 'dj', true, true, true, 20),
  ('groom_party', 'בחר קייטרינג', 'אוכל ושתייה', true, 'catering', true, true, true, 30)
on conflict do nothing;

-- ── vendors: the registry of all suppliers and choices ─────────────────────
create table if not exists public.vendors (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  category       text not null,
  -- The decision: what business was hired
  name           text not null,
  contact_name   text not null default '',
  phone          text not null default '',
  email          text not null default '',
  cost           numeric(12,2),
  location       text not null default '',
  notes          text not null default '',
  -- Link to the task that captured it, if any
  task_id        uuid references public.tasks(id) on delete set null,
  status         text not null default 'selected',  -- selected, confirmed, completed
  created_at     timestamptz not null default now(),
  constraint vendors_cost_nonneg check (cost is null or cost >= 0)
);

create index if not exists vendors_event_idx on public.vendors(event_id, category);
create index if not exists vendors_task_idx on public.vendors(task_id);

-- ── RLS for vendors ────────────────────────────────────────────────────────
alter table public.vendors enable row level security;

drop policy if exists vendors_read on public.vendors;
create policy vendors_read on public.vendors for select
  using (public.can_read_client((select client_id from public.events where id = vendors.event_id)));

drop policy if exists vendors_write on public.vendors;
create policy vendors_write on public.vendors for all
  using (public.can_read_client((select client_id from public.events where id = vendors.event_id)))
  with check (public.can_read_client((select client_id from public.events where id = vendors.event_id)));

-- ── add vendor link to tasks ───────────────────────────────────────────────
alter table public.tasks add column if not exists vendor_id uuid references public.vendors(id) on delete set null;
create index if not exists tasks_vendor_idx on public.tasks(vendor_id);

-- ── RLS updates for task_templates and event_types ────────────────────────
alter table public.task_templates enable row level security;
alter table public.event_types enable row level security;

-- Everyone can read templates (they are platform-wide)
drop policy if exists task_templates_read on public.task_templates;
create policy task_templates_read on public.task_templates for select using (true);

drop policy if exists event_types_read on public.event_types;
create policy event_types_read on public.event_types for select using (true);

-- ── comments ───────────────────────────────────────────────────────────────
comment on table public.task_templates is
  'One task offered to a new event of a given type. When a couple creates a '
  '(say) henna event, tasks are auto-created from the henna templates.';

comment on column public.task_templates.is_vendor_task is
  'True for tasks like "choose venue" that are completed by hiring a supplier. '
  'When marked done, the couple (or producer) is asked for the vendor details.';

comment on column public.task_templates.vendor_category is
  'What kind of supplier this is: venue, catering, dj, etc. Used to categorize '
  'the vendors table.';

comment on table public.vendors is
  'A supplier hired for an event. Categories: venue, catering, photography, dj, '
  'flowers, decor, attire, printing, etc. One vendor may serve multiple tasks '
  '(a venue hosts both henna and wedding).';

comment on column public.vendors.status is
  'selected (chosen but not contacted), confirmed (committed), completed (day-of '
  'or after). Helps track whether arrangements are solid.';

comment on column public.tasks.vendor_id is
  'If this task captured a vendor choice, link to that vendor row. Allows the '
  'vendor panel to tie directly to the task that booked it.';
