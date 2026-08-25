/**
 * The event file, as this producer already keeps it.
 *
 * Lifted from the Word document and the spreadsheet he has been filling in by
 * hand for every wedding, wording and order included. Nothing here was
 * invented, and that is the whole point: a template somebody has to translate
 * into their own language before they can use it is a template they abandon
 * after one event.
 *
 * Each list is a starting point applied in one press onto an empty section,
 * and every line is editable and deletable afterwards.
 */

/** The fourteen suppliers on every one of his events, in his order and with
 *  his names for them. Categories are ours, so the lists group and report;
 *  the labels are his, so he recognises them. */
export const SUPPLIER_ROLES: { name: string; category: string }[] = [
  { name: 'מנהל אירוע',        category: 'other' },
  { name: 'צלם סטילס ווידאו',  category: 'photo' },
  { name: 'צלם מגנטים',        category: 'photo' },
  { name: 'אטרקציות',          category: 'other' },
  { name: 'דיג׳יי',            category: 'music' },
  { name: 'דיג׳יי אפטר',       category: 'music' },
  { name: 'מעצב',              category: 'floral' },
  { name: 'רב',                category: 'other' },
  { name: 'איפור ושיער',       category: 'other' },
  { name: 'אישורי הגעה',       category: 'other' },
  { name: 'מלווה לכלה',        category: 'other' },
  { name: 'מלווה לחתן',        category: 'other' },
  { name: 'גת',                category: 'catering' },
  { name: 'טיפים לצוות',       category: 'other' },
];

/** The budget as his spreadsheet lays it out. Estimates are left at zero
 *  rather than guessed: a number nobody typed, sitting in a budget, is worse
 *  than an empty row, because it gets added up. */
export const BUDGET_LINES: { label: string; category: string }[] = [
  { label: 'מקום ואולם (כולל ביטוח)', category: 'venue' },
  { label: 'בר ושירותי מזיגה',        category: 'bar' },
  { label: 'אלכוהול',                 category: 'bar' },
  { label: 'קייטרינג',                category: 'catering' },
  { label: 'דיג׳יי',                  category: 'music' },
  { label: 'נגן רחבה',                category: 'music' },
  { label: 'צלם וידאו',               category: 'photo' },
  { label: 'צלם סטילס',               category: 'photo' },
  { label: 'מגנטים',                  category: 'photo' },
  { label: 'צלמת סושיאל',             category: 'photo' },
  { label: 'עיצוב',                   category: 'design' },
  { label: 'עיצוב וסידור שולחנות',    category: 'design' },
  { label: 'תאורה והגברה',            category: 'tech' },
  { label: 'שמלה',                    category: 'look' },
  { label: 'חליפה',                   category: 'look' },
  { label: 'איפור ושיער',             category: 'look' },
  { label: 'עיצוב הזמנה',             category: 'invites' },
  { label: 'שליחת הזמנות',            category: 'invites' },
  { label: 'אישורי הגעה',             category: 'invites' },
  { label: 'מתנות לאורחים',           category: 'other' },
  { label: 'הסעות',                   category: 'transport' },
  { label: 'מקום התארגנות ולינה',     category: 'other' },
  /* Last on purpose, and never zero in practice. It is the line that decides
     whether a surprise is a problem or an inconvenience. */
  { label: 'בלת״ם',                   category: 'other' },
];

/** The seven moments of the evening that need a song chosen, from his music
 *  table. Nobody remembers the second entrance after the change of clothes
 *  until the DJ asks for it on the night. */
export const MUSIC_MOMENTS: string[] = [
  'כניסת חתן ושושבינים',
  'כניסת כלה',
  'שבירת כוס',
  'כניסה לריקודים',
  'סלואו',
  'כניסה שנייה אחרי החלפת בגדים',
  'סיום האירוע',
];

/** The equipment checklist from the back of his file. */
export const EQUIPMENT_CHECK: string[] = [
  'גנרטור',
  'תאורה',
  'מערכת סאונד',
  'מקרנים ומסכים',
  'שולחנות וכיסאות',
  'עמדות קפה ומזנונים',
];

/** The things he writes down about each of them, which is what turns a
 *  wedding into their wedding: what she likes to drink, who is walking her in,
 *  what must not be forgotten. */
