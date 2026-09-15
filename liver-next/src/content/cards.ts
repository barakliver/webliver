/**
 * The deck.
 *
 * Seventy-four cards he drew himself, in `public/game/cards/NN.webp`. The
 * image is the card — his frame, his fingerprint heart, his line icons, his
 * footer — and this file is the words on it.
 *
 * The words are here rather than only in the picture for one reason that is
 * not optional: an image with no text is nothing at all to a screen reader,
 * and a couple playing this on a phone with VoiceOver on would get
 * seventy-four announcements of the word "image". Every card's `alt` comes
 * from this file. It also means a card can be searched, quoted into a
 * summary, or read by the assistant later without anybody running OCR over a
 * picture of a sentence.
 *
 * The numbering is this file's own, 1 to 74, and it starts here because the
 * cards carry no printed number. The source folder had three overlapping
 * exports under two naming schemes, and the file name was the only identity a
 * card had — which had already broken three times before anybody looked. A
 * card's identity is now its id in this array, and the image is named after
 * it.
 *
 * Twelve of the eighty-six drawn cards are not here. Four answered themselves
 * ("זר פרחים לכלה או מיותר ומיושן" is not a choice anybody makes), six asked
 * a question another card already asks, one was a heading rather than a card,
 * and one told the couple which supplier to hire. The reasoning is in the
 * commit that added this file.
 *
 * Hebrew only, deliberately. The seventy-four pictures are Hebrew, and
 * English chrome around Hebrew artwork is a half-translation that reads worse
 * than no translation. If the deck is ever redrawn in English this file grows
 * a second column; until then the game says so at the door.
 */

export type OrCard = {
  id: number; kind: 'or';
  /** The small bold line some cards carry above the choice, e.g. "ירח דבש". */
  lead?: string;
  a: string; b: string;
};
export type QuestionCard = { id: number; kind: 'question'; q: string };
export type RuleCard = { id: number; kind: 'rule'; title: string; body: string };
export type Card = OrCard | QuestionCard | RuleCard;

