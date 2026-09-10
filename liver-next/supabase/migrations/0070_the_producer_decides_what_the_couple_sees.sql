-- ============================================================================
--  0070 — the producer decides what the couple sees
-- ============================================================================
--  The couple's screen is a list of sections: tasks, suppliers, the day's
--  schedule, the faces the photographer must not miss, the cars, and so on.
--  Until now every one of them was open to the couple whenever the plan
--  included it, and the only door a producer could close by hand was money.
--
--  Some events want more doors. A producer working from their own envelope
--  list does not want the couple's aunt editing it; a producer whose couple
--  has not yet been told the hall is booked does not want the halls panel
--  showing them the comparison. So every section gets a switch the producer
--  can flip, per event, and the couple's screen reads the switches.
--
--  One jsonb column rather than fifteen booleans, because the list of
--  sections is the application's, and a section added next month must not
--  need a migration to be switchable. A key that is absent means open, so
--  every couple today sees exactly what they saw yesterday: an empty object
--  changes nothing. Only an explicit false closes a section.
--
--  Money keeps its own column. budget_visible is read by the row policies
--  on budget_items and payments, so for money the door is locked in the
--  database and not only on the screen; that is right for money and stays
--  as it was. The switches here are read by the screen and by the couple's
--  assistant, which are the two things that draw the couple's view.
-- ============================================================================

alter table public.clients
  add column if not exists shared_sections jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.clients add constraint clients_shared_sections_object
    check (jsonb_typeof(shared_sections) = 'object');
exception when duplicate_object then null; end $$;

comment on column public.clients.shared_sections is
  'Which sections of the couple''s screen the producer has closed, as '
  '{"section": false}. A key that is absent is open. Money is not here: '
  'budget_visible gates it in the row policies.';
