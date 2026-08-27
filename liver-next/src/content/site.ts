/**
 * Every line of public copy lives here so wording is reviewed in one place.
 * House rule: no long dashes anywhere in headings or body.
 *
 * This is the default and the fallback, not the only source. 0026 adds an
 * override layer so a sentence can be changed on a Tuesday without a deploy;
 * what is written here is what renders when nothing has been overridden, and
 * what renders if the database cannot be reached at all. A missing override is
 * never a missing sentence.
 *
 * Typed rather than `as const`, so an override of a string is a string and an
 * override of a list is a list. The literal types bought nothing: nobody
 * branches on the exact wording of a headline.
 */
export type SiteCopy = {
  brand: string;
  tagline: string;
  hero: { eyebrow: string; headline: string; name: string; body: string[]; cta: string };
  philosophy: { title: string; body: string[] };
  value: { title: string; body: string[] };
  journey: { title: string; steps: string[]; link: string };
  about: { title: string; body: string[] };
  dayOf: { title: string; body: string[] };
  work: { title: string; sub: string };
  academy: { title: string; body: string[]; cta: string };
  closing: { title: string; body: string[]; cta: string };
  budget: { title: string; sub: string; closing: string };
  lead: {
    title: string; sub: string;
    fields: { name: string; phone: string; email: string; kind: string; date: string; guests: string; message: string };
    submit: string; sending: string; okTitle: string; okBody: string;
  };
  fab: { whatsapp: string; booking: string; bookingNote: string; lead: string; whatsappMessage: string };
  nav: { philosophy: string; journey: string; about: string; budget: string; contact: string; login: string };
  footer: string;
};

/**
 * The line the business is built on.
 *
 * His words, written by hand before they were ever typed. It is the headline on
 * the site and it appears in a handful of other places, and it is a constant
 * rather than a string in each of them for one reason: a sentence that is
 * copied is a sentence that eventually differs, and this one is not ours to
 * change by a comma.
 *
 * Used sparingly on purpose. A line that appears everywhere stops being read.
 */
export const PROMISE = 'רגע מאושר שישאר לנצח';

export const site: SiteCopy = {
  brand: 'ברק ליור',
  tagline: 'הפקת חתונות ואירועים',

  hero: {
    eyebrow: 'הפקת חתונות ואירועים',
    headline: PROMISE,
    name: 'ברק ליור',
    body: [
      'יש לכם בראש את החתונה שאתם רוצים.',
      'מהיום, יש גם מי שיודע איך להביא אתכם לשם.',
      'מהפגישה הראשונה ועד סוף האירוע, ברק מחזיק את התכנון, התקציב, הספקים וכל הפרטים שבדרך.',
      'אתם נשארים קרובים לכל החלטה שחשובה לכם.',
      'בלי להחזיק את כל החתונה על הכתפיים.',
    ],
    cta: 'בואו נכיר',
  },

  philosophy: {
    title: 'החתונה שלכם מתחילה בכם',
    body: [
      'לפני שבוחרים מקום, צלם או עיצוב, מבינים מה חשוב לכם.',
      'איך אתם רוצים שהערב ירגיש.',
      'מי האנשים שלכם.',
      'איפה נכון לכם להשקיע.',
      'ועל אילו דברים אתם לא מוכנים להתפשר.',
      'משם נבנית חתונה שמתאימה לכם, גם בחוויה וגם בתקציב.',
    ],
  },

  value: {
    title: 'כשיש מי שמחזיק את התמונה',
    body: [
      'אתם יודעים מה קורה עכשיו ומה השלב הבא.',
      'התקציב נמצא מול העיניים.',
      'הספקים מקבלים תשובות.',
      'ההחלטות מתקבלות בזמן.',
      'והדברים הקטנים לא הופכים לבעיה גדולה שבוע לפני החתונה.',
      'יש לכם כתובת אחת לאורך כל הדרך.',
    ],
  },

  journey: {
    title: 'איך הדרך שלנו נראית',
    steps: [
      'משאירים פרטים',
      'נפגשים ומכירים',
      'מגדירים תקציב וכיוון',
      'מחפשים וסוגרים לוקיישן',
      'בוחרים את האנשים הנכונים סביבכם',
      'בונים ומפיקים את החתונה עד הפרט האחרון',
    ],
    link: 'לכל תהליך העבודה',
  },

  about: {
    title: 'האדם שהולך איתכם',
    body: [
      'עם למעלה מ8 שנות ניסיון בהפקת מאות אירועי יוקרה, חתונות שטח ואירועים מורכבים, ברק ליור מביא להפקה שילוב ייחודי של פיקוד, ניהול אסטרטגי, שקט תעשייתי ושיחה בגובה העיניים.',
      'מישהו שיידע מתי להקשיב לכם, מתי לבדוק שוב את המספרים ומתי להגיד שמשהו פחות נכון עבורכם.',
      'כי בסוף אתם צריכים להרגיש שיש לידכם אדם שאתם סומכים עליו.',
    ],
  },

  work: {
    title: 'עבודות אחרונות',
    sub: 'שמונה רגעים מאירועים שהופקו בשנה האחרונה.',
  },

  dayOf: {
    title: 'וביום החתונה',
    body: [
      'מגיע הרגע שבו מפסיקים לתכנן.',
      'האנשים שלכם מגיעים.',
      'המוזיקה מתחילה.',
      'והחתונה שחיכיתם לה קורית.',
      'מאחורי הקלעים ברק כבר יודע מי מגיע, מתי, מה סוכם ומה צריך לקרות בכל רגע.',
      'אתם פנויים להיות בחתונה שלכם.',
    ],
  },

  academy: {
    title: 'רוצים לתכנן בעצמכם?',
    body: [
      'יש זוגות שרוצים להחזיק את ההפקה בידיים שלהם.',
      'בשבילם נבנה הקורס הדיגיטלי של ברק.',
      'תהליך מסודר לתכנון חתונה, עם הידע, הכלים והשלבים שמפיק עובד לפיהם.',
      'מהתקציב והלוקיישן ועד הספקים, החוזים ויום האירוע.',
    ],
    cta: 'לקורס הדיגיטלי',
  },

  closing: {
    title: 'מתחילים בפגישה',
    body: [
      'ספרו לברק איפה אתם נמצאים היום ואיזו חתונה אתם רוצים.',
      'כאן תגלו איך תהליך שלם הופך לפשוט, מדויק ורגוע.',
      'מכאן תראו אם נכון לצעוד יחד.',
    ],
    cta: 'קובעים פגישת היכרות',
  },

  budget: {
    title: 'כמה חתונה כזאת עולה',
    sub: 'הזינו כמה פרטים וקבלו חלוקה ראשונית. זו נקודת פתיחה, לא הצעת מחיר.',
    closing: 'רוצים שברק יעבור איתכם על המספרים? קבעו פגישת היכרות',
  },

  lead: {
    title: 'נעים להכיר',
    sub: 'משאירים פרטים וברק חוזר אליכם בדרך כלל תוך יום עסקים.',
    fields: {
      name: 'שם מלא',
      phone: 'טלפון',
      email: 'אימייל',
      kind: 'סוג האירוע',
      date: 'תאריך משוער',
      guests: 'כמות אורחים',
      message: 'משהו שחשוב שנדע',
    },
    submit: 'שליחה',
    sending: 'שולח',
    okTitle: 'תודה, קיבלנו',
    okBody: 'הפרטים הגיעו לברק והוא יחזור אליכם בקרוב.',
  },

  fab: {
    whatsapp: 'וואטסאפ',
    booking: 'פגישת היכרות',
    bookingNote: 'חצי שעה ביומן של ברק',
    lead: 'השאירו פרטים',
    whatsappMessage: 'היי ברק, הגעתי מהאתר ואשמח לשמוע פרטים על הפקת החתונה שלנו.',
  },

  nav: {
    philosophy: 'הגישה',
    journey: 'התהליך',
    about: 'על ברק',
    budget: 'תקציב',
    contact: 'יצירת קשר',
    login: 'כניסה',
  },

  footer: 'הפקת אירועים. כל הזכויות שמורות.',
};

export const EVENT_KINDS = [
  { value: 'wedding',   label: 'חתונה' },
  { value: 'corporate', label: 'אירוע עסקי' },
] as const;

export const MIN_EVENT_DATE = '2026-01-01';
export const MAX_GUESTS = 1500;