export const CARDS: readonly Card[] = [
  /* ── the choices ─────────────────────────────────────────────────────── */
  { id: 1, kind: 'or', a: 'קוד לבוש', b: 'בלי' },
  { id: 2, kind: 'or', a: 'טקס דתי חופה וקידושין', b: 'אזרחי ומודרני' },
  { id: 3, kind: 'or', a: 'עיצוב עם מוטיב חוזר', b: 'צבעוני ומיוחד' },
  { id: 4, kind: 'or', lead: 'מה חשוב יותר', a: 'שיהיה טעים', b: 'שהאלכוהול יהיה טוב' },
  { id: 5, kind: 'or', a: 'אולם', b: 'גן אירועים' },
  { id: 6, kind: 'or', a: 'חתונה קטנה', b: 'המונית' },
  { id: 7, kind: 'or', a: 'חתונת חורף', b: 'חתונת קיץ' },
  { id: 8, kind: 'or', a: 'מגנטים', b: 'לוחות עץ' },
  { id: 9, kind: 'or', a: 'די־ג׳יי', b: 'להקה חיה' },
  { id: 10, kind: 'or', a: 'שמלה אחת', b: 'שלוש' },
  { id: 11, kind: 'or', a: 'עוגת חתונה', b: 'מגדל כוסות יין' },
  { id: 12, kind: 'or', a: 'הזמנות מודפסות', b: 'הזמנות דיגיטליות' },
  { id: 13, kind: 'or', a: 'הפתעות לאורחים', b: 'סרטון מחברים' },
  { id: 14, kind: 'or', a: 'מסיבת רווקים בנפרד', b: 'ביחד' },
  { id: 15, kind: 'or', a: 'צלם וידאו', b: 'רק צלם סטילס' },
  { id: 16, kind: 'or', a: 'לשכור מקום התארגנות', b: 'להתארגן בבית' },
  { id: 17, kind: 'or', a: 'רכב חתונה', b: 'להגיע עם חברים' },
  { id: 18, kind: 'or', a: 'הגשה לשולחן', b: 'בופה' },
  { id: 19, kind: 'or', a: 'אירוע מתוזמן', b: 'זורם וספונטני' },
  { id: 20, kind: 'or', a: 'רק ההורים בחופה', b: 'כל המשפחה הקרובה' },
  { id: 21, kind: 'or', a: 'ספקים מומלצים', b: 'ללכת על תחושת בטן' },
  { id: 22, kind: 'or', a: 'קינוח מיוחד', b: 'משהו שכולם אוהבים' },
  { id: 23, kind: 'or', a: 'פינות ישיבה', b: 'רק רחבת ריקודים' },
  { id: 24, kind: 'or', a: 'חתונה רגילה', b: 'הפוכה' },
  { id: 25, kind: 'or', a: 'עמדת קוקטיילים', b: 'בר שכולם מכירים' },
  { id: 26, kind: 'or', a: 'אוכל רחוב', b: 'קייטרינג יוקרתי' },
  { id: 27, kind: 'or', a: 'תאריך מיוחד', b: 'מה שזמין' },
  { id: 28, kind: 'or', a: 'אירוע צהריים קליל', b: 'לילה עד הבוקר' },
  { id: 29, kind: 'or', a: 'מוזיקה חיה בחופה', b: 'פלייליסט' },
  { id: 30, kind: 'or', a: 'סידורי ישיבה', b: 'קרב על מקומות' },
  { id: 31, kind: 'or', a: 'להביא את הכלב', b: 'להשאיר אותו בבית' },
  { id: 32, kind: 'or', a: 'כניסה לחופה עם ההורים', b: 'ביחד' },
  { id: 33, kind: 'or', lead: 'ירח דבש', a: 'בארץ', b: 'בחו״ל ישר אחרי האירוע' },
  { id: 34, kind: 'or', lead: 'שיר סיום', a: 'שכולם יבכו ממנו', b: 'שירים ליציאה' },
  { id: 35, kind: 'or', lead: 'עיצוב', a: 'DIY', b: 'לתת למקצוענים לעבוד' },
  { id: 36, kind: 'or', lead: 'צילום', a: 'מאחורי הקלעים', b: 'רק רגעים מהאירוע עצמו' },
  { id: 37, kind: 'or', lead: 'נדרים בחופה', a: 'חובה', b: 'קיטצ׳י מיותר' },
  { id: 38, kind: 'or', lead: 'צילומי זוגיות', a: 'ביום החתונה', b: 'ביום נפרד בלי לחץ' },
  { id: 39, kind: 'or', lead: 'שיר חופה', a: 'אישי שלכם', b: 'קלאסיקות שכולם מכירים' },
  { id: 40, kind: 'or', lead: 'ילדים באירוע', a: 'זה חמוד', b: 'כאב ראש מיותר' },
  { id: 41, kind: 'or', a: 'לתת להורים לנהל', b: 'לקחת מישהו מקצועי' },
  { id: 42, kind: 'or', a: 'לפתוח מעטפות בלילה', b: 'למחרת בבוקר' },
  { id: 43, kind: 'or', a: 'הלילה הראשון בבית', b: 'במלון' },
  { id: 44, kind: 'or', a: 'לזכור את מי שחסר', b: 'לשמור על אווירה שמחה' },
  { id: 45, kind: 'or', a: 'חתונה חסכונית', b: 'חתונה בלי פשרות' },
  { id: 46, kind: 'or', a: 'להסתובב בקבלת פנים', b: 'הפתעה בכניסה לחופה' },
  { id: 47, kind: 'or', a: 'מתנות לאורחים', b: 'לתרום בשמם לעמותה' },
  { id: 48, kind: 'or', a: 'להפתיע בשיר', b: 'לשמור הכול משותף' },
  { id: 49, kind: 'or', a: 'טלפונים חופשיים', b: 'חתונה בלי מסכים' },
  { id: 50, kind: 'or', a: 'להישאר עד הסוף', b: 'לסיים מוקדם ובשקט' },
  { id: 51, kind: 'or', a: 'שבע ברכות מהרב', b: 'מבני המשפחה' },
  { id: 52, kind: 'or', a: 'לשבור כוס כמו במסורת', b: 'לחפש סיום אחר לטקס' },
  { id: 53, kind: 'or', a: 'להזמין את כל העבודה', b: 'רק חברים קרובים משם' },
  { id: 54, kind: 'or', a: 'עיצוב עשיר ומפואר', b: 'מינימליסטי ונקי' },

  /* ── the open questions ──────────────────────────────────────────────── */
  { id: 55, kind: 'question', q: 'מה הדבר שהכי חשוב לי ולא אוותר עליו בחתונה?' },
  { id: 56, kind: 'question', q: 'איזה שיר אסור בשום אופן שיתנגן בחתונה שלנו?' },
  { id: 57, kind: 'question', q: 'איזה חפץ מהילדות שלי הייתי רוצה שיהיה בחתונה?' },
  { id: 58, kind: 'question', q: 'אם היינו יכולים להזמין כל אדם בעולם, את מי היינו מזמינים?' },
  { id: 59, kind: 'question', q: 'מה הדבר הראשון שנעשה כשנגיע הביתה בסוף הלילה?' },
  { id: 60, kind: 'question', q: 'איזו החלטה בתכנון החתונה אני כבר יודע/ת שנתווכח עליה?' },
  { id: 61, kind: 'question', q: 'מי מאיתנו יבכה ראשון מתחת לחופה?' },
  { id: 62, kind: 'question', q: 'איזה רגע מהקשר שלנו הייתי רוצה שכל האורחים יכירו?' },
  { id: 63, kind: 'question', q: 'מה הדבר שהכי מלחיץ אותי ביום החתונה ועוד לא סיפרתי לך?' },
  { id: 64, kind: 'question', q: 'איזו מסורת משפחתית הייתי רוצה להמשיך, ואיזו הייתי שמח/ה לוותר עליה?' },
  { id: 65, kind: 'question', q: 'איזה משפט הייתי רוצה שהאורחים יגידו כשהם יוצאים מהחתונה?' },
  { id: 66, kind: 'question', q: 'על מה הכי קשה לי לוותר בגלל התקציב?' },
  { id: 67, kind: 'question', q: 'איך נחגוג את יום הנישואין הראשון שלנו?' },
  { id: 68, kind: 'question', q: 'מי הייתי רוצה שיברך אותנו מתחת לחופה?' },
  { id: 69, kind: 'question', q: 'מה אני הכי רוצה לראות בפנים שלך כשנפגש מתחת לחופה?' },
  { id: 70, kind: 'question', q: 'איזה שיר מזכיר לי אותנו ופשוט חייב להתנגן?' },
  { id: 71, kind: 'question', q: 'איזה פרט קטן בחתונה יגרום לי להרגיש שזו באמת החתונה שלנו?' },

  /* ── the three that change how the next card is played ───────────────── */
  {
    id: 72, kind: 'rule', title: 'החלפת תפקידים',
    body: 'כל אחד עונה על הקלף הבא כאילו הוא בן או בת הזוג',
  },
  {
    id: 73, kind: 'rule', title: 'וטו',
    body: 'מותר לבטל תשובה אחת שלא מתאימה לך, בתנאי שמסבירים למה',
  },
  {
    id: 74, kind: 'rule', title: 'מה ההורים היו בוחרים?',
    body: 'מה ההורים שלכם היו עונים על הקלף הקודם?',
  },
];

/** The image behind a card, named after the card's own id. */
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
