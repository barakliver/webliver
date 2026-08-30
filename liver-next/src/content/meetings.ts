/**
 * The four meetings a wedding actually has, and what gets asked in each.
 *
 * Written as data rather than as four screens, because the drawer that renders
 * one of these is the same drawer for all four and the thing that differs is
 * the list of questions. A fifth meeting is a new entry here and nothing else.
 *
 * The questions are the ones a producer asks anyway, in the order they come up
 * in the room. Which is the point: a form that asks in a different order from
 * the conversation gets filled in afterwards from memory, and a summary
 * written from memory is worth less than no summary.
 */

export type FieldKind = 'text' | 'long' | 'number' | 'time' | 'choice' | 'yesno';

export type Field = {
  id: string;
  label: string;
  kind: FieldKind;
  /** For `choice`. */
  options?: readonly string[];
  hint?: string;
};

export type MeetingKind = 'production' | 'tasting' | 'venue' | 'design' | 'other';

export type MeetingTemplate = {
  kind: MeetingKind;
  title: string;
  /** When it happens, said the way a producer says it. */
  when: string;
  /** Days before the wedding, for the timeline. Negative is before. */
  offsetDays: number;
  blurb: string;
  sections: readonly { title: string; fields: readonly Field[] }[];
};

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

export const meetingTemplate = (kind: string): MeetingTemplate | undefined =>
  MEETING_TEMPLATES.find((m) => m.kind === kind);

/** Every field of a template, flattened. The summary builder walks this and so
 *  does the check that an unknown answer key never reaches the database. */
export const fieldsOf = (t: MeetingTemplate): Field[] =>
  t.sections.flatMap((s) => s.fields);
