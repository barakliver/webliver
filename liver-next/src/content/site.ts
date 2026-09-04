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
  /* The mock screen standing beside that argument. The words on a phone that
     is standing in for the product belong with the rest of the public copy:
     they were literals inside the component, which meant the English site put
     an English argument next to a Hebrew screenshot. */
  stage: { couple: string; days: string; rows: [string, string, string, string] };
  journey: { title: string; steps: string[]; link: string };
  /* The visitor's own three moves, in order. Not the production process, which
     `journey` tells: this is what the person holding the phone does next, and
     it exists because he asked for exactly that in as many words: that the
     order of actions be unmistakable. */
  begin: { title: string; steps: [
    { title: string; body: string }, { title: string; body: string }, { title: string; body: string },
  ] };
  about: { title: string; body: string[] };
  dayOf: { title: string; body: string[] };
  work: { title: string; sub: string };
  academy: { title: string; body: string[]; cta: string };
  closing: { title: string; body: string[]; cta: string };
  budget: { title: string; sub: string; closing: string };
  lead: {
    title: string; sub: string;
    fields: { name: string; phone: string; email: string; kind: string; date: string; guests: string; message: string; location: string };
    locationFree: string; locationPh: string; locationNeed: string;
    /* Six labels, in the reader's language, for the six regions in REGIONS. */
    regions: readonly [string, string, string, string, string, string];
    submit: string; sending: string; okTitle: string; okBody: string;
  };
  fab: { whatsapp: string; booking: string; bookingNote: string; lead: string; whatsappMessage: string };
  nav: { philosophy: string; journey: string; about: string; budget: string; shop: string; contact: string; login: string };
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
    /* Two lines where five stood. A hero is a claim, not an explanation:
       the first line is the evening, the second is what we are for. The
       rest of the argument moved down the page, to the sections whose job
       it is to argue. */
    body: [
      'ערב אחד בחיים, כל היקרים לכם במקום אחד.',
      'אנחנו מחזיקים את כל השאר.',
    ],
    cta: 'בואו נכיר',
  },

  /* Three sentences, each one an instruction. The order is the argument:
     feel first, count second, talk third. */
  begin: {
    title: 'מאיפה מתחילים',
    steps: [
      { title: 'רואים את העבודות', body: 'תיק העבודות מחכה למטה. ראו אם הוא מדבר אליכם.' },
      { title: 'בודקים את המספרים', body: 'מחשבון התקציב נותן סדר גודל בדקה, בלי להשאיר פרטים.' },
      { title: 'קובעים פגישת היכרות', body: 'חצי שעה של שיחה, בלי התחייבות. אחריה תדעו אם נכון להמשיך יחד.' },
    ],
  },

  philosophy: {
    title: 'החתונה שלכם מתחילה בכם',
    body: [
      'לפני אולם. לפני צלם. לפני הכל, שאלה אחת: כיצד תרצו לזכור את הערב הזה.',
      'מה ירגישו האורחים כשייכנסו. אילו רגעים יקרים מכדי שיחלפו. על מה לא מתפשרים.',
      'מהתשובות האלה נבנית חתונה שהיא רק שלכם.',
    ],
  },

  value: {
    title: 'כשיש מי שמחזיק את התמונה',
    body: [
      'שקט אמיתי אינו היעדר מעשה. הוא הידיעה שמישהו כבר מטפל בכל דבר.',
      'התקציב גלוי. הספקים נענים. ההחלטות מתקבלות בזמן.',
      'ובערבים אתם מדברים על החתונה עצמה, לא על משימותיה.',
      'כתובת אחת, מן הרגע הראשון ועד האחרון.',
    ],
  },

  /* The screen on the phone standing beside that argument. A worked example,
     not a real couple: the numbers are what an event of this size looks like
     halfway through. */
  stage: {
    couple: 'נועה ואיתי',
    days: 'ימים לאירוע',
    rows: ['תקציב', 'אישורי הגעה', 'כספת השראה', 'חמ״ל ספקים'],
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
    title: 'מי שהולך איתכם',
    body: [
      'יותר משמונה שנים. מאות אירועים. מחתונות שטח ועד ערבים של מאות אורחים.',
      'השנים לימדו דבר אחד פשוט: את הלחץ של היום הגדול אין מנהלים ברגע האמת. מונעים אותו מראש.',
      'מקשיבים עד הסוף. בודקים פעם נוספת. אומרים את האמת גם כשאינה נוחה.',
      'וכשמשהו משתנה ברגע האחרון, לצדכם מי שראה הכל ונשאר רגוע.',
    ],
  },

  work: {
    title: 'עבודות אחרונות',
    sub: 'שמונה רגעים משנה אחת של חתונות. מאחורי כל אחד מהם, חודשים של עבודה שקטה.',
  },

  dayOf: {
    title: 'וביום החתונה',
    body: [
      'התכנון נגמר. החגיגה מתחילה.',
      'מאחורי הקלעים ידוע מי הגיע, מה סוכם, ומה קורה בכל דקה. אתם לא מרגישים דבר מזה. זו בדיוק המלאכה.',
      'לכם נשאר רק לחגוג.',
    ],
  },

  academy: {
    title: 'רוצים לתכנן בעצמכם?',
    body: [
      'יש זוגות שמחזיקים את ההפקה בידיים שלהם. ועושים זאת כראוי.',
      'הקורס הדיגיטלי הוא השיטה שאנחנו עובדים לפיה, שלב אחר שלב, מהתקציב ועד יום האירוע עצמו.',
      'אתם מפיקים לבד. אתם לא לבדכם.',
    ],
    /* The label names where pressing it goes, which is this page's contact
       form. It used to read "to the digital course" and scroll to that same
       form, which is a promise the site cannot keep: there is no course page
       to arrive at. When one exists with its own address, its own outline and
       a way to enrol, this becomes a link to it and the wording goes back. */
    cta: 'לשמוע על הקורס',
  },

  closing: {
    title: 'מתחילים בפגישה',
    body: [
      'הכל מתחיל בשיחה אחת. חצי שעה, בלי התחייבות.',
      'ספרו היכן אתם היום, ואיזו חתונה אתם רואים.',
      'נכון להמשיך יחד? ממשיכים. ואם לא, יצאתם עם סדר וכיוון.',
    ],
    cta: 'קובעים פגישת היכרות',
  },

  budget: {
    title: 'כמה חתונה כזאת עולה',
    sub: 'כמה פרטים, ותוך דקה יש לכם סדר גודל. נקודת פתיחה כנה, לא הצעת מחיר.',
    closing: 'רוצים לעבור על המספרים יחד? קבעו פגישת היכרות, בלי התחייבות.',
  },

  lead: {
    title: 'נעים להכיר',
    sub: 'השאירו פרטים ונשוב אליכם בדרך כלל בתוך יום עסקים. בצד השני עונה אדם, לא מערכת.',
    fields: {
      name: 'שם מלא',
      phone: 'טלפון',
      email: 'אימייל',
      kind: 'סוג האירוע',
      date: 'תאריך משוער',
      guests: 'כמות אורחים',
      message: 'משהו שחשוב שנדע',
      location: 'מיקום האירוע / אזור מבוקש',
    },
    locationFree: 'או שם האולם, אם כבר נבחר',
    locationPh: 'שם האולם או כתובת, אם יש',
    locationNeed: 'נא לבחור אזור או לכתוב איפה האירוע',
    regions: ['מרכז', 'שרון', 'צפון', 'דרום', 'ירושלים והסביבה', 'שטח / פתוח'],
    submit: 'שליחה',
    sending: 'שולח',
    okTitle: 'תודה, קיבלנו',
    okBody: 'הפרטים התקבלו. נשוב אליכם בדרך כלל בתוך יום עסקים.',
  },

  fab: {
    whatsapp: 'וואטסאפ',
    booking: 'פגישת היכרות',
    bookingNote: 'חצי שעה של היכרות, בלי התחייבות',
    lead: 'השאירו פרטים',
    whatsappMessage: 'שלום, הגעתי מהאתר ואשמח לשמוע פרטים על הפקת החתונה שלנו.',
  },

  nav: {
    philosophy: 'הגישה',
    journey: 'התהליך',
    about: 'אודות',
    budget: 'תקציב',
    shop: 'חנות',
    contact: 'יצירת קשר',
    login: 'כניסה',
  },

  footer: 'הפקת אירועים. כל הזכויות שמורות.',
};

/* The six regions the first call is decided at. The value is what the lead
   stores, in Hebrew, whichever language the visitor read the chip in; the
   labels live in each language's `lead.regions` by the same index. */
