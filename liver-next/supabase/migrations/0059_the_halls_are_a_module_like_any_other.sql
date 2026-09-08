-- ── Comparing halls becomes a module a couple can be given ──────────────────
--  0058 put the table behind can_read_client, which already means a couple may
--  read and write their own event's halls. What was missing is the thing every
--  other couple-facing module has: a row in feature_flags, so the panel appears
--  on the producer's list of what a plan includes rather than being the one
--  module that is silently always on.
--
--  This is the same omission 0057 fixed for the faces and the looks, made
--  again eight migrations later, which is a reasonable argument for the
--  checker that would have caught it.
--
--  feature_on() answers true for a key with no row, so nothing changes for
--  anybody today. What changes is that the switch exists where the other ten
--  are. On conflict do nothing: a producer who has already closed this for a
--  plan must not have it reopened by a deploy.
insert into public.feature_flags (key, label, diy, managed) values
  ('venues', 'השוואת אולמות', true, true)
on conflict (key) do nothing;
