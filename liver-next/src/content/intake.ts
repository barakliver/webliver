/**
 * The questionnaire a couple answers once, in six short chapters.
 *
 * This is the source the profile is built from, and it is code rather than
 * a table because it is Hebrew wording: thirty-six questions, each with a
 * stable key that the database trigger reads by name (0105), the renderer
 * draws by type, and the producer's profile card groups by chapter. A
 * question key is never renamed; a renamed key is an answer that
 * disappears from the profile without anybody deleting it.
 *
 * Warm, second person plural, one question at a time on a phone. The
 * "between us" chapter is private: each partner answers alone and only
 * the producer reads both.
 */

export type QuestionType =
  | 'text' | 'textarea' | 'number' | 'date' | 'date_range'
  | 'single' | 'multi' | 'scale' | 'rank' | 'list' | 'people';

export type Option = { value: string; he: string; en: string };

export type Question = {
  key: string;
  type: QuestionType;
  he: string;
  en: string;
  /** A line under the question, when the question needs a reason. */
  hintHe?: string;
  hintEn?: string;
  options?: readonly Option[];
  /** For a scale: the things rated, each on 1 to 5. */
  items?: readonly Option[];
  /** For `list` and `people`: the most entries the box takes. */
  max?: number;
  /** Counts toward completeness. */
  required?: boolean;
};

export type Chapter = {
  key: 'a' | 'b' | 'c' | 'd' | 'e' | 'f';
  he: string;
  en: string;
  minutesHe: string;
  minutesEn: string;
  /** Each partner answers alone; only the producer reads both. */
  private?: boolean;
  questions: readonly Question[];
};

const opt = (value: string, he: string, en: string): Option => ({ value, he, en });

export const INTAKE_KEY = 'couple_intake';

