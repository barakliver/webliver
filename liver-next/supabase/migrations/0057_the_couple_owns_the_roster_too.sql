-- ── The faces and the looks become a module the couple can be given ────────
--  0056 built the tables and put them behind can_read_client, which already
--  means a couple may read and write their own event's roster. What was
--  missing is the thing every other couple-facing module has: a row in
--  feature_flags, so the panel appears on the producer's list of what a plan
--  includes instead of being the one module that is silently always on.
--
--  feature_on() answers true for a key with no row, so this changes nothing
--  for anybody today. What it changes is that the switch now exists and is
--  visible where the other nine are.
--
--  On conflict do nothing, like 0030's own seed: a producer who has already
--  turned this off for a plan must not have it turned back on by a deploy.
insert into public.feature_flags (key, label, diy, managed) values
  ('prep', 'פנים והשראה', true, true)
on conflict (key) do nothing;
