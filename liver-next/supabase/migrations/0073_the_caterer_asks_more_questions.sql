-- ============================================================================
--  0073 — the caterer asks more questions
-- ============================================================================
--  A guest's meal was one of five: regular, vegetarian, vegan, gluten free,
--  kosher. The caterer asks two more that the sheet could not answer: who
--  needs glatt, and who has an allergy the kitchen must know about. Both
--  are values of the same enum the reply form already writes, so the form,
--  the guest list, the export and the numbers sheet all learn them at once.
--
--  Adding a value to an enum is additive and touches no row. A guest whose
--  answer was "kosher" stays "kosher".
-- ============================================================================

alter type diet_pref add value if not exists 'glatt';
alter type diet_pref add value if not exists 'allergy';
alter type diet_pref add value if not exists 'kids';