export const REGIONS = ['מרכז', 'שרון', 'צפון', 'דרום', 'ירושלים והסביבה', 'שטח / פתוח'] as const;

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
  emailLabel: 'כתובת אימייל',
  newHere: 'זו הפעם הראשונה שלי כאן',
  nameLabel: 'שם מלא',
  brandLabel: 'שם העסק (למפיקים)',
  submit: 'שליחת קוד',
  sending: 'שולח',
  note: 'זוגות מוזמנים נכנסים עם הכתובת שאליה נשלחה ההזמנה. מפיק חדש נכנס לאישור לפני שהחשבון נפתח.',
  codeTitle: 'הקוד בדרך',
  codeSentEmail: 'שלחנו קוד חד פעמי לכתובת',
  codeSentPhone: 'שלחנו קוד חד פעמי במסרון למספר',
  codeLabel: 'הקוד שקיבלתם',
  codeSubmit: 'כניסה',
  codeChecking: 'בודק',
  codeBackEmail: 'לשנות כתובת',
  codeBackPhone: 'לשנות מספר',
  /* A sentence with a hole in it rather than a function. The whole block is
     handed to a client component, and a function cannot cross that boundary:
     React refuses to serialise it and the sign-in screen returns a 500. The
     wording is unchanged; only the substitution moved. */
  validFor: 'הקוד בתוקף עוד {t}',
  expired: 'הקוד כנראה כבר לא בתוקף. אפשר לבקש חדש.',
  resend: 'שליחת קוד חדש',
  resendIn: 'אפשר לבקש קוד חדש בעוד {s} שניות',
  resendSending: 'שולח קוד חדש',
  resentEmail: 'שלחנו קוד חדש לאימייל.',
  /* The two that stay. Phone sign-in is closed, and the code step still
     renders whichever channel a session was actually opened on — an account
     created that way before the door shut is still a real account. */
  resentPhone: 'שלחנו קוד חדש במסרון.',
  google: 'כניסה עם גוגל',
  googleGoing: 'מעבירים לגוגל',
  googleFailed: 'לא הצלחנו לפתוח את החלון של גוגל. אפשר להיכנס עם קוד למטה.',
  or: 'או',
  privacyNote: 'בכניסה אתם מסכימים ל',
  /* The word between the two documents. It was a literal in the component,
     which is how an English sign-in screen ended up reading
     "Terms of use ול Privacy policy". */
  legalJoin: ' ול',
  signingIn: 'מכניסים אתכם',
  linkExpired: 'הקישור כבר שימש או שפג תוקפו. נשלח לכם קוד חדש לאותה כתובת.',
  linkMissing: 'הקישור לא היה שלם. אפשר להיכנס מכאן.',
} as const;

/* ── מחשבון התקציב ────────────────────────────────────────────────────────
   Every word the simulator renders, in one place.

   It was the last thing on the public site still holding its own strings,
   including the eight budget line names, which sat inside the arithmetic in
   `lib/budget`. That is why an English visitor got English chips above Hebrew
   line items: the maths was carrying the wording.

   The keys on `tier`, `day`, `season`, `style`, `bar` and `line` are the
   values the calculation actually branches on, so a language cannot rename an
   option out from under the maths. */
export const budgetSimCopy = {
  note:
    'כל המספרים כאן הם אומדן בלבד ואינם מדויקים. הם נועדו לתת סדר גודל להתחלה, ומשתנים לפי '
    + 'הספקים, המקום והעונה. המחיר האמיתי נקבע רק מול הצעות מחיר.',
  invited: 'כמה הזמנות אתם שולחים',
  attending: 'כמה מהם באמת מגיעים',
  attendingHint: 'הקייטרינג נספר על מי שמגיע בפועל, לא על מי שהוזמן.',
  tierLabel: 'סוג המקום',
  plate: 'מחיר למנה',
  plateHint: 'יש לכם הצעת מחיר? הקלידו את המספר שקיבלתם והתחשיב יתעדכן לפיו.',
  dayLabel: 'יום בשבוע',
  seasonLabel: 'עונה',
  styleLabel: 'סגנון',
  barLabel: 'אלכוהול',
  rangeLabel: 'טווח תקציב משוער',
  /* "עד" rather than a dash. A range written with a dash reads ambiguously in
     a right to left line, where the eye cannot tell which end it started
     from; the word cannot be read backwards. */
  to: 'עד',
  attendingCount: 'מגיעים בפועל',
  tables: 'שולחנות',
  perGuest: 'לאורח',
  breakdown: 'חלוקה לפי סעיפים',
  marginal: 'כל עשרה אורחים נוספים',
  tier: { garden: 'גן אירועים', hall: 'אולם', boutique: 'מקום בוטיק', field: 'שטח פתוח' },
  day: { weekday: 'אמצע שבוע', friday: 'שישי', saturday: 'שבת' },
  season: { spring: 'אביב או סתיו', summer: 'קיץ', winter: 'חורף' },
  style: { classic: 'קלאסי', modern: 'מודרני', rustic: 'כפרי', lux: 'יוקרתי' },
  bar: { venue: 'כלול במקום', external: 'בר חיצוני', none: 'בלי בר' },
  scale: { guest: 'לפי אורח', table: 'לפי שולחן', fixed: 'קבוע' },
  line: {
    catering: 'מקום וקייטרינג',
    bar: 'בר ואלכוהול',
    center: 'עיצוב שולחנות',
    photo: 'צילום ווידאו',
    music: 'מוזיקה והגברה',
    design: 'חופה ועיצוב',
    prod: 'תכנון והפקה',
    extra: 'הזמנות, איפור ונלוות',
  },
} as const;

/* ── פרטיות ───────────────────────────────────────────────────────────────
   Written from what the schema actually holds rather than from a template. A
   privacy policy that lists categories nobody collects, and omits the guest
   list of somebody's wedding, is worse than none: it reads as compliance
   theatre and it is wrong on the one thing that matters here.

   Every claim below is checkable against a migration. Where something is not
   yet true it is not written, and the two things this business genuinely does
   not do — sell data, and advertise from it — are said plainly rather than
   buried. */
export const privacyCopy = {
  title: 'מדיניות פרטיות',
  sub: 'מה נאסף כאן, למה, מי רואה את זה, וכמה זמן זה נשמר. בעברית, בלי משפטים שאי אפשר לקרוא.',

  shortTitle: 'בקצרה',
  short: [
    'אנחנו אוספים רק את מה שצריך כדי להפיק לכם אירוע.',
    'רשימת האורחים שלכם, הקבצים שלכם והתקציב שלכם נראים לכם ולברק ליור בלבד.',
    'אנחנו לא מוכרים מידע ולא משתמשים בו לפרסום.',
    'אפשר לבקש למחוק הכל, בכל רגע, וזה יימחק.',
  ],

  whoTitle: 'מי אחראי למידע',
  who:
    'ברק ליור, הפקת חתונות ואירועים. לכל שאלה בנושא פרטיות אפשר לפנות ישירות בכתובת שלמטה, '
    + 'ואנחנו נחזור בתוך כמה ימי עסקים.',

  whatTitle: 'מה נאסף, ולמה',
  what: [
    ['פרטי הקשר שלכם',
     'שם, טלפון ואימייל. זה מה שמאפשר לנו לחזור אליכם, לשלוח קוד כניסה, ולדעת מי מדבר איתנו.'],
    ['פרטי האירוע',
     'תאריך, אולם, מספר אורחים משוער, תקציב והמשימות שנפתחו. זה גוף העבודה עצמו.'],
    ['רשימת האורחים',
     'שמות, טלפונים, אישורי הגעה והעדפות תזונה, כפי שאתם או האורחים שלכם ממלאים אותם. '
     + 'המידע הזה שייך לכם. אנחנו מחזיקים אותו כדי לבנות הושבה, לוז ומספרים לספקים.'],
    ['קבצים שאתם מעלים',
     'תמונות השראה, הזמנה, תוכניות מהאולם וכל מה שאתם שולחים לתיקייה המשותפת.'],
    ['הודעות בינינו',
     'מה שנכתב בשיחה שבתוך המערכת, כדי שיישאר תיעוד למה שסוכם.'],
    ['נתוני כניסה',
     'כתובת אימייל או מספר טלפון, וקוד חד פעמי. אנחנו לא שומרים סיסמאות, כי אין כאן סיסמאות.'],
  ],

  cookiesTitle: 'עוגיות',
  cookies:
    'אנחנו משתמשים בעוגיות לשני דברים בלבד: לזכור שאתם מחוברים, ולזכור את הגדרות '
    + 'הנגישות והשפה שבחרתם. אין כאן עוגיות פרסום, אין מעקב בין אתרים, ואין פיקסלים של '
    + 'רשתות חברתיות.',

  whoSeesTitle: 'מי רואה מה',
  whoSees: [
    'האזור שלכם נראה לכם ולברק ליור. זוג אחד לא רואה אירוע של זוג אחר, וזה נאכף בבסיס '
    + 'הנתונים עצמו ולא רק במסך.',
    'עלויות, שכר צוות ושיבוצי ספקים הם צד ההפקה. הם לא מוצגים לזוג.',
    'ספק שמקבל קישור לחתימה רואה את המסמך שלו בלבד. לא את האירוע, לא את האורחים ולא את התקציב.',
    'אורח שממלא אישור הגעה רואה את השורה שלו בלבד.',
  ],

  thirdTitle: 'למי המידע מגיע מחוץ לכאן',
  third: [
    ['Supabase', 'מאחסן את בסיס הנתונים והקבצים. השרתים באירופה.'],
    ['Resend', 'שולח את המיילים היוצאים: קוד כניסה, הזמנה, התראה.'],
    ['DigitalOcean', 'מארח את השרת שהאתר רץ עליו.'],
    ['Anthropic', 'מפעיל את העוזר החכם באתר. נשלח אליו רק מה שנכתב בשיחה עצמו, בלי לצרף '
     + 'את הנתונים של האירוע.'],
    ['Google', 'רק אם בחרתם להיכנס עם חשבון גוגל. במקרה הזה גוגל מוסרת לנו את השם, כתובת '
     + 'האימייל ותמונת הפרופיל, ואנחנו לא מקבלים ולא מבקשים שום דבר אחר מהחשבון שלכם.'],
  ],
  thirdNote:
    'אנחנו לא מוכרים מידע, לא משכירים אותו, ולא מעבירים אותו למפרסמים. הרשימה למעלה היא '
    + 'הרשימה המלאה.',

  keepTitle: 'כמה זמן זה נשמר',
  keep:
    'מידע על אירוע נשמר כל עוד האירוע פעיל ולמשך שבע שנים אחריו, כי חשבוניות וחוזים כפופים '
    + 'לחובת שמירה בדין. פנייה שלא הפכה לאירוע נמחקת בתוך שנתיים. אפשר לבקש מחיקה מוקדמת '
    + 'של כל מה שאינו חייב בשמירה, ואנחנו נבצע.',

  rightsTitle: 'הזכויות שלכם',
  rights: [
    'לדעת מה מוחזק עליכם ולקבל עותק.',
    'לתקן פרט שגוי.',
    'לבקש מחיקה של מה שאינו חייב בשמירה לפי דין.',
    'לבקש שנפסיק לשלוח מיילים שאינם קשורים ישירות לאירוע שלכם.',
  ],
  rightsHow:
    'כל בקשה כזאת מטופלת בפנייה אחת לכתובת שלמטה. אין טופס, אין תהליך, ואין צורך להסביר למה.',

  securityTitle: 'איך זה נשמר',
  security: [
    'החיבור לאתר מוצפן.',
    'כל טבלה בבסיס הנתונים נושאת כלל הרשאה משלה, כך שגישה למידע של מישהו אחר נחסמת '
    + 'בשכבת הנתונים ולא רק במסך.',
    'קבצים שאתם מעלים יושבים באחסון פרטי ונפתחים רק דרך קישור חתום וקצר מועד.',
    'קוד כניסה חד פעמי תקף לזמן קצר ולשימוש אחד.',
  ],

  kidsTitle: 'קטינים',
  kids:
    'השירות מיועד לבגירים. אנחנו לא אוספים ביודעין מידע על ילדים. אם הגיע אלינו מידע כזה '
    + 'דרך רשימת אורחים, הוא מטופל כמו כל שאר רשימת האורחים ונמחק יחד איתה.',

  changesTitle: 'שינויים במדיניות',
  changes:
    'אם נשנה משהו מהותי, נעדכן את התאריך שלמטה ונודיע לכל מי שיש לו אירוע פעיל. אנחנו לא '
    + 'משנים את המדיניות למפרע.',

  contactTitle: 'יצירת קשר בנושא פרטיות',
  contact: 'שאלה, בקשה למחיקה, או משהו שלא ברור. כתבו לנו.',
  updated: 'עודכן לאחרונה',
  back: 'חזרה לעמוד הבית',
} as const;

