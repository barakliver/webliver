/**
 * The meetings a wedding actually has, and what gets asked in each.
 *
 * Written as data rather than as screens, because the drawer that renders
 * one of these is the same drawer for all of them and the thing that differs
 * is the list of questions. The four coordination meetings and the first call
 * are compiled in here; a producer's own are rows of the same shape in
 * `meeting_templates`, and the drawer cannot tell them apart.
 *
 * The questions are the ones a producer asks anyway, in the order they come up
 * in the room. Which is the point: a form that asks in a different order from
 * the conversation gets filled in afterwards from memory, and a summary
 * written from memory is worth less than no summary.
 */

export const FIELD_KINDS = ['text', 'long', 'number', 'time', 'choice', 'yesno'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export type Field = {
  id: string;
  label: string;
  kind: FieldKind;
  /** For `choice`. */
  options?: readonly string[];
  hint?: string;
};

export type Section = { title: string; fields: readonly Field[] };

/** The compiled-in kinds, plus 'custom' for a producer's own template and
 *  'other' which the database has always allowed and nothing has written. */
export type MeetingKind = 'intro' | 'production' | 'tasting' | 'venue' | 'design' | 'custom' | 'other';

export type MeetingTemplate = {
  kind: MeetingKind;
  /** The row id, for a producer's own. Absent on the compiled-in ones. */
  id?: string;
  title: string;
  /** When it happens, said the way a producer says it. */
  when: string;
  /** Days before the wedding, for the timeline. Negative is before. Null
   *  keeps it off the timeline, which is right for a first call. */
  offsetDays: number | null;
  blurb: string;
  sections: readonly Section[];
  /** A producer's template that still has logs pointing at it, and so is
   *  kept but no longer offered. */
  archived?: boolean;
};

/**
 * The first conversation, before anything is signed.
 *
 * Asked for by name: "a template every producer can build for the first call
 * with a couple, with the basic questions". This is the one to start from,
 * and the button that copies it into a producer's own list is how they make
 * it theirs. Nothing here is a coordination detail; it is who they are, what
 * they want and whether it is a fit.
 */
export const INTRO_TEMPLATE: MeetingTemplate = {
  kind: 'intro',
  title: 'שיחה ראשונה',
  when: 'לפני שסוגרים',
  offsetDays: null,
  blurb: 'מי הם, מה הם רוצים, ואם זה מתאים. הרישום כאן הוא מה שנזכרים בו בשיחה השנייה.',
  sections: [
    {
      title: 'מי אתם',
      fields: [
        { id: 'names', label: 'שמות בני הזוג', kind: 'text' },
        { id: 'heard_from', label: 'איך הגעתם אלינו', kind: 'text',
          hint: 'המלצה, אינסטגרם, אולם' },
        { id: 'who_decides', label: 'מי מעורב בהחלטות', kind: 'text',
          hint: 'הורים, אח גדול, רק שניכם' },
      ],
    },
    {
      title: 'האירוע',
      fields: [
        { id: 'date_idea', label: 'תאריך או עונה', kind: 'text' },
        { id: 'guests_idea', label: 'כמה אורחים בערך', kind: 'number' },
        { id: 'venue_booked', label: 'האולם כבר סגור', kind: 'yesno' },
        { id: 'venue_idea', label: 'איפה, או איזה סוג מקום', kind: 'text',
          hint: 'אולם, גן, שטח פתוח, אזור בארץ' },
        { id: 'kind', label: 'סוג האירוע', kind: 'choice',
          options: ['חתונה', 'חינה', 'בר או בת מצווה', 'אירוע חברה', 'אחר'] },
      ],
    },
    {
      title: 'מה הם רוצים',
      fields: [
        { id: 'feel', label: 'האירוע במשפט', kind: 'long',
          hint: 'איך זה אמור להרגיש' },
        { id: 'must', label: 'מה הכי חשוב להם', kind: 'long' },
        { id: 'avoid', label: 'מה לא רוצים בשום אופן', kind: 'long' },
      ],
    },
    {
      title: 'מסגרת',
      fields: [
        { id: 'budget_range', label: 'טווח תקציב', kind: 'choice',
          options: ['עד 150 אלף', '150 עד 250 אלף', '250 עד 400 אלף', 'מעל 400 אלף', 'עוד לא יודעים'] },
        { id: 'service', label: 'מה מחפשים מאיתנו', kind: 'choice',
          options: ['הפקה מלאה', 'ליווי ותיאום', 'ניהול יום האירוע', 'עוד לא ברור'] },
        { id: 'fit', label: 'הרושם שלי', kind: 'long',
          hint: 'לעצמכם. הזוג לא רואה את זה אלא אם משתפים.' },
        { id: 'next', label: 'מה הצעד הבא', kind: 'text',
          hint: 'הצעת מחיר, פגישה, סיור באולם' },
      ],
    },
  ],
};

/** The four coordination meetings. Offsets place them on the timeline. */
export const MEETING_TEMPLATES: readonly MeetingTemplate[] = [
  {
    kind: 'production',
    title: 'פגישת הפקה',
    when: 'חודש עד חודש וחצי לפני',
    offsetDays: -40,
    blurb: 'הפגישה שבה כל מה שסוכם לאורך השנה נסגר למספרים ולשעות.',
    sections: [
      {
        title: 'המסגרת',
        fields: [
          { id: 'guests_final', label: 'מספר אורחים מעודכן', kind: 'number' },
          { id: 'arrive_from', label: 'שעת קבלת פנים', kind: 'time' },
          { id: 'chuppah_at', label: 'שעת חופה', kind: 'time' },
          { id: 'dinner_at', label: 'שעת ישיבה לארוחה', kind: 'time' },
          { id: 'end_at', label: 'שעת סיום', kind: 'time' },
        ],
      },
      {
        title: 'רגעים',
        fields: [
          { id: 'entrance_song', label: 'שיר כניסה לחופה', kind: 'text' },
          { id: 'first_dance', label: 'ריקוד ראשון', kind: 'text' },
          { id: 'speeches', label: 'מי מדבר, ומתי', kind: 'long',
            hint: 'שם, קרבה, ובאיזה שלב בערב' },
          { id: 'surprises', label: 'הפתעות שצריך לתאם', kind: 'long' },
        ],
      },
      {
        title: 'אנשים',
        fields: [
          { id: 'contact_day_of', label: 'איש קשר ביום האירוע', kind: 'text',
            hint: 'מי עונה לטלפון במקום הזוג' },
          { id: 'sensitivities', label: 'רגישויות משפחתיות', kind: 'long',
            hint: 'מי לא יושב ליד מי, מי לא מוזכר בברכות' },
          { id: 'kids', label: 'ילדים באירוע', kind: 'yesno' },
        ],
      },
      {
        title: 'כסף',
        fields: [
          { id: 'balance_when', label: 'מתי משלימים יתרה', kind: 'text' },
          { id: 'open_items', label: 'מה עוד פתוח', kind: 'long' },
        ],
      },
    ],
  },
  {
    kind: 'tasting',
    title: 'פגישת טעימות',
    when: 'שלושה עד ארבעה חודשים לפני',
    offsetDays: -110,
    blurb: 'מה נבחר בפועל, ומה צריך לחזור אל הקייטרינג כדי לסגור.',
    sections: [
      {
        title: 'התפריט',
        fields: [
          { id: 'reception', label: 'קבלת פנים', kind: 'long',
            hint: 'עמדות, מה נבחר ומה ירד' },
          { id: 'first_course', label: 'מנה ראשונה', kind: 'text' },
          { id: 'main', label: 'עיקריות', kind: 'long' },
          { id: 'dessert', label: 'קינוחים', kind: 'text' },
        ],
      },
      {
        title: 'מגבלות',
        fields: [
          { id: 'kosher', label: 'כשרות', kind: 'choice',
            options: ['רגילה', 'מהדרין', 'ללא'] },
          { id: 'diet', label: 'מנות מיוחדות', kind: 'long',
            hint: 'צמחוני, טבעוני, ללא גלוטן, אלרגיות' },
          { id: 'bar', label: 'בר', kind: 'long' },
        ],
      },
      {
        title: 'לסגירה',
        fields: [
          { id: 'to_confirm', label: 'מה חוזר לקייטרינג', kind: 'long' },
          { id: 'price_change', label: 'שינוי במחיר למנה', kind: 'text' },
        ],
      },
    ],
  },
  {
    kind: 'venue',
    title: 'פגישת תיאום מול האולם',
    when: 'שבועיים עד שלושה שבועות לפני',
    offsetDays: -18,
    blurb: 'הדברים הטכניים שאם לא נשאלו מראש מתגלים בשבע בערב.',
    sections: [
      {
        title: 'גישה וזמנים',
        fields: [
          { id: 'load_in', label: 'שעת כניסת ספקים', kind: 'time' },
          { id: 'load_out', label: 'שעת פינוי', kind: 'time' },
          { id: 'parking', label: 'חניה ופריקה', kind: 'long' },
          { id: 'venue_contact', label: 'מנהל האירוע מטעם האולם', kind: 'text' },
        ],
      },
      {
        title: 'טכני',
        fields: [
          { id: 'power', label: 'נקודות חשמל והספק', kind: 'long' },
          { id: 'sound_limit', label: 'מגבלת רעש ושעת כיבוי', kind: 'text' },
          { id: 'generator', label: 'גנרטור', kind: 'yesno' },
          { id: 'weather_plan', label: 'תוכנית גשם', kind: 'long' },
        ],
      },
      {
        title: 'הושבה',
        fields: [
          { id: 'tables', label: 'סוג וגודל שולחנות', kind: 'text' },
          { id: 'seats_per', label: 'מקומות לשולחן', kind: 'number' },
          { id: 'reserve', label: 'שולחנות ריזרבה', kind: 'number' },
        ],
      },
    ],
  },
  {
    kind: 'design',
    title: 'פגישת עיצוב וקונספט',
    when: 'שלושה עד חמישה חודשים לפני',
    offsetDays: -130,
    blurb: 'איך זה נראה, ומה זה עולה.',
    sections: [
      {
        title: 'הכיוון',
        fields: [
          { id: 'concept', label: 'הקונספט במשפט', kind: 'text' },
          { id: 'palette', label: 'צבעים', kind: 'text' },
          { id: 'avoid', label: 'מה לא רוצים לראות', kind: 'long' },
        ],
      },
      {
        title: 'פרחים ותאורה',
        fields: [
          { id: 'chuppah_design', label: 'חופה', kind: 'long' },
          { id: 'centerpieces', label: 'מרכזי שולחן', kind: 'long' },
          { id: 'lighting', label: 'תאורה', kind: 'long' },
          { id: 'flowers_budget', label: 'תקציב פרחים ועיצוב', kind: 'number' },
        ],
      },
      {
        title: 'פריסה',
        fields: [
          { id: 'layout', label: 'פריסת החלל', kind: 'long' },
          { id: 'signage', label: 'שילוט ונייר', kind: 'long' },
        ],
      },
    ],
  },
];

/** Everything compiled in, in the order the buttons show it: the first call
 *  first, because it is the first thing that happens. */
export const BUILT_IN_TEMPLATES: readonly MeetingTemplate[] = [INTRO_TEMPLATE, ...MEETING_TEMPLATES];

export const meetingTemplate = (kind: string): MeetingTemplate | undefined =>
  BUILT_IN_TEMPLATES.find((m) => m.kind === kind);

/** Every field of a template, flattened. The summary builder walks this and so
 *  does the check that an unknown answer key never reaches the database. */
export const fieldsOf = (t: MeetingTemplate): Field[] =>
  t.sections.flatMap((s) => s.fields);
