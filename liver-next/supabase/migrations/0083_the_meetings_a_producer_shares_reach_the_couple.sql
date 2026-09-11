-- ============================================================================
--  0083 — the meetings a producer shares reach the couple
-- ============================================================================
--  Every meeting form has had a switch, "משותף עם הזוג", since 0042. It
--  wrote visible_to_client, the read policy on meeting_logs honoured it, and
--  nothing on the couple's screen ever read the table. The switch was a
--  promise the product did not keep: a producer who ticked it believed the
--  couple could see what was agreed, and the couple saw nothing, and neither
--  side had any way to know.
--
--  The screen now reads it. What this migration adds is the one thing the
--  screen needs that a screen cannot add for itself: the door. Every module
--  the couple sees is gated on a feature_flags row so a plan that does not
--  include it does not quietly include it, and the guard suite refuses a
--  gate with no row behind it. Open on both plans, like the rest.
--
--  Nothing here touches a row of anybody's data.
-- ============================================================================

insert into public.feature_flags (key, label, diy, managed) values
  ('meetings', 'סיכומי פגישות', true, true)
on conflict (key) do nothing;