/** Copy for the signed-in area. Same house rule: no long dashes. */
export const auth = {
  title: 'כניסה לאזור האישי',
  sub: 'נשלח לכם קוד חד פעמי. אין סיסמאות לזכור.',
  byEmail: 'אימייל',
  byPhone: 'טלפון',
  emailLabel: 'כתובת אימייל',
  phoneLabel: 'מספר טלפון',
  phoneHint: 'למשל 050-1234567',
  newHere: 'זו הפעם הראשונה שלי כאן',
  nameLabel: 'שם מלא',
  brandLabel: 'שם העסק (למפיקים)',
  submit: 'שליחת קוד',
  sending: 'שולח',
  note: 'זוגות מוזמנים נכנסים עם הכתובת או המספר שקיבלו את ההזמנה. מפיק חדש נכנס לאישור לפני שהחשבון נפתח.',
  codeTitle: 'הקוד בדרך',
  codeSentEmail: 'שלחנו קוד חד פעמי לכתובת',
  codeSentPhone: 'שלחנו קוד חד פעמי במסרון למספר',
  codeLabel: 'הקוד שקיבלתם',
  codeSubmit: 'כניסה',
  codeChecking: 'בודק',
  codeBackEmail: 'לשנות כתובת',
  codeBackPhone: 'לשנות מספר',
  validFor: (mmss: string) => `הקוד בתוקף עוד ${mmss}`,
  expired: 'הקוד כנראה כבר לא בתוקף. אפשר לבקש חדש.',
  resend: 'שליחת קוד חדש',
  resendIn: (s: number) => `אפשר לבקש קוד חדש בעוד ${s} שניות`,
  resendSending: 'שולח קוד חדש',
  resentEmail: 'שלחנו קוד חדש לאימייל.',
  resentPhone: 'שלחנו קוד חדש במסרון.',
  switchToEmail: 'לשלוח קוד לאימייל במקום',
  switchToPhone: 'לשלוח קוד ב-SMS במקום',
  linkExpired: 'הקישור כבר שימש או שפג תוקפו. נשלח לכם קוד חדש לאותה כתובת.',
  linkMissing: 'הקישור לא היה שלם. אפשר להיכנס מכאן.',
} as const;

/* ── נגישות ───────────────────────────────────────────────────────────────
   The wording is the previous site's, unchanged. It names the standard the
   statement is made under, and a statement that names the wrong standard is
   worse than none. */
export const a11yCopy = {
  open: 'תפריט נגישות',
  title: 'הגדרות נגישות',
  sub: 'התאימו את התצוגה לצרכים שלכם. ההגדרות חלות על כל המסכים ונשמרות בדפדפן הזה.',
  font: 'הגדלת טקסט',
  smaller: 'הקטנת טקסט',
  bigger: 'הגדלת טקסט',
  contrast: 'ניגודיות גבוהה',
  links: 'הדגשת קישורים',
  readable: 'ריווח מוגדל לקריאה',
  motion: 'עצירת אנימציות',
  cursor: 'סמן גדול',
  reset: 'איפוס הגדרות',
  resetOk: 'ההגדרות אופסו.',
  on: 'מופעל',
  off: 'כבוי',
  close: 'סגירה',
  statement: 'הצהרת נגישות',
  statementBody:
    'האתר נבנה בהתאם לתקן הישראלי ת"י 5568 ולהנחיות WCAG 2.1 ברמה AA: ניווט מלא במקלדת, '
    + 'תמיכה בקוראי מסך, ניגודיות תקנית, טקסט חלופי לתמונות ואפשרות התאמה אישית. '
    + 'נתקלתם בבעיית נגישות? כתבו לנו ונתקן.',
  statementMore: 'להצהרת הנגישות המלאה',
  page: {
    title: 'הצהרת נגישות',
    sub: 'מה נעשה כאן כדי שהאתר יהיה שמיש לכולם, ואיך לפנות אלינו אם משהו לא עובד.',
    standardTitle: 'התקן שלפיו נבנה האתר',
    standard:
      'האתר נבנה בהתאם לתקן הישראלי ת"י 5568 ולהנחיות WCAG 2.1 ברמה AA.',
    doneTitle: 'מה קיים באתר',
    done: [
      'ניווט מלא במקלדת, כולל קישור דילוג לתוכן הראשי.',
      'תמיכה בקוראי מסך: מבנה כותרות תקין, תוויות לכל שדה, וטקסט חלופי לכל תמונה.',
      'ניגודיות צבעים נמדדת ולא מוערכת. כל צירוף של טקסט ורקע באתר נבדק אוטומטית מול הסף של WCAG.',
      'תפריט התאמה אישית: הגדלת טקסט, ניגודיות גבוהה, הדגשת קישורים, גופן קריא ומרווח, עצירת אנימציות וסמן גדול.',
      'ההגדרות נשמרות בדפדפן וממשיכות לחול בכל כניסה.',
      'האתר מכבד את הגדרת מערכת ההפעלה לצמצום תנועה.',
    ],
    limitsTitle: 'מגבלות ידועות',
    limits:
      'קבצים שהועלו על ידי משתמשים, כמו תמונות שזוג מוסיף לכספת ההשראה, אינם בשליטתנו '
      + 'ועשויים להגיע ללא טקסט חלופי.',
    contactTitle: 'פנייה בנושא נגישות',
    contact:
      'נתקלתם במשהו שלא עובד, או שיש לכם הצעה? נשמח לשמוע ונתקן.',
    updated: 'עודכן לאחרונה',
  },
} as const;

