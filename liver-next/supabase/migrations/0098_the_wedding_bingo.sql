-- ============================================================================
--  0098 — the wedding bingo
-- ============================================================================
--  A board of the couple's own critical tasks, in a square, ticked by pressing
--  a cell and won by a row, a column or a diagonal.
--
--  There is no table here and that is the design rather than an omission. The
--  squares are the couple's real tasks and pressing one goes through the same
--  toggleTask every other tick goes through, so the board is computed from
--  rows that already exist and stores nothing of its own. A bingo with a list
--  of its own would be a second checklist, and by the end of the first week a
--  couple would have two answers to "did we book the photographer" and no way
--  to tell which one is the wedding.
--
--  So the one thing this adds is the door. Every module the couple's screen
--  draws is gated on a feature_flags row, so a plan that does not include
--  something does not quietly include it, and the guard suite refuses a gate
--  with no row behind it. Open on both plans, like the rest.
--
--  Its own switch rather than riding on the task list's: a producer who wants
--  the list without the game, or the game without a second list on the screen,
--  is a reasonable person, and a section that cannot be turned off on its own
--  is a section somebody turns the whole tab off to be rid of.
--
--  Nothing here touches a row of anybody's data.
-- ============================================================================

insert into public.feature_flags (key, label, diy, managed) values
  ('bingo', 'בינגו החתונה', true, true)
on conflict (key) do nothing;
