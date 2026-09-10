import type { VendorCategory } from '@/content/eventFile';

/**
 * The year before the wedding, as a plan that bends to the wedding.
 *
 * The first plan (content/plan.ts) is twenty-eight habits dated from the
 * wedding. This is the same rhythm, made to answer three things the flat list
 * cannot: a wedding abroad, where the invitations have to leave nine months
 * out or the guests cannot book flights; a big wedding, where the hall and
 * the replies both have to come earlier; and a short runway, where half the
 * steps are already late on the day the file is opened and somebody has to
 * be told which ones.
 *
 * Every step has an area of work, so a couple can be handed the guest
 * communications and the producer the suppliers in one setting rather than
 * forty; and a reminder, in days before the date, which is what the calendar
 * subscription turns into an alarm.
 *
 * Pure on purpose. The screen calls it to show the table, the action calls
 * it again on the server to write the tasks, and a test calls it with a
 * wedding in Cyprus and one in five weeks.
 */

export const TIMELINE_CATEGORIES = [
  'vendors', 'guests', 'attire', 'money', 'travel', 'ceremony', 'legal',
] as const;
export type TimelineCategory = (typeof TIMELINE_CATEGORIES)[number];

export type Owner = 'producer' | 'client';

export type TimelineStep = {
  /** Stable across edits, so a task written from this step can be told apart
   *  from one the producer typed in by hand. */
  id: string;
  title: string;
  /** Days from the wedding. Negative before it, which is nearly all of them. */
  offsetDays: number;
  category: TimelineCategory;
  owner: Owner;
  visibleToClient: boolean;
  /** Days before the due date to remind. */
  remindDays: number;
  note: string;
  /** Set when finishing this step means a supplier was hired: ticking the
   *  task then asks who and for how much. */
  vendor?: VendorCategory;
  /** Where the step moves for a wedding abroad, or for one with more than
   *  150 guests, or fewer than 50. Absent means it stays put. */
  abroad?: number;
  big?: number;
  small?: number;
  /** Only on the plan at all when the wedding is abroad. */
  abroadOnly?: true;
};

/* Reminder lead times, from the kind of step rather than typed per step, so
   two steps of the same weight cannot drift apart. */
const BOOKING = 14;   // a hall or a photographer: two weeks to chase
const COMMS = 7;      // invitations, replies: a week
const MID = 7;        // fittings, tastings, trials
const FINAL = 3;      // the last month
const WEEK_OF = 1;    // the week itself