export const appCopy = {
  signOut: 'יציאה',
  overview2: {
    clear: 'הכל מטופל',
    clearSub: 'אין כרגע שום דבר שממתין להחלטה שלך.',
    needsYou: 'מחכה להחלטה שלך',
    now: 'דחוף',
    soon: 'השבוע',
    nextEvent: 'האירוע הקרוב',
    inDays: (n: number) => (n === 0 ? 'היום' : n === 1 ? 'מחר' : `בעוד ${n} ימים`),
    money: 'כסף',
    paid: 'שולם',
    owed: 'פתוח',
    overdue: 'באיחור',
    allClients: 'לכל האירועים',
    seeAll: 'הצגת הכל',
  },

  profile: {
    title: 'הפרופיל שלי',
    sub: 'השם והתמונה שאתם מופיעים בהם מול כל מי שעובד איתכם על האירוע.',
    name: 'שם מלא',
    picture: 'תמונת פרופיל',
    choose: 'בחירת תמונה',
    replace: 'החלפת תמונה',
    remove: 'הסרת התמונה',
    hint: 'JPG, PNG או WEBP · עד 5MB',
    saving: 'שומר…',
    save: 'שמירה',
    saved: 'נשמר',
    tooBig: 'הקובץ גדול מ-5MB. בחרו תמונה קטנה יותר.',
    notImage: 'אפשר להעלות רק תמונה.',
    uploadFailed: 'ההעלאה נכשלה. נסו שוב.',
  },

  insights: {
    title: 'נתונים',
    sub: 'איפה העסק עומד באמת, ולא איך הוא מרגיש.',
    empty: 'עוד אין מספיק נתונים כדי להראות כאן משהו אמיתי. אחרי כמה לידים ואירועים המסך הזה מתמלא לבד.',
    thin: 'מעט מדי נתונים',
    thinHint: 'אחוזים מוצגים רק מחמישה מקרים ומעלה. עד אז מוצג המספר עצמו.',
    ofPrev: 'מהשלב הקודם',

    funnel: {
      title: 'מהפנייה לחוזה',
      sub: 'כל שלב נספר יחד עם מה שאחריו, כדי שהמסך לא יראה יותר חתימות משיחות.',
      leads: 'פניות',
      contacted: 'נענו',
      meeting: 'פגישה',
      won: 'נסגרו',
    },

    sources: {
      title: 'מאיפה מגיעה העבודה',
      sub: 'ערוץ עם פנייה אחת שנסגרה הוא פנייה אחת, לא מאה אחוז.',
      source: 'ערוץ',
      leads: 'פניות',
      won: 'נסגרו',
      rate: 'אחוז סגירה',
      unknown: 'לא ידוע',
    },

    response: {
      title: 'כמה זמן פנייה מחכה',
      sub: 'החציון ולא הממוצע. פנייה אחת ששכחנו במשך שבועיים לא אמורה לצבוע את כל החודש.',
      median: 'זמן תגובה חציוני',
      answered: 'פניות שנענו',
      waiting: 'ממתינות למענה',
      hours: (n: number) => (n < 1 ? 'פחות משעה' : n < 2 ? 'שעה' : `${n} שעות`),
      none: 'אין עדיין מספיק פניות שנענו',
    },

    cash: {
      title: 'כסף',
      sub: 'שלושה מספרים ולא אחד. מה שנכנס, מה שעוד אמור להיכנס, ומה שהיה אמור להיכנס וטרם נכנס.',
      collected: 'נגבה',
      due: 'פתוח',
      overdue: 'באיחור',
      overdueCount: (n: number) => (n === 1 ? 'תשלום אחד' : `${n} תשלומים`),
    },

    health: {
      title: 'מה דורש טיפול',
      signed: 'אירועים עם חוזה חתום',
      overdueTasks: 'משימות באיחור',
      waiting: 'פניות שאף אחד עוד לא ענה',
      clear: 'אין כרגע צווארי בקבוק.',
      toLeads: 'למסך הלידים',
      toClients: 'לאירועים',
    },
  },

  dayOf: {
    title: 'חמ״ל האירוע',
    sub: 'מה קורה עכשיו, מה הבא בתור, ומי אמור להיות כאן.',
    open: 'פתיחת חמ״ל',
    notToday: 'האירוע לא היום, אז אין כאן שעון שרץ. הלוז מוצג כמו שהוא נכתב.',
    empty: 'עוד אין לוז לאירוע הזה. אפשר לבנות אותו במסך האירוע.',
    toEvent: 'למסך האירוע',
    now: 'עכשיו',
    next: 'הבא בתור',
    nothingNow: 'כרגע לא רשום שום דבר',
    nothingNext: 'זה היה הדבר האחרון בלוז',
    done: 'בוצע',
    late: 'עבר הזמן',
    tick: 'סימון כבוצע',
    untick: 'ביטול הסימון',
    doneAt: (t: string) => `סומן ב-${t}`,
    schedule: 'כל הלוז',
    openCount: (n: number) => (n === 1 ? 'שורה אחת פתוחה' : `${n} שורות פתוחות`),

    people: {
      title: 'מי אמור להיות כאן',
      sub: 'צוות וספקים ברשימה אחת, לפי שעת ההגעה.',
      dueSoon: 'אמורים להגיע עכשיו',
      noTime: 'בלי שעה',
      call: 'חיוג',
      whatsapp: 'וואטסאפ',
      crew: 'צוות',
      vendor: 'ספק',
      empty: 'עוד לא נרשמו אנשים לאירוע הזה.',
      here: 'הגיע',
      arrived: 'כאן',
      arrivedAt: (t: string) => `הגיע ב-${t}`,
      undo: 'ביטול',
      missing: 'טרם הגיעו',
      headcount: (here: number, of: number) => `${here} מתוך ${of} כאן`,
    },

    alert: {
      inMinutes: (n: number) => (n === 0 ? 'מתחיל עכשיו' : n === 1 ? 'עוד דקה' : `עוד ${n} דקות`),
      dismiss: 'הבנתי',
    },

    keyMoment: 'רגע מרכזי',

    broadcast: {
      title: 'הודעה לכולם',
      sub: 'פותח וואטסאפ לכל אחד בנפרד עם אותה הודעה. אין כאן שליחה אוטומטית: הודעה לספק באמצע ערב נשלחת בידיים.',
      open: 'הודעת חירום',
      placeholder: 'מה קורה ומה צריך לעשות',
      presets: [
        'שינוי בלוז, נא להתעדכן איתי לפני שממשיכים.',
        'צריך אתכם עכשיו בכניסה הראשית.',
        'עיכוב של רבע שעה, אין צורך למהר.',
      ],
      send: 'פתיחת וואטסאפ',
      to: 'למי',
      allHere: 'לכל מי שכאן',
      allMissing: 'לכל מי שטרם הגיע',
      everyone: 'לכולם',
      noPhones: 'לאף אחד ברשימה אין מספר טלפון שמור.',
      count: (n: number) => (n === 1 ? 'איש קשר אחד' : `${n} אנשי קשר`),
      cancel: 'סגירה',
    },
  },

  brand: {
    title: 'המיתוג שלי',
    sub: 'איך העסק שלך נראה לזוגות שעובדים איתך. אף אחד מהם לא רואה את שם הפלטפורמה.',
    name: 'שם העסק',
    namePh: 'קרן הפקות',
    tagline: 'משפט מלווה',
    taglinePh: 'חתונות בוטיק בצפון',
    logo: 'לוגו',
    logoHint: 'PNG או SVG על רקע שקוף · עד 5MB',
    logoChoose: 'בחירת לוגו',
    logoReplace: 'החלפת לוגו',
    logoRemove: 'הסרת הלוגו',
    accent: 'צבע מוביל',
    accentHint: 'הצבעים כאן נבדקו לקריאוּת מול הרקע והטקסט. לכן זו רשימה ולא בורר צבעים חופשי.',
    whatsapp: 'וואטסאפ',
    booking: 'קישור לתיאום פגישה',
    address: 'כתובת באינטרנט',
    slug: 'תת דומיין',
    slugHint: 'אותיות באנגלית, ספרות ומקפים. כך זה ייראה: ',
    domain: 'דומיין משלך',
    domainHint: 'רק רישום. חיבור ה-DNS עצמו הוא פעולה נפרדת שנעשה בנפרד ובכוונה.',
    preview: 'תצוגה מקדימה',
    save: 'שמירה',
    saving: 'שומר…',
    saved: 'נשמר',
    failed: 'לא הצלחנו לשמור. נסו שוב.',
    slugTaken: 'תת הדומיין הזה כבר תפוס.',
    slugShape: 'אותיות באנגלית קטנות, ספרות ומקפים בלבד.',
  },

  sheets: {
    close: 'סגירה',
    contact: {
      open: 'שיחה עם המפיק',
      title: 'ברק ליור · מפיק האירוע',
      sub: 'זמין בימים א׳ עד ה׳, 09:00 עד 19:00',
      call: 'שיחה טלפונית',
      whatsapp: 'הודעה בוואטסאפ',
      whatsappMeta: 'מענה עד שעה',
      meeting: 'קביעת פגישה',
      meetingMeta: 'יומן פנוי',
    },
    report: {
      open: 'דיווח על בעיה',
      title: 'דיווח על בעיה',
      sub: 'הדיווח נשלח ישירות לחמ״ל ההפקה ומתועד באירוע.',
      topics: ['לו״ז ותזמון', 'ספק לא עונה', 'תשלום', 'אישורי הגעה', 'תקלה באפליקציה', 'אחר'],
      placeholder: 'מה קרה? אפשר להוסיף פרטים',
      submit: 'שליחת דיווח',
      sending: 'שולח…',
      sent: 'הדיווח נשלח לחמ״ל',
      failed: 'לא הצלחנו לשלוח. נסו שוב.',
      empty: 'נא לכתוב מה קרה',
    },
  },

  nav: {
    overview: 'סקירה',
    leads: 'לידים',
    clients: 'אירועים',
    calendar: 'יומן',
    insights: 'נתונים',
    brand: 'מיתוג',
    vendors: 'ספקים',
    sop: 'מדריכים',
    site: 'האתר',
    admin: 'ניהול מערכת',
    portal: 'האזור שלנו',
    more: 'עוד',
    moreTitle: 'עוד מסכים',
    close: 'סגירה',
  },
  pending: {
    title: 'החשבון ממתין לאישור',
    body: [
      'נרשמתם בהצלחה, והחשבון נפתח אחרי אישור של מנהל המערכת.',
      'עד אז אין גישה לנתונים ואין מה לעשות כאן.',
      'ברגע שהחשבון יאושר, הכניסה תעבוד מאותה כתובת בדיוק.',
    ],
    statusLabel: 'סטטוס',
    statuses: {
      pending: 'ממתין לאישור',
      approved: 'מאושר',
      suspended: 'מושהה',
      rejected: 'נדחה',
    },
  },
  overview: {
    greeting: 'שלום',
    leadsTitle: 'לידים חדשים',
    clientsTitle: 'אירועים פעילים',
    tasksTitle: 'משימות פתוחות',
    empty: 'אין עדיין מה להציג כאן.',
  },
  leads: {
    title: 'לידים',
    sub: 'כל פנייה שהגיעה מהאתר, לפי סדר הגעה.',
    empty: 'עוד לא הגיעו פניות.',
    cols: { name: 'שם', contact: 'יצירת קשר', event: 'אירוע', date: 'תאריך', guests: 'אורחים', status: 'סטטוס' },
    statuses: { new: 'חדש', contacted: 'יצרנו קשר', meeting: 'נקבעה פגישה', won: 'נסגר', lost: 'לא רלוונטי' },
  },
  clients: {
    title: 'אירועים',
    sub: 'כל זוג או לקוח עם מרחב עבודה משלו.',
    empty: 'עוד לא נפתחו אירועים.',
    cols: { name: 'שם', date: 'תאריך', venue: 'מקום', guests: 'אורחים' },
    noDate: 'טרם נקבע',
  },
  admin: {
    title: 'ניהול מערכת',
    sub: 'מי על הפלטפורמה, מי עובד, ומה פתוח לכל סוג לקוח.',
    waiting: 'ממתינים לאישור',
    producers: 'מפיקים',
    empty: 'עוד לא נרשם אף מפיק.',
    approve: 'אישור',
    reject: 'דחייה',
    suspend: 'השהיה',
    restore: 'החזרה לפעילות',
    rootBadge: 'בעל המערכת',
    oneLive: 'אירוע פעיל',
    manyLive: 'אירועים פעילים',
    ofTotal: 'מתוך',
    never: 'טרם נכנס',
    lastSeen: 'נכנס לאחרונה',
    statsFailed: 'לא הצלחנו לקרוא את המספרים כרגע.',

    /* The screen says out loud what it cannot show. An empty list where a
       list used to be reads as a bug; a sentence reads as a decision. */
    privacy: {
      title: 'מה המסך הזה לא מראה',
      body: [
        'אירועים, אורחים, תקציבים, חוזים והודעות של מפיקים אחרים אינם נגישים מכאן, וגם לא דרך שאילתה ישירה.',
        'זה נאכף במסד הנתונים ולא בקוד של המסך, כך שאין מסלול עוקף.',
        'המחיר: אי אפשר להציץ באירוע של מפיק אחר כדי להבין למה משהו נראה לו מוזר. תמיכה נעשית בשיתוף מסך.',
      ],
    },

    stats: {
      title: 'תמונת מצב',
      users: 'משתמשים',
      active30: 'פעילים ב-30 יום',
      neverSeen: 'נרשמו וטרם נכנסו',
      producers: 'מפיקים',
      approved: 'מאושרים',
      pending: 'ממתינים',
      blocked: 'מושהים או נדחו',
      couples: 'זוגות',
      managed: 'בליווי מפיק',
      diy: 'עצמאיים',
      events: 'אירועים',
      live: 'פעילים',
      leads: 'לידים',
      last30: 'ב-30 יום',
    },

    board: {
      title: 'מי עובד',
      sub: 'מספרים בלבד. אין כאן שם של אף זוג ואף אירוע.',
      events: 'אירועים',
      leads: 'לידים',
      signed: 'חוזים חתומים',
    },

    flags: {
      title: 'מה פתוח למי',
      sub: 'זוג עצמאי וזוג בליווי מפיק אינם אותו לקוח. כאן נקבע מה כל אחד מהם מקבל.',
      diy: 'עצמאי',
      managed: 'בליווי',
      on: 'פתוח',
      off: 'סגור',
      saved: 'נשמר',
      note: 'למפיק עצמו שום דבר לא נסגר. הבידול הוא במה שהזוג מקבל.',
    },
  },
  newClient: {
    title: 'אירוע חדש',
    open: 'פתיחת אירוע',
    sub: 'פותחים מרחב עבודה, ואחר כך מזמינים את הזוג אליו.',
    name: 'שם האירוע',
    namePh: 'נועה ואיתי',
    kind: 'סוג האירוע',
    date: 'תאריך',
    venue: 'מקום',
    guests: 'הערכת אורחים',
    submit: 'פתיחת האירוע',
    saving: 'פותח',
    cancel: 'ביטול',
  },
  live: {
    offline: 'אין חיבור, המסך עלול לא להיות מעודכן',
  },

  guestImport: {
    open: 'ייבוא רשימה מקובץ',
    export: 'ייצוא לאקסל',
    hint: 'קובץ CSV מאקסל או מגוגל שיטס. הכותרות יכולות להיות בעברית או באנגלית, שם מלא, צד, טלפון, כמות. גם קובץ בלי כותרות יעבוד.',
    orPaste: 'או להדביק ישירות:',
    pastePh: 'נועה כהן,כלה,0501111111\nדני לוי,חתן,0502222222',
    import: 'ייבוא',
    importing: 'מייבא',
    added: 'נוספו',
    duplicates: 'כבר היו ברשימה',
    nothingNew: 'כולם כבר היו ברשימה. לא נוסף אף אחד.',
    skipped: 'שורות שלא נקלטו',
    line: 'שורה',
  },

  calendar: {
    title: 'יומן',
    sub: 'האירועים, מה שצריך לקרות לפניהם, ומתי הכסף אמור להיכנס, על אותו ציר.',
    subscribe: 'הורדת קובץ יומן',
    empty: 'אין כלום ביומן קדימה.',
    addEvent: 'הוספת האירוע ליומן',

    feed: {
      title: 'יומן מתעדכן לבד',
      sub: 'הקובץ להורדה הוא צילום מצב של היום. מנוי מתעדכן לבד בכל פעם שמשהו זז.',
      create: 'יצירת קישור מנוי',
      creating: 'רגע…',
      open: 'פתיחה ביומן',
      copy: 'העתקת הכתובת',
      copied: 'הועתק',
      revoke: 'ביטול הקישור',
      revoked: 'הקישור בוטל. אפשר ליצור חדש בכל רגע.',
      warning: 'הכתובת הזו היא המפתח. כל מי שמחזיק אותה רואה את היומן, אז לא לשתף אותה.',
      how: 'באייפון הקישור נפתח ישירות ביומן. בגוגל קלנדר יש להדביק את הכתובת תחת הוספת יומן, מכתובת אינטרנט.',
    },
  },

  runsheet: {
    title: 'לוז יום האירוע',
    back: 'חזרה לאירוע',
    print: 'הדפסה / שמירה כ-PDF',
    audience: 'למי הלוז',
    everyone: 'הכול',
    sheetFor: 'לוז עבור:',
    noDate: 'טרם נקבע תאריך',
    empty: 'עוד לא נבנה לוז ליום האירוע.',
    emptyForRole: 'אין שורות המסומנות לתפקיד הזה. שורה בלי סימון מופיעה אצל כולם.',
    printedOn: 'הופק ב-',
    open: 'לוז ליום האירוע',
    owner: 'אחראי',
    pastMidnight: '(אחרי חצות)',
  },

  statusBoard: {
    noDate: 'ללא תאריך',
    daysLeft: 'ימים',
    daysAgo: 'ימים',
    passed: 'עבר',
    next: 'הבא:',
    attending: 'מגיעים',
    owed: 'לתשלום',
    open: 'פתיחת',
    close: 'סגירת תיק',
    reopen: 'החזרה לפעילים',
    tabLive: 'פעילים',
    tabDone: 'סגורים',
    emptyDone: 'עוד לא נסגר אף תיק. אירוע שעבר יופיע כאן אחרי שתסגרו אותו.',
    allClear: 'הכול מסודר. אין פערים פתוחים באף אירוע.',
  },

  preview: {
    title: 'תצוגת הזוג',
    banner: 'אתם רואים את המסך של הזוג',
    exit: 'חזרה לניהול האירוע',
    moneyShared: 'התקציב והתשלומים פתוחים לזוג, ולכן מופיעים כאן.',
    moneyHidden: 'התקציב והתשלומים סגורים לזוג, ולכן לא מופיעים כאן.',
    open: 'לראות כמו הזוג',
  },

  clientPage: {
    back: 'חזרה לאירועים',
    details: 'פרטי האירוע',

    /* The event file, in sections. One page holding nine panels is not a file,
       it is a scroll, and the thing somebody came for is always below the
       fold. */
    tabs: {
      overview: 'סקירה',
      tasks: 'משימות',
      day: 'לוז',
      guests: 'אורחים',
      crew: 'צוות וספקים',
      bar: 'בר',
      money: 'כסף',
      docs: 'מסמכים',
      files: 'קבצים',
      messages: 'הודעות',
      board: 'השראה',
    },

    edit: 'עריכת פרטים',
    editSave: 'שמירה',
    editSaving: 'שומר',
    editCancel: 'ביטול',
    noDateYet: 'עוד לא נקבע תאריך',
    setDate: 'קביעת תאריך',
    daysLeft: 'ימים לאירוע',
    today: 'האירוע היום',
    tomorrow: 'האירוע מחר',
    passed: 'האירוע היה',
    daysAgo: (n: number) => `לפני ${n} ימים`,

    at: {
      guests: 'אורחים',
      confirmed: 'אישרו',
      pending: 'טרם ענו',
      declined: 'לא מגיעים',
      seats: 'נפשות',
      paid: 'שולם',
      owed: 'נותר לגבות',
      overdue: 'באיחור',
      tasksOpen: 'משימות פתוחות',
      dayLines: 'שורות בלוז',
      contracts: 'מסמכים חתומים',
      none: '·',
    },

    nextUp: 'הדבר הבא',
    nextUpNone: 'אין כרגע משימה פתוחה או תשלום שממתין.',
    openTab: 'פתיחה',

    access: 'מי נכנס לאזור הזוג',
    accessSub: 'עד שלוש כתובות, לכל אחד מהן כניסה משלה לאותו אירוע. הכניסה היא עם הכתובת עצמה, בקוד חד פעמי, בלי סיסמה.',
    accessNone: 'עוד לא צורפה אף כתובת. עד שתצרפו, לזוג אין דרך להיכנס.',
    invitePh: 'כתובת אימייל',
    invite: 'צירוף והזמנה',
    inviting: 'שולח',
    invited: 'ההזמנה נשלחה',
    revoke: 'הסרה',
    joined: 'נכנס למערכת',
    pendingJoin: 'טרם נכנס',
    full: 'שלוש הכתובות תפוסות. להסיר אחת כדי לצרף אחרת.',
    notFound: 'האירוע לא נמצא.',
  },

  tasks: {
    title: 'משימות',
    subProducer: 'רשימה משותפת. שני הצדדים רואים אותה ושניהם יכולים לסמן.',
    subClient: 'מה שנשאר לעשות, ומה שכבר סגור.',
    add: 'הוספת משימה',
    adding: 'מוסיף',
    titlePh: 'מה צריך לעשות',
    due: 'עד מתי',
    owner: 'על מי',
    ownerProducer: 'עלינו',
    ownerClient: 'עליכם',
    ownerProducerClientView: 'על ההפקה',
    ownerClientClientView: 'עלינו',
    none: 'אין עדיין משימות.',
    open: 'פתוחות',
    done: 'הושלמו',
    overdue: 'באיחור',
    noDue: 'בלי תאריך',
    remove: 'מחיקה',
    byProducer: 'נכתב על ידי ההפקה',
    byClient: 'נכתב על ידי הזוג',
  },

  money: {
    payTitle: 'תשלומים',
    paySubProducer: 'מה הזוג שילם ומה עוד פתוח. הזוג רואה את זה, ורק אתם מסמנים ששולם.',
    paySubClient: 'מה שולם ומה עוד פתוח.',
    payWhat: 'על מה',
    payWhatPh: 'מקדמה',
    payAmount: 'סכום',
    payDue: 'לתשלום עד',
    payAdd: 'הוספת תשלום',
    payAdding: 'מוסיף',
    payNone: 'עוד לא נרשמו תשלומים.',
    paid: 'שולם',
    unpaid: 'פתוח',
    overdue: 'באיחור',
    totalPaid: 'שולם',
    totalOwed: 'נותר לתשלום',
    totalAll: 'סך הכל',
    markPaid: 'סימון ששולם',
    markUnpaid: 'ביטול הסימון',
    remove: 'מחיקה',
    noDue: 'בלי תאריך',

    budTitle: 'תקציב',
    budSub: 'אומדן מול מה שנסגר בפועל, לפי סעיף.',
    budLabel: 'סעיף',
    budLabelPh: 'קייטרינג',
    budCategory: 'קטגוריה',
    budVendor: 'ספק',
    budEstimate: 'אומדן',
    budAgreed: 'נסגר בפועל',
    budAdd: 'הוספת סעיף',
    /* Reading a receipt fills the form. It never saves, and the wording says
       so, because a producer who believes the line was added will not look. */
    scan: 'צילום קבלה',
    scanning: 'קורא את הקבלה',
    scanHint: 'צלמו קבלה של ספק והשדות יתמלאו. שום דבר לא נשמר עד שתלחצו על ההוספה.',
    scanFilled: 'מילאתי לפי הקבלה. תבדקו ותוסיפו.',
    scanUnsure: 'מילאתי מה שהצלחתי לקרוא, אבל לא הכל היה ברור. כדאי לבדוק את הסכום.',
    scanFailed: 'לא הצלחתי לקרוא את התמונה. אפשר למלא ידנית.',
    scanTooBig: 'התמונה גדולה מדי. נסו לצלם שוב.',
    budNone: 'עוד לא נרשמו סעיפי תקציב.',
    budTotalEst: 'סך האומדן',
    budTotalAgreed: 'סך מה שנסגר',
    budDiff: 'הפרש',
    budUnder: 'מתחת לאומדן',
    budOver: 'מעל האומדן',
    budShow: 'הזוג רואה את התקציב',
    budHidden: 'מוסתר מהזוג',
    budVisible: 'גלוי לזוג',
    budHiddenNote: 'התקציב מוסתר מהזוג. אפשר לפתוח להם אותו בכל רגע.',
  },

  board: {
    title: 'לוח ניצחון',
    subClient: 'התמונות שגרמו לכם להגיד "זה זה". כל מה שנאסף כאן עובר איתנו לספקים.',
    subProducer: 'התמונות שהזוג אסף. תצוגה בלבד, הם מנהלים את הלוח מהאזור שלהם.',
    upload: 'העלאת תמונה',
    uploading: 'מעלה',
    caption: 'כיתוב',
    captionPh: 'מה אהבתם כאן',
    category: 'קטגוריה',
    all: 'הכל',
    none: 'עדיין אין תמונות בלוח.',
    noneProducer: 'הזוג עוד לא העלה תמונות.',
    remove: 'הסרה',
    tooBig: 'התמונה גדולה מדי. עד 8MB.',
  },

  files: {
    title: 'קבצים ותמונות',
    subClient: 'כל מה שרציתם להעביר לנו ולא ידעתם לאן. תמונות, הזמנה, רשימה, תוכנית מהאולם.',
    subProducer: 'התיקייה המשותפת של האירוע. מה שהזוג העלה ומה שהעליתם להם.',
    add: 'הוספת קבצים',
    adding: 'מעלה',
    drop: 'גוררים לכאן, או בוחרים מהמכשיר',
    dropHint: 'עד 50MB לקובץ. תמונות, PDF, וורד, אקסל, וידאו ואודיו.',
    none: 'עדיין אין כאן קבצים.',
    noneProducer: 'עדיין לא הועלו קבצים לאירוע הזה.',
    open: 'פתיחה',
    download: 'הורדה',
    remove: 'הסרה',
    note: 'הערה',
    notePh: 'מה זה הקובץ הזה',
    noteSave: 'שמירה',
    by: 'הועלה על ידי',
    photos: 'תמונות',
    documents: 'מסמכים',
    tooBig: 'הקובץ גדול מדי. עד 50MB.',
    badType: 'סוג הקובץ הזה לא נתמך',
    failed: 'ההעלאה נכשלה. נסו שוב.',
  },

  portal: {
    title: 'האזור שלנו',
    sub: 'כל מה שקשור לאירוע שלכם, במקום אחד.',
    empty: 'עוד לא שויך לכם אירוע. ברק יפתח אותו ותקבלו הודעה.',
    daysLeft: 'ימים לאירוע',
    dateTbd: 'התאריך עוד לא נקבע',
    summary: 'סקירה מהירה',
    rowBudget: 'תקציב',
    rowRsvp: 'אישורי הגעה',
    rowBoard: 'כספת השראה',
    rowVendors: 'חמ״ל ספקים',
  },
} as const;

