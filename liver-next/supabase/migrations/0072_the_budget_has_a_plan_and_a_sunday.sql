-- ============================================================================
--  0072 — the budget has a plan, and a Sunday
-- ============================================================================
--  The budget screen listed lines. What it could not say was what the
--  couple meant to spend on each area before the lines existed, so there
--  was nothing for a line to be "over". The plan is that intention: a total,
--  the areas the couple would rather overspend on, the ones they would cut
--  first, and the split that came out of it. One jsonb column, because the
--  split is a small object the application owns, and a planned figure that
--  changes shape should not need a migration.
--
--  Once a week the numbers are read out: what was booked, what was paid,
--  where the budget stands, what to watch, what is due next. The date the
--  last such letter went out is kept, so a sweep that runs twice on a Sunday
--  writes once.
--
--  Two columns, both additive, both with a default. No row is touched.
-- ============================================================================

alter table public.clients
  add column if not exists budget_plan jsonb not null default '{}'::jsonb,
  add column if not exists budget_digest_on date;

do $$ begin
  alter table public.clients add constraint clients_budget_plan_object
    check (jsonb_typeof(budget_plan) = 'object');
exception when duplicate_object then null; end $$;

comment on column public.clients.budget_plan is
  'The intended split: {"total", "guests", "must": [...], "nice": [...], '
  '"splits": {"venue": 52, ...}}. Empty until the planner is used.';
comment on column public.clients.budget_digest_on is
  'The last day the weekly budget letter went out for this event.';