export const TIMELINE: readonly TimelineStep[] = [
  // ── a year out ────────────────────────────────────────────────────────────
  { id: 'budget', title: 'לסגור תקציב מסגרת ומספר אורחים משוער', offsetDays: -365, category: 'money', owner: 'client', visibleToClient: true, remindDays: BOOKING,
    note: 'שני המספרים שכל השאר נגזר מהם. מספר האורחים קובע אולם, וקייטרינג הוא הנתח הגדול בתקציב.' },
  { id: 'style', title: 'לבחור אופי וסגנון לאירוע', offsetDays: -340, category: 'ceremony', owner: 'client', visibleToClient: true, remindDays: MID,
    note: 'ערב חורף באולם וחתונת גן בקיץ הן שתי הפקות שונות. ההחלטה הזאת מצמצמת את רשימת הספקים לפני שמתחילים לחפש.' },
  { id: 'venue', title: 'לסגור מקום ולחתום חוזה', offsetDays: -300, big: -365, abroad: -390, category: 'vendors', owner: 'producer', visibleToClient: true, remindDays: BOOKING, vendor: 'venue',
    note: 'התאריך לא באמת שלכם עד שיש חוזה חתום. כל שאר הספקים נסגרים מול המקום הזה. אירוע גדול או בחו"ל: מוקדם יותר, כי התאריכים הטובים נגמרים.' },
  { id: 'hotel', title: 'לחסום חדרים במלון לאורחים שמגיעים מרחוק', offsetDays: -360, abroadOnly: true, category: 'travel', owner: 'producer', visibleToClient: true, remindDays: BOOKING,
    note: 'לפני ההזמנות. אורח שמקבל הזמנה צריך לדעת איפה הוא ישן ובכמה.' },

  // ── the suppliers ─────────────────────────────────────────────────────────
  { id: 'photo', title: 'לסגור צלם סטילס', offsetDays: -280, category: 'vendors', owner: 'producer', visibleToClient: true, remindDays: BOOKING, vendor: 'photography',
    note: 'הצלמים הטובים נתפסים ראשונים, במיוחד לעונה. אחרי המקום, לפני כל השאר.' },
  { id: 'video', title: 'לסגור צלם וידאו', offsetDays: -270, category: 'vendors', owner: 'producer', visibleToClient: true, remindDays: BOOKING, vendor: 'video',
    note: 'לוודא שהוא והסטילס עובדים יחד בלי להתנגש.' },
  { id: 'catering', title: 'לסגור קייטרינג ותפריט ראשוני', offsetDays: -260, category: 'vendors', owner: 'producer', visibleToClient: true, remindDays: BOOKING, vendor: 'catering',
    note: 'הנתח הגדול בתקציב. לסגור מחיר למנה ומה נכנס בו לפני שמדברים על תוספות.' },
  { id: 'music', title: 'לסגור מוזיקה: די.ג׳יי או להקה', offsetDays: -250, category: 'vendors', owner: 'producer', visibleToClient: true, remindDays: BOOKING, vendor: 'dj',
    note: 'כולל מי מנגן בקבלת הפנים ובחופה, שזה לא תמיד אותו אחד.' },
  { id: 'attire-start', title: 'להתחיל חיפוש שמלה וחליפה', offsetDays: -240, category: 'attire', owner: 'client', visibleToClient: true, remindDays: MID,
    note: 'שמלה מוזמנת לוקחת חודשים להגיע, ואחריה עוד שלוש מדידות.' },
  { id: 'save-date', title: 'לשלוח save the date', offsetDays: -240, abroad: -330, category: 'guests', owner: 'client', visibleToClient: true, remindDays: COMMS,
    note: 'הודעה קצרה עם התאריך והמקום, לפני ההזמנה הרשמית. בחו"ל: מוקדם מאוד, כי אנשים מתכננים חופשה סביב זה.' },
  { id: 'design', title: 'לסגור עיצוב, תפאורה ותאורה', offsetDays: -190, category: 'vendors', owner: 'producer', visibleToClient: true, remindDays: BOOKING, vendor: 'decor',
    note: 'ככל שזה נסגר מוקדם יותר, כך יש יותר זמן להתאים את המקום לסגנון ולא להפך.' },
  { id: 'makeup', title: 'לסגור מאפרת ומעצב שיער', offsetDays: -200, category: 'attire', owner: 'client', visibleToClient: true, remindDays: BOOKING, vendor: 'makeup',
    note: 'הטובות סגורות חצי שנה קדימה בעונה.' },
  { id: 'rabbi', title: 'לסגור רב או עורך טקס', offsetDays: -170, abroad: -200, category: 'ceremony', owner: 'client', visibleToClient: true, remindDays: BOOKING, vendor: 'rabbi',
    note: 'ואם דרך הרבנות, לפתוח את התיק מוקדם. זה לוקח זמן.' },
  { id: 'rings', title: 'להזמין טבעות', offsetDays: -150, category: 'attire', owner: 'client', visibleToClient: true, remindDays: MID,
    note: 'חריטה ומידה לוקחות שבועות, ולפעמים צריך תיקון אחרי.' },
  { id: 'flow', title: 'לתכנן את מהלך הערב: קבלת פנים, חופה, מסיבה', offsetDays: -150, category: 'ceremony', owner: 'producer', visibleToClient: true, remindDays: BOOKING,
    note: 'השלד שכל לוח הזמנים של יום האירוע ייתלה עליו.' },

  // ── guests ────────────────────────────────────────────────────────────────
  { id: 'travel-guide', title: 'לפרסם לאורחים מדריך נסיעה: טיסות, מלון, הסעות', offsetDays: -240, abroadOnly: true, category: 'travel', owner: 'client', visibleToClient: true, remindDays: COMMS,
    note: 'עמוד אחד עם הכל, לפני ההזמנות. חוסך מאה שיחות טלפון.' },
  { id: 'invite-design', title: 'לעצב הזמנה ולאשר נוסח', offsetDays: -130, abroad: -300, category: 'guests', owner: 'client', visibleToClient: true, remindDays: COMMS, vendor: 'printing',
    note: 'להשאיר זמן להגהה. שם שמאויית לא נכון בהזמנה נשאר שם לנצח.' },
  { id: 'passports', title: 'לתזכר את האורחים לבדוק דרכונים ואשרות', offsetDays: -150, abroadOnly: true, category: 'travel', owner: 'client', visibleToClient: true, remindDays: COMMS,
    note: 'דרכון שפג תוקפו מתגלה תמיד שבועיים לפני הטיסה.' },
  { id: 'invites', title: 'לשלוח הזמנות', offsetDays: -60, big: -75, abroad: -270, category: 'guests', owner: 'client', visibleToClient: true, remindDays: COMMS,
    note: 'שישה עד שמונה שבועות. מוקדם מדי נשכח, מאוחר מדי כבר תפוס. בחו"ל: תשעה חודשים לפחות, כדי שיוכלו להזמין טיסות.' },
  { id: 'rsvp-open', title: 'לפתוח מעקב אישורי הגעה', offsetDays: -50, big: -65, abroad: -260, category: 'guests', owner: 'producer', visibleToClient: true, remindDays: COMMS,
    note: 'מהרגע הזה המספר הזה קובע קייטרינג, הושבה והסעות.' },
  { id: 'rsvp-deadline', title: 'מועד אחרון לאישורי הגעה', offsetDays: -21, big: -30, abroad: -120, category: 'guests', owner: 'client', visibleToClient: true, remindDays: COMMS,
    note: 'שלושה שבועות לפני מספיק בארץ. בחו"ל ארבעה חודשים, כי אחרי המועד הזה כבר מזמינים טיסות ומלון.' },
  { id: 'welcome', title: 'לתכנן ערב קבלת פנים לאורחים שהגיעו', offsetDays: -90, abroadOnly: true, category: 'travel', owner: 'producer', visibleToClient: true, remindDays: COMMS,
    note: 'אורח שטס בשביל החתונה מצפה ליותר מערב אחד. משהו פשוט, ערב לפני.' },

  // ── the look and the evening ──────────────────────────────────────────────
  { id: 'flowers', title: 'לסגור עיצוב פרחים סופי', offsetDays: -110, category: 'vendors', owner: 'producer', visibleToClient: true, remindDays: BOOKING, vendor: 'flowers',
    note: 'מה שבעונה זול ויפה, ומה שצריך להביא מרחוק ולשלם עליו.' },
  { id: 'transport', title: 'לתאם הסעות, חניה ונגישות', offsetDays: -90, category: 'travel', owner: 'producer', visibleToClient: true, remindDays: MID, vendor: 'transport',
    note: 'כמה אורחים מגיעים מרחוק, ומי מהמשפחה צריך גישה קרובה.' },
  { id: 'tasting', title: 'טעימות ואישור תפריט סופי', offsetDays: -75, category: 'vendors', owner: 'client', visibleToClient: true, remindDays: MID,
    note: 'אחרי הטעימות המחיר למנה כבר לא זז, אז זה הרגע לסגור גם אותו.' },
  { id: 'trial', title: 'ניסיון איפור ושיער', offsetDays: -60, category: 'attire', owner: 'client', visibleToClient: true, remindDays: MID,
    note: 'עם הצלם אם אפשר, כדי לראות איך זה יוצא בתמונה ולא רק במראה.' },
  { id: 'vows', title: 'לכתוב את הדברים לחופה', offsetDays: -60, category: 'ceremony', owner: 'client', visibleToClient: true, remindDays: MID,
    note: 'עמוד אחד לכל אחד. מי מדבר, מתי, וכמה זמן, כדי שהרב והצלם יידעו.' },
  { id: 'fitting-1', title: 'מדידה ראשונה: שמלה וחליפה', offsetDays: -42, category: 'attire', owner: 'client', visibleToClient: true, remindDays: MID,
    note: 'שישה שבועות לפני. מכאן עוד שתיים, ובכל אחת משהו זז.' },
  { id: 'contracts', title: 'לעבור על החוזים והיתרות מול כל הספקים', offsetDays: -30, category: 'legal', owner: 'producer', visibleToClient: false, remindDays: COMMS,
    note: 'מה נחתם, מה שולם, ומה נשאר לשלם ומתי. דף אחד.' },
  { id: 'rabbinate', title: 'להסדיר את רישום הנישואין', offsetDays: -100, abroad: -180, category: 'legal', owner: 'client', visibleToClient: true, remindDays: COMMS,
    note: 'בארץ: פתיחת תיק ברבנות והדרכת כלה. בחו"ל: מסמכים מתורגמים ואפוסטיל, וזה לוקח חודשים.' },

  // ── the last month ────────────────────────────────────────────────────────
  { id: 'seating', title: 'לבנות סידור הושבה ראשוני', offsetDays: -35, big: -45, category: 'guests', owner: 'producer', visibleToClient: true, remindDays: MID,
    note: 'ראשוני בכוונה. הוא ישתנה עוד שלוש פעמים לפני הערב.' },
  { id: 'diet', title: 'לאסוף העדפות תזונה ומנות מיוחדות', offsetDays: -25, category: 'guests', owner: 'client', visibleToClient: true, remindDays: MID,
    note: 'צמחוני, טבעוני, ללא גלוטן, אלרגיות. הקייטרינג צריך את המספרים האלה בנפרד.' },
  { id: 'fitting-2', title: 'מדידה שנייה: שמלה וחליפה', offsetDays: -21, category: 'attire', owner: 'client', visibleToClient: true, remindDays: FINAL,
    note: 'שלושה שבועות לפני. מה שלא יושב עכשיו, עוד אפשר לתקן.' },
  { id: 'vendors-sched', title: 'לתאם לוח זמנים ראשוני עם כל הספקים', offsetDays: -20, category: 'vendors', owner: 'producer', visibleToClient: false, remindDays: FINAL,
    note: 'מי מגיע מתי, מה הוא צריך במקום, וכמה זמן לוקח לו להתארגן.' },
  { id: 'headcount', title: 'לאשר מספרים סופיים לקייטרינג', offsetDays: -14, category: 'legal', owner: 'producer', visibleToClient: true, remindDays: FINAL,
    note: 'המספר שמשלמים עליו. אחריו כל תוספת היא תוספת בתשלום.' },
  { id: 'seating-final', title: 'לסגור סידור הושבה סופי', offsetDays: -10, category: 'guests', owner: 'producer', visibleToClient: true, remindDays: FINAL,
    note: 'אחרי המועד האחרון לאישורים ולפני שהמקום מדפיס שלטי שולחן.' },
  { id: 'balances', title: 'לסגור יתרות תשלום לספקים', offsetDays: -10, category: 'money', owner: 'producer', visibleToClient: false, remindDays: FINAL,
    note: 'ספק שלא קיבל את היתרה הוא שיחת טלפון שאף אחד לא רוצה ביום האירוע.' },
  { id: 'fitting-3', title: 'מדידה אחרונה ואיסוף השמלה והחליפה', offsetDays: -7, category: 'attire', owner: 'client', visibleToClient: true, remindDays: FINAL,
    note: 'שבוע לפני, לא יום לפני. תיקון של הרגע האחרון צריך רגע.' },
  { id: 'contacts', title: 'להפיץ לוח זמנים ורשימת אנשי קשר לכל הספקים', offsetDays: -7, category: 'vendors', owner: 'producer', visibleToClient: false, remindDays: FINAL,
    note: 'דף אחד, אצל כולם, עם מספר טלפון ליד כל שורה.' },
  { id: 'walkthrough', title: 'לעבור על סדר היום עם הזוג', offsetDays: -4, category: 'ceremony', owner: 'producer', visibleToClient: true, remindDays: WEEK_OF,
    note: 'שעה שעה, מהאיפור ועד סוף הערב, כדי שלא יופתעו משום דבר.' },
  { id: 'kit', title: 'לארוז ערכת חירום ליום האירוע', offsetDays: -3, category: 'legal', owner: 'client', visibleToClient: true, remindDays: WEEK_OF,
    note: 'סיכות, פלסטרים, מטען, דאודורנט, מים. הדברים שאף אחד לא זוכר בבוקר.' },
  { id: 'arrivals', title: 'לאשר שעות הגעה עם כל הספקים', offsetDays: -2, category: 'vendors', owner: 'producer', visibleToClient: false, remindDays: WEEK_OF,
    note: 'שיחה של דקה לכל אחד. מי שלא ענה, מתקשרים שוב.' },
  { id: 'gear', title: 'לוודא הגעת ציוד ותפאורה', offsetDays: -2, category: 'vendors', owner: 'producer', visibleToClient: false, remindDays: WEEK_OF,
    note: 'מה מגיע יום לפני, מה מגיע בבוקר, ומי פותח את המקום.' },
  { id: 'day-of', title: 'יום האירוע: לפתוח את קונסולת יום האירוע', offsetDays: 0, category: 'vendors', owner: 'producer', visibleToClient: false, remindDays: WEEK_OF,
    note: 'לוח הזמנים החי, אנשי הקשר וסימון מה כבר קרה. המסך נשאר דלוק כל הערב.' },

  // ── after ─────────────────────────────────────────────────────────────────
  { id: 'brunch', title: 'ארוחת בוקר עם האורחים למחרת', offsetDays: 1, abroadOnly: true, category: 'travel', owner: 'client', visibleToClient: true, remindDays: WEEK_OF,
    note: 'האורחים עדיין שם. שעה אחת ביחד לפני שכולם טסים.' },
  { id: 'final-pay', title: 'לסגור תשלומים אחרונים', offsetDays: 3, category: 'money', owner: 'producer', visibleToClient: false, remindDays: FINAL,
    note: 'כל עוד הערב טרי בראש של כולם.' },
  { id: 'files', title: 'לאסוף קבצים מהצלמים ולהעביר לזוג', offsetDays: 21, category: 'vendors', owner: 'producer', visibleToClient: true, remindDays: COMMS,
    note: 'זה הדבר האחרון שהזוג מקבל מכם, והוא זה שהם יזכרו.' },
  { id: 'feedback', title: 'לבקש משוב ולתייק את האירוע', offsetDays: 35, category: 'legal', owner: 'producer', visibleToClient: false, remindDays: COMMS,
    note: 'המלצה נכתבת בקלות בחודש הראשון ובקושי אחרי חצי שנה.' },
];

