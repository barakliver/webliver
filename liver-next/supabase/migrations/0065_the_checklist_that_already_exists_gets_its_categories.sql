-- ============================================================================
--  0065 — the checklist that already exists gets its categories
-- ============================================================================
--  Ticking a supplier task opens a form asking who was hired and for how
--  much. It opens on the task's category, and the standing checklist that
--  every wedding gets — DJ, מקום, צלם וידיאו, all of it — was seeded without
--  one. So on every event opened before tonight, ticking DJ crossed out a
--  line and asked nothing.
--
--  createClient now writes the category alongside the title. This is the
--  same mapping applied to the rows that are already there: only where the
--  category is still empty, and only where the title is one of the lines the
--  checklist knows. A task somebody typed themselves is left exactly as it
--  was, and a task a producer has already categorised is not touched.
--
--  createClient stores a note-bearing line as "title · note", so the match is
--  on the part before the separator.
-- ============================================================================

update public.tasks t
   set category = m.category
  from (values
    ('מקום',                        'venue'),
    ('DJ',                          'dj'),
    ('צלם וידיאו',                  'video'),
    ('צלם סטילס',                   'photography'),
    ('צלם מגנטים',                  'magnets'),
    ('תא צילום',                    'photobooth'),
    ('צלמת סושיאל',                 'photography'),
    ('עיצוב',                       'decor'),
    ('איפור',                       'makeup'),
    ('שיער',                        'hair'),
    ('לסגור רב',                    'rabbi'),
    ('שמלה +הינומה',                'attire'),
    ('חליפה +בגדים להחלפה',         'attire'),
    ('טבעות לטקס',                  'rings'),
    ('כתובה',                       'printing'),
    ('לסגור חברת לאישורי הגעה',     'rsvp'),
    ('בר אלכוהול/קוקטיילים',        'bar'),
    ('אטקציה מגניבה',               'attraction'),
    ('סגירת מקום וביטוח',           'venue'),
    ('סגירת קייטרינג ותפריט',       'catering'),
    ('סגירת בר ושירותי מזיגה',      'bar'),
    ('סגירת דיג׳יי',                'dj'),
    ('סגירת צלם סטילס ווידאו',      'photography'),
    ('סגירת מגנטים',                'magnets'),
    ('סגירת מעצב',                  'decor'),
    ('סגירת תאורה והגברה',          'sound')
  ) as m(title, category)
 where t.category = ''
   and split_part(t.title, ' · ', 1) = m.title;
