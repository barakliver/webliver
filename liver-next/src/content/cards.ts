/**
 * The deck.
 *
 * Sixty-six cards he drew himself, in `public/game/cards/`. The image is the
 * card — his frame, his fingerprint heart, his line icons, his footer — and
 * this file is the words on it.
 *
 * The words are here rather than only in the picture for one reason that is
 * not optional: an image with no text is nothing at all to a screen reader,
 * and a couple playing this on a phone with VoiceOver on would get sixty-six
 * announcements of the word "image". Every card's `alt` comes from this file.
 * It also means a card can be searched, quoted into a summary, or read by the
 * assistant later without anybody running OCR over a picture of a sentence.
 *
 * **The ids are his file names and not this file's own numbering.** The first
 * version of this deck numbered the cards here, 1 to 74, because the drafts
 * arrived under two overlapping naming schemes and no card carried a number
 * anybody could trust. The final deck arrived numbered, so card 37 is
 * `37.webp` is the 37th picture he drew, and "look at 37" is a sentence that
 * survives the trip from a phone call to a file. That is also why the two rule
 * cards are 100 and 101 rather than 65 and 66: he numbered them apart from the
 * playing cards, and renumbering them here to close the gap would quietly undo
 * the one thing the ids are for.
 *
 * **Three of his cards are printed but not dealt**, and each is drawn where it
 * belongs instead. 102 is the instruction card and it is the rules screen; a
 * deck that deals its own instructions halfway through a game is a deck with a
 * bug in it. 103 is his contact card, which in the box is the one you find at
 * the bottom, so here it is the end of the deck and not a turn in it. And the
 * back is the back: one picture, behind every card, which is what the face-down
 * card on the table shows.
 *
 * Hebrew only, deliberately. The pictures are Hebrew, and English chrome
 * around Hebrew artwork is a half-translation that reads worse than no
 * translation. If the deck is ever redrawn in English this file grows a second
 * column; until then the game says so at the door.
 */

export type OrCard = {
  id: number; kind: 'or';
  /** The small bold line some cards carry above the choice, e.g. "בחופה:". */
  lead?: string;
  a: string; b: string;
};
export type QuestionCard = { id: number; kind: 'question'; q: string };
export type RuleCard = { id: number; kind: 'rule'; title: string; body: string };
export type Card = OrCard | QuestionCard | RuleCard;

/** The instruction card, drawn on the rules screen and never dealt. */
export const HOW_TO_PLAY_IMAGE = '/game/cards/102.webp';

/** His contact card, drawn at the end of the deck and never dealt. */
export const CONTACT_IMAGE = '/game/cards/103.webp';
export const CONTACT_ALT =
  'רוצים עוד טיפים? סרקו וגלו רגעים יפים מאחורי הקלעים, רעיונות והשראה לחתונה שלכם. '
  + '@barakliver';

/**
 * The back of the card, his own.
 *
 * It was a bordered rectangle with a heart character and the producer's name
 * in it, standing in for a picture nobody had sent yet. The picture arrived
 * with the final deck, and the difference is the whole of whether the table
 * looks like a deck of cards or like a web page pretending to be one.
 */
export const CARD_BACK_IMAGE = '/game/cards/back.webp';
export const CARD_BACK_ALT = 'Before I Do';