/* ── תנאי שימוש ───────────────────────────────────────────────────────────
   Written the same way the privacy policy was: from what this system actually
   does, and never from a template.

   Two lines below are the ones that matter, and both of them give something
   up rather than take it. The production agreement wins over this page, so
   nothing written here can quietly rewrite what he signed with a couple. And
   a photograph of somebody's wedding does not enter the portfolio without
   their word first, which is a promise the law does not require and the
   category routinely ignores.

   What is deliberately absent: any term about charging a card, because the
   shop charges none. An order there is a request that reaches him within a
   second, and it is written down here as exactly that. */
export const termsCopy = {
  title: 'תנאי שימוש',
  sub: 'מה מותר כאן, מה אנחנו מתחייבים אליו, ומה לא. בעברית, בלי משפטים שאי אפשר לקרוא.',

  shortTitle: 'בקצרה',
  short: [
    'האתר והאזור האישי הם כלי עבודה. ההסכם על ההפקה עצמה נחתם בנפרד, והוא זה שקובע.',
    'מה שאתם מעלים נשאר שלכם. אנחנו רק מחזיקים את זה בשבילכם.',
    'תמונות מהאירוע שלכם לא מגיעות לתיק העבודות בלי שאמרתם כן.',
    'הזמנה בחנות היא בקשה, לא חיוב. שום כרטיס לא נטען כאן.',
  ],

  whoTitle: 'מי מפעיל את השירות',
  who:
    'ברק ליור, הפקת חתונות ואירועים. האתר, האזור האישי והחנות מופעלים על ידו. כל פנייה '
    + 'בנוגע לתנאים האלה מגיעה לכתובת שלמטה.',

  scopeTitle: 'מה כולל השירות',
  scope: [
    ['האתר', 'עמוד תדמית, מחשבון תקציב, טופס פנייה וחנות. פתוח לכל אחד, בלי הרשמה.'],
    ['האזור האישי',
     'נפתח לזוג שיש לו אירוע פעיל. בתוכו התקציב, המשימות, רשימת האורחים, אישורי ההגעה, '
     + 'הלוז, הקבצים והשיחה עם ההפקה.'],
    ['החנות', 'מוצרים ושירותים שאפשר לבקש דרך האתר. הפרטים בהמשך.'],
    ['ההפקה עצמה',
     'העבודה שאנחנו מבצעים. היא נקבעת בהסכם שנחתם בין הצדדים ולא בעמוד הזה.'],
  ],

  contractTitle: 'ההסכם על ההפקה גובר',
  contract:
    'אם משהו כאן סותר את ההסכם שנחתם על ההפקה, ההסכם גובר. עמוד תנאי השימוש מסדיר את '
    + 'השימוש באתר ובאזור האישי בלבד, והוא לא משנה, מצמצם או מוסיף דבר למה שסוכם בכתב '
    + 'על האירוע.',

  accountTitle: 'כניסה לחשבון',
  account: [
    'הכניסה היא בקוד חד פעמי שנשלח לאימייל, או דרך חשבון גוגל. אין כאן סיסמאות.',
    'הקוד אישי. מי שמקבל גישה לתיבה שלכם מקבל גישה לאזור האישי, ולכן שווה לשמור עליה.',
    'הרשאות מנהל שמורות לבעל העסק. חשבון שנפתח מעצמו ממתין לאישור ולא רואה דבר עד אז.',
    'אם נראה לכם שמישהו נכנס לאזור שלכם, כתבו לנו ונחסום את הגישה מיד.',
  ],

  useTitle: 'שימוש הוגן',
  useIntro: 'הדברים שאסור לעשות כאן קצרים ומובנים מאליהם:',
  use: [
    'לא לנסות להיכנס לאזור של מישהו אחר, ולא לחפש דרכים לעקוף את ההרשאות.',
    'לא להעלות קבצים שיש בהם נוזקה, ולא להעמיס על השירות בכוונה.',
    'לא להעלות תוכן שאין לכם זכות להעלות, ולא תוכן פוגעני.',
    'לא לגרד את האתר באופן אוטומטי ולא להעתיק ממנו תוכן לשימוש מסחרי.',
  ],
  useNote:
    'חשבון שפועל כך ייחסם. אם זו הייתה טעות, כתבו לנו ונבדוק. אנחנו מעדיפים לדבר לפני '
    + 'שאנחנו חוסמים, כשזה אפשרי.',

  contentTitle: 'התוכן שאתם מעלים',
  content: [
    'הקבצים, רשימת האורחים והטקסטים שאתם מעלים נשארים שלכם. אנחנו לא הופכים לבעלים שלהם.',
    'אנחנו מקבלים רשות אחת ומצומצמת: להחזיק את החומר, להציג אותו לכם ולהפקה, ולהשתמש בו '
    + 'כדי להפיק את האירוע. לא מעבר לזה.',
    'אתם אחראים לכך שמותר לכם להעלות את מה שהעליתם. אם העליתם תמונה של צלם, ההסכם מול '
    + 'הצלם הוא שלכם.',
    'בקשה למחוק קובץ מתבצעת. מה שנמחק לא נשמר לנו בצד.',
  ],

  photosTitle: 'תמונות מהאירוע שלכם',
  photos:
    'תמונות מהאירוע שלכם נכנסות לתיק העבודות, לרשתות או לכל פרסום אחר רק אחרי שאישרתם. '
    + 'אישור אחד לא הופך לאישור לתמיד: אפשר לחזור בכם בכל שלב, ואנחנו נוריד את התמונות '
    + 'מכל מקום שאנחנו שולטים בו.',

  shopTitle: 'החנות',
  shop: [
    'המחירים בשקלים חדשים. מחיר שמופיע בטעות אינו מחייב, ואם זה קורה נודיע לכם לפני כל '
    + 'צעד נוסף.',
    'הזמנה שנשלחת מהחנות היא בקשה שמגיעה אלינו, לא רכישה. שום אמצעי תשלום לא נמסר כאן '
    + 'ושום כרטיס לא נטען.',
    'העסקה נסגרת בשיחה, וההתחייבות ההדדית נוצרת רק כשסוכמו התנאים והתשלום מול שני הצדדים.',
    'עד לרגע הזה אפשר לבטל בקשה בהודעה אחת, בלי לנמק ובלי עלות.',
    'אחרי שנסגרה עסקה, הביטול כפוף למה שסוכם בה ולזכויות שמוקנות לכם בחוק הגנת הצרכן.',
  ],

  availabilityTitle: 'זמינות השירות',
  availability:
    'אנחנו עושים מה שאפשר כדי שהמערכת תהיה זמינה, ובכל זאת: זה תוכנה שרצה על שרתים. '
    + 'יהיו רגעים של תחזוקה ויכולות להיות תקלות. אנחנו לא מתחייבים לזמינות רצופה, '
    + 'ואנחנו כן מתחייבים לטפל בתקלה מהר ולא להשאיר אתכם בלי תשובה.',

  dataTitle: 'הנתונים שלכם לא נעלמים בעדכון',
  data:
    'עדכון גרסה לא מוחק נתונים של אף אחד. זה כלל ברזל של המערכת הזאת, והוא נבדק לפני כל '
    + 'עלייה לאוויר. אם בכל זאת קרה משהו, יש גיבוי ואנחנו משחזרים.',

  liabilityTitle: 'אחריות',
  liability: [
    'האחריות על ההפקה עצמה נקבעת בהסכם ההפקה.',
    'לגבי האתר והאזור האישי: הם ניתנים כפי שהם. אנחנו לא אחראים לנזק עקיף שנגרם מתקלה '
    + 'טכנית, מאובדן חיבור, או משימוש שאינו לפי התנאים האלה.',
    'אנחנו כן אחראים למה שאנחנו עושים ברשלנות, וזה לא משהו שעמוד אינטרנט יכול לוותר עליו.',
    'קישורים לשירותים של אחרים, כמו יומן פגישות חיצוני, כפופים לתנאים של אותם שירותים.',
  ],

  endTitle: 'סיום',
  end:
    'אפשר לבקש לסגור חשבון בכל רגע. אנחנו נסגור אותו ונמחק את מה שאינו חייב בשמירה לפי '
    + 'דין, בדיוק כמו שכתוב במדיניות הפרטיות. אם האירוע כבר קרה, ההסכם עליו ממשיך לחול '
    + 'על מה שנשאר פתוח בו.',

  changesTitle: 'שינויים בתנאים',
  changes:
    'אם נשנה משהו מהותי, נעדכן את התאריך שלמטה ונודיע לכל מי שיש לו אירוע פעיל. שינוי '
    + 'לא חל למפרע על משהו שכבר סוכם.',

  lawTitle: 'דין וסמכות שיפוט',
  law:
    'על התנאים האלה חל הדין הישראלי, והסמכות נתונה לבתי המשפט המוסמכים בישראל.',

  contactTitle: 'יצירת קשר',
  contact: 'שאלה על התנאים, או משהו שלא ברור. כתבו לנו ונחזור אליכם.',
  privacyLink: 'מדיניות הפרטיות משלימה את העמוד הזה ומסבירה מה נאסף ומי רואה מה.',
  updated: 'עודכן לאחרונה',
  back: 'חזרה לעמוד הבית',
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
    back: 'חזרה לעמוד הבית',
  },
} as const;