/** The one screen a guest ever sees. They have no account and no context
 *  beyond the link they were sent, so it says who it is for and what it is
 *  about before it asks anything. */
export const rsvpCopy = {
  eyebrow: 'אישור הגעה',
  hello: 'שלום',
  invitedTo: 'הוזמנתם ל',
  question: 'מגיעים?',
  yes: 'כן, נגיע',
  no: 'לא נוכל להגיע',
  howMany: 'כמה אנשים תהיו',
  howManyHint: 'כולל אתכם.',
  diet: 'העדפת אוכל',
  note: 'משהו שחשוב שנדע',
  notePh: 'אלרגיה, כיסא לתינוק, כל דבר',
  submit: 'שליחת התשובה',
  sending: 'שולח',
  already: 'כבר עניתם. אפשר לשנות את התשובה כאן.',
  okComing: 'מעולה, נתראה!',
  okComingBody: 'רשמנו אתכם. נשמח לראותכם.',
  okNotComing: 'תודה שעדכנתם',
  okNotComingBody: 'חבל שלא תוכלו להגיע. תודה שהודעתם.',
  changeLater: 'אם משהו ישתנה, אפשר לחזור לקישור הזה ולעדכן.',
  badLink: 'הקישור לא נמצא',
  badLinkBody: 'יכול להיות שהקישור הועתק חלקית, או שההזמנה כבר לא בתוקף. אפשר לפנות לזוג.',
} as const;

