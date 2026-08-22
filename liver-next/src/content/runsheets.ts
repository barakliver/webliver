import type { Track, Audience } from '@/content/lists';

/**
 * Starting points for a day, so nobody writes one from a blank page.
 *
 * A schedule that starts empty gets written the week of the wedding, at night,
 * from memory — and what memory leaves out is never the ceremony. It is the
 * generator refuelling, the second photographer's meal, the moment somebody
 * has to physically hand over the rings. Those lines are missing from every
 * schedule written from memory and present on every one written from a
 * template, which is the entire argument for having templates.
 *
 * These are starting points and not standards. Every line is editable and
 * deletable, and a template is offered only while the schedule is empty, so it
 * can never overwrite an evening somebody already planned.
 *
 * The times are real ones. An Israeli evening wedding is built backwards from
 * the chuppah, and the chuppah is set by when the light goes: couple portraits
 * want the hour before sunset, the reception has to be long enough for guests
 * arriving across ninety minutes of traffic, and the kitchen needs the main
 * course out before the floor opens or it never gets eaten.
 */

export type TemplateLine = {
  at: string;
  title: string;
  note?: string;
  track?: Track;
  minutes?: number;
  owner?: string;
  audience?: Audience[];
};

export type RunsheetTemplate = {
  id: string;
  label: string;
  sub: string;
  lines: TemplateLine[];
};

/** An evening wedding, built backwards from a chuppah at 20:00. */
const EVENING_WEDDING: TemplateLine[] = [
  { at: '13:00', title: 'הגעת צוות ההפקה', note: 'מפתחות, חשמל, גישה לרכבים', track: 'shared', minutes: 60, audience: ['crew'] },
  { at: '14:00', title: 'פריקת ציוד והקמה', note: 'הגברה, תאורה, במה', track: 'shared', minutes: 120, audience: ['crew', 'vendors'] },
  { at: '15:00', title: 'איפור ושיער', note: 'להתחיל בזמן, זה הדבר הראשון שנשבר', track: 'partner_a', minutes: 120 },
  { at: '16:00', title: 'התארגנות והלבשה', track: 'partner_b', minutes: 60 },
  { at: '16:30', title: 'הגעת צלם וצלמת', note: 'צילומי הכנות בשני המסלולים', track: 'shared', minutes: 30, audience: ['photo'] },
  { at: '17:00', title: 'צילומי הכנות', track: 'partner_a', minutes: 45, audience: ['photo'] },
  { at: '17:15', title: 'צילומי הכנות', track: 'partner_b', minutes: 30, audience: ['photo'] },
  { at: '17:45', title: 'ה־First Look', note: 'הפגישה הראשונה, לפני שיש קהל', track: 'shared', minutes: 20, audience: ['couple', 'photo'] },
  { at: '18:05', title: 'צילומי זוג', note: 'השעה שלפני השקיעה. אחריה האור נגמר ולא חוזר', track: 'shared', minutes: 45, audience: ['couple', 'photo'] },
  { at: '18:30', title: 'סידור מתחם קבלת פנים', note: 'עמדות אוכל, ברים, שילוט', track: 'shared', minutes: 30, audience: ['crew', 'vendors'] },
  { at: '19:00', title: 'קבלת פנים', note: 'רוב האורחים מגיעים בשעה הראשונה', track: 'shared', minutes: 75 },
  { at: '19:30', title: 'צילומי משפחות', note: 'רשימה כתובה מראש, אחרת זה לוקח שעה', track: 'shared', minutes: 30, audience: ['couple', 'photo'] },
  { at: '19:50', title: 'העברת הרשות והטבעות', note: 'מי מחזיק את הטבעות, בשם', track: 'shared', minutes: 10, audience: ['couple', 'crew'] },
  { at: '20:00', title: 'חופה', track: 'shared', minutes: 30, audience: ['couple', 'photo', 'crew'] },
  { at: '20:35', title: 'כניסת הזוג לאולם', note: 'לתאם עם הדיג׳יי ועם התאורה', track: 'shared', minutes: 10, audience: ['couple', 'vendors'] },
  { at: '20:45', title: 'ריקוד ראשון', track: 'shared', minutes: 10, audience: ['couple', 'photo'] },
  { at: '21:00', title: 'הגשת מנה ראשונה', track: 'shared', minutes: 30, audience: ['vendors'] },
  { at: '21:30', title: 'נאומים', note: 'שניים או שלושה, ולתאם אורך מראש', track: 'shared', minutes: 20 },
  { at: '21:50', title: 'הגשת מנה עיקרית', track: 'shared', minutes: 40, audience: ['vendors'] },
  { at: '22:30', title: 'פתיחת רחבה', track: 'shared', minutes: 90, audience: ['vendors'] },
  { at: '23:30', title: 'הגשת קינוחים', track: 'shared', minutes: 30, audience: ['vendors'] },
  { at: '23:45', title: 'ארוחת הצוות', note: 'הצלמים והדיג׳יי לא אכלו מאז הצהריים', track: 'shared', minutes: 30, audience: ['crew', 'vendors'] },
  { at: '00:30', title: 'שיר אחרון', track: 'shared', minutes: 10 },
  { at: '00:45', title: 'פרידה מהאורחים', track: 'shared', minutes: 30, audience: ['couple'] },
  { at: '01:00', title: 'פינוי ציוד', note: 'מי לוקח מה, ומי סוגר את המקום', track: 'shared', minutes: 90, audience: ['crew', 'vendors'] },
];

