import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SOP } from '@/content/sop';
import { producerGuide, type GuideBook } from '@/content/guide';
import { categoryLabel, stateLabel } from '@/content/production';
import { summarise } from '@/lib/finance';

/**
 * What the producer's assistant knows, and how it finds out.
 *
 * Two halves. The standing half is the operating book and the playbook, the
 * same text the concierge on the public site carries, digested once when the
 * process starts. The moving half is the event the producer has open: its
 * date, its open tasks, what is owed, who is booked, read at the moment of
 * asking through the producer's own session, so row level security decides
 * what the assistant may see exactly as it decides what the screen may.
 *
 * It has no tools. It drafts, it lists, it answers; it does not write a row.
 * An assistant that can also edit the event is an assistant that one
 * ambiguous sentence away from cancelling a supplier.
 */

const playbook = SOP.map((chapter) => {
  const sections = chapter.sections.map((s) => `  · ${s.title}: ${s.sub}`).join('\n');
  return `${chapter.title} · ${chapter.sub}\n${sections}`;
}).join('\n\n');

const bookDigest = (book: GuideBook) => {
  const start = book.start.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.body}`).join('\n');
  const chapters = book.chapters.map((ch) =>
    ch.entries.map((e) => `ש: ${e.q}\nת: ${e.steps.join(' ')}${e.note ? ` (${e.note})` : ''}`).join('\n')
  ).join('\n');
  return `${book.start.title}:\n${start}\n\n${chapters}`;
};

const producerBook = bookDigest(producerGuide);

/** The part of the prompt that never changes between requests, so it can be
 *  cached at the API and paid for once an hour rather than once a message. */
export const COPILOT_SYSTEM = `אתה העוזר של מפיק אירועים, בתוך מערכת הניהול שלו.
אתה מדבר עם המפיק עצמו, לא עם לקוח. הוא מקצוען; דבר אליו כמו קולגה מנוסה, לא כמו מדריך למתחילים.

## מה אתה עושה
- מנסח טיוטות: מייל לספק, הודעת וואטסאפ לזוג עם עדכון לוז, סדר יום לפגישת תיאום, תזכורת תשלום.
  טיוטה היא טקסט מוכן להעתקה: פנייה, גוף, חתימה בשם העסק. בלי הקדמות שלך לפני הטיוטה ואחריה,
  חוץ משורה אחת אם יש משהו שכדאי לבדוק לפני שליחה.
- עונה על "מה נשאר לעשות": צ׳קליסט לפי המרחק מתאריך האירוע, מהדחוף ביותר, מבוסס על מה שבאמת פתוח
  באירוע (משימות, תשלומים, ספקים שעוד לא סגורים) ועל ספר ההפעלה והפלייבוק שלמטה.
- עונה על שאלות תפעול ותקציב מהנתונים שיש לך. כשמספר חסר בהקשר, אמור שהוא לא מופיע ואל תמציא.
- מסביר איך עושים דברים במערכת לפי ספר ההפעלה. אל תמציא מסך או כפתור שלא כתוב שם.

## איך אתה כותב
- עברית, גוף שני יחיד או רבים לפי מה שהמפיק כותב. ענייני, חם, בלי מליצות.
- קצר כשאפשר. טיוטה באורך של טיוטה, תשובה באורך של תשובה.
- בלי אימוג׳י, בלי קווים מפרידים ארוכים, בלי כותרות מנופחות. רשימות עם מקפים כשיש רשימה.
- מספרים וסכומים בספרות. תאריכים בעברית כפי שהם מופיעים בהקשר.
- לזוג פונים בשמם כפי שהוא מופיע בהקשר. לספק פונים לפי שם איש הקשר אם ידוע, אחרת לפי שם העסק.

## מה אתה לא עושה
- לא משנה שום דבר במערכת. אתה מנסח ומייעץ; המפיק שולח וסוגר.
- לא ממציא ספק, מחיר, שעה או תאריך שלא מופיעים בהקשר. כשחסר, כותב [להשלים] בטיוטה.
- לא נותן ייעוץ משפטי או ביטוחי מעבר למה שבפלייבוק.

## ספר ההפעלה של הקונסולה
${producerBook}