export const guestsCopy = {
  title: 'אישורי הגעה',
  sub: 'רשימת האורחים והתשובות שלהם. כל אורח מקבל קישור אישי.',
  attending: 'מגיעים',
  declined: 'לא מגיעים',
  pending: 'טרם ענו',
  invited: 'הוזמנו',
  heads: 'סה״כ נפשות',
  /* The accessible name of a figure that filters the list under it. A screen
     reader reaching a link called "24" has been told nothing. */
  showOnly: 'הצגה ברשימה',
  addTitle: 'הוספת אורחים',
  addHint: 'שם בכל שורה. אפשר גם "שם, צד, טלפון".',
  addPh: 'משפחת כהן, כלה, 0501234567\nדוד ורונית\nיעל מהעבודה',
  side: 'צד (ברירת מחדל)',
  add: 'הוספה לרשימה',
  adding: 'מוסיף',
  none: 'עוד לא נוספו אורחים.',
  copyLink: 'העתקת הקישור',
  copied: 'הועתק',
  remove: 'הסרה',
  markAttending: 'סמנו מגיעים',
  markDeclined: 'סמנו לא מגיעים',
  markPending: 'איפוס',
  guest: 'אורח',
  status: 'תשובה',
  party: 'נפשות',
  dietCol: 'אוכל',
  noteCol: 'הערה',
} as const;