/** Below nine months the plan is compressed and says so. */
export const SHORT_RUNWAY_DAYS = 270;
/** Abroad, the invitations have to leave this early. */
export const ABROAD_INVITE_DAYS = 270;
const BIG = 150;
const SMALL = 50;

export type TimelineInput = {
  /** ISO date of the wedding. */
  eventDate: string;
  /** ISO date of today, in the event's own zone. Passed in so the same
   *  wedding builds the same plan on the server and in the browser. */
  today: string;
  guests: number | null;
  abroad: boolean;
  /** Per area of work. Absent means the step's own owner. */
  owners?: Partial<Record<TimelineCategory, Owner>>;
};

export type TimelineRow = {
  id: string;
  title: string;
  dueOn: string;
  category: TimelineCategory;
  owner: Owner;
  visibleToClient: boolean;
  remindDays: number;
  note: string;
  vendor?: VendorCategory;
  /** Already past, or squeezed into the next fortnight because it was. */
  atRisk: boolean;
};

export type TimelineWarning = 'short' | 'abroadShort';

export type Timeline = {
  rows: TimelineRow[];
  warnings: TimelineWarning[];
  /** Days from today to the wedding. */
  runway: number;
};

/* Calendar arithmetic on ISO dates, pivoted at noon UTC so a daylight-saving
   change cannot move a date by a day. */
