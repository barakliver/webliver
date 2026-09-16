/**
 * The words around the deck.
 *
 * Hebrew only, and that is a decision rather than an omission. The seventy-four
 * cards are pictures with Hebrew set into them; English chrome around Hebrew
 * artwork is a half-translation, and a half-translation reads worse than none.
 * The rest of the platform switches language because the rest of the platform
 * is text. If the deck is ever redrawn in English this file grows a second
 * export and the route reads the cookie like everything else.
 *
 * The rules screen is the one piece of this that is not in the box. Seventy-four
 * cards arrived with no card saying how to play, so what is written here was
 * read off the three rule cards themselves: "הקלף הבא" and "הקלף הקודם" mean
 * the deck is played in order, one card at a time; "לבטל תשובה אחת" means both
 * of you answer and the answers stand. Everything below follows from that, and
 * the last line of it is the one to change first if he plays it and it is
 * wrong.
 */

export const game = {
  /* ── the door ──────────────────────────────────────────────────────────── */
  kicker: 'משחק הקלפים',
  /* The deck's name, and it stays in Latin in a Hebrew screen because it is
     a name rather than a phrase to translate. */
  title: 'Before I Do',
  intro: 'שבעים וארבעה קלפים על החתונה שלכם ועליכם. כל אחד פותח בטלפון שלו, שניכם על אותו קלף.',
  who: 'מי פותח עכשיו?',
  sideA: 'אני הראשון/ה',
  sideB: 'אני השני/ה',
  rulesLink: 'איך משחקים',
  gone: 'Before I Do לא פתוח',
  goneBody: 'הקישור שגוי, או שהמשחק עדיין לא נפתח לאירוע הזה.',

  /* ── the rules ─────────────────────────────────────────────────────────── */
  rulesTitle: 'איך משחקים',
  rulesBack: 'חזרה למשחק',
  rules: [
    {
      h: 'שניכם, כל אחד במכשיר שלו',
      p: 'פותחים את אותו קישור בשני טלפונים ובוחרים כל אחד את הצד שלו. '
        + 'החפיסה מסודרת אותו דבר לשניכם, אז אתם תמיד על אותו קלף.',
    },
    {
      h: 'קלף אחד בכל פעם',
      p: 'לוחצים על הקלף והוא נפתח. עונים שניכם, בקול ולא במסך, ואז לוחצים על "הקלף הבא". '
        + 'אין ניקוד ואין מנצח. מה שיוצא מזה זו השיחה.',
    },
    {
      h: 'שלושה סוגי קלפים',
      p: 'קלף "או" הוא בחירה בין שתי אפשרויות. קלף שאלה הוא שאלה פתוחה שכל אחד עונה עליה בעצמו. '
        + 'ושלושה קלפים הם חוקים: הם משנים איך משחקים את הקלף שלידם, וכשאחד כזה עולה כדאי לקרוא אותו בקול.',
    },
    {
      h: 'יש מחברת',
      p: 'בכל קלף אפשר לרשום לעצמכם הערה, וכל מה שרשמתם מחכה ב"מחברת" למעלה. '
        + 'זה שווה: חצי מהקלפים הם החלטה אמיתית על הערב, והשיחה הזאת נשכחת עד מרץ. '
        + 'המחברת היא שלכם בלבד, גם בן או בת הזוג לא רואים אותה.',
    },
    {
      h: 'אין צורך לסיים בישיבה אחת',
      p: 'המשחק זוכר איפה עצרתם במכשיר הזה. סוגרים וממשיכים מתי שבא לכם.',
    },
  ],

  /* ── the table ─────────────────────────────────────────────────────────── */
  tapToOpen: 'לחצו כדי לפתוח',
  next: 'הקלף הבא',
  done: 'סיימתם את החפיסה',
  doneBody: 'שבעים וארבעה קלפים. אפשר להתחיל מחדש מתי שתרצו.',
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
  sub: 'שבעים וארבעה קלפים לזוג, על מסך משלהם. נפתח מכאן בלבד.',
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