export const seatingCopy = {
  dragHint: 'אפשר לגרור אורח לשולחן, או להשתמש בבחירה. שולחן שאין בו מקום לא יקבל את הגרירה.',
  title: 'סידורי הושבה',
  sub: 'רק מי שאישר הגעה מקבל מקום. השולחן לא ייתן לשבת יותר אנשים משיש בו כיסאות.',
  addTable: 'שולחן חדש',
  tableName: 'שם',
  tableNamePh: 'שולחן 1',
  seats: 'מקומות',
  add: 'הוספה',
  adding: 'מוסיף',
  noTables: 'עוד לא נוספו שולחנות.',
  seated: 'יושבים',
  free: 'פנוי',
  full: 'מלא',
  emptyTable: 'אין עדיין אף אחד בשולחן הזה.',
  unseated: 'ממתינים לשיבוץ',
  unseatedNone: 'כל מי שאישר כבר משובץ. 🎉',
  place: 'לשבץ ב',
  choose: 'בחרו שולחן',
  unseat: 'הוצאה מהשולחן',
  removeTable: 'מחיקת השולחן',
  removeTableHint: 'האורחים לא נמחקים, הם חוזרים לרשימת הממתינים.',
  peopleShort: 'נפשות',
  needRsvp: 'אין עדיין מי שאישר הגעה. שבצו אחרי שיתחילו לענות.',
  floor: 'מפת האולם',
  floorSub: 'כל עיגול הוא שולחן, וכל נקודה סביבו היא כיסא. כיסא מלא מסומן בזהב.',
  openTable: 'לפתוח את השולחן',
  seatFree: 'כיסא פנוי',
} as const;

export const dayCopy = {
  moveUp: 'להזיז מוקדם יותר',
  moveDown: 'להזיז מאוחר יותר',
  dragHint: 'אפשר גם לגרור שורה למעלה או למטה',
  audience: 'למי הלוז הזה (ריק = לכולם):',
  title: 'לוז יום האירוע',
  sub: 'הבוקר נראה אחרת לכל אחד, אז לכל אחד יש מסלול משלו, ומה שמשותף מופיע באמצע.',
  shared: 'משותף',
  addTitle: 'מה קורה',
  addTitlePh: 'איפור ושיער',
  time: 'שעה',
  note: 'הערה',
  notePh: 'איפה, עם מי',
  track: 'מסלול',
  add: 'הוספה ללוז',
  adding: 'מוסיף',
  none: 'עוד לא נבנה לוז ליום.',
  emptyTrack: 'אין עדיין שורות במסלול הזה.',
  remove: 'מחיקה',
  rename: 'שינוי שמות המסלולים',
  renameSave: 'שמירת השמות',
  renameHint: 'איך תקראו לשני המסלולים. אלה השמות שלכם.',

  owner: 'מי אחראי',
  ownerPh: 'שם',
  duration: 'כמה זמן',
  durationPh: 'דק׳',
  untilNext: 'עד הבא',
  edit: 'עריכה',
  save: 'שמירה',
  cancel: 'ביטול',
  addOpen: 'הוספת שורה',
  addClose: 'סגירה',
  overlap: (title: string) => `חופף ל"${title}" באותו מסלול`,
  crossesMidnight: 'הלוז ממשיך אחרי חצות, והשורות מסודרות לפי סדר הערב.',
  totalLines: (n: number) => `${n} שורות`,
  span: (from: string, to: string) => `${from} עד ${to}`,

  templateTitle: 'להתחיל מלוז מוכן',
  templateSub: 'בחרו נקודת פתיחה, ואז תמחקו ותשנו מה שלא מתאים. אפשר רק כשהלוז ריק.',
  templateApply: 'פתיחת הלוז',
  templateApplying: 'פותח',
  templateOr: 'או להתחיל משורה ריקה',
  keyMoment: 'רגע מרכזי',
  keyMomentHint: 'החמ״ל יתריע 10 דקות לפני',
} as const;

export const leadsCopy = {
  statuses: { new: 'חדש', contacted: 'יצרנו קשר', meeting: 'נקבעה פגישה', won: 'נסגר', lost: 'לא רלוונטי' },
  note: 'הערה',
  notePh: 'מה סוכם',
  saveNote: 'שמירה',
  convert: 'פתיחת אירוע מהליד',
  callTitle: 'שיחת מעקב',
  callWhen: 'להזכיר בתאריך',
  callBook: 'קביעת תזכורת',
  callBooking: 'קובע',
  callsTitle: 'שיחות מעקב',
  callsNone: 'אין שיחות מעקב פתוחות.',
  callDone: 'בוצע',
  callReopen: 'החזרה',
  callToday: 'להיום',
  callLate: 'באיחור',
  open: 'פתיחה',
  close: 'סגירה',

  add: 'פנייה שקיבלתי',
  addTitle: 'רישום פנייה',
  addSub: 'שיחה, הודעה או המלצה שהגיעה אליכם ישירות. נכנסת לאותה רשימה כמו פנייה מהאתר, כדי שלא תישאר בפנקס.',
  addName: 'שם',
  addPhone: 'טלפון',
  addEmail: 'אימייל',
  addKind: 'סוג האירוע',
  addDate: 'תאריך משוער',
  addGuests: 'כמות אורחים',
  addMessage: 'מה נאמר',
  addMessagePh: 'חתונה באוגוסט, שמעו עלינו מחברים',
  addHow: 'איך הגיעו אלינו',
  addSave: 'שמירה',
  addSaving: 'שומר',
  addCancel: 'ביטול',
  addNeedContact: 'צריך טלפון או אימייל',
  addNeedName: 'נא למלא שם',
  addFailed: 'לא הצלחנו לשמור את הפנייה',

  /* Where a lead came from, in the words a producer would use. Anything that
     arrives from a source nobody named yet is shown as it was stored rather
     than hidden, so a new channel is visible the day it starts working. */
  sources: {
    site: 'מהאתר',
    phone: 'שיחת טלפון',
    whatsapp: 'וואטסאפ',
    instagram: 'אינסטגרם',
    facebook: 'פייסבוק',
    meta: 'מטא',
    google_ads: 'גוגל',
    referral: 'המלצה',
    walk_in: 'הגיעו אלינו',
    webhook: 'מערכת מחוברת',
  } as Record<string, string>,
} as const;

/** The ways a producer would say a lead reached them, for the manual form.
 *  Stored as the same slugs the webhook stores, so one report counts both. */
