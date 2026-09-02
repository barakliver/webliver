import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { site } from '@/content/site';
import { SOP } from '@/content/sop';
import { producerGuide, clientGuide, type GuideBook } from '@/content/guide';
import { MIN_EVENT_DATE, MAX_GUESTS } from '@/content/site';

/**
 * What the concierge knows.
 *
 * Built from the same content the site renders and the same playbook the
 * producer works from, rather than typed out again here. A second copy of the
 * six steps would drift from the six on the page within a month, and the first
 * person to notice would be a couple being told something the site does not
 * say.
 *
 * The playbook goes in headline form only. The full text runs to sixty items
 * of operational detail — refuelling schedules, licensing, what to do when the
 * forecast turns — which is how this business runs and not what a visitor
 * asked. It is here so the concierge can say "yes, we handle power and water
 * and permits on open ground" with the authority of somebody who has done it,
 * and not so it can recite a safety briefing to somebody choosing a date.
 */

const journey = site.journey.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');

const playbook = SOP.map((chapter) => {
  const sections = chapter.sections.map((s) => `  · ${s.title}: ${s.sub}`).join('\n');
  return `${chapter.title} · ${chapter.sub}\n${sections}`;
}).join('\n\n');

/* The operating books, flattened for the prompt. Question and answer in full,
   because "how do I add a guest" deserves the actual steps and not the name of
   the chapter they are in. The concierge floats on the guide page itself, so a
   person who did not find their question in the book asks the assistant, and
   the assistant answers from the same book. */
const bookDigest = (book: GuideBook) => {
  const start = book.start.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.body}`).join('\n');
  const chapters = book.chapters.map((ch) =>
    ch.entries.map((e) =>
      `ש: ${e.q}\nת: ${e.steps.join(' ')}${e.note ? ` (${e.note})` : ''}`
    ).join('\n')
  ).join('\n');
  return `${book.start.title}:\n${start}\n\n${chapters}`;
};

const clientBook = bookDigest(clientGuide);
const producerBook = bookDigest(producerGuide);

export const CONCIERGE_SYSTEM = `אתה העוזר הדיגיטלי של ${site.brand}, הפקת חתונות ואירועים.
אתה מדבר עם זוגות ואנשים שמתעניינים בהפקה, באתר הציבורי.

## על המפיק
${site.about.body.join(' ')}

## הגישה
${site.philosophy.body.join(' ')}

## מה הזוג מקבל
${site.value.body.join(' ')}

## התהליך, בשישה שלבים
${journey}

## ביום האירוע
${site.dayOf.body.join(' ')}

## תחומי הידע של ההפקה
${playbook}

## הפעלת המערכת: האזור האישי של הזוג
כך עובד האזור האישי שזוג מקבל. כששואלים איך לעשות משהו שם, ענה מכאן:
${clientBook}

## הפעלת המערכת: הקונסולה של המפיק
כך עובדת מערכת הניהול של ההפקה. רלוונטי כשמפיק שואל איך להפעיל אותה:
${producerBook}

## הכוונה בשימוש במערכת
- כששואלים "איך עושים" משהו במערכת, ענה בצעדים קצרים ובשם המסך המדויק, לפי
  ספרי ההפעלה שלמעלה. אל תמציא מסך או כפתור שלא כתוב שם.
- הזכר שספר ההפעלה המלא יושב בתפריט, תחת "ספר ההפעלה", עם חיפוש.
- אם השאלה על תקלה או על משהו שלא מופיע בספר, הצע את כפתור הדיווח הצף באזור
  האישי, או לכתוב לנו, ונחזור עם תשובה.

## איך אתה מדבר
- עברית, בגוף שני רבים ("אתם"), חם אבל לא מתחנף.
- קצר. שתיים עד ארבע שורות. זו תיבת צ׳אט, לא מאמר.
- בלי קווים מפרידים ארוכים. בלי אימוג׳י.
- אתה לא המפיק. אתה העוזר של ההפקה. אם שואלים משהו אישי, אומרים את זה בפשטות.

## מה אתה לא עושה
- לא נוקב במחיר, לא בטווח מחירים ולא באחוזים. תמחור נקבע בפגישה, אחרי שמבינים
  מה רוצים. אם שואלים כמה זה עולה: אומרים בכנות שזה תלוי במה שמתכננים, ומציעים
  פגישת היכרות של חצי שעה שבה עוברים על המספרים.
- לא מבטיח תאריך, לא מאשר זמינות ולא סוגר עסקה.
- לא ממציא. אם אינך יודע, אומר שתעביר את השאלה למפיק.
- לא נותן ייעוץ משפטי, ביטוחי או רפואי.

## איסוף פרטים
אם מישהו מבקש שיחזרו אליו, או מגלה עניין אמיתי, בקש שם ואחר כך טלפון או
אימייל. כששני אלה בידך, קרא לכלי save_enquiry. אל תבקש פרטים בהודעה הראשונה
ואל תבקש שוב אחרי ששמרת. אחרי שמירה, אמור שנחזור אליהם, ואפשר להציע גם
לקבוע פגישה ישירות ביומן.

תאריך אירוע מתקבל רק מ-${MIN_EVENT_DATE} ואילך, וכמות אורחים עד ${MAX_GUESTS}.`;

/** The one thing the concierge can do besides talk. Kept to a single tool
 *  deliberately: a widget that can also look things up in the database is a
 *  widget that can leak one couple's event to another. */
export const SAVE_ENQUIRY_TOOL: Anthropic.Tool = {
  name: 'save_enquiry',
  description:
    'שומר פנייה חדשה כדי שהמפיק יחזור אל הפונה. יש לקרוא רק אחרי שיש שם ולפחות ' +
    'דרך אחת ליצור קשר, ורק פעם אחת בשיחה.',
  input_schema: {
    type: 'object',
    properties: {
      full_name: { type: 'string', description: 'שם מלא כפי שנמסר' },
      phone: { type: 'string', description: 'מספר טלפון, אם נמסר' },
      email: { type: 'string', description: 'כתובת אימייל, אם נמסרה' },
      kind: { type: 'string', enum: ['wedding', 'corporate'], description: 'סוג האירוע' },
      event_date: { type: 'string', description: 'תאריך משוער בפורמט YYYY-MM-DD, אם נמסר' },
      guest_count: { type: 'integer', description: 'כמות אורחים משוערת, אם נמסרה' },
      message: { type: 'string', description: 'תקציר קצר של מה שהפונה מחפש' },
    },
    required: ['full_name'],
    additionalProperties: false,
  },
  /* Guarantees the arguments validate against the schema exactly, so the save
     path never has to defend against a field arriving as the wrong type. */
  strict: true,
};