/**
 * An event on open ground: a field, a beach, a yard, a forest clearing.
 *
 * The difference from a venue is not the atmosphere, it is that nothing is
 * already there. No power, no water, no toilets, no lighting, no shelter, and
 * no roof over the decision you make at four in the afternoon when the forecast
 * turns. Every line below exists because its absence has ruined an evening
 * somewhere: the generator that was never refuelled, the second generator
 * nobody rented, the access road that a catering truck could not turn around
 * on, the toilets that arrived and were never connected, the lighting on the
 * path from the car park that nobody thought about until it was dark.
 */
const OUTDOOR_PRODUCTION: TemplateLine[] = [
  { at: '07:00', title: 'סיור פתיחה בשטח', note: 'מצב הקרקע אחרי הלילה, גישה לרכבים כבדים', track: 'shared', minutes: 45, audience: ['crew'] },
  { at: '07:45', title: 'סימון המתחם', note: 'חופה, רחבה, מטבח, שירותים, חניה', track: 'shared', minutes: 45, audience: ['crew'] },
  { at: '08:30', title: 'הצבת גנרטור ראשי', note: 'הארקה, מרחק מהאורחים בגלל רעש', track: 'shared', minutes: 60, audience: ['crew', 'vendors'] },
  { at: '09:00', title: 'הצבת גנרטור גיבוי', note: 'לא מותרות. גנרטור אחד נופל ואין ערב', track: 'shared', minutes: 45, audience: ['crew'] },
  { at: '09:45', title: 'בדיקת סולר', note: 'כמה שעות יש בפועל, ומי מתדלק באמצע הערב', track: 'shared', minutes: 15, audience: ['crew'] },
  { at: '10:00', title: 'פריסת חשמל', note: 'כבלים בתעלות או מגושרים, לא על מעברי אנשים', track: 'shared', minutes: 120, audience: ['crew'] },
  { at: '10:30', title: 'הקמת סככה או אוהל', note: 'גם כשהתחזית נקייה. שמש היא בעיה כמו גשם', track: 'shared', minutes: 150, audience: ['crew', 'vendors'] },
  { at: '11:30', title: 'חיבור מים', note: 'מיכל או חיבור, ובדיקת לחץ לפני שהמטבח מגיע', track: 'shared', minutes: 45, audience: ['crew', 'vendors'] },
  { at: '12:15', title: 'הצבת שירותים ניידים', note: 'להציב, לחבר ולבדוק. ולוודא שיש תאורה בדרך אליהם', track: 'shared', minutes: 60, audience: ['crew'] },
  { at: '13:00', title: 'תאורת שטח ומסלולי הליכה', note: 'מהחניה לחופה, ומהחופה לשירותים', track: 'shared', minutes: 90, audience: ['crew'] },
  { at: '14:00', title: 'בדיקת בטיחות', note: 'מטפים, ערכת עזרה ראשונה, דרך פינוי פנויה', track: 'shared', minutes: 30, audience: ['crew'] },
  { at: '14:30', title: 'אישורים ומסמכים בשטח', note: 'רישוי, ביטוח, אישור כיבוי אש. עותק פיזי', track: 'shared', minutes: 15, audience: ['crew'] },
  { at: '15:00', title: 'החלטת מזג אוויר', note: 'נקודת ההחלטה על תוכנית הגיבוי. אחריה כבר מאוחר', track: 'shared', minutes: 15, audience: ['crew'] },
  { at: '15:30', title: 'הגעת ספקי מזון', note: 'לוודא שהגישה פנויה ושהחשמל שלהם מוכן', track: 'shared', minutes: 90, audience: ['vendors'] },
  { at: '16:00', title: 'בריפינג צוות', note: 'מי אחראי על מה, ולמי מתקשרים כשמשהו נופל', track: 'shared', minutes: 30, audience: ['crew'] },
  { at: '16:30', title: 'הכוונת חניה', note: 'שני אנשים, אפודים, ושילוט מהכביש', track: 'shared', minutes: 30, audience: ['crew'] },
  { at: '17:00', title: 'סאונד־צ׳ק', note: 'לפני שיש אורחים, ובעוצמה של הערב', track: 'shared', minutes: 45, audience: ['vendors'] },
  { at: '17:45', title: 'סבב אחרון לפני אורחים', note: 'זבל, כבלים, שילוט, תאורה', track: 'shared', minutes: 30, audience: ['crew'] },
  { at: '18:30', title: 'פתיחת שערים', track: 'shared', minutes: 60 },
  { at: '22:00', title: 'תדלוק גנרטור', note: 'באמצע הערב, לא כשהוא נכבה', track: 'shared', minutes: 15, audience: ['crew'] },
  { at: '00:30', title: 'סיום והכוונת יציאה', note: 'תאורת חניה נשארת דולקת עד שהאחרון יצא', track: 'shared', minutes: 45, audience: ['crew'] },
  { at: '01:00', title: 'פירוק ופינוי', note: 'השטח נמסר כפי שהתקבל. לצלם לפני ואחרי', track: 'shared', minutes: 180, audience: ['crew', 'vendors'] },
];

