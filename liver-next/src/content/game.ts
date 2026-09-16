/**
 * The words around the deck.
 *
 * Hebrew only, and that is a decision rather than an omission. The cards are
 * pictures with Hebrew set into them; English chrome around Hebrew artwork is
 * a half-translation, and a half-translation reads worse than none. The rest
 * of the platform switches language because the rest of the platform is text.
 * If the deck is ever redrawn in English this file grows a second export and
 * the route reads the cookie like everything else.
 *
 * The rules screen used to be the one piece of this that was not in the box:
 * the drafts arrived with no card saying how to play, so five paragraphs were
 * inferred from what the rule cards said about their neighbours. The final
 * deck came with card 102, "איך משחקים?", in his own words, so the rules
 * screen now shows that card and the words below it only cover what a printed
 * card cannot know: that there are two phones, that the notebook is the עט ודף
 * it asks for, and that the deck remembers where you stopped.
 */

export const game = {
  /* ── the door ──────────────────────────────────────────────────────────── */
  kicker: 'משחק הקלפים',
  /* The deck's name, and it stays in Latin in a Hebrew screen because it is
     a name rather than a phrase to translate. */
  title: 'Before I Do',
  intro: 'שישים ושישה קלפים על החתונה שלכם ועליכם. כל אחד פותח בטלפון שלו, שניכם על אותו קלף.',
  who: 'מי פותח עכשיו?',
  sideA: 'אני הראשון/ה',
  sideB: 'אני השני/ה',
  rulesLink: 'איך משחקים',
  gone: 'Before I Do לא פתוח',
  goneBody: 'הקישור שגוי, או שהמשחק עדיין לא נפתח לאירוע הזה.',

  /* ── the rules ─────────────────────────────────────────────────────────── */
  rulesTitle: 'איך משחקים',
  rulesBack: 'חזרה למשחק',
  /* The card says the rest. These four cover only what a printed card has no
     way to know: that this is a screen, that there are two of them, and that
     the עט ודף it asks for is built in. */
  rules: [
    {
      h: 'שניכם, כל אחד במכשיר שלו',
      p: 'פותחים את אותו קישור בשני טלפונים ובוחרים כל אחד את הצד שלו. '
        + 'החפיסה מסודרת אותו דבר לשניכם, אז אתם תמיד על אותו קלף.',
    },
    {
      h: 'קלף אחד בכל פעם',
      p: 'לוחצים על הקלף והוא נפתח. עונים שניכם בקול ולא במסך, ואז לוחצים על "הקלף הבא". '
        + 'אין ניקוד ואין מנצח.',
    },
    {
      h: 'שני קלפי חוק',
      p: 'שניים מהקלפים הם לא שאלה אלא חוק: החלפת תפקידים, ווטו. '
        + 'הם משנים איך משחקים את הקלף שאחריהם, וכשאחד כזה עולה כדאי לקרוא אותו בקול.',
    },
    {
      h: 'העט והדף כאן',
      p: 'בכל קלף אפשר לרשום לעצמכם הערה, וכל מה שרשמתם מחכה ב"מחברת" למעלה. '
        + 'זה שווה: חצי מהקלפים הם החלטה אמיתית על הערב, והשיחה הזאת נשכחת עד מרץ. '
        + 'המחברת היא שלכם בלבד, גם בן או בת הזוג לא רואים אותה. '
        + 'המשחק גם זוכר איפה עצרתם, אז אפשר לסגור ולהמשיך מתי שבא לכם.',
    },
  ],

  /* ── the table ─────────────────────────────────────────────────────────── */
  tapToOpen: 'לחצו כדי לפתוח',
  next: 'הקלף הבא',
  done: 'סיימתם את החפיסה',
  doneBody: 'שישים ושישה קלפים. אפשר להתחיל מחדש מתי שתרצו.',
  restart: 'להתחיל מחדש',
  leave: 'יציאה',
  ofDeck: 'מתוך',
  switchSide: 'להחליף צד',

  /* ── the notebook ──────────────────────────────────────────────────────── */
  notebook: 'המחברת',
  noteAdd: 'לרשום',
  noteEdit: 'ההערה שלי',
  notePlaceholder: 'מה סיכמנו, מה חשבתי, מה לא לשכוח…',
  noteSave: 'לשמור',
  noteSaving: 'שומר…',
  noteSaved: 'נשמר',
  noteClose: 'סגירה',
  noteClear: 'למחוק',
  noteTrouble: 'לא הצלחנו לשמור. נסו שוב עוד רגע.',
  notebookEmpty: 'עוד לא רשמתם כלום',
  notebookEmptyBody: 'בכל קלף יש כפתור "לרשום". מה שתכתבו שם יופיע כאן, '
    + 'ויחכה לכם גם בפעם הבאה שתיכנסו.',
  notebookBack: 'חזרה למשחק',
  notebookMine: 'המחברת נשמרת רק לצד שלכם. בן או בת הזוג לא רואים אותה.',
  goToCard: 'לקלף',
  /* The face-down card carries the producer's name and nothing else, the way
     the back of a real card does. */
  backLine: 'קלף',
} as const;

export type GameCopy = typeof game;

/**
 * The switch, on the event file.
 *
 * Its words live here beside the game's rather than in the console's copy
 * files for one reason: this control is the root address's alone, the root
 * address is one person, and that person reads Hebrew. Running a one-person
 * switch through the bilingual pipeline would be plumbing with nobody at the
 * other end of it — and it keeps every word the game owns in one file, which
 * is where they are easiest to change.
 */
export const gameAdmin = {
  title: 'Before I Do',
  sub: 'שישים ושישה קלפים לזוג, על מסך משלהם. נפתח מכאן בלבד.',
  on: 'פתוח',
  off: 'סגור',
  turnOn: 'לפתוח לזוג',
  turnOff: 'לסגור',
  link: 'הקישור לזוג',
  copy: 'העתקה',
  copied: 'הועתק',
  open: 'לפתוח',
  share: 'וואטסאפ',
  shareText: 'הכנתי לכם משחק קלפים לקראת החתונה, Before I Do. כל אחד פותח בטלפון שלו:',
  saving: 'שומר…',
  saved: 'נשמר',
  hint: 'הקישור קיים גם כשהמשחק סגור, כדי שאפשר יהיה להכין אותו מראש, '
    + 'אבל הוא לא ייפתח לאף אחד עד שתלחץ "לפתוח לזוג".',
} as const;
