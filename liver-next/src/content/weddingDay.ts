/**
 * The wedding-day questionnaire: forty questions, six chapters, opened
 * on the couple's screen forty-five days before the date.
 *
 * Everything the run of show is built from and nothing else. The keys
 * are read by `lib/runOfShow.ts`, which turns the answers into lines on
 * the day schedule, so a key here is never renamed: the generator reads
 * it by name and a test holds the two files to each other. Same renderer
 * as the intake questionnaire, two new kinds of answer: a time, and a
 * table of short rows for the entrances, the blessings, the surprises
 * and the day's contacts.
 */
import type { Chapter, Column, Option, Question } from './intake.ts';

export const WEDDING_DAY_KEY = 'wedding_day';

const opt = (value: string, he: string, en: string): Option => ({ value, he, en });
const col = (key: string, he: string, en: string, kind?: Column['kind']): Column => ({ key, he, en, kind });
const yesNo = [opt('yes', 'כן', 'Yes'), opt('no', 'לא', 'No')] as const;

export const WEDDING_DAY: readonly Chapter[] = [
  {
    key: 'a', he: 'הבוקר וההתארגנות', en: 'The morning', minutesHe: 'חמש דקות', minutesEn: 'five minutes',
    questions: [
      { key: 'wd_a1_where', type: 'textarea', he: 'איפה כל אחד מתארגן?', en: 'Where does each of you get ready?', hintHe: 'כתובת, מי איתכם, משעה.', hintEn: 'Address, who is with you, from what time.', required: true },
      { key: 'wd_a2_makeup', type: 'text', he: 'איפור ושיער', en: 'Hair and makeup', hintHe: 'מי, משעה עד שעה, האם מגיעים אליכם.', hintEn: 'Who, from when to when, do they come to you.' },
      { key: 'wd_a3_prep_photos', type: 'single', he: 'צילום התארגנות?', en: 'Getting-ready photos?', required: true, options: [opt('both', 'לשניכם', 'Both of you'), opt('one', 'לאחד', 'One of you'), opt('none', 'לא', 'No')] },
      { key: 'wd_a4_first_look', type: 'single', he: 'מפגש ראשון לפני האורחים?', en: 'A first look before the guests?', required: true, options: [opt('yes', 'כן', 'Yes'), opt('no', 'לא', 'No'), opt('surprise', 'מופתעים', 'Surprised')] },
      { key: 'wd_a5_transport', type: 'single', he: 'הסעה לאולם', en: 'Getting to the venue', required: true, options: [opt('self', 'עצמאי', 'On our own'), opt('car', 'רכב מיוחד', 'A special car'), opt('producer', 'הסעה שהמפיק מארגן', 'The producer arranges')] },
      { key: 'wd_a5_leave', type: 'time', he: 'שעת יציאה לאולם', en: 'Leaving for the venue at' },
      { key: 'wd_a6_prep_people', type: 'table', max: 8, he: 'אנשים לצלם בהתארגנות', en: 'People to photograph while getting ready', columns: [col('name', 'שם', 'Name'), col('who', 'מי זה', 'Who')] },
    ],
  },
  {
    key: 'b', he: 'קבלת פנים', en: 'The reception', minutesHe: 'חמש דקות', minutesEn: 'five minutes',
    questions: [
      { key: 'wd_b7_reception', type: 'time', he: 'שעת תחילת קבלת הפנים, לפי ההזמנה', en: 'Reception start, as on the invitation', required: true },
      { key: 'wd_b7_real', type: 'time', he: 'ומתי באמת אתם מצפים שאנשים יגיעו?', en: 'And when do you really expect people to arrive?' },
      { key: 'wd_b8_at_reception', type: 'single', he: 'אתם בקבלת הפנים, או נכנסים אחר כך?', en: 'Are you at the reception, or do you enter later?', required: true, options: [opt('yes', 'בקבלת הפנים', 'At the reception'), opt('later', 'נכנסים אחר כך', 'Enter later')] },
      { key: 'wd_b8_from', type: 'time', he: 'אם אתם שם, מאיזו שעה?', en: 'If there, from what time?' },
      { key: 'wd_b9_music', type: 'single', he: 'מוזיקה בקבלת הפנים', en: 'Reception music', options: [opt('dj', 'די-ג׳יי', 'DJ'), opt('player', 'נגן', 'A musician'), opt('playlist', 'פלייליסט', 'A playlist'), opt('artist', 'אמן', 'An artist')] },
      { key: 'wd_b9_style', type: 'text', he: 'באיזה סגנון?', en: 'What style?' },
      { key: 'wd_b10_host', type: 'table', max: 2, he: 'מי מקבל את הספקים ועונה לשאלות עד שהמפיק מגיע?', en: 'Who receives suppliers and answers questions until the producer arrives?', hintHe: 'לרוב אח או חבר.', hintEn: 'Usually a sibling or a friend.', required: true, columns: [col('name', 'שם', 'Name'), col('phone', 'טלפון', 'Phone', 'phone')] },
      { key: 'wd_b11_holders', type: 'textarea', he: 'מי מחזיק את הטבעות? את הכתובה? מתנות ומעטפות: מי אחראי ואיפה הקופסה?', en: 'Who holds the rings? The ketubah? Gifts and envelopes: who is responsible and where is the box?', required: true },
      { key: 'wd_b12_time_for', type: 'textarea', he: 'אנשים שצריך לפנות להם זמן בקבלת הפנים', en: 'People to make time for at the reception', hintHe: 'סבים, אורח מחו"ל.', hintEn: 'Grandparents, a guest from abroad.' },
    ],
  },
  {
    key: 'c', he: 'החופה', en: 'The chuppah', minutesHe: 'עשר דקות', minutesEn: 'ten minutes',
    questions: [
      { key: 'wd_c13_time', type: 'time', he: 'שעת החופה המתוכננת', en: 'Planned chuppah time', hintHe: 'בלי תשובה: שעה ועשר דקות אחרי קבלת הפנים.', hintEn: 'Blank: seventy minutes after the reception.' },
      { key: 'wd_c14_officiant', type: 'table', max: 1, he: 'מי עורך את החופה?', en: 'Who officiates?', required: true, columns: [col('name', 'שם', 'Name'), col('phone', 'טלפון', 'Phone', 'phone'), col('arrives', 'מגיע ב', 'Arrives at', 'time'), col('needs', 'צריך משהו?', 'Needs anything?')] },
      { key: 'wd_c15_entrances', type: 'table', max: 10, he: 'סדר הכניסה לחופה', en: 'Order of entrance', hintHe: 'ברירת מחדל: סבים, אחים, הורי החתן, החתן, הורי הכלה, הכלה. שורה לכל כניסה, עם השיר.', hintEn: 'Default: grandparents, siblings, his parents, him, her parents, her. A row per entrance, with the song.', required: true,
        columns: [col('who', 'מי נכנס', 'Who'), col('with', 'עם מי', 'With'), col('song', 'שיר', 'Song'), col('artist', 'אמן', 'Artist'), col('cue', 'מאיזו דקה', 'From minute'), col('note', 'הערה', 'Note')] },
      { key: 'wd_c16_poles', type: 'text', he: 'מי מחזיק את עמודי החופה?', en: 'Who holds the chuppah poles?', hintHe: 'ארבעה שמות, או חופה קבועה.', hintEn: 'Four names, or a fixed chuppah.' },
      { key: 'wd_c17_blessings', type: 'table', max: 7, he: 'שבע ברכות', en: 'The seven blessings', hintHe: 'שורה לכל ברכה: מי, והערה. קטין? צריך עזרה? אנגלית?', hintEn: 'A row per blessing: who, and a note. A minor? Needs help? English?', columns: [col('who', 'מי מברך', 'Who'), col('note', 'הערה', 'Note')] },
      { key: 'wd_c18_ketubah', type: 'table', max: 1, he: 'קריאת הכתובה והעדים', en: 'The ketubah reading and the witnesses', hintHe: 'לפי הרבנות העדים חייבים להיות שומרי מצוות.', hintEn: 'By the rabbinate the witnesses must be observant.', columns: [col('reader', 'מי קורא', 'Reader'), col('witness1', 'עד ראשון', 'First witness'), col('witness2', 'עד שני', 'Second witness')] },
      { key: 'wd_c19_glass_song', type: 'text', he: 'השיר אחרי שבירת הכוס', en: 'The song after the glass', hintHe: 'בלי תשובה: שמחה גדולה הלילה.', hintEn: 'Blank: the usual one.' },
      { key: 'wd_c20_moments', type: 'table', max: 6, he: 'רגעים מיוחדים בחופה', en: 'Special moments in the chuppah', hintHe: 'הקראה, שיר של חבר, ברכה של סבתא, הנצחה.', hintEn: 'A reading, a friend\'s song, a grandmother\'s blessing, a memorial.', columns: [col('who', 'מי', 'Who'), col('what', 'מה', 'What')] },
      { key: 'wd_c21_yichud', type: 'single', he: 'ייחוד?', en: 'Yichud?', required: true, options: [...yesNo] },
      { key: 'wd_c21_detail', type: 'text', he: 'אם כן: מי שומר בדלת, כמה דקות, מה אוכלים שם', en: 'If yes: who guards the door, how long, what is eaten there' },
      { key: 'wd_c22_shabbat', type: 'text', he: 'אילוצי שבת ודת', en: 'Shabbat and religious constraints', hintHe: 'שעת צאת שבת, המתנה, רב שצריך לסיים עד שעה.', hintEn: 'Shabbat ends at, a wait, a rabbi who must finish by.' },
    ],
  },
  {
    key: 'd', he: 'האירוע', en: 'The party', minutesHe: 'עשר דקות', minutesEn: 'ten minutes',
    questions: [
      { key: 'wd_d23_entry', type: 'single', he: 'הכניסה לריקודים', en: 'The entrance to the dancing', required: true, options: [opt('together', 'ביחד', 'Together'), opt('separate', 'נפרד', 'Separately'), opt('parents', 'עם ההורים', 'With the parents')] },
      { key: 'wd_d23_song', type: 'text', he: 'שיר הכניסה', en: 'The entrance song', required: true },
      { key: 'wd_d24_slow', type: 'single', he: 'ריקוד ראשון, סלואו?', en: 'A first dance, a slow one?', options: [opt('yes', 'כן', 'Yes'), opt('no', 'לא', 'No'), opt('surprise', 'בהפתעה', 'As a surprise')] },
      { key: 'wd_d24_song', type: 'text', he: 'השיר לריקוד הראשון', en: 'The first-dance song' },
      { key: 'wd_d24_when', type: 'single', he: 'מתי?', en: 'When?', options: [opt('entry', 'בכניסה', 'At the entrance'), opt('after_first', 'אחרי מנה ראשונה', 'After the first course'), opt('other', 'אחר', 'Other')] },
      { key: 'wd_d25_parents', type: 'single', he: 'ריקוד עם ההורים?', en: 'A dance with the parents?', options: [opt('mother_groom', 'אמא וחתן', 'Mother and groom'), opt('father_bride', 'אבא וכלה', 'Father and bride'), opt('both', 'שניהם', 'Both'), opt('no', 'לא', 'No')] },
      { key: 'wd_d25_songs', type: 'text', he: 'השירים לריקוד עם ההורים', en: 'The songs for the parents\' dance' },
      { key: 'wd_d26_courses', type: 'table', max: 4, he: 'סדר הארוחה', en: 'The meal', hintHe: 'מנה ושעה: ראשונה, עיקרית, קינוח.', hintEn: 'Course and time: first, main, dessert.', columns: [col('course', 'מנה', 'Course'), col('time', 'שעה', 'Time', 'time')] },
      { key: 'wd_d27_speeches', type: 'table', max: 8, he: 'נאומים וברכות', en: 'Speeches and blessings', hintHe: 'מי, כמה דקות, ומתי: בין מנות או אחרי ריקודים.', hintEn: 'Who, how many minutes, and when: between courses or after the dancing.', columns: [col('who', 'מי', 'Who'), col('minutes', 'דקות', 'Minutes', 'number'), col('when', 'מתי', 'When')] },
      { key: 'wd_d28_surprises', type: 'table', max: 6, he: 'הפתעות', en: 'Surprises', hintHe: 'ריקוד מתוכנן, סרטון, שיר של חברים, מופע. מי לא יודע נשאר סודי בגרסה שלו.', hintEn: 'A planned dance, a video, a friends\' song, a show. Whoever must not know never sees it in their version.', columns: [col('what', 'מה', 'What'), col('knows', 'מי יודע', 'Who knows'), col('secret_from', 'סודי מ', 'Secret from'), col('needs', 'מה צריך', 'Needs'), col('when', 'מתי', 'When', 'time')] },
      { key: 'wd_d29_bouquet', type: 'single', he: 'זריקת זר?', en: 'Bouquet toss?', options: [...yesNo] },
      { key: 'wd_d29_time', type: 'time', he: 'שעה משוערת לזריקת הזר', en: 'Rough time for the toss' },
      { key: 'wd_d30_must', type: 'list', max: 10, he: 'שירים שחייבים', en: 'Songs that must play', required: true },
      { key: 'wd_d30_no', type: 'list', max: 10, he: 'שירים שאסור', en: 'Songs that must not play' },
      { key: 'wd_d31_sets', type: 'text', he: 'סט מזרחי, ישראלי, לועזי: אחוזים או סדר', en: 'Mizrahi, Israeli, foreign sets: shares or order', hintHe: '"לא מתחת לדקה ה-X".', hintEn: '"Not before minute X".' },
      { key: 'wd_d32_effects', type: 'table', max: 6, he: 'זיקוקים, קונפטי, רקדנים', en: 'Fireworks, confetti, dancers', columns: [col('what', 'מה', 'What'), col('when', 'מתי', 'When', 'time'), col('who', 'מי מביא', 'Who brings it')] },
    ],
  },
  {
    key: 'e', he: 'הסיום', en: 'The end', minutesHe: 'שלוש דקות', minutesEn: 'three minutes',
    questions: [
      { key: 'wd_e33_contract_end', type: 'time', he: 'שעת הסיום לפי החוזה עם האולם', en: 'End time by the venue contract', required: true },
      { key: 'wd_e33_wanted_end', type: 'time', he: 'ושעת הסיום שאתם רוצים', en: 'And the end time you want' },
      { key: 'wd_e34_after', type: 'single', he: 'אפטר פארטי?', en: 'An after party?', required: true, options: [...yesNo] },
      { key: 'wd_e34_detail', type: 'table', max: 1, he: 'אם כן', en: 'If yes', columns: [col('where', 'איפה', 'Where'), col('from', 'משעה', 'From', 'time'), col('food', 'אוכל', 'Food'), col('vendor_at', 'הספק מגיע ב', 'Supplier arrives at', 'time')] },
      { key: 'wd_e35_collect', type: 'textarea', he: 'מי אוסף: מתנות, שאריות, חפצים אישיים, בגדים? ולאן הולכים אחרי?', en: 'Who collects: gifts, leftovers, personal things, clothes? And where to after?', required: true },
      { key: 'wd_e36_last_song', type: 'text', he: 'השיר האחרון של הערב', en: 'The last song of the night' },
      { key: 'wd_e37_tomorrow', type: 'text', he: 'למחרת: צ׳ק אאוט ממלון? טיסה?', en: 'The next day: hotel checkout? A flight?', hintHe: 'כדי לדעת מתי לא להציק.', hintEn: 'So we know when not to bother you.' },
    ],
  },
  {
    key: 'f', he: 'אנשי קשר ליום', en: 'Contacts for the day', minutesHe: 'שלוש דקות', minutesEn: 'three minutes',
    questions: [
      { key: 'wd_f38_contacts', type: 'table', max: 12, he: 'האנשים של היום', en: 'The day\'s people', hintHe: 'שם, תפקיד ביום, טלפון, ומתי צריך אותם.', hintEn: 'Name, role on the day, phone, and when they are needed.', required: true, columns: [col('name', 'שם', 'Name'), col('role', 'תפקיד', 'Role'), col('phone', 'טלפון', 'Phone', 'phone'), col('when', 'מתי', 'When')] },
      { key: 'wd_f39_dont_call', type: 'textarea', he: 'למי לא לפנות ביום, ולמי כן?', en: 'Who not to call on the day, and who to call?' },
      { key: 'wd_f40_anything', type: 'textarea', he: 'משהו שחשוב שהמפיק ידע ליום עצמו ולא שאלנו?', en: 'Anything the producer should know for the day that we did not ask?' },
    ],
  },
];

export const WEDDING_DAY_QUESTIONS: readonly Question[] = WEDDING_DAY.flatMap((c) => c.questions);