/** A short daytime event: a brit, a corporate morning, a small ceremony. */
const DAYTIME_SHORT: TemplateLine[] = [
  { at: '07:30', title: 'הגעת צוות והקמה', track: 'shared', minutes: 90, audience: ['crew'] },
  { at: '08:30', title: 'הגעת ספקים', note: 'מזון, הגברה, פרחים', track: 'shared', minutes: 60, audience: ['vendors'] },
  { at: '09:00', title: 'בדיקת הגברה ומיקרופון', track: 'shared', minutes: 20, audience: ['vendors'] },
  { at: '09:30', title: 'פתיחת דלתות', track: 'shared', minutes: 30 },
  { at: '10:00', title: 'קבלת פנים', track: 'shared', minutes: 45 },
  { at: '10:45', title: 'הטקס', track: 'shared', minutes: 30, audience: ['couple', 'photo'] },
  { at: '11:15', title: 'צילומי משפחות', note: 'רשימה כתובה מראש', track: 'shared', minutes: 20, audience: ['couple', 'photo'] },
  { at: '11:30', title: 'כיבוד', track: 'shared', minutes: 60, audience: ['vendors'] },
  { at: '12:30', title: 'פרידה מהאורחים', track: 'shared', minutes: 30 },
  { at: '13:00', title: 'פירוק ופינוי', track: 'shared', minutes: 90, audience: ['crew', 'vendors'] },
];

export const RUNSHEET_TEMPLATES: RunsheetTemplate[] = [
  {
    id: 'evening_wedding',
    label: 'חתונה בערב',
    sub: 'בנוי אחורה מחופה ב־20:00. כולל צילומי זוג לפני השקיעה, ארוחת צוות, ופינוי.',
    lines: EVENING_WEDDING,
  },
  {
    id: 'outdoor',
    label: 'אירוע שטח',
    sub: 'מקום שאין בו כלום מראש: גנרטור וגיבוי, מים, שירותים, תאורת דרך, אישורים ונקודת החלטה על מזג אוויר.',
    lines: OUTDOOR_PRODUCTION,
  },
  {
    id: 'daytime',
    label: 'אירוע בוקר קצר',
    sub: 'ברית, טקס קטן, בוקר חברה. מהקמה ועד פינוי.',
    lines: DAYTIME_SHORT,
  },
];

export const templateById = (id: string) => RUNSHEET_TEMPLATES.find((t) => t.id === id) ?? null;
