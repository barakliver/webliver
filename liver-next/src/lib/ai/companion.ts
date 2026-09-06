/**
 * The couple's assistant, which is their producer's voice and nobody else's.
 *
 * The portal deliberately had none. The comment in the app shell says why: a
 * couple's concierge is their producer, and a second voice in their area would
 * be the platform speaking, which on a white-labelled product it must never
 * do. That objection is right, and it is an objection to a particular kind of
 * assistant rather than to the idea.
 *
 * So this one is built to answer it. It has no name and no personality of its
 * own; it introduces nothing and signs nothing; it speaks in the producer's
 * business name because on that couple's screen there is no other identity
 * that exists. It never mentions a platform, because from where the couple is
 * standing there isn't one.
 *
 * Two harder rules follow from where it sits.
 *
 * It knows only this couple's own event, read through their own session, so
 * row level security decides what it may see exactly as it decides what their
 * screen may. And it respects the producer's gates on top of that: a producer
 * who has hidden the budget from a couple has made a decision about their
 * client relationship, and an assistant that answers "what have we spent" for
 * a couple who cannot see the budget panel would quietly overturn it. That is
 * the failure this file is mostly written to prevent, and it is the part with
 * tests.
 *
 * It has no tools and writes nothing, for the reason the producer's copilot
 * gives: an assistant that can also edit the event is one ambiguous sentence
 * away from cancelling a supplier.
 */

/** What the couple may see, as the portal already decides it. */
export type CoupleGates = {
  /** The producer can hide the money from a couple entirely. */
  budget: boolean;
  guests: boolean;
  runsheet: boolean;
};

export type CoupleFactsInput = {
  coupleName: string;
  eventDate: string | null;
  venue: string;
  daysToEvent: number | null;
  gates: CoupleGates;
  /** Only what is theirs to do. A task owned by the producer is the
   *  producer's business and appears on nobody's list but theirs. */
  openTasks: { title: string; due_on: string | null; owner: string }[];
  payments: { title: string; amount: number | string; due_on: string | null; paid: boolean }[];
  budgetTotal: number | null;
  guests: { invited: number; coming: number; pending: number };
  schedule: { at_time: string; title: string }[];
};

const num = (v: number | string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Everything the assistant is allowed to know about this event, as text.
 *
 * Pure on purpose, and the reason is the gates: whether a couple's money
 * reaches this string is the one thing here that must never be got wrong, and
 * a rule that can only be exercised by standing up a database and signing in
 * as somebody is a rule nobody will ever check.
 *
 * Gated sections are omitted rather than replaced with a note saying they
 * exist. "The budget is hidden from you" is itself an answer about the budget,
 * and it invites a conversation the producer chose not to have.
 */
export function coupleFacts(f: CoupleFactsInput): string {
  const lines: string[] = [];

  lines.push(`האירוע: ${f.coupleName}`);
  if (f.eventDate) lines.push(`תאריך: ${f.eventDate}`);
  if (f.venue) lines.push(`מקום: ${f.venue}`);
  if (f.daysToEvent !== null) {
    lines.push(
      f.daysToEvent > 0 ? `נותרו ${f.daysToEvent} ימים`
        : f.daysToEvent === 0 ? 'האירוע היום'
        : `האירוע היה לפני ${Math.abs(f.daysToEvent)} ימים`,
    );
  }

  /* Theirs only. A couple asking "what is left for us" means for us. */
  const mine = f.openTasks.filter((t) => t.owner === 'client');
  if (mine.length > 0) {
    lines.push('', 'מה שנשאר לזוג לעשות:');
    for (const t of mine.slice(0, 25)) {
      lines.push(`- ${t.title}${t.due_on ? ` (עד ${t.due_on})` : ''}`);
    }
  } else {
    lines.push('', 'אין כרגע משימות פתוחות שמוטלות על הזוג.');
  }

  if (f.gates.guests) {
    lines.push(
      '',
      `אורחים: ${f.guests.invited} הוזמנו, ${f.guests.coming} אישרו הגעה, ${f.guests.pending} טרם ענו.`,
    );
  }

  if (f.gates.budget) {
    const paid = f.payments.filter((p) => p.paid).reduce((a, p) => a + num(p.amount), 0);
    const open = f.payments.filter((p) => !p.paid).reduce((a, p) => a + num(p.amount), 0);
    lines.push('', `תשלומים: שולם ${paid} ש"ח, פתוח ${open} ש"ח.`);
    if (f.budgetTotal !== null) lines.push(`סך התקציב שנקבע: ${f.budgetTotal} ש"ח.`);

    const next = f.payments.filter((p) => !p.paid && p.due_on)
      .sort((a, b) => String(a.due_on).localeCompare(String(b.due_on)))[0];
    if (next) lines.push(`התשלום הבא: ${next.title}, ${num(next.amount)} ש"ח, עד ${next.due_on}.`);
  }

  if (f.gates.runsheet && f.schedule.length > 0) {
    lines.push('', 'סדר הערב:');
    for (const s of f.schedule.slice(0, 30)) lines.push(`- ${s.at_time.slice(0, 5)} ${s.title}`);
  }

  return lines.join('\n');
}

/**
 * The instructions, with the producer's name in them.
 *
 * Built per request rather than kept as a constant, because the one thing it
 * must get right is whose voice it is, and that changes with whoever the
 * couple belongs to. The cost is that this part of the prompt cannot be cached
 * between tenants, which is the correct thing to pay for.
 */
export function companionSystem(brandName: string, reachOut: string): string {
  return `אתה העוזר של ${brandName} באזור האישי של הזוג.

אתה מדבר בשם ${brandName} ובשמם בלבד. אין לך שם משלך, אתה לא מציג את עצמך, ואתה לא חותם.
אל תזכיר אף פעם מערכת, פלטפורמה, תוכנה או ספק טכנולוגי. מבחינת הזוג הם מדברים עם ההפקה שלהם.

## מה אתה עונה עליו
אתה עונה על שאלות שהתשובה להן נמצאת בנתוני האירוע שלמטה: מה נשאר להם לעשות, כמה אישרו
הגעה, מתי התשלום הבא, מה סדר הערב. תשובה קצרה, בעברית פשוטה, בלי כותרות ובלי רשימות
ארוכות כשמשפט מספיק.

## מה שאתה לא עושה
- **אל תמציא.** אם משהו לא מופיע בנתונים למטה, אתה לא יודע אותו. תגיד את זה בפשטות והפנה
  אותם ל${brandName}: "${reachOut}".
- אל תנחש תאריכים, מחירים, שמות ספקים או מספרים. מספר שלא כתוב למטה הוא מספר שאין לך.
- אל תיתן ייעוץ משפטי, רפואי או פיננסי, ואל תמליץ על ספקים שלא מופיעים באירוע.
- אל תבטיח שום דבר בשם ההפקה. אתה מוסר מידע, לא מתחייב.
- אם הם מבקשים לשנות משהו באירוע (תאריך, מספר אורחים, תשלום), אתה לא משנה כלום. תגיד
  שזה עובר דרך ${brandName} ותפנה אותם לשם.

## מיידיות
אין מילות המתנה. אסור לכתוב "רק רגע", "שנייה", "אני בודק" או כל ניסוח שמבטיח תשובה במקום
לתת אותה. מה שיש לך, יש לך עכשיו.

## נימה
זו החתונה שלהם. דבר בחום ובקצרה, בלי התלהבות מוגזמת ובלי אימוג'ים.`;
}