export const appCopy = {
  signOut: 'יציאה',
  overview2: {
    clear: 'הכל מטופל',
    clearSub: 'אין כרגע שום דבר שממתין להחלטה שלך.',
    /* The first morning: no events yet, so instead of "all clear" the screen
       says what to do, in the book's own order. */
    begin: {
      eyebrow: 'מתחילים כאן',
      sub: 'עוד אין אירועים במערכת, אז זה הסדר הנכון להתחיל בו.',
      cta: 'למסך המיתוג',
      book: 'ספר ההפעלה המלא',
    },
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
    /* What became of the enquiries. Separate from the funnel above it, and
       deliberately so: the funnel reads the status column, which is a
       producer's own opinion typed into a dropdown, and this counts events
       that exist. A lead marked won that never became an event is the most
       expensive thing on this screen to be wrong about. */
    conversion: {
      title: 'מה יצא מהפניות',
      sub: 'נספר לפי אירועים שנפתחו בפועל, לא לפי סטטוס שסומן ביד.',
      rate: 'הפכו לאירוע',
      count: 'מתוך {n} פניות',
      wait: 'זמן עד סגירה',
      days: '{n} ימים',
      none: 'עוד אין מספיק פניות כדי לומר משהו.',
    },
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
    /* Shown while the screen is being held awake, because a battery going
       down with no explanation reads as a broken app rather than a helpful
       one. */
    awake: 'המסך יישאר דלוק כל עוד המסך הזה פתוח.',
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

    /* The three pictures a brand is made of, and what each one has to be.
       The rules are said on the screen, next to the button, because a logo
       that arrives as a 40 pixel JPG with a white box around it is not a
       mistake anybody makes twice once they have been told. */
    assets: {
      title: 'הקבצים של המותג',
      sub: 'הלוגו, האייקון של האפליקציה ותמונת הפתיחה. שלושתם מופיעים אצל הזוגות שלכם ובשום מקום אחר.',
      choose: 'בחירת קובץ',
      replace: 'החלפה',
      remove: 'הסרה',
      uploading: 'מעלה',
      uploaded: 'נשמר',
      empty: 'עוד לא הועלה',
      tooBig: 'הקובץ גדול מדי.',
      badType: 'סוג הקובץ הזה לא מתאים כאן.',
      failed: 'ההעלאה נכשלה. נסו שוב.',
      logo: {
        title: 'לוגו',
        where: 'מופיע בראש המסך של הזוגות, במיילים ובדף הכניסה שלכם.',
        rules: ['PNG או SVG על רקע שקוף', 'לפחות 512 על 512 פיקסלים', 'ריבועי, או רחב כמו באנר', 'עד 2MB'],
      },
      icon: {
        title: 'אייקון האפליקציה',
        where: 'האייקון שמופיע במסך הבית כשמתקינים את האפליקציה בטלפון.',
        rules: ['PNG ריבועי, 512 על 512 פיקסלים', 'בלי שקיפות ובלי שוליים ריקים', 'צורה פשוטה שנקראת גם בגודל 60 פיקסלים', 'עד 1MB'],
      },
      cover: {
        title: 'תמונת פתיחה',
        where: 'הכרטיס שוואטסאפ מצייר לקישור שלכם, ורקע דף הכניסה.',
        rules: ['JPG או WebP', '1920 על 1080 פיקסלים, יחס 16:9', 'תמונה אמיתית מאירוע, בלי טקסט עליה', 'עד 5MB'],
      },
    },
    accent: 'צבע מוביל',
    accentHint: 'הצבעים כאן נבדקו לקריאוּת מול הרקע והטקסט. לכן זו רשימה ולא בורר צבעים חופשי.',
    whatsapp: 'וואטסאפ',
    booking: 'קישור לתיאום פגישה',
    address: 'כתובת באינטרנט',
    slug: 'השם הקצר שלכם בכתובת',
    slugHint: 'אותיות באנגלית קטנות, ספרות ומקפים בלבד. בלי נקודות, בלי רווחים, בלי עברית. למשל: eden-haimov',
    slugPreview: 'הכתובת שתשלחו לזוגות תהיה:',
    slugBad: 'יש כאן תו שלא מתאים לכתובת. אפשר להשתמש בגרסה הזאת במקום:',
    slugUse: 'להשתמש בה',
    slugShort: 'קצר מדי. לפחות שלושה תווים.',
    domain: 'דומיין משלכם (לא חובה)',
    domainHint: 'רק למי שכבר יש דומיין שקנה בעצמו. לרוב המפיקים השם הקצר למעלה מספיק. חיבור ה-DNS הוא פעולה נפרדת.',
    /* The link a producer sends couples, carrying their brand and not the
       platform's. Needs only the slug above; no domain, no DNS. */
    shareTitle: 'הקישור שלך לזוגות',
    shareSub: 'שלחו את הקישור הזה, לא את הכתובת של האתר. הכרטיס שוואטסאפ מצייר לו נושא את השם והלוגו שלכם בלבד, ומשם הזוג נכנס לאזור האישי.',
    shareNoSlug: 'קבעו תת דומיין למעלה ושמרו, והקישור יופיע כאן.',
    shareCopy: 'העתקה',
    shareCopied: 'הועתק',
    shareWhatsapp: 'שליחה בוואטסאפ',
    shareText: 'שלום, זה הקישור לאזור האישי שלכם:',
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
      /* Role only, never the name: the sheet belongs to whichever producer
         runs this event, and PortalActions puts the resolved brand's name in
         front of it. A personal name here would surface on every tenant. */
      title: 'מפיק האירוע',
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
    store: 'חנות',
    sop: 'מדריכים',
    /* One entry where there were two. The playbook and the system's own
       guides sat side by side and neither name said which was which. */
    knowledge: 'ידע',
    guide: 'ספר ההפעלה',
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

  /* The one page a supplier actually asks for: how many, what, and when.
     A print-first sibling of the run sheet, and deliberately without a
     shekel on it anywhere: it is handed to the caterer and the venue. */
  numbers: {
    open: 'דף מספרים',
    title: 'דף המספרים',
    sub: 'עמוד אחד עם כל מה שספק שואל: כמה, מה, ומתי.',
    back: 'חזרה לאירוע',
    print: 'הדפסה / שמירה כ-PDF',
    counts: 'כמה מגיעים',
    invited: 'הוזמנו',
    attending: 'אישרו',
    pending: 'טרם ענו',
    declined: 'לא מגיעים',
    heads: 'נפשות שאישרו',
    households: 'בתי אב',
    diet: 'מנות לקייטרינג',
    dietRegular: 'רגיל',
    dietNone: 'אין בקשות מיוחדות בינתיים.',
    meals: 'מנות',
    seating: 'שולחנות והושבה',
    seatingNone: 'עוד לא הוגדרו שולחנות.',
    seatedShort: 'הושבו',
    seatsShort: 'מקומות',
    unseated: 'טרם הושבו',
    schedule: 'רגעי המפתח',
    scheduleNone: 'עוד אין רגעי מפתח בלוז.',
    arrivals: 'שעות הגעה',
    arrivalsNone: 'עוד לא נקבעו שעות הגעה.',
    updated: 'נכון לרגע ההפקה של הדף. המספרים ממשיכים לזוז עד הרגע האחרון.',
  },

  /* The producer's switch for the guests' page, on the guests tab. */
  guestSite: {
    title: 'אתר האורחים',
    sub: 'עמוד אחד לשליחה לכל המוזמנים: מתי, איפה, סדר הערב, ואישור הגעה לפי מספר טלפון.',
    on: 'האתר פתוח',
    off: 'האתר כבוי',
    turnOn: 'פתיחת האתר',
    turnOff: 'כיבוי האתר',
    link: 'הקישור לשליחה',
    copy: 'העתקה',
    copied: 'הועתק',
    open: 'פתיחה',
    share: 'שיתוף בוואטסאפ',
    shareText: 'הוזמנתם לחגוג איתנו! כל הפרטים ואישור ההגעה כאן:',
    note: 'כמה מילים לאורחים',
    notePh: 'קוד לבוש, חניה, כל מה שחשוב שידעו',
    save: 'שמירה',
    saving: 'שומר',
    saved: 'נשמר',
    hint: 'לאורחים מופיעים רק השמות, התאריך, המקום, רגעי המפתח מהלוז והמילים שכאן. שום דבר אחר.',
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
      details: 'תיק האירוע',
      crew: 'צוות וספקים',
      bar: 'בר',
      money: 'כסף',
      docs: 'מסמכים',
      files: 'קבצים ותמונות',
      meetings: 'פגישות',
      messages: 'הודעות',
      board: 'השראה',
    },

    edit: 'עריכת פרטים',
    editSave: 'שמירה',
    editSaving: 'שומר',
    editCancel: 'ביטול',
    noDateYet: 'עוד לא נקבע תאריך',
    /* What came across from the enquiry. These rows only appear when there is
       something in them: an event the producer opened himself has no lead
       behind it, and a row reading "none" three times looks like data that
       went missing rather than data that never existed. */
    contact: {
      phone: 'טלפון',
      email: 'אימייל',
      brief: 'מה שנכתב בפנייה',
    },
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
    reorder: 'גרירה לשינוי הסדר',
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
    planTitle: 'להתחיל מתוכנית מלאה',
    planBody: 'עשרים ושמונה צעדים מתוארכים אחורה מתאריך האירוע, משנה לפני ועד חודש אחרי. הכל ניתן לעריכה, ושום דבר לא נדרס.',
    planCta: 'בנו לי את התוכנית',
    planBusy: 'בונה',
    planDone: 'התוכנית נבנתה',
    planEmpty: 'כל הצעדים כבר קיימים באירוע הזה.',
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

    /* The five figures and the sentence that explains them. */
    finance: {
      title: 'תמונת הכסף',
      sub: 'חמישה מספרים, ואיך הגענו אליהם.',
      how: 'איך זה מחושב',
      formula: 'איך מחושב התקציב? סך כל עלויות הספקים המאושרות פחות המקדמות ששולמו = יתרת תשלום עד ליום האירוע. מרווח הביטחון הוא תקציב היעד פחות ההתחייבויות.',
      target: 'תקציב יעד כולל',
      targetSub: 'התקרה שסיכמתם יחד',
      noTarget: 'לא נקבע',
      committed: 'סה״כ התחייבויות וחוזים',
      committedSub: 'כל סעיף במחיר שנסגר, או באומדן עד שייסגר',
      paid: 'שולם בפועל / מקדמות',
      paidSub: 'מה שכבר יצא מהחשבון',
      remaining: 'יתרה לתשלום',
      remainingSub: 'התחייבויות פחות מה ששולם',
      variance: 'מרווח ביטחון / חריגה',
      surplus: 'מרווח ביטחון',
      overrun: 'חריגה מהתקציב',
      underBadge: 'בתוך התקציב',
      overBadge: 'מעל התקציב',
      setTargetFirst: 'קבעו תקציב יעד',
      paidShare: 'שולם',
      pendingShare: 'ממתין לתשלום',
      setTarget: 'קביעת תקציב יעד',
      editTarget: 'שינוי תקציב היעד',
      save: 'שמירה',
      saving: 'שומר',
      cancel: 'ביטול',
    },
    budShow: 'הזוג רואה את התקציב',
    budHidden: 'מוסתר מהזוג',
    budVisible: 'גלוי לזוג',
    budHiddenNote: 'התקציב מוסתר מהזוג. אפשר לפתוח להם אותו בכל רגע.',
  },

  board: {
    /* The word above the title. It was a hard-coded English "BRIDE MODE",
       which assumed both a language and a bride. */
    eyebrow: 'כספת השראה',
    title: 'לוח ניצחון',
    subClient: 'התמונות שגרמו לכם להגיד "זה זה". כל מה שנאסף כאן עובר איתנו לספקים.',
    subProducer: 'התמונות שהזוג אסף. תצוגה בלבד, הם מנהלים את הלוח מהאזור שלהם.',
    upload: 'העלאת תמונה',
    choose: 'בחירת תמונה',
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

    /* The pictures, sorted by the four words people use for them. */
    media: {
      title: 'תמונות',
      sub: 'הלוקיישן, העיצוב, ההשראה והספקים. כל תמונה מתויגת, אז מוצאים אותה גם אחרי שישים תמונות.',
      tagForUpload: 'תיוג לתמונות שמעלים עכשיו',
      all: 'הכל',
      untagged: 'ללא תיוג',
      tags: {
        venue: 'לוקיישן',
        design: 'עיצוב',
        inspiration: 'השראה',
        vendors: 'ספקים',
      },
      count: '{n} תמונות',
      one: 'תמונה אחת',
      none: 'עוד אין תמונות בתיוג הזה.',
      open: 'הגדלה',
      close: 'סגירה',
      prev: 'הקודמת',
      next: 'הבאה',
      retag: 'שינוי תיוג',
      manage: 'ניהול',
      done: 'סיום',
    },
  },

  portal: {
    title: 'האזור שלנו',
    sub: 'כל מה שקשור לאירוע שלכם, במקום אחד.',
    /* The link the couple pastes into the family group. */
    guestSite: {
      title: 'הקישור לאורחים',
      sub: 'שלחו אותו בוואטסאפ לכל המוזמנים. כל אחד מוצא את עצמו לפי מספר הטלפון ומאשר הגעה.',
      copy: 'העתקת הקישור',
      copied: 'הועתק',
      open: 'פתיחת העמוד',
      share: 'שיתוף בוואטסאפ',
      /* The sentence that travels with the link. Short, because the link's
         own preview carries the names and the date. */
      shareText: 'הוזמנתם לחגוג איתנו! כל הפרטים ואישור ההגעה כאן:',
    },
    empty: 'עוד לא שויך לכם אירוע. ההפקה תפתח אותו ותקבלו הודעה.',
    /* The likeliest reason somebody sees an empty area is not that their event
       has not been opened yet — it is that they signed in with a different
       address from the one they were invited at, which Google made easy to do
       by accident. Naming the address they are actually signed in as turns a
       blank page into something they can fix in one message. */
    /* Sentences with a hole in them rather than functions. This block is
        handed to a client component so a couple can read it in English, and a
        function cannot be serialised across that boundary. The wording is
        unchanged; only the substitution moved to the call site. */
    emptyWho: 'נכנסתם בתור {email}.',
    emptyMismatch:
      'אם ההזמנה הגיעה לכתובת אחרת, זאת הסיבה שהמסך ריק. אפשר לצאת ולהיכנס עם הכתובת '
      + 'שאליה קיבלתם את ההזמנה, או פשוט לכתוב לנו ונחבר את הכתובת הזאת לאירוע.',
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
/* The guests' page: what a couple sends to everyone they invited. Reached by
   an unguessable link, read on a phone in a family group, by people who have
   no account and never will. Every string here is for them. */
export const guestSiteCopy = {
  eyebrow: 'הוזמנתם לחגוג איתנו',
  daysLeft: 'ימים לאירוע',
  today: 'זה היום',
  passed: 'האירוע כבר נערך. תודה שהייתם איתנו.',
  dateTbd: 'התאריך יפורסם בקרוב',
  waze: 'ניווט בוויז',
  maps: 'מפות גוגל',
  calendar: 'הוספה ליומן',
  moments: 'סדר הערב',
  note: 'כמה מילים מאיתנו',
  rsvpTitle: 'אישור הגעה',
  rsvpSub: 'הקלידו את מספר הטלפון שאליו נשלחה ההזמנה, ונעביר אתכם לאישור האישי שלכם.',
  phone: 'מספר טלפון',
  find: 'מצאו אותי',
  finding: 'מחפש',
  notFound: 'לא מצאנו את המספר ברשימה. אפשר לפנות ישירות לזוג.',
  tooMany: 'יותר מדי ניסיונות ברצף. נסו שוב בעוד רגע.',
  bad: 'המספר לא נראה תקין. בדקו ונסו שוב.',
  producedBy: 'הפקה',
  gone: 'הדף לא זמין',
  goneBody: 'הקישור לא נמצא, או שהדף עדיין לא פורסם. אפשר לפנות לזוג.',
} as const;

/* A producer's own front door on the platform's address: the page their
   couples open from a shared link, carrying only the producer's brand. */
export const producerEntryCopy = {
  eyebrow: 'האזור האישי',
  enter: 'כניסה לאזור האישי',
  sub: 'הכניסה עם הכתובת שאליה נשלחה ההזמנה, בקוד חד פעמי. אין סיסמה.',
  whatsapp: 'הודעה בוואטסאפ',
  booking: 'קביעת פגישה',
  gone: 'הדף לא נמצא',
  goneBody: 'הקישור לא נמצא. אפשר לפנות למי ששלח אותו.',
} as const;

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
  overlap: 'חופף ל"{title}" באותו מסלול',
  crossesMidnight: 'הלוז ממשיך אחרי חצות, והשורות מסודרות לפי סדר הערב.',
  totalLines: '{n} שורות',
  span: '{from} עד {to}',

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
  addLocation: 'מיקום האירוע',
  addLocationFree: 'או שם האולם',
  addLocationPh: 'שם האולם או כתובת, אם ידוע',
  location: 'מיקום',
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
  agreedPrice: 'מחיר מוסכם',
  depositPaid: 'מקדמה ששולמה',

  /* The spreadsheet every producer already keeps, brought in whole. */
  import: {
    open: 'ייבוא מאקסל',
    title: 'ייבוא ספקים מאקסל',
    sub: 'קובץ אקסל או CSV עם עמודות: שם ספק, קטגוריה, טלפון, מייל, מחיר מוסכם, מקדמה ששולמה, הערות. השורה הראשונה היא הכותרות.',
    template: 'הורדת תבנית',
    templateName: 'ספקים-תבנית.xlsx',
    choose: 'בחירת קובץ',
    drop: 'גוררים לכאן קובץ xlsx, xls או csv',
    reading: 'קורא את הקובץ',
    unreadable: 'לא הצלחנו לקרוא את הקובץ. נסו לשמור אותו מחדש כ-xlsx.',
    noRows: 'לא נמצאו שורות עם שם ספק.',
    mapping: 'התאמת עמודות',
    mappingSub: 'זיהינו את העמודות לפי הכותרות. אפשר לתקן כאן לפני הייבוא.',
    skip: 'לא לייבא',
    preview: 'מה ייכנס',
    previewMore: 'ועוד {n} שורות',
    rowsFound: '{n} ספקים בקובץ',
    willAdd: '{n} חדשים',
    willUpdate: '{n} קיימים יעודכנו',
    run: 'ייבוא',
    running: 'מייבא',
    done: 'הייבוא הושלם',
    added: 'נוספו',
    updated: 'עודכנו',
    skipped: 'דולגו',
    failed: 'הייבוא נכשל. נסו שוב.',
    cancel: 'ביטול',
    columns: {
      name: 'שם ספק',
      category: 'קטגוריה',
      phone: 'טלפון',
      email: 'מייל',
      agreed_price: 'מחיר מוסכם',
      deposit_paid: 'מקדמה ששולמה',
      notes: 'הערות',
      contact_name: 'איש קשר',
      area: 'אזור',
    },
  },
} as const;

/**
 * The page that is not there.
 *
 * A 404 on a wedding site is almost never somebody typing badly. It is a link
 * from an old message, a share that lost its last characters, or an
 * invitation somebody forwarded twice. So it does not scold and it does not
 * shrug: it says the address did not lead anywhere, and offers the three
 * places a person who landed here actually wanted.
 */
export const notFoundCopy = {
  code: '404',
  title: 'הכתובת הזאת לא מובילה לשום מקום',
  body: 'יכול להיות שהקישור נשלח חלקי, או שהעמוד זז מאז. שום דבר לא אבד.',
  home: 'לעמוד הבית',
  contact: 'לדבר איתנו',
  signIn: 'לאזור האישי',
  help: 'אם הגעתם לכאן מקישור שקיבלתם, שווה לבקש אותו שוב מהשולח. קישורים לאירוע הם אישיים ויש להם תוקף.',
  /* The same situation for somebody already signed in, which is a different
     situation. A producer who opened a stale link to an event does not want
     the home page and does not want to be offered our phone number; they want
     the list they came from. Sending them to the public notice was offering a
     customer service desk to somebody standing inside the building. */
  workspace: {
    title: 'האירוע הזה לא נמצא',
    body: 'יכול להיות שהוא הועבר לארכיון, או שהקישור מצביע על אירוע שנמחק.',
    back: 'חזרה לאירועים',
  },
} as const;

/**
 * Something on the public site threw.
 *
 * Separate from the workspace's own boundary because the reader is different:
 * a visitor has no account to go back to and no reason to trust that anything
 * was saved. What they need is the way to reach a person, which is why the
 * two buttons here are the home page and the phone.
 */
export const siteErrorCopy = {
  title: 'משהו נפל אצלנו',
  body: 'התקלה בצד שלנו ולא בצד שלכם. אפשר לנסות שוב, ואם זה חוזר, אנחנו זמינים.',
  retry: 'לנסות שוב',
  home: 'לעמוד הבית',
  whatsapp: 'לכתוב לנו בוואטסאפ',
  ref: 'קוד לתקלה',
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
    house: 'החישוב שלי',
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
  houseNote: 'לפי הכלל שלך: ליטר לכל תשעה אנשים, בפיצול הקבוע שלך. שעות הבר לא משנות את הכמות בשיטה הזאת, כי הן כבר בתוך המספר.',
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
  sub: 'העוזר הדיגיטלי שלנו',
  open: 'פתיחת שיחה',
  close: 'סגירה',
  greeting: 'אפשר לשאול אותי איך התהליך עובד, מה כלול בהפקה, ומה קורה ביום האירוע. אם תרצו שנחזור אליכם, השאירו לי שם וטלפון.',
  starters: ['איך התהליך עובד?', 'מה כלול בהפקה?', 'אנחנו רוצים חתונה בשטח'],
  placeholder: 'מה תרצו לדעת',
  send: 'שליחה',
  /* Not "רגע". The assistant's own instructions forbid it every filler word
     of waiting, and the panel around it was saying one. */
  thinking: 'כותב',
  wentWrong: 'משהו נתקע אצלי. אפשר לכתוב לנו בוואטסאפ ונחזור אליכם.',
  disclaimer: 'תשובות כלליות. מחיר וזמינות נסגרים בפגישה.',
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
  noneSub: 'כשמשהו יקרה באחד האירועים, הוא יופיע כאן.',
  markAll: 'סמן הכל כנקרא',
  markOne: 'סימון כנקרא',
  open: 'פתיחה',
  close: 'סגירה',
  unread: 'לא נקראו',
  now: 'עכשיו',
  minutes: 'לפני {n} דק׳',
  hours: 'לפני {n} שע׳',
  days: 'לפני {n} ימים',
  kinds: {
    lead: 'פנייה',
    rsvp: 'אישור הגעה',
    task: 'משימה',
    payment: 'תשלום',
    invite: 'גישה',
    message: 'הודעה',
    contract: 'חוזה',
    file: 'קובץ',
    order: 'הזמנה',
    anniversary: 'יום נישואים',
    meeting: 'פגישה',
    ticket: 'דיווח',
  },
} as const;

/* Saying something is wrong, to the people who run the platform rather than
   to the producer. Nameless on purpose: whoever reads it, the screen belongs
   to the producer's brand. */
export const ticketCopy = {
  open: 'דיווח על תקלה',
  title: 'דיווח על תקלה',
  sub: 'משהו לא עובד כמו שצריך? ספרו לנו מה קרה ונטפל.',
  category: 'סוג התקלה',
  categories: {
    visual: 'באג ויזואלי',
    auth: 'תקלת התחברות',
    data: 'שגיאת נתונים',
    other: 'אחר',
  },
  body: 'מה קרה',
  bodyPh: 'מה ניסיתם לעשות, מה ציפיתם שיקרה, ומה קרה בפועל',
  screenshot: 'צילום מסך',
  screenshotHint: 'לא חובה. תמונה עד 5MB.',
  screenshotRemove: 'הסרה',
  auto: 'נצרף אוטומטית את כתובת המסך והדפדפן, כדי שנוכל לשחזר.',
  /* Named when the report is opened from inside a particular panel, so the
     answer does not start with "which screen?". */
  inContext: 'דיווח על: {what}',
  openHere: 'משהו לא בסדר כאן?',
  submit: 'שליחת הדיווח',
  sending: 'שולח',
  sent: 'קיבלנו. נחזור אליכם.',
  sentSub: 'הדיווח נשמר ונשלח לצוות. אם נצטרך עוד פרטים, נכתוב לכתובת שאתם מחוברים איתה.',
  empty: 'נא לכתוב מה קרה',
  tooBig: 'צילום המסך גדול מדי. עד 5MB.',
  badType: 'צילום מסך צריך להיות תמונה.',
  failed: 'לא הצלחנו לשלוח. נסו שוב.',
  close: 'סגירה',
  /* The root account's list. */
  admin: {
    title: 'דיווחי תקלות',
    sub: 'מה שמשתמשים דיווחו מתוך המערכת. פתוחים קודם.',
    none: 'אין דיווחים פתוחים.',
    open: 'פתוח',
    closed: 'טופל',
    markClosed: 'סימון כטופל',
    reopen: 'פתיחה מחדש',
    route: 'מסך',
    agent: 'דפדפן',
    screenshot: 'צילום מסך',
    reporter: 'דווח על ידי',
    showClosed: 'הצגת מה שטופל',
  },
} as const;

/* The producer's own assistant, inside the console. Different animal from the
   concierge on the public site: that one talks to strangers about a wedding,
   this one talks to the producer about their week. */
/* The search box every desk app has. Screens and events, two keystrokes. */
/* The Hebrew calendar, as a producer needs it: which nights a wedding can
   stand on. Planning guidance, and the screen says so. */
export const hebrewCalCopy = {
  title: 'לוח עברי ומועדים',
  sub: 'אילו ערבים פנויים לחתונה בשלושים הימים הקרובים, ואילו סגורים לפי ההלכה.',
  next30: '30 יום',
  next60: '60 יום',
  clear: 'פנוי',
  check: 'לבדוק',
  blocked: 'מוגבל לחתונה כהלכה',
  clearLegend: 'ערב פנוי',
  checkLegend: 'תלוי במנהג',
  blockedLegend: 'לא מקיימים חתונה',
  today: 'היום',
  hebrewOn: 'בערב נכנס',
  none: 'אין ימים בטווח הזה.',
  /* Said plainly, and not buried. The producer is not a rabbi and neither is
     this screen. */
  disclaimer: 'זו עזרה לתכנון ולא פסיקה. המנהגים משתנים בין עדות ובין קהילות, ובכל תאריך גבולי סוגרים מול הרב של הזוג.',
  custom: 'המנהג שמוצג כאן הוא המנהג האשכנזי הרווח בארץ. במנהג הספרדי ספירת העומר נמשכת עד ל״ד בעומר.',
  reasons: {
    shabbat: 'שבת',
    erevShabbat: 'ערב שבת',
    roshHashana: 'ראש השנה',
    yomKippur: 'יום כיפור',
    sukkot: 'סוכות',
    cholHamoed: 'חול המועד',
    shminiAtzeret: 'שמיני עצרת ושמחת תורה',
    pesach: 'פסח',
    shavuot: 'שבועות',
    erevChag: 'ערב חג',
    threeWeeks: 'בין המצרים',
    nineDays: 'תשעת הימים',
    tishaBav: 'תשעה באב',
    omer: 'ימי העומר',
    omerSephardi: 'עומר, במנהג הספרדי',
    lagBaomer: 'ל״ג בעומר',
    fast: 'צום',
    purim: 'פורים',
    roshChodesh: 'ראש חודש',
  },
} as const;

/* The producer's own colours and their own channels. One toolbar, two uses. */
export const labelCopy = {
  tagsTitle: 'הצבעים שלי',
  tagsSub: 'מה כל צבע אומר ביומן שלכם. אפשר לשנות שם, צבע, ולהוסיף משלכם.',
  channelsTitle: 'ערוצי הפניות שלי',
  channelsSub: 'איך פניות מגיעות אליכם. מה שתוסיפו כאן יופיע בטופס רישום פנייה ובדוח הערוצים.',
  add: 'הוספה',
  addPh: 'שם התגית',
  addChannelPh: 'שם הערוץ',
  save: 'שמירה',
  saving: 'שומר',
  rename: 'שינוי שם',
  color: 'צבע',
  remove: 'מחיקה',
  none: 'עוד לא הוגדרו.',
  noneChannels: 'עוד לא הוספתם ערוץ משלכם. שישה ערוצים מובנים כבר קיימים.',
  builtIn: 'מובנה',
  taken: 'כבר קיים אצלכם שם כזה.',
  failed: 'לא הצלחנו לשמור. נסו שוב.',
  tooLong: 'שם ארוך מדי. עד 40 תווים.',
  needName: 'נא לכתוב שם.',
  close: 'סגירה',
  eventTag: 'תגית לאירוע',
  eventTagNone: 'בלי תגית',
  legend: 'מקרא',
} as const;

/**
 * One place to look things up.
 *
 * The menu had two entries for knowledge, side by side, and neither name said
 * which kind it held: "מדריכים" was how to use this system and "ספר ההפעלה"
 * was how to run an event on open ground. A producer looking for either had to
 * guess, and the cost of guessing wrong was opening the other one.
 */
/**
 * Where an event is, in words.
 *
 * The names are the producer's own vocabulary rather than a progress bar's,
 * because a phase is a kind of work and not a percentage: "closing suppliers"
 * says what to do next and "62%" does not.
 */
export const phaseCopy = {
  expected: 'אמור להיות ב',
  actually: 'בפועל ב',
  names: {
    foundation: 'בסיס: תאריך, מקום ותקציב',
    bookings:   'סגירת ספקים',
    experience: 'עיצוב החוויה',
    guests:     'אורחים והזמנות',
    final:      'תיאום אחרון',
    dayOf:      'יום האירוע',
    after:      'סגירה אחרי האירוע',
  },
} as const;

export const knowledgeCopy = {
  title: 'ידע',
  sub: 'איך עובדים במערכת, איך מפיקים אירוע, ומה שכבר בנית לעצמך.',
  shelves: {
    book: 'הפעלת המערכת',
    playbook: 'ספר ההפקה',
    templates: 'התבניות שלך',
  },
} as const;

export const jumpCopy = {
  open: 'חיפוש מהיר',
  title: 'לאן?',
  placeholder: 'שם של אירוע, ליד, ספק או מסך',
  screens: 'מסכים',
  events: 'אירועים',
  leads: 'לידים',
  vendors: 'ספקים',
  recent: 'אחרונים',
  sections: 'מקטע בתוך אירוע',
  none: 'לא נמצא. אפשר לנסות חלק מהשם.',
  close: 'סגירה',
  hint: 'חצים לבחירה, Enter לפתיחה, Esc לסגירה.',
  hintTwo: 'שם אירוע יחד עם שם מקטע פותח ישר את המקטע.',
} as const;

export const copilotCopy = {
  open: 'עוזר מפיק',
  close: 'סגירה',
  title: 'עוזר מפיק',
  sub: 'מכיר את האירוע הפתוח, את הלוז ואת ספר ההפעלה.',
  context: 'בהקשר',
  noContext: 'כל האירועים',
  greeting: 'אפשר לבקש ממני ניסוח למייל לספק, עדכון לזוג בוואטסאפ, סדר יום לפגישה, או לשאול מה נשאר לעשות לפני האירוע.',
  /* Named jobs rather than an empty box. A blank field with a cursor in it is
     a test somebody has to pass before the tool does anything, and the answer
     to "what can this do" should be readable rather than guessable. Grouped
     the way the work is: what to write, what to check, what to prepare. */
  starters: [
    'נסח מייל לספק עם שעת הגעה',
    'עדכון קצר לזוג על הלוז',
    'מה נשאר לעשות לפני האירוע?',
    'אילו אישורים עוד חסרים לי מספקים?',
    'אילו תשלומים פתוחים ומתי',
    'סכם לי משימות באיחור',
    'סדר יום לפגישת תיאום',
    'שאלון לפגישת טעימות',
    'תדריך קצר לצוות ליום האירוע',
  ],
  /* What the answer was built from. Counts rather than rows: a panel that
     listed the guest list to prove it had read the guest list would be the
     leak it was trying to reassure somebody about. */
  read: 'קראתי',
  reads: {
    tasks: 'משימות',
    payments: 'תשלומים',
    vendors: 'ספקים',
    budget: 'שורות תקציב',
    guests: 'אורחים',
    schedule: 'שורות לוז',
  },
  placeholder: 'מה צריך?',
  send: 'שליחה',
  thinking: 'רגע',
  copy: 'העתקה',
  copied: 'הועתק',
  whatsapp: 'שליחה בוואטסאפ',
  wentWrong: 'משהו נתקע אצלי. נסו שוב בעוד רגע.',
  disclaimer: 'טיוטות לעריכה. לפני ששולחים, קוראים.',
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

/* ── the shop ─────────────────────────────────────────────────────────────
   Two audiences from one block: the producer arranging what is for sale, and
   the visitor buying it. Kept together because half these lines appear on both
   screens and a second copy of them is how the shop and the shopfront end up
   calling the same thing by two names. */
export const storeCopy = {
  title: 'חנות',
  sub: 'מוצרים ושירותים שאפשר להזמין דרך האתר.',
  tabProducts: 'מה מוכרים',
  tabOrders: 'הזמנות',

  add: 'הוספת פריט',
  edit: 'עריכה',
  saving: 'שומר',
  save: 'שמירה',
  cancel: 'ביטול',
  remove: 'מחיקה',
  removeAsk: 'למחוק את הפריט מהחנות?',
  drag: 'גרירה לשינוי הסדר',
  dragHint: 'הסדר כאן הוא הסדר שהמבקרים רואים בעמוד החנות.',

  name: 'שם',
  namePh: 'חבילת בר מלא',
  blurb: 'שורה אחת',
  blurbPh: 'מה זה, במשפט',
  body: 'תיאור מלא',
  bodyPh: 'מה כלול, מה לא, כמה זמן',
  price: 'מחיר',
  pricePh: '0',
  kind: 'סוג',
  kindProduct: 'מוצר',
  kindService: 'שירות',
  photo: 'תמונה',
  photoAdd: 'העלאת תמונה',
  photoUploading: 'מעלה',
  photoDone: 'תמונה נבחרה',
  active: 'מוצג בחנות',
  hidden: 'מוסתר',
  show: 'הצגה',
  hide: 'הסתרה',
  noneProducts: 'עוד לא הוספת שום דבר למכירה.',
  noneOrders: 'עוד לא הגיעו הזמנות.',
  saveFailed: 'לא הצלחנו לשמור',

  /* the columns an order moves between */
  state: {
    draft: 'טיוטה',
    pending: 'ממתין לתשלום',
    paid: 'שולם',
    refunded: 'הוחזר',
  },
  moveTo: 'העברה אל',
  orderNote: 'הערה פנימית',
  orderNotePh: 'מה סוכם בטלפון',
  items: 'פריטים',
  total: 'סך הכל',
  ordersHint: 'גוררים כרטיס בין העמודות, או בוחרים מהתפריט שבו.',

  /* ── the shopfront, as a visitor sees it ─────────────────────────────── */
  shopTitle: 'מה אפשר להזמין',
  shopSub: 'בוחרים, משאירים פרטים, ואנחנו חוזרים לסגור.',
  shopEmpty: 'החנות ריקה כרגע. דברו איתנו ונרכיב לכם הצעה.',
  addToCart: 'הוספה',
  inCart: 'בסל',
  cart: 'הסל שלי',
  cartEmpty: 'הסל ריק.',
  qty: 'כמות',
  clear: 'ריקון הסל',
  checkout: 'שליחת הזמנה',
  sending: 'שולח',
  buyerName: 'שם מלא',
  buyerPhone: 'טלפון',
  buyerEmail: 'אימייל',
  buyerNote: 'הערה',
  buyerNotePh: 'תאריך האירוע, שאלה, כל דבר',
  /* No card is charged here, and saying so is not a disclaimer, it is the
     product: this business closes on the phone. */
  payLater: 'לא מחייבים כרטיס. שולחים את ההזמנה, ואנחנו חוזרים לסגור תשלום ותאריך.',
  thanksTitle: 'ההזמנה התקבלה',
  thanks: 'שמרנו את ההזמנה ונחזור אליכם. מספר ההזמנה שלכם:',
  again: 'הזמנה נוספת',
  failed: 'לא הצלחנו לשלוח את ההזמנה. נסו שוב.',
} as const;

/* ── הארכיון, הפגישות והתבניות ───────────────────────────────────────────
   One block for the year after the wedding: closing an event, finding it again
   two summers later, the four meetings along the way, and the anniversary. */
export const archiveCopy = {
  title: 'ארכיון',
  sub: 'אירועים שנסגרו, לפי השנה שבה הם היו.',
  open: 'ארכיון',
  backToLive: 'לאירועים הפעילים',
  yearLabel: (year: number) => `אירועי ${year}`,
  noYear: 'בלי תאריך',
  count: (n: number) => (n === 1 ? 'אירוע אחד' : `${n} אירועים`),
  empty: 'עוד לא נסגר כאן אף אירוע.',
  emptyYear: 'אין אירועים בשנה הזאת.',

  close: 'סגירת אירוע',
  closing: 'סוגר',
  closeAsk: 'לסגור את האירוע? נשמור תמונת מצב של הספקים, הצוות והכסף כפי שהם עכשיו.',
  closeNote: 'הערה לסגירה',
  closeNotePh: 'מה שכדאי לזכור מהערב הזה',
  reopen: 'פתיחה מחדש',
  reopened: 'האירוע חזר לפעילים',
  /* Said once, on the button, because it is the part people do not expect. */
  closeNote2: 'התמונה שנשמרת בסגירה נשארת גם אם תפתחו את האירוע מחדש.',

  frozen: 'תמונת מצב מהסגירה',
  vendors: 'ספקים',
  crew: 'צוות',
  money: 'כסף',
  runsheet: 'לוז',
  guestsFinal: 'אורחים שהגיעו',
  budget: 'תקציב',
  paid: 'שולם',
  closedOn: 'נסגר בתאריך',

  anniversary: 'שנה לאירוע',
  anniversarySub: 'תזכורת נשלחת חודש, שבוע ויום לפני. רק בשנה הראשונה.',
  anniversaryCancel: 'ביטול התזכורת',
  yearSince: 'שנה ל-',
  anniversaryIn: {
    month: 'בעוד חודש',
    week: 'בעוד שבוע',
    day: 'מחר',
  },
  greet: 'שליחת ברכה',
} as const;

export const meetingCopy = {
  title: 'פגישות',
  sub: 'מה נשאל, מה נענה, ומה סוכם. כל גרסה נשמרת.',
  none: 'עוד לא תועדה פגישה.',
  add: 'תיעוד פגישה',
  pick: 'איזו פגישה',
  held: 'תאריך הפגישה',
  save: 'שמירה',
  saving: 'שומר',
  cancel: 'ביטול',
  remove: 'מחיקה',
  removeAsk: 'למחוק את תיעוד הפגישה?',
  open: 'פתיחה',
  close: 'סגירה',

  summary: 'סיכום',
  summarise: 'כתיבת סיכום',
  summarising: 'כותב',
  summaryByModel: 'הפסקה העליונה נכתבה אוטומטית. הרישום שמתחתיה הוא מה שנרשם בפגישה.',
  summaryNone: 'אין עדיין מה לסכם. מלאו כמה שדות ושמרו.',
  answered: (filled: number, total: number) => `נענו ${filled} מתוך ${total}`,
  shareWithCouple: 'משותף עם הזוג',
  shareHint: 'כברירת מחדל פגישה נשארת אצלכם בלבד.',
  versions: 'גרסאות',
  versionsNone: 'זאת הגרסה הראשונה.',
  savedAt: 'נשמר',
  saveFailed: 'לא הצלחנו לשמור',
} as const;

export const workflowCopy = {
  title: 'תבניות עבודה',
  sub: 'רשימות שחוזרות בכל אירוע. מוחלות על התאריך של החתונה ומתפרסות ללוז.',
  none: 'עוד לא בניתם תבנית.',
  add: 'תבנית חדשה',
  seed: 'להתחיל מארבע הפגישות',
  name: 'שם התבנית',
  namePh: 'הדרך שלי לחתונה',
  steps: 'שלבים',
  stepTitle: 'מה עושים',
  stepWhen: 'כמה ימים לפני החתונה',
  stepWhenHint: 'מספר חיובי. 90 זה שלושה חודשים לפני.',
  stepOwner: 'על מי',
  ownerProducer: 'עליי',
  ownerClient: 'על הזוג',
  addStep: 'הוספת שלב',
  removeStep: 'הסרה',
  save: 'שמירה',
  saving: 'שומר',
  cancel: 'ביטול',
  remove: 'מחיקה',
  removeAsk: 'למחוק את התבנית?',
  /* The panel on the event page is about *this* event, so it says so. Its
     heading used to repeat the one on the playbook page, which put the same
     three words on two screens that do different things. */
  onThisEvent: 'רשימה לאירוע הזה',
  which: 'איזו תבנית',
  stepsCount: (n: number) => (n === 1 ? 'שלב אחד' : `${n} שלבים`),
  apply: 'החלה על אירוע',
  applying: 'מחיל',
  applied: (n: number) => (n === 0 ? 'הכל כבר היה שם' : `נוספו ${n} שלבים`),
  noDate: 'לאירוע אין עדיין תאריך, אז השלבים ייכנסו בלי תאריך יעד.',
  saveFailed: 'לא הצלחנו לשמור',
} as const;

export const referralCopy = {
  title: 'הפניות',
  sub: 'מי הצטרף דרך מי. מספרים בלבד, בלי שם של אף זוג ואף אירוע.',
  myLink: 'הקישור שלי',
  copy: 'העתקה',
  copied: 'הועתק',
  producer: 'מפיק',
  code: 'קוד',
  invitedBy: 'הצטרף דרך',
  invited: 'הביא',
  clients: 'אירועים',
  direct: 'ישירות',
  none: 'עוד לא הצטרף אף אחד דרך קישור.',
  claim: 'הצטרפתי דרך קוד',
  claimPh: 'הקוד שקיבלתם',
  claimSave: 'שיוך',
  claimed: 'השיוך נשמר',
  claimFailed: 'הקוד לא נמצא, או שכבר משויכים.',
} as const;

/* ── תיק האירוע ───────────────────────────────────────────────────────────
   The three lists out of his own file. The wording is his: "כניסה שנייה אחרי
   החלפת בגדים" is not a phrase anybody invents, it is a thing that happens at
   an Israeli wedding and gets forgotten every time. */
export const eventFileCopy = {
  music: {
    title: 'מוזיקה',
    sub: 'שבעה רגעים שצריך לבחור להם שיר. הרשימה עוברת לדיג׳יי כמו שהיא.',
    song: 'שיר',
    songPh: 'שם השיר',
    artist: 'אמן',
    note: 'הערה',
    notePh: 'גרסה, אורך, איפה לעצור',
    save: 'שמירה',
    chosen: 'נבחרו {n} מתוך {of}',
    empty: 'עוד לא נבחר שיר לאף רגע.',
  },

  equipment: {
    title: 'ציוד',
    sub: 'מה צריך, ומה כבר סגור.',
    /* Three states, not a tick. A checkbox cannot say "we need a generator and
       have not booked one", which is the only state here worth a reminder. */
    /* An item nobody has looked at yet. Not the same as one somebody checked
       and ruled out, which is what `off` means. */
    undecided: 'טרם נבדק',
    off: 'לא צריך',
    needed: 'צריך',
    sorted: 'סגור',
    /* Two sentences rather than one with a branch, because the plural rule is
       a property of the language and not of the count. */
    openCountOne: 'פריט אחד פתוח',
    openCountMany: '{n} פריטים פתוחים',
    allSorted: 'הכל סגור.',
  },

  couple: {
    title: 'פרטים אישיים',
    sub: 'מה שהופך חתונה לחתונה שלהם. הזוג ממלא, ואתם רואים.',
    personA: 'צד א׳',
    personB: 'צד ב׳',
    name: 'שם',
    namePh: 'איך קוראים לו/לה',
    save: 'שמירה',
    saved: 'נשמר',
    emptyHint: 'ריק. אפשר למלא מכאן, או לבקש מהזוג למלא באזור שלהם.',
  },
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
