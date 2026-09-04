import type { Phase } from '@/lib/phase';

/**
 * The first plan, for an event that has nothing yet.
 *
 * A new producer opens their first event and gets a workspace with a date in
 * it and nothing else. The operating book tells them to load a schedule from
 * a template, and there are no templates, because templates belong to a
 * producer and a producer who signed up an hour ago owns none. So the third
 * of the five first steps points at an empty screen, and the promise that the
 * system plans the wedding with them turns out to start with them planning it
 * alone.
 *
 * This is that missing template. Twenty-eight steps, dated backwards from the
 * wedding, covering an Israeli wedding from a year out to the month after.
 *
 * The dates are not invented for this file. Every offset lands inside the
 * phase that `lib/phase.ts` already says an event of that age is in — the
 * suppliers are signed while the calendar calls it the booking phase, the
 * invitations go out while it calls it guest operations. Those two things
 * being one rhythm rather than two is the whole point: the dashboard tells a
 * producer they are a phase behind, and the task list tells them which
 * specific things a phase behind consists of. A test holds them together, so
 * that moving a threshold in one place fails loudly rather than quietly
 * teaching the two screens to disagree.
 *
 * Habits, not laws. This lands as an ordinary editable template, exactly like
 * the four meetings do, and the first useful thing a producer does with it is
 * disagree with it — a photographer at nine months is Barak's rhythm, not a
 * fact about weddings. What matters is that they start from twenty-eight
 * things to argue with rather than from an empty page.
 */

export type PlanStep = {
  title: string;
  /** Days from the wedding. Negative before it, which is nearly all of them. */
  offsetDays: number;
  /** Which phase this belongs to, checked against lib/phase.ts by a test. */
  phase: Phase;
  owner: 'producer' | 'client';
  /** Whether the couple sees it in their own area. Internal money does not. */
  visibleToClient: boolean;
  note: string;
};