## הפלייבוק המקצועי של ההפקה
${playbook}`;

type Ctx = {
  brand: string;
  today: string;
  event: string | null;
};

/** The moving half: the event the producer has open, as a few lines of
 *  facts. Every read is allowed to fail on its own; a missing table costs
 *  the assistant one paragraph of context, not the answer. */
export async function eventContext(sb: SupabaseClient, clientId: string | null): Promise<string | null> {
  if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) return null;

  const { data: client } = await sb
    .from('clients')
    .select('display_name,kind,event_date,venue,guest_estimate,budget_target')
    .eq('id', clientId)
    .maybeSingle();
  if (!client) return null;

  const [tasks, payments, vendors, budget, guests, day] = await Promise.all([
    sb.from('tasks').select('title,due_on,done,owner').eq('client_id', clientId).eq('done', false)
      .order('due_on', { ascending: true, nullsFirst: false }).limit(20).then((r) => r.data ?? []),
    sb.from('payments').select('title,amount,due_on,paid').eq('client_id', clientId)
      .order('due_on', { ascending: true, nullsFirst: false }).limit(20).then((r) => r.data ?? []),
    sb.from('event_vendors').select('name,category,phone,status,call_time').eq('client_id', clientId)
      .order('category').limit(30).then((r) => r.data ?? []),
    sb.from('budget_items').select('category,label,estimate,agreed').eq('client_id', clientId)
      .limit(40).then((r) => r.data ?? []),
    sb.from('guests_rsvp').select('status,party_size').eq('client_id', clientId).limit(1500).then((r) => r.data ?? []),
    sb.from('day_schedule').select('at_time,title,key_moment').eq('client_id', clientId)
      .order('at_time').limit(40).then((r) => r.data ?? []),
  ]);

  const daysLeft = client.event_date
    ? Math.round((new Date(client.event_date).getTime() - Date.now()) / 86_400_000)
    : null;

  const shekels = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
  const money = (n: unknown) => (typeof n === 'number' ? shekels.format(n) : '');
  /* The same five figures the couple's screen shows, from the same module.
     Without them the assistant answered "are we over budget" from the
     estimate column alone, which is a different question. */
  const fin = summarise(
    budget as { estimate: number; agreed: number | null }[],
    payments as { amount: number; paid: boolean }[],
    client.budget_target === null || client.budget_target === undefined ? null : Number(client.budget_target),
  );
  const est = budget.reduce((s, b) => s + (Number(b.estimate) || 0), 0);
  const owed = payments.filter((p) => !p.paid).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const attending = guests.filter((g) => g.status === 'attending').reduce((s, g) => s + (Number(g.party_size) || 1), 0);
  const declined = guests.filter((g) => g.status === 'declined').length;
  const silent = guests.filter((g) => g.status !== 'attending' && g.status !== 'declined').length;

  const lines: string[] = [
    `אירוע: ${client.display_name} (${client.kind === 'corporate' ? 'אירוע עסקי' : 'חתונה'})`,
    client.event_date ? `תאריך: ${client.event_date}${daysLeft !== null ? ` (בעוד ${daysLeft} ימים)` : ''}` : 'תאריך: עוד לא נקבע',
    client.venue ? `מקום: ${client.venue}` : '',
    client.guest_estimate ? `אומדן אורחים: ${client.guest_estimate}` : '',
    guests.length > 0 ? `אישורי הגעה: ${attending} מגיעים, ${declined} לא מגיעים, ${silent} עוד לא ענו` : '',
    '',
    `משימות פתוחות (${tasks.length}):`,
    ...tasks.map((t) => `- ${t.title}${t.due_on ? ` · עד ${t.due_on}` : ''}${t.owner ? ` · ${t.owner}` : ''}`),
    tasks.length === 0 ? '- אין' : '',
    '',
    `תשלומים: שולם ${money(fin.paid)}, פתוח ${money(owed)}`,
    ...payments.filter((p) => !p.paid).map((p) => `- ${p.title}: ${money(Number(p.amount))}${p.due_on ? ` · עד ${p.due_on}` : ''}`),
    '',
    budget.length > 0 ? `תקציב: אומדן ${money(est)}, התחייבויות ${money(fin.committed)}` : '',
    fin.target === null
      ? 'תקציב יעד: לא נקבע. אם שואלים על חריגה, אמור שאין תקרה מוגדרת.'
      : `תקציב יעד: ${money(fin.target)}. ${fin.underTarget ? `מרווח ביטחון ${money(fin.variance ?? 0)}` : `חריגה של ${money(Math.abs(fin.variance ?? 0))}`}`,
    `יתרה לתשלום: ${money(fin.remaining)}`,
    ...budget.slice(0, 20).map((b) => `- ${b.label || b.category}: אומדן ${money(Number(b.estimate))}${b.agreed ? `, סוכם ${money(Number(b.agreed))}` : ''}`),
    '',
    `ספקים באירוע (${vendors.length}):`,
    ...vendors.map((v) => `- ${v.name} · ${categoryLabel(v.category)} · ${stateLabel(v.status)}${v.call_time ? ` · הגעה ${v.call_time}` : ''}${v.phone ? ` · ${v.phone}` : ''}`),
    vendors.length === 0 ? '- עוד לא שובצו' : '',
    '',
    day.length > 0 ? `לוז היום (${day.length} פריטים):` : 'לוז היום: עוד לא נבנה',
    ...day.slice(0, 30).map((d) => `- ${String(d.at_time).slice(0, 5)} ${d.title}${d.key_moment ? ' (רגע מפתח)' : ''}`),
  ];

  return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
}

/** The per-request half of the prompt: who is asking, what day it is, and
 *  the open event. Sent after the cached block so the cache still hits. */
export function situation(ctx: Ctx): string {
  return [
    `## המצב עכשיו`,
    `העסק: ${ctx.brand}. חתום על טיוטות בשם הזה.`,
    `היום: ${ctx.today}.`,
    ctx.event ? `\n## האירוע הפתוח\n${ctx.event}` : '\nאין אירוע פתוח כרגע. אם השאלה על אירוע מסוים, בקש מהמפיק לפתוח אותו.',
  ].join('\n');
}