export const COUPLE_DETAIL_FIELDS: string[] = [
  'שמות ההורים',
  'שמות האחים',
  'מה אוהב/ת לשתות',
  'מאכלים אהובים',
  'מי מלווה',
  'פריטים חשובים',
  'בקשות מיוחדות',
];


export type TemplateTask = {
  title: string;
  /** Whether this one is offered as shared. The producer changes any of them
   *  before applying; this is only what is ticked when the list opens. */
  shared: boolean;
  note?: string;
};

export type TaskGroup = { id: string; title: string; sub: string; tasks: TemplateTask[] };

/**
 * The task lists out of his file, split by who they are really for.
 *
 * The split is the point. Planning tasks belong to both sides and are offered
 * shared: the couple choosing a dress is not the producer's job to do, only to
 * chase. The day-of list is operating instructions, and reading it three weeks
 * before a wedding is reading a list of things that could go wrong. Cash
 * envelopes for the rabbi, and who may authorise another bottle to a table,
 * are the producer's business.
 *
 * Everything is a default and nothing is a rule. Each line is ticked or
 * unticked, and shared or private, before it is applied.
 */

/* ── the standing checklist ────────────────────────────────────────────────
   His own list, as he wrote it, in his order and with his wording. It is not
   a suggestion the way the two groups above are: these are the lines that are
   on every wedding, so they are applied to a new event without being asked
   for. Every one of them stays editable and deletable afterwards.

   Most are shared. This list is largely the couple's own errands — a dress,
   shoes, the mikveh, opening a file at the rabbinate — and a checklist the
   couple cannot see is a checklist the producer chases by phone. The two that
   are not shared carry money, which is producer-only everywhere else in this
   product and stays that way here. */
export const STANDING_CHECKLIST: TaskGroup[] = [
  {
    id: 'checklist',
    title: 'צ׳ק ליסט',
    sub: 'מה שסוגרים לכל אירוע. נכנס לבד לכל אירוע חדש, וניתן למחיקה שורה שורה.',
    tasks: [
      { title: 'מקום', shared: true },
      { title: 'DJ', shared: true },
      { title: 'צלם וידיאו', shared: true },
      { title: 'צלם סטילס', shared: true },
      { title: 'צלם מגנטים', shared: true },
      { title: 'תא צילום', shared: true },
      { title: 'צלמת סושיאל', shared: true },
      { title: 'עיצוב', shared: true, note: 'להבין איך רוצים את העיצוב ולסגור עם מקום' },
      { title: 'איפור', shared: true },
      { title: 'שיער', shared: true },
      { title: 'לפתוח תיק ברבנות', shared: true },
      { title: 'לסגור רב', shared: true },
      { title: 'מקווה', shared: true },
      { title: 'חינה ?', shared: true },
      { title: 'שבת חתן?', shared: true },
    ],
  },
  {
    id: 'clothing',
    title: 'ביגוד',
    sub: 'מה שלובשים ומה שנוסע איתם.',
    tasks: [
      { title: 'חליפה +בגדים להחלפה', shared: true },
      { title: 'שמלה +הינומה', shared: true },
      { title: 'שמלה שניה', shared: true },
      { title: 'נעליים לכל אחד', shared: true },
      { title: 'כוס שבירה לחתונה', shared: true },
      { title: 'טבעות לטקס', shared: true },
      { title: 'AirTag', shared: true, note: 'אם אין זמין לי יש' },
      { title: 'כתובה', shared: true },
      { title: 'רמקול למוזיקה להתארגנות', shared: true },
      { title: 'תיק ללילה במלון לפני', shared: true },
      { title: 'וביגוד למלון', shared: true },
    ],
  },
  {
    id: 'seating',
    title: 'הושבה',
    sub: 'מי מגיע, ומי יושב איפה.',
    tasks: [
      { title: 'לסגור חברת לאישורי הגעה', shared: true },
      { title: 'לעשות רשומות', shared: true },
      { title: 'לסדר מי יושב באיזה שולחן', shared: true },
      { title: 'לקבל מוזמנים מההורים', shared: true },
      { title: 'חברים של האחים', shared: true },
      { title: 'עיצוב מתאים באולם', shared: true },
    ],
  },
  {
    id: 'venue',
    title: 'מקום',
    sub: 'מה קורה באולם עצמו.',
    tasks: [
      { title: 'בר אלכוהול/קוקטיילים', shared: true },
      { title: 'גומי', shared: true },
      {
        title: 'אטקציה מגניבה',
        shared: true,
        note: 'קוקטיילים, ברמן מפעיל בבר, משהו שמוסיף עניין בגדול',
      },
      { title: 'בטקס- 7 ברכות ?', shared: true, note: 'מי מקריא, ילדות פרחים מי הן ?' },
      { title: 'מתנות לאורחים', shared: true },
      /* Carries a rate. Money is producer-only everywhere else in this
         product, and a couple reading what the staff are tipped is the same
         kind of leak as a couple reading what the staff are paid. */
      {
        title: 'טיפ במזומן',
        shared: false,
        note: 'נע בדרך כלל ל 50-80 שקל למלצר, 200-300 שקל למנהלים (מטעם האולם)',
      },
    ],
  },
];