export const LEAD_SOURCES = [
  { value: 'phone', label: 'שיחת טלפון' },
  { value: 'whatsapp', label: 'וואטסאפ' },
  { value: 'instagram', label: 'אינסטגרם' },
  { value: 'facebook', label: 'פייסבוק' },
  { value: 'referral', label: 'המלצה' },
  { value: 'walk_in', label: 'הגיעו אלינו' },
] as const;

export const crewCopy = {
  title: 'צוות האירוע',
  sub: 'מי עובד בערב, מתי הוא מגיע ואיך משיגים אותו. הזוג לא רואה את המסך הזה.',
  none: 'עוד לא שובץ צוות.',
  add: 'הוספת איש צוות',
  close: 'סגירה',
  name: 'שם',
  role: 'תפקיד',
  rolePh: 'תאורן',
  phone: 'טלפון',
  callTime: 'שעת הגעה',
  fee: 'עלות',
  feePh: '₪',
  notes: 'הערה',
  save: 'שמירה',
  saving: 'שומר',
  cancel: 'ביטול',
  edit: 'עריכה',
  remove: 'הסרה',
  totalFee: 'סה״כ עלות צוות',
  noTime: 'ללא שעה',
  privateNote: 'צוות ועלויות גלויים למפיק בלבד.',
} as const;

export const vendorCopy = {
  eventTitle: 'ספקים באירוע',
  eventSub: 'מי סוגר את מה. מספרי טלפון וסטטוס, במקום אחד.',
  eventNone: 'עוד לא שובצו ספקים.',
  add: 'ספק חדש לאירוע',
  fromDirectory: 'מהספקים שלי',
  bookIt: 'שיבוץ',
  close: 'סגירה',
  name: 'שם הספק',
  category: 'תחום',
  contact: 'איש קשר',
  phone: 'טלפון',
  email: 'אימייל',
  area: 'אזור',
  notes: 'הערות',
  callTime: 'שעת הגעה',
  status: 'סטטוס',
  save: 'שמירה',
  saving: 'שומר',
  cancel: 'ביטול',
  edit: 'עריכה',
  remove: 'הסרה',
  saveToDirectory: 'לשמור בספקים שלי',
  inDirectory: 'שמור אצלי',
  privateNote: 'רשימת הספקים גלויה למפיק בלבד.',

  dirTitle: 'הספקים שלי',
  dirSub: 'הפנקס שנשאר בין אירועים. ספק שנשמר כאן משובץ לאירוע הבא בלחיצה, בלי להקליד שוב את המספר.',
  dirNone: 'עוד לא נשמרו ספקים.',
  dirAdd: 'הוספת ספק',
  dirSearch: 'חיפוש ספק',
  dirSearchPh: 'שם, תחום או אזור',
  dirActive: 'פעילים',
  dirArchived: 'בארכיון',
  archive: 'העברה לארכיון',
  unarchive: 'החזרה',
  count: (n: number) => `${n} ספקים`,
  noResults: 'לא נמצא ספק מתאים.',
  allCategories: 'כל התחומים',
} as const;

export const installCopy = {
  title: 'להתקין בטלפון',
  sub: 'האזור שלכם נפתח כמו אפליקציה רגילה, עם אייקון במסך הבית. אין מה להוריד מחנות, וזה לוקח פחות מדקה.',
  why: 'למה שווה',
  whyLines: [
    'נפתח במסך מלא, בלי שורת הכתובת של הדפדפן.',
    'אייקון במסך הבית, כמו כל אפליקציה אחרת.',
    'נשארים מחוברים, בלי להיכנס מחדש בכל פעם.',
  ],
  iphone: 'אייפון',
  iphoneSteps: [
    'לפתוח את האתר בספארי. חשוב שזה יהיה ספארי ולא כרום.',
    'ללחוץ על כפתור השיתוף למטה באמצע, הריבוע עם החץ למעלה.',
    'לגלול ולבחור "הוספה למסך הבית".',
    'ללחוץ "הוספה" למעלה מימין.',
  ],
  android: 'אנדרואיד',
  androidSteps: [
    'לפתוח את האתר בכרום.',
    'ללחוץ על שלוש הנקודות למעלה מימין.',
    'לבחור "הוספה למסך הבית" או "התקנת האפליקציה".',
    'לאשר.',
  ],
  desktop: 'מחשב',
  desktopSteps: [
    'בכרום או באדג׳, בצד שמאל של שורת הכתובת יש אייקון התקנה.',
    'ללחוץ עליו ולאשר.',
  ],
  troubleTitle: 'לא מוצאים את האפשרות?',
  troubleLines: [
    'באייפון זה עובד רק בספארי. אם פתחתם בכרום או מתוך אינסטגרם, צריך לפתוח את הקישור בספארי קודם.',
    'אם כבר התקנתם פעם, האפשרות לא תופיע שוב. תחפשו את האייקון במסך הבית.',
  ],
  backToApp: 'לאזור שלי',
} as const;

export const templateCopy = {
  title: 'תיק אירוע מוכן',
  sub: 'הרשימות שאתה עובד לפיהן. תבחר מה נכנס לאירוע הזה, ולכל משימה תחליט אם הזוג רואה אותה.',
  tasksTab: 'משימות',
  budgetTab: 'תקציב',
  suppliersTab: 'ספקים',
  pickAll: 'לסמן הכל',
  pickNone: 'לנקות',
  shared: 'הזוג רואה',
  sharedOn: 'משותף',
  sharedOff: 'פרטי',
  apply: (n: number) => (n === 1 ? 'הוספת שורה אחת' : `הוספת ${n} שורות`),
  applying: 'מוסיף',
  nothing: 'לא נבחר כלום',
  added: (n: number) => `נוספו ${n}. אפשר לערוך כל אחת מהן.`,
  privateNote: 'משימה פרטית לא מופיעה אצל הזוג, לא באזור שלהם ולא בהתראות.',
  open: 'להוסיף מהתבנית',
  close: 'סגירה',
} as const;

export const barCopy = {
  title: 'מחשבון בר',
  sub: 'כמה בקבוקים, כמה קרח, וכמה זה עולה. נקודת פתיחה למשא ומתן עם הספק, לא הצעת מחיר.',
  guests: 'אורחים',
  children: 'אחוז ילדים',
  childrenHint: 'לא שותים אלכוהול, ושותים הכל חוץ מזה',
  drinkers: 'אחוז שותים מהמבוגרים',
  drinkersHint: 'המספר שמזיז את התוצאה יותר מכל דבר אחר',
  hours: 'שעות פתיחת הבר',
  hoursHint: 'לא אורך הערב. הבר נסגר לפני השיר האחרון',
  style: 'אופי השתייה',
  season: 'עונה',
  styles: {
    barak: 'החישוב שלי',
    classic: 'מעורב',
    spirits: 'חזק',
    wine: 'יין',
    beer: 'בירה',
    light: 'קליל',
  } as Record<string, string>,
  seasons: { summer: 'קיץ', mild: 'אביב או סתיו', winter: 'חורף' } as Record<string, string>,

  planTitle: 'מה לקנות',
  drinkersOut: 'שותים',
  servingsOut: 'מנות משקה',
  litresOut: 'ליטר אלכוהול',
  barakNote: 'לפי הכלל שלך: ליטר לכל תשעה אנשים, בפיצול הקבוע שלך. שעות הבר לא משנות את הכמות בשיטה הזאת, כי הן כבר בתוך המספר.',
  items: {
    vodka: 'וודקה', whiskey: 'וויסקי', gin: 'ג׳ין', other: 'ליקרים ואחר',
    campari: 'קמפרי', tequila: 'טקילה', rum: 'רום',
    wine: 'יין', beer: 'בירה', soft: 'שתייה קלה', ice: 'קרח',
    citrus: 'לימונים ולימים', cups: 'כוסות',
  } as Record<string, string>,
  units: {
    vodka: 'בקבוקים', whiskey: 'בקבוקים', gin: 'בקבוקים', other: 'בקבוקים',
    campari: 'בקבוקים', tequila: 'בקבוקים', rum: 'בקבוקים',
    wine: 'בקבוקים', beer: 'יחידות', soft: 'ליטר', ice: 'ק״ג',
    citrus: 'יחידות', cups: 'יחידות',
  } as Record<string, string>,
  beerUnit: 'ספירת בירה',
  beerAsBottles: 'בקבוקי 330',
  beerAsPacks: 'מארזי שישייה',
  beerPackNote: 'אותה כמות בירה, ספורה כמו שקונים אותה. הליטרים לא משתנים.',
  unitPrice: 'מחיר ליחידה',
  lineTotal: 'סה״כ',
  grandTotal: 'סה״כ משוער',
  prices: 'מחירים',
  pricesHint: 'המחירים שלכם, לא שלנו. שנו אותם ומה שלמטה מתעדכן.',
  print: 'הדפסה של רשימת הקנייה',
  assumptions: 'איך זה חושב',
  assumptionLines: [
    'שעה ראשונה שתי מנות לשותה, כל שעה אחריה מנה אחת. אנשים מגיעים צמאים ואז מתייצבים.',
    'בקבוק אלכוהול חזק הוא 15 מנות ולא 17, כי יד ממהרת נדיבה. יין הוא 5 כוסות.',
    'קרח לפי אורח ולא לפי שעה, כי גם הבקבוקים והדגים צריכים אותו.',
    'העדפנו לטעות למעלה בקרח ולמטה באלכוהול. בר בלי קרח נגמר באחת עשרה; בקבוק וודקה שנשאר הולך הביתה עם מישהו.',
    '"החישוב שלי" הוא הכלל מהגיליון שלך ולא נגענו בו. השאר הוא מודל לפי מנות, שעונה על השאלה "ומה אם הבר פתוח שעתיים יותר".',
  ],
} as const;

