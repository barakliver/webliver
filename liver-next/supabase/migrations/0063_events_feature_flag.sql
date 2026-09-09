-- ============================================================================
--  0063 — multi-event planning as a feature flag
-- ============================================================================
--  The events table is now the center of planning. The couple's portal can
--  display multiple events (henna, wedding, post-party) and manage each one
--  separately. This is a platform-wide feature, open for both DIY and managed
--  couples.
--
--  The existing "venues" module now lives within events — each event can have
--  venue comparisons, and they are kept separate.
-- ============================================================================

-- ── seed feature flag for events ───────────────────────────────────────────
--  Multi-event planning: couples can create, name, and manage multiple
--  celebrations (wedding, henna, groom party, etc).

insert into public.feature_flags (key, label, diy, managed) values
  ('events', 'מספר אירועים', true, true)
on conflict (key) do nothing;