export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const daysApart = (from: string, to: string): number =>
  Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10))
    - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86_400_000);

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Where a step falls for this wedding, before the runway is considered. */
export function offsetFor(step: TimelineStep, input: Pick<TimelineInput, 'guests' | 'abroad'>): number {
  let days = step.offsetDays;
  if (input.abroad && step.abroad !== undefined) days = step.abroad;
  else if (input.guests !== null && input.guests >= BIG && step.big !== undefined) days = step.big;
  else if (input.guests !== null && input.guests > 0 && input.guests < SMALL && step.small !== undefined) days = step.small;
  return days;
}

/**
 * The plan for one wedding.
 *
 * Steps that would already be late are not dropped and not dated in the
 * past: a task dated last March is a task nobody opens. They are laid across
 * the next two weeks in the order they were meant to happen, and flagged, so
 * the producer sees at once which fourteen things this wedding is behind on.
 * Steps after the wedding are never moved.
 */
export function buildTimeline(input: TimelineInput, steps: readonly TimelineStep[] = TIMELINE): Timeline {
  if (!ISO.test(input.eventDate) || !ISO.test(input.today)) return { rows: [], warnings: [], runway: 0 };
  const runway = daysApart(input.today, input.eventDate);

  const picked = steps
    .filter((s) => !s.abroadOnly || input.abroad)
    .map((s) => ({ step: s, offset: offsetFor(s, input) }))
    .sort((a, b) => a.offset - b.offset || a.step.offsetDays - b.step.offsetDays);

  const late = picked.filter((p) => p.offset < 0 && -p.offset > runway);
  /* Spread over fourteen days at most, one a day when there are few and
     several a day when there are many, so the order is kept and nothing
     lands after the wedding. */
  const spread = Math.min(14, Math.max(0, runway - 1));
  const perDay = late.length === 0 ? 0 : late.length / (spread + 1);

  const rows: TimelineRow[] = [];
  const seen = new Set<string>();
  picked.forEach((p, i) => {
    const s = p.step;
    if (seen.has(s.title)) return;
    seen.add(s.title);
    const lateIndex = late.indexOf(p);
    const atRisk = lateIndex >= 0;
    const dueOn = atRisk
      ? shiftDate(input.today, perDay > 0 ? Math.min(spread, Math.floor(lateIndex / perDay)) : 0)
      : shiftDate(input.eventDate, p.offset);
    rows.push({
      id: s.id,
      title: s.title,
      dueOn,
      category: s.category,
      owner: input.owners?.[s.category] ?? s.owner,
      visibleToClient: s.visibleToClient,
      remindDays: s.remindDays,
      note: s.note,
      vendor: s.vendor,
      atRisk,
    });
    void i;
  });
  rows.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || picked.findIndex((p) => p.step.id === a.id) - picked.findIndex((p) => p.step.id === b.id));

  const warnings: TimelineWarning[] = [];
  if (runway < SHORT_RUNWAY_DAYS) warnings.push('short');
  if (input.abroad && runway < ABROAD_INVITE_DAYS) warnings.push('abroadShort');

  return { rows, warnings, runway };
}