export const updateCopy = {
  /* Deliberately not "עדכון זמין". Nothing is downloaded and nothing is
     installed: the newer version is already being served, and the page simply
     has not picked it up yet. */
  ready: 'יש גרסה חדשה של המערכת',
  refresh: 'רענון',
} as const;

export const partyCopy = {
  name: 'שם הצד השני',
  namePh: 'שם הספק או הזוג',
  role: 'תפקיד',
  rolePh: 'דיג׳יי, צלם, רב',
} as const;

export const linkCopy = {
  make: 'קישור לחתימה',
  making: 'יוצר',
  ready: 'הקישור מוכן. שלחו אותו לספק בוואטסאפ או במייל.',
  copy: 'העתקה',
  copied: 'הועתק',
  whatsapp: 'שליחה בוואטסאפ',
  revoke: 'ביטול הקישור',
  /* Said where the producer decides, not after. Withdrawing a link is not the
     same as cancelling an agreement, and the two are easy to confuse. */
  revokeNote: 'ביטול הקישור סוגר את הדלת ולא מבטל חתימה שכבר נעשתה.',
  failed: 'לא הצלחנו ליצור קישור. נסו שוב.',
} as const;

export const signCopy = {
  eyebrow: 'הסכם לחתימה',
  badLink: 'הקישור הזה כבר לא פעיל',
  badLinkBody: 'ייתכן שההסכם נחתם, שהקישור הוחלף, או שהוא הועתק חלקית. אפשר לפנות למי ששלח לכם אותו ולבקש קישור חדש.',
  amount: 'סכום',
  file: 'לצפייה בקובץ המצורף',
  nameLabel: 'השם המלא שלכם',
  namePh: 'כפי שיופיע על ההסכם',
  sign: 'קראתי ואני מאשר',
  signing: 'חותם',
  /* Said before the button, not after it. Somebody should know what pressing
     it does while they can still not press it. */
  before: 'לחיצה על הכפתור היא חתימה. מרגע זה אי אפשר לשנות את התנאים שלמעלה, לא על ידכם ולא על ידי מי ששלח.',
  doneTitle: 'נחתם',
  doneBy: 'נחתם על ידי',
  doneAt: 'בתאריך',
  doneBody: 'שמרו את הקישור הזה. הוא ימשיך להראות את ההסכם שנחתם ואת מועד החתימה.',
  short: 'נא לחתום בשם מלא',
  failed: 'החתימה לא נקלטה. נסו שוב, ואם זה חוזר פנו למי ששלח את הקישור.',
} as const;

export const conciergeCopy = {
  title: 'שאלות על ההפקה',
  sub: 'העוזר הדיגיטלי של ברק',
  open: 'פתיחת שיחה',
  close: 'סגירה',
  greeting: 'אפשר לשאול אותי איך התהליך עובד, מה כלול בהפקה, ומה קורה ביום האירוע. אם תרצו שברק יחזור אליכם, תשאירו לי שם וטלפון.',
  starters: ['איך התהליך עובד?', 'מה כלול בהפקה?', 'אנחנו רוצים חתונה בשטח'],
  placeholder: 'מה תרצו לדעת',
  send: 'שליחה',
  thinking: 'רגע',
  wentWrong: 'משהו נתקע אצלי. אפשר לכתוב לברק בוואטסאפ והוא יחזור אליכם.',
  disclaimer: 'תשובות כלליות. מחיר וזמינות נסגרים מול ברק בפגישה.',
} as const;

export const siteEditorCopy = {
  title: 'עריכת האתר',
  sub: 'הטקסטים באתר הציבורי. שינוי נשמר ומתפרסם מיד, בלי פריסה.',
  sections: 'פרקים',
  save: 'שמירה',
  saving: 'שומר',
  saved: 'נשמר',
  wasReset: 'הוחזר למקור',
  unsaved: 'יש שינוי שלא נשמר',
  reset: 'החזרה לנוסח המקורי',
  edited: 'נערך',
  note: 'מה שלא מופיע כאן נשאר קבוע בקוד. שדה שנמחק חוזר לנוסח שנכתב במקור.',
} as const;

export const noticeCopy = {
  title: 'עדכונים',
  none: 'אין עדכונים חדשים.',
  markAll: 'סימון הכל כנקרא',
  open: 'פתיחה',
  kinds: {
    lead: 'פנייה',
    rsvp: 'אישור הגעה',
    task: 'משימה',
    payment: 'תשלום',
    invite: 'גישה',
    message: 'הודעה',
  },
} as const;

export const threadCopy = {
  title: 'הודעות',
  sub: 'כל מה שסוכם על האירוע, במקום אחד שנשאר איתו.',
  empty: 'עוד אין הודעות. כתבו את הראשונה.',
  placeholder: 'לכתוב הודעה',
  send: 'שליחה',
  sending: 'שולח',
  retract: 'מחיקה',
  today: 'היום',
  yesterday: 'אתמול',
} as const;

export const contractCopy = {
  title: 'הסכמים',
  subProducer: 'טיוטה נשארת אצלכם. מרגע שנשלחה, הזוג רואה אותה, ומרגע שנחתמה, התנאים כבר לא זזים.',
  subClient: 'מה שסוכם, כתוב. חתימה כאן שקולה לחתימה על הנייר.',
  newContract: 'הסכם חדש',
  cancel: 'ביטול',
  untitled: 'הסכם ללא שם',
  titleLabel: 'שם ההסכם',
  titlePh: 'הסכם הפקת חתונה',
  amountLabel: 'סכום',
  amountPh: 'סכום בש״ח',
  bodyLabel: 'תנאי ההסכם',
  bodyPh: 'התמורה, לוח התשלומים, מה כלול ומה לא, תנאי ביטול.',
  attach: 'צירוף מסמך',
  attached: 'המסמך צורף',
  uploading: 'מעלה',
  tooBig: 'הקובץ גדול מדי. עד 20MB.',
  uploadFailed: 'ההעלאה נכשלה. נסו שוב.',
  saveDraft: 'שמירת טיוטה',
  saving: 'שומר',
  draftHint: 'הטיוטה לא נראית לזוג עד שתשלחו אותה.',
  send: 'שליחה לחתימה',
  discard: 'מחיקה',
  void: 'ביטול ההסכם',
  openDoc: 'פתיחת המסמך המצורף',
  signedBy: 'נחתם על ידי',
  signIntro: 'קראתם את התנאים? חתמו בשם המלא כדי לאשר.',
  signNameLabel: 'שם מלא לחתימה',
  signNamePh: 'שם מלא',
  sign: 'חתימה',
  signing: 'חותם',
  signLegal: 'החתימה נרשמת עם השם, התאריך והשעה, ועם טביעת אצבע של הנוסח שנחתם. אחרי החתימה אי אפשר לשנות את התנאים.',
  tampered: 'הנוסח שמופיע כאן אינו זהה לנוסח שנחתם. אל תסתמכו עליו, פנו למפיק.',
  emptyProducer: 'עוד לא נוצר הסכם לאירוע הזה.',
  emptyClient: 'עוד לא נשלח אליכם הסכם.',
  status: {
    draft: 'טיוטה',
    sent: 'ממתין לחתימה',
    signed: 'נחתם',
    void: 'בוטל',
  },
} as const;