export const INTAKE: readonly Chapter[] = [
  {
    key: 'a', he: 'מי אתם', en: 'Who you are', minutesHe: 'חמש דקות', minutesEn: 'five minutes',
    questions: [
      { key: 'a1_names', type: 'text', he: 'השמות המלאים שלכם', en: 'Your full names', required: true },
      { key: 'a1_nickname', type: 'text', he: 'איך אתם רוצים שנקרא לכם?', en: 'What should we call you?', hintHe: 'כמו שחברים קוראים לכם. ככה המסך שלכם יברך אתכם.', hintEn: 'The way friends do. Your screen will greet you with it.', required: true },
      { key: 'a2_birthdays', type: 'text', he: 'תאריכי הלידה שלכם', en: 'Your birthdays', hintHe: 'לגיל, ולהפתעות.', hintEn: 'For the age, and for surprises.' },
      { key: 'a3_how_met', type: 'textarea', he: 'איך הכרתם?', en: 'How did you meet?', hintHe: 'שניים או שלושה משפטים.', hintEn: 'Two or three sentences.', required: true },
      { key: 'a4_together', type: 'text', he: 'כמה זמן אתם ביחד, ומתי התארסתם?', en: 'How long have you been together, and when did you get engaged?' },
      { key: 'a5_home', type: 'textarea', he: 'איפה אתם גרים, ומאיפה כל אחד במקור?', en: 'Where do you live, and where is each of you from?', hintHe: 'שפות בבית, עלייה, משפחה בחו"ל.', hintEn: 'Languages at home, immigration, family abroad.', required: true },
      { key: 'a6_jobs', type: 'text', he: 'במה אתם עוסקים?', en: 'What do you do?', hintHe: 'לא חובה. עוזר להבין זמינות.', hintEn: 'Optional. It helps with availability.' },
      { key: 'a7_photo', type: 'text', he: 'תמונה של שניכם', en: 'A picture of the two of you', hintHe: 'העלו אותה ללוח ההשראה, והיא תופיע בראש המסך שלכם.', hintEn: 'Upload it to the inspiration board and it will head your screen.' },
    ],
  },
  {
    key: 'b', he: 'האירוע בגדול', en: 'The event, broadly', minutesHe: 'חמש דקות', minutesEn: 'five minutes',
    questions: [
      { key: 'b8_date', type: 'date_range', he: 'תאריך, או טווח תאריכים', en: 'A date, or a range', hintHe: 'גמיש? אילוצים: חגים, ספירת העומר, צום, לידה במשפחה.', hintEn: 'Flexible? Constraints: holidays, the Omer, a fast, a birth in the family.', required: true },
      { key: 'b8_constraints', type: 'textarea', he: 'אילוצים על התאריך', en: 'Constraints on the date' },
      { key: 'b9_guests', type: 'number', he: 'כמה מוזמנים משוער?', en: 'Roughly how many invited?', required: true },
      { key: 'b9_expected', type: 'number', he: 'וכמה אתם מעריכים שיגיעו?', en: 'And how many do you expect to come?' },
      { key: 'b10_region', type: 'single', he: 'באיזה אזור בארץ?', en: 'Which part of the country?', required: true, options: [
        opt('north', 'צפון', 'North'), opt('sharon', 'השרון', 'Sharon'), opt('center', 'מרכז', 'Centre'), opt('shfela', 'שפלה', 'Shfela'),
        opt('jerusalem', 'ירושלים והסביבה', 'Jerusalem area'), opt('south', 'דרום', 'South'), opt('abroad', 'חו"ל', 'Abroad'), opt('open', 'עוד לא החלטנו', 'Not decided'),
      ] },
      { key: 'b10_venue_type', type: 'single', he: 'איזה סוג מקום?', en: 'What kind of venue?', required: true, options: [
        opt('hall', 'אולם סגור', 'Hall'), opt('garden', 'גן אירועים', 'Garden venue'), opt('beach', 'חוף', 'Beach'), opt('home', 'בית', 'Home'), opt('abroad', 'חו"ל', 'Abroad'), opt('open', 'פתוחים', 'Open'),
      ] },
      { key: 'b11_style', type: 'multi', he: 'סגנון האירוע', en: 'The style', hintHe: 'אפשר יותר מאחד.', hintEn: 'More than one is fine.', required: true, options: [
        opt('classic', 'קלאסי ואלגנטי', 'Classic and elegant'), opt('boho', 'בוהו', 'Boho'), opt('minimal', 'מודרני ומינימליסטי', 'Modern and minimal'),
        opt('rustic', 'כפרי', 'Rustic'), opt('urban', 'עירוני ותעשייתי', 'Urban, industrial'), opt('beach', 'מסיבת חוף', 'Beach party'), opt('other', 'אחר', 'Other'),
      ] },
      { key: 'b12_dream', type: 'textarea', he: 'תארו את החתונה המושלמת בשלושה משפטים', en: 'Describe the perfect wedding in three sentences', required: true },
      { key: 'b12_afterparty', type: 'single', he: 'אפטר פארטי?', en: 'An after party?', options: [opt('yes', 'כן', 'Yes'), opt('no', 'לא', 'No'), opt('maybe', 'אולי', 'Maybe')] },
      { key: 'b13_religious', type: 'single', he: 'איך תגדירו את עצמכם?', en: 'How would you describe yourselves?', required: true, options: [
        opt('religious', 'דתיים', 'Religious'), opt('traditional', 'מסורתיים', 'Traditional'), opt('secular', 'חילוניים', 'Secular'), opt('mixed', 'מעורב', 'Mixed'),
      ] },
      { key: 'b13_ceremony', type: 'single', he: 'הטקס', en: 'The ceremony', required: true, options: [
        opt('rabbinate', 'רב מטעם הרבנות', 'Rabbinate rabbi'), opt('private', 'רב פרטי', 'Private rabbi'), opt('civil', 'טקס אזרחי', 'Civil'), opt('personal', 'טקס זוגי', 'Personal ceremony'),
      ] },
      { key: 'b14_shabbat', type: 'single', he: 'שבת וחג', en: 'Shabbat and holidays', hintHe: 'האירוע חייב להתחיל אחרי צאת שבת? יש שומרי שבת בקהל?', hintEn: 'Must it start after Shabbat ends? Observant guests?', required: true, options: [
        opt('after_shabbat', 'חייב להתחיל אחרי צאת שבת', 'Must start after Shabbat'), opt('observant_guests', 'יש שומרי שבת בקהל', 'Observant guests'),
        opt('both', 'שניהם', 'Both'), opt('none', 'לא רלוונטי', 'Not relevant'),
      ] },
      { key: 'b15_kosher', type: 'single', he: 'כשרות', en: 'Kashrut', required: true, options: [
        opt('none', 'בלי', 'None'), opt('regular', 'רגילה', 'Regular'), opt('mehadrin', 'מהדרין', 'Mehadrin'), opt('badatz', 'בד"ץ', 'Badatz'),
      ] },
      { key: 'b15_allergies', type: 'text', he: 'אלרגיות משמעותיות במשפחה הקרובה', en: 'Significant allergies in the close family' },
    ],
  },
  {
    key: 'c', he: 'האנשים', en: 'The people', minutesHe: 'חמש דקות', minutesEn: 'five minutes',
    questions: [
      { key: 'c16_parents', type: 'textarea', he: 'ההורים', en: 'The parents', hintHe: 'שמות, האם מעורבים בתכנון, האם משתתפים בתקציב. גרושים, נישואים שניים, חשוב להושיב בנפרד.', hintEn: 'Names, involvement, whether they share the budget. Divorced, remarried, to be seated apart.', required: true },
      { key: 'c17_siblings', type: 'textarea', he: 'אחים ואחיות', en: 'Siblings', hintHe: 'שמות וגילאים. לחופה, לריקודים, להפתעות.', hintEn: 'Names and ages. For the chuppah, the dancing, surprises.' },
      { key: 'c18_grandparents', type: 'textarea', he: 'סבים וסבתות שמגיעים', en: 'Grandparents attending', hintHe: 'ישיבה, נגישות, רגע מיוחד.', hintEn: 'Seating, accessibility, a special moment.' },
      { key: 'c19_children', type: 'number', he: 'כמה ילדים באירוע?', en: 'How many children at the event?', hintHe: 'אפס זאת תשובה. אם יש, מאיזה גיל, וצריך פינת ילדים?', hintEn: 'Zero is an answer. If some, from what age, and a kids corner?', required: true },
      { key: 'c19_children_note', type: 'text', he: 'גילאים, ופינת ילדים?', en: 'Ages, and a kids corner?' },
      { key: 'c20_key_people', type: 'people', max: 6, he: 'שלושה אנשים שחשוב לכם במיוחד שיהיו חלק מהיום', en: 'Three people it matters to you are part of the day', hintHe: 'לחופה, לברכות, לכניסה.', hintEn: 'For the chuppah, the blessings, the entrance.', required: true },
      { key: 'c21_sensitivities', type: 'textarea', he: 'רגישויות', en: 'Sensitivities', hintHe: 'אנשים שאסור להושיב יחד, נושאים שלא נוגעים בהם, אובדן במשפחה שצריך לכבד. רק המפיק רואה את זה.', hintEn: 'People never to seat together, subjects not to touch, a loss to honour. Only the producer sees this.' },
    ],
  },
  {
    key: 'd', he: 'טעם וסגנון', en: 'Taste and style', minutesHe: 'חמש דקות', minutesEn: 'five minutes',
    questions: [
      { key: 'd22_must_play', type: 'list', max: 5, he: 'חמישה שירים שאתם אוהבים לרקוד להם', en: 'Five songs you love dancing to', required: true },
      { key: 'd22_no_play', type: 'list', max: 3, he: 'שלושה שירים שאסור שיתנגנו', en: 'Three songs that must not be played' },
      { key: 'd23_genres', type: 'scale', he: 'כמה מכל ז׳אנר?', en: 'How much of each genre?', hintHe: 'אחת זה כמעט בכלל לא, חמש זה הרבה.', hintEn: 'One is hardly any, five is a lot.', required: true, items: [
        opt('israeli', 'ישראלי', 'Israeli'), opt('mizrahi', 'מזרחי', 'Mizrahi'), opt('pop', 'פופ', 'Pop'), opt('hiphop', 'היפ הופ', 'Hip hop'),
        opt('electronic', 'אלקטרוני', 'Electronic'), opt('rock', 'רוק', 'Rock'), opt('world', 'מוזיקת עולם', 'World'), opt('eighties', 'שנות השמונים והתשעים', 'Eighties and nineties'),
      ] },
      { key: 'd24_food', type: 'single', he: 'אוכל', en: 'Food', required: true, options: [
        opt('meat', 'בשרי', 'Meat'), opt('fish', 'דגים', 'Fish'), opt('veg', 'צמחוני או טבעוני', 'Vegetarian or vegan'), opt('mixed', 'מעורב', 'Mixed'),
      ] },
      { key: 'd24_service', type: 'single', he: 'סגנון הגשה', en: 'Service style', options: [
        opt('seated', 'ישיבה', 'Seated'), opt('buffet', 'בופה', 'Buffet'), opt('stations', 'תחנות', 'Stations'), opt('cocktail', 'קוקטייל', 'Cocktail'),
      ] },
      { key: 'd24_must_dish', type: 'text', he: 'מנה שחייבת להיות', en: 'A dish that must be there' },
      { key: 'd25_alcohol', type: 'single', he: 'אלכוהול', en: 'Alcohol', required: true, options: [
        opt('full', 'בר מלא', 'Full bar'), opt('wine_beer', 'יין ובירה', 'Wine and beer'), opt('none', 'בלי', 'None'),
      ] },
      { key: 'd25_cocktail', type: 'text', he: 'קוקטייל אישי?', en: 'A signature cocktail?' },
      { key: 'd26_colors', type: 'list', max: 3, he: 'עד שלושה צבעים שאתם אוהבים', en: 'Up to three colours you love', required: true },
      { key: 'd26_avoid', type: 'text', he: 'צבע שאתם לא רוצים לראות', en: 'A colour you do not want to see' },
      { key: 'd27_inspiration', type: 'text', he: 'תמונות השראה', en: 'Inspiration pictures', hintHe: 'חמש עד עשר, ללוח ההשראה שכבר פתוח לכם במסך.', hintEn: 'Five to ten, on the inspiration board already on your screen.' },
      { key: 'd28_priorities', type: 'rank', he: 'מה חשוב לכם יותר?', en: 'What matters most?', hintHe: 'סדרו מהחשוב ביותר. זה קובע את סדר המסך שלכם ואת חלוקת התקציב המוצעת.', hintEn: 'Order from most important. It sets your screen order and the suggested budget split.', required: true, options: [
        opt('food', 'אוכל', 'Food'), opt('music', 'מוזיקה', 'Music'), opt('design', 'עיצוב', 'Design'), opt('photo', 'צילום', 'Photography'),
        opt('attire', 'הלבוש', 'Attire'), opt('vibe', 'האווירה', 'The atmosphere'), opt('guests', 'הנוחות של האורחים', 'Guests\' comfort'),
      ] },
    ],
  },
  {
    key: 'e', he: 'בינינו', en: 'Between us', minutesHe: 'שלוש דקות, כל אחד לבד', minutesEn: 'three minutes, each alone', private: true,
    questions: [
      { key: 'e29_stress', type: 'textarea', he: 'מה הדבר שהכי מלחיץ אותך בחתונה?', en: 'What stresses you most about the wedding?', required: true },
      { key: 'e30_excite', type: 'textarea', he: 'מה הדבר שהכי מרגש אותך?', en: 'What excites you most?', required: true },
      { key: 'e31_surprise', type: 'textarea', he: 'משהו שבן או בת הזוג לא יודעים שהיית רוצה שיקרה?', en: 'Something your partner does not know you would love to happen?', hintHe: 'הפתעות. רק המפיק רואה.', hintEn: 'Surprises. Only the producer sees.' },
      { key: 'e32_pressure', type: 'textarea', he: 'איך את או אתה בלחץ? מה עוזר?', en: 'How are you under pressure? What helps?', hintHe: 'למפיק, ליום האירוע.', hintEn: 'For the producer, on the day.' },
      { key: 'e33_anything', type: 'textarea', he: 'משהו שחשוב לך שהמפיק ידע ולא שאלנו?', en: 'Anything the producer should know that we did not ask?' },
    ],
  },
  {
    key: 'f', he: 'תקציב ותקשורת', en: 'Budget and contact', minutesHe: 'שתי דקות', minutesEn: 'two minutes',
    questions: [
      { key: 'f34_budget', type: 'single', he: 'טווח התקציב הכולל', en: 'The overall budget range', required: true, options: [
        opt('lt100', 'עד מאה אלף', 'Under 100k'), opt('100_150', 'מאה עד מאה וחמישים אלף', '100k to 150k'), opt('150_250', 'מאה וחמישים עד מאתיים וחמישים אלף', '150k to 250k'),
        opt('250_400', 'מאתיים וחמישים עד ארבע מאות אלף', '250k to 400k'), opt('gt400', 'מעל ארבע מאות אלף', 'Over 400k'),
      ] },
      { key: 'f34_paid_by', type: 'single', he: 'מי משלם?', en: 'Who pays?', required: true, options: [
        opt('couple', 'אנחנו', 'Us'), opt('parents', 'ההורים', 'The parents'), opt('mixed', 'מעורב', 'Mixed'),
      ] },
      { key: 'f35_channel', type: 'single', he: 'איך אתם רוצים שנעדכן אתכם?', en: 'How should we update you?', required: true, options: [
        opt('whatsapp', 'וואטסאפ', 'WhatsApp'), opt('email', 'מייל', 'Email'), opt('portal', 'רק כאן, במסך', 'Only here, on screen'),
      ] },
      { key: 'f35_frequency', type: 'single', he: 'באיזו תדירות?', en: 'How often?', options: [
        opt('every', 'כל שינוי', 'Every change'), opt('weekly', 'סיכום שבועי', 'A weekly summary'),
      ] },
      { key: 'f35_quiet', type: 'text', he: 'שעות שלא להפריע', en: 'Hours not to disturb', hintHe: 'למשל 22:00 עד 8:00.', hintEn: 'For example 22:00 to 8:00.' },
      { key: 'f36_contact', type: 'text', he: 'מי מכם איש הקשר הראשי לשאלות דחופות?', en: 'Which of you is the main contact for urgent questions?', required: true },
    ],
  },
];

/** Every question, flat, for a lookup by key. */
export const INTAKE_QUESTIONS: readonly Question[] = INTAKE.flatMap((c) => c.questions);