export const FIRST_PLAN: readonly PlanStep[] = [
  // ── יסודות ────────────────────────────────────────────────────────────────
  {
    title: 'לסגור תקציב מסגרת ומספר אורחים משוער',
    offsetDays: -365, phase: 'foundation', owner: 'client', visibleToClient: true,
    note: 'שני המספרים שכל השאר נגזר מהם. מספר האורחים קובע אולם, וקייטרינג הוא הנתח הגדול בתקציב.',
  },
  {
    title: 'לבחור אופי וסגנון לאירוע',
    offsetDays: -330, phase: 'foundation', owner: 'client', visibleToClient: true,
    note: 'ערב חורף באולם וחתונת גן בקיץ הן שתי הפקות שונות. ההחלטה הזאת מצמצמת את רשימת הספקים לפני שמתחילים לחפש.',
  },

  // ── סגירת ספקים ───────────────────────────────────────────────────────────
  {
    title: 'לסגור מקום ולחתום חוזה',
    offsetDays: -300, phase: 'bookings', owner: 'producer', visibleToClient: true,
    note: 'התאריך לא באמת שלכם עד שיש חוזה חתום. כל שאר הספקים נסגרים מול המקום הזה.',
  },
  {
    title: 'לסגור צלם סטילס',
    offsetDays: -280, phase: 'bookings', owner: 'producer', visibleToClient: true,
    note: 'הצלמים הטובים נתפסים ראשונים, במיוחד לעונה.',
  },
  {
    title: 'לסגור צלם וידאו',
    offsetDays: -270, phase: 'bookings', owner: 'producer', visibleToClient: true,
    note: 'לוודא שהוא ושל הסטילס עובדים יחד בלי להתנגש.',
  },
  {
    title: 'לסגור מוזיקה: די.ג׳יי או להקה',
    offsetDays: -250, phase: 'bookings', owner: 'producer', visibleToClient: true,
    note: 'כולל מי מנגן בקבלת הפנים ובחופה, שזה לא תמיד אותו אחד.',
  },
  {
    title: 'לסגור קייטרינג ותפריט ראשוני',
    offsetDays: -220, phase: 'bookings', owner: 'producer', visibleToClient: true,
    note: 'הנתח הגדול בתקציב. לסגור מחיר למנה ומה נכנס בו לפני שמדברים על תוספות.',
  },
  {
    title: 'לסגור עיצוב, תפאורה ותאורה',
    offsetDays: -190, phase: 'bookings', owner: 'producer', visibleToClient: true,
    note: 'ככל שזה נסגר מוקדם יותר, כך יש יותר זמן להתאים את המקום לסגנון ולא להפך.',
  },
  {
    title: 'לסגור רב או עורך טקס',
    offsetDays: -170, phase: 'bookings', owner: 'client', visibleToClient: true,
    note: 'ואם דרך הרבנות, לפתוח את התיק מוקדם. זה לוקח זמן.',
  },

  // ── חוויית האורח ──────────────────────────────────────────────────────────
  {
    title: 'לתכנן את מהלך הערב: קבלת פנים, חופה, מסיבה',
    offsetDays: -150, phase: 'experience', owner: 'producer', visibleToClient: true,
    note: 'השלד שכל לוח הזמנים של יום האירוע ייתלה עליו.',
  },
  {
    title: 'לעצב הזמנה ולאשר נוסח',
    offsetDays: -130, phase: 'experience', owner: 'client', visibleToClient: true,
    note: 'להשאיר זמן להגהה. שם שמאויית לא נכון בהזמנה נשאר שם לנצח.',
  },
  {
    title: 'לסגור עיצוב פרחים סופי',
    offsetDays: -110, phase: 'experience', owner: 'producer', visibleToClient: true,
    note: 'מה שבעונה זול ויפה, ומה שצריך להביא מרחוק ולשלם עליו.',
  },
  {
    title: 'לתאם הסעות, חניה ונגישות',
    offsetDays: -90, phase: 'experience', owner: 'producer', visibleToClient: true,
    note: 'כמה אורחים מגיעים מרחוק, ומי מהמשפחה צריך גישה קרובה.',
  },
  {
    title: 'טעימות ואישור תפריט סופי',
    offsetDays: -75, phase: 'experience', owner: 'client', visibleToClient: true,
    note: 'אחרי הטעימות המחיר למנה כבר לא זז, אז זה הרגע לסגור גם אותו.',
  },

  // ── אורחים ────────────────────────────────────────────────────────────────
  {
    title: 'לשלוח הזמנות',
    offsetDays: -60, phase: 'guests', owner: 'client', visibleToClient: true,
    note: 'שישה עד שמונה שבועות. מוקדם מדי נשכח, מאוחר מדי כבר תפוס.',
  },
  {
    title: 'לפתוח מעקב אישורי הגעה',
    offsetDays: -50, phase: 'guests', owner: 'producer', visibleToClient: true,
    note: 'מהרגע הזה המספר הזה קובע קייטרינג, הושבה והסעות.',
  },
  {
    title: 'לבנות סידור הושבה ראשוני',
    offsetDays: -35, phase: 'guests', owner: 'producer', visibleToClient: true,
    note: 'ראשוני בכוונה. הוא ישתנה עוד שלוש פעמים לפני הערב.',
  },
  {
    title: 'לאסוף העדפות תזונה ומנות מיוחדות',
    offsetDays: -25, phase: 'guests', owner: 'client', visibleToClient: true,
    note: 'צמחוני, טבעוני, ללא גלוטן, אלרגיות. הקייטרינג צריך את המספרים האלה בנפרד.',
  },
  {
    title: 'לתאם לוח זמנים ראשוני עם כל הספקים',
    offsetDays: -20, phase: 'guests', owner: 'producer', visibleToClient: false,
    note: 'מי מגיע מתי, מה הוא צריך במקום, וכמה זמן לוקח לו להתארגן.',
  },

  // ── תיאום אחרון ───────────────────────────────────────────────────────────
  {
    title: 'לאשר מספרים סופיים לקייטרינג',
    offsetDays: -14, phase: 'final', owner: 'producer', visibleToClient: true,
    note: 'המספר שמשלמים עליו. אחריו כל תוספת היא תוספת בתשלום.',
  },
  {
    title: 'לסגור יתרות תשלום לספקים',
    offsetDays: -10, phase: 'final', owner: 'producer', visibleToClient: false,
    note: 'ספק שלא קיבל את היתרה הוא שיחת טלפון שאף אחד לא רוצה ביום האירוע.',
  },
  {
    title: 'להפיץ לוח זמנים ורשימת אנשי קשר לכל הספקים',
    offsetDays: -7, phase: 'final', owner: 'producer', visibleToClient: false,
    note: 'דף אחד, אצל כולם, עם מספר טלפון ליד כל שורה.',
  },
  {
    title: 'לעבור על סדר היום עם הזוג',
    offsetDays: -4, phase: 'final', owner: 'producer', visibleToClient: true,
    note: 'שעה שעה, מהאיפור ועד סוף הערב, כדי שלא יופתעו משום דבר.',
  },
  {
    title: 'לוודא הגעת ציוד ותפאורה',
    offsetDays: -2, phase: 'final', owner: 'producer', visibleToClient: false,
    note: 'מה מגיע יום לפני, מה מגיע בבוקר, ומי פותח את המקום.',
  },

  // ── יום האירוע ────────────────────────────────────────────────────────────
  {
    title: 'יום האירוע: לפתוח את קונסולת יום האירוע',
    offsetDays: 0, phase: 'dayOf', owner: 'producer', visibleToClient: false,
    note: 'לוח הזמנים החי, אנשי הקשר וסימון מה כבר קרה. המסך נשאר דלוק כל הערב.',
  },

  // ── אחרי ──────────────────────────────────────────────────────────────────
  {
    title: 'לסגור תשלומים אחרונים',
    offsetDays: 3, phase: 'after', owner: 'producer', visibleToClient: false,
    note: 'כל עוד הערב טרי בראש של כולם.',
  },
  {
    title: 'לאסוף קבצים מהצלמים ולהעביר לזוג',
    offsetDays: 21, phase: 'after', owner: 'producer', visibleToClient: true,
    note: 'זה הדבר האחרון שהזוג מקבל מכם, והוא זה שהם יזכרו.',
  },
  {
    title: 'לבקש משוב ולתייק את האירוע',
    offsetDays: 35, phase: 'after', owner: 'producer', visibleToClient: false,
    note: 'המלצה נכתבת בקלות בחודש הראשון ובקושי אחרי חצי שנה.',
  },
] as const;