export const TASK_TEMPLATE: TaskGroup[] = [
  {
    id: 'planning',
    title: 'תכנון',
    sub: 'מה שצריך לקרות לפני. רובן משותפות, כי הזוג עושה חצי מהן.',
    tasks: [
      { title: 'סגירת מקום וביטוח', shared: true },
      { title: 'סגירת קייטרינג ותפריט', shared: true },
      { title: 'סגירת בר ושירותי מזיגה', shared: true },
      { title: 'סגירת דיג׳יי', shared: true },
      { title: 'סגירת צלם סטילס ווידאו', shared: true },
      { title: 'סגירת מגנטים', shared: true },
      { title: 'סגירת מעצב', shared: true },
      { title: 'סגירת תאורה והגברה', shared: true },
      { title: 'בחירת שמלה', shared: true },
      { title: 'בחירת חליפה', shared: true },
      { title: 'סגירת איפור ושיער', shared: true },
      { title: 'עיצוב הזמנה', shared: true },
      { title: 'שליחת הזמנות', shared: true },
      { title: 'אישורי הגעה', shared: true },
      { title: 'סידור הושבה', shared: true },
      { title: 'בחירת שירים לרגעים של הערב', shared: true, note: 'כניסות, שבירת כוס, סלואו, שיר אחרון' },
      { title: 'הסעות', shared: true },
      { title: 'מקום התארגנות ולינה', shared: true },
      { title: 'מתנות לאורחים', shared: true },
      { title: 'סגירת רב', shared: true },
      /* His, and not the couple's: the number that decides whether a surprise
         is a problem or an inconvenience. */
      { title: 'לוודא תקציב בלת״ם', shared: false },
    ],
  },
  {
    id: 'day_of',
    title: 'יום האירוע',
    sub: 'הוראות הפעלה. ברירת המחדל היא פרטי, כי רשימה של מה עלול להשתבש היא לא מה שזוג צריך לקרוא שבועיים לפני.',
    tasks: [
      { title: 'ווידוא הגעת ספקים בזמן', shared: false },
      { title: 'בדיקת תאורה והגברה', shared: false },
      { title: 'ווידוא מוכנות האולם והריהוט', shared: false },
      { title: 'קבלת פנים ותדרוך הצוות', shared: false },
      { title: 'פיקוח על לוחות הזמנים', shared: false },
      {
        title: 'להתקשר להורים ולאחים של שני הצדדים',
        shared: false,
        note: 'לוודא שמגיעים בזמן לצילומי משפחות',
      },
      {
        title: 'מעטפות מזומן לספקים',
        shared: false,
        note: 'רב, צלם מגנטים, גת, ספק במה, וטיפים לצוות האולם',
      },
      {
        title: 'לא מוציאים בקבוקים נוספים לשולחנות בלי אישור',
        shared: false,
      },
      { title: 'לוודא שהזוג אכל', shared: false, note: 'הכי נשכח, והכי מורגש בשעה השלישית' },
      { title: 'לוודא מי מחזיק את הטבעות', shared: false },
      { title: 'לתאם מי אוסף מתנות בסוף הערב', shared: false },
      { title: 'לצלם את השטח לפני ואחרי הפינוי', shared: false },
    ],
  },
];