export const CARDS: readonly Card[] = [
  /* ── the choices ─────────────────────────────────────────────────────── */
  { id: 1, kind: 'or', a: 'קוד לבוש', b: 'בלי' },
  { id: 2, kind: 'or', a: 'טקס דתי חופה וקידושין', b: 'אזרחי ומודרני' },
  { id: 3, kind: 'or', lead: 'מה חשוב יותר', a: 'שיהיה טעים', b: 'שהאלכוהול יהיה טוב' },
  { id: 4, kind: 'or', a: 'חתונה קטנה', b: 'המונית' },
  { id: 5, kind: 'or', a: 'חתונת חורף', b: 'חתונת קיץ' },
  { id: 6, kind: 'or', a: 'מגנטים', b: 'לוחות עץ' },
  { id: 7, kind: 'or', a: 'די־ג׳יי', b: 'להקה חיה' },
  { id: 8, kind: 'or', a: 'שמלה אחת', b: 'שלוש' },
  { id: 9, kind: 'or', a: 'עוגת חתונה', b: 'מגדל כוסות יין' },
  { id: 10, kind: 'or', a: 'הזמנות מודפסות', b: 'הזמנות דיגיטליות' },
  { id: 12, kind: 'or', a: 'מסיבת רווקים בנפרד', b: 'ביחד' },
  { id: 13, kind: 'or', a: 'צלמ.ת וידאו', b: 'צלמ.ת סושיאל' },
  { id: 14, kind: 'or', a: 'לשכור מקום התארגנות', b: 'להתארגן בבית' },
  { id: 15, kind: 'or', a: 'רכב חתונה', b: 'להגיע עם חברים' },
  { id: 16, kind: 'or', a: 'הגשה לשולחן', b: 'בופה' },
  { id: 17, kind: 'or', a: 'רק ההורים בחופה', b: 'כל המשפחה הקרובה' },
  { id: 18, kind: 'or', a: 'קונספט ייחודי', b: 'חתונה קלאסית' },
  { id: 19, kind: 'or', a: 'חתונה רגילה', b: 'הפוכה' },
  { id: 20, kind: 'or', a: 'עמדת קוקטיילים', b: 'בר קלאסי' },
  { id: 21, kind: 'or', lead: 'באפטר:', a: 'של המקום', b: 'חיצוני' },
  { id: 22, kind: 'or', a: 'תאריך מיוחד', b: 'מה שזמין' },
  { id: 23, kind: 'or', a: 'אירוע צהריים קליל', b: 'לילה עד הבוקר' },
  { id: 24, kind: 'or', a: 'סידורי הושבה', b: 'ישיבה אלטרנטיבית' },
  { id: 25, kind: 'or', a: 'להביא את הכלב', b: 'להשאיר אותו בבית' },
  { id: 26, kind: 'or', a: 'סלואו אחרי חופה', b: 'יאללה באלגן' },
  { id: 27, kind: 'or', a: 'זר פרחים לכלה', b: 'ידיים חופשיות' },
  { id: 28, kind: 'or', a: 'תכנון עם תקציב מדויק', b: 'חתונה בלי פשרות' },
  { id: 29, kind: 'or', a: 'כניסה לחופה עם ההורים', b: 'ביחד' },
  { id: 30, kind: 'or', a: 'מפיק שחוסך כאב ראש', b: 'להפיק לבד' },
  { id: 32, kind: 'or', lead: 'עיצוב', a: 'DIY', b: 'לתת למקצוענים לעבוד' },
  { id: 33, kind: 'or', lead: 'צילום', a: 'מאחורי הקלעים', b: 'רק רגעים מהאירוע עצמו' },
  { id: 34, kind: 'or', lead: 'נדרים בחופה', a: 'חובה', b: 'בארבע עיניים' },
  { id: 35, kind: 'or', lead: 'צילומי זוגיות', a: 'ביום החתונה', b: 'ביום נפרד בלי לחץ' },
  { id: 36, kind: 'or', lead: 'שיר חופה', a: 'אישי שלכם', b: 'קלאסיקות שכולם מכירים' },
  { id: 37, kind: 'or', lead: 'ילדים באירוע', a: 'זה חמוד', b: 'כאב ראש' },
  { id: 46, kind: 'or', a: 'לתת להורים לנהל', b: 'לקחת מפיק מקצועי' },
  { id: 47, kind: 'or', a: 'לפתוח מעטפות בלילה', b: 'לא בלחץ' },
  { id: 48, kind: 'or', a: 'הלילה הראשון בבית', b: 'במלון' },
  { id: 49, kind: 'or', lead: 'בחופה:', a: 'להזכיר את מי שחסר', b: 'הם איתנו בלב' },
  { id: 50, kind: 'or', a: 'להסתובב בקבלת פנים', b: 'הפתעה בכניסה לחופה' },
  { id: 51, kind: 'or', lead: 'בחופה:', a: 'בלי טלפונים', b: 'יותר תיוגים, יותר שמח' },
  { id: 52, kind: 'or', lead: 'בחופה:', a: 'שבע ברכות מהרב', b: 'מבני המשפחה' },
  { id: 56, kind: 'or', a: 'לשבור כוס כמו במסורת', b: 'לחפש סיום אחר לטקס' },
  { id: 57, kind: 'or', a: 'כל הצוות מהעבודה', b: 'רק מי שהפך לחבר' },
  { id: 59, kind: 'or', a: 'עיצוב עשיר ומפואר', b: 'מינימליסטי ונקי' },
  { id: 60, kind: 'or', lead: 'הפתעות:', a: 'מהמשפחה והחברים', b: 'לפי הלו״ז בלי הפתעות' },
  { id: 61, kind: 'or', lead: 'אחרי החופה:', a: 'חיבוקים ונשיקות בחופה', b: 'ישר על הכתפיים לרחבה' },
  { id: 62, kind: 'or', lead: 'אפטר פארטי:', a: 'רוקדים עד הזריחה', b: 'פיצה ונעלי בית בחצות' },
  { id: 63, kind: 'or', a: 'מתנות לאורחים', b: 'שיקחו עלה נענע' },
  { id: 64, kind: 'or', a: 'אולם / גן אירועים', b: 'הפקת שטח' },

  /* ── the open questions ──────────────────────────────────────────────── */
  { id: 11, kind: 'question', q: 'מה הדבר שהכי חשוב לי ולא אוותר עליו בחתונה?' },
  { id: 31, kind: 'question', q: 'מה יהיה שיר הסיום של החתונה שלנו?' },
  { id: 38, kind: 'question', q: 'איזה שיר אסור בשום אופן שיתנגן בחתונה שלנו?' },
  { id: 39, kind: 'question', q: 'אם היינו יכולים להזמין כל אדם בעולם, את מי היינו מזמינים?' },
  { id: 40, kind: 'question', q: 'מה הדבר הראשון שנעשה כשנגיע הביתה בסוף הלילה?' },
  { id: 41, kind: 'question', q: 'איזה רגע מהקשר שלנו הייתי רוצה שכל האורחים יכירו?' },
  { id: 42, kind: 'question', q: 'מה הדבר שהכי מלחיץ אותי ביום החתונה ועוד לא סיפרתי לך?' },
  { id: 43, kind: 'question', q: 'איזו מסורת משפחתית הייתי רוצה להמשיך, ואיזו הייתי שמח.ה לוותר עליה?' },
  { id: 44, kind: 'question', q: 'איזה משפט הייתי רוצה שהאורחים יגידו כשהם יוצאים מהחתונה?' },
  { id: 45, kind: 'question', q: 'על מה הכי קשה לי לוותר בגלל התקציב?' },
  { id: 53, kind: 'question', q: 'מי הייתי רוצה שיברך אותנו מתחת לחופה?' },
  { id: 54, kind: 'question', q: 'איזה שיר מזכיר לי אותנו ופשוט חייב להתנגן?' },
  { id: 55, kind: 'question', q: 'איזה פרט קטן בחתונה יגרום לי להרגיש שזו באמת החתונה שלנו?' },
  { id: 58, kind: 'question', q: 'מה אני הכי מפחד.ת שישתבש ביום הזה?' },

  /* ── the two that change how the next card is played ─────────────────── */
  {
    id: 100, kind: 'rule', title: 'החלפת תפקידים',
    body: 'כל אחד עונה על הקלף הבא כאילו הוא בן או בת הזוג',
  },
  {
    id: 101, kind: 'rule', title: 'וטו',
    body: 'מותר לבטל תשובה אחת שלא מתאימה לך, בתנאי שמסבירים למה',
  },
];

/**
 * The image behind a card, named after the card's own id.
 *
 * Two digits below a hundred because that is how the files are named, and the
 * rule cards keep their three: `padStart` leaves a number that is already long
 * enough alone, which is exactly the behaviour wanted here.
 */
export const imageOf = (card: Card): string =>
  `/game/cards/${String(card.id).padStart(2, '0')}.webp`;

/**
 * What a screen reader says instead of "image".
 *
 * Reads as the card reads: the lead, then one side, then the word between
 * them, then the other. A question and a rule are read straight.
 */
export function altOf(card: Card): string {
  if (card.kind === 'question') return card.q;
  if (card.kind === 'rule') return `${card.title}. ${card.body}`;
  return [card.lead, `${card.a} או ${card.b}`].filter(Boolean).join(': ');
}
