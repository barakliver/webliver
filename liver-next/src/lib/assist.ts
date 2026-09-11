import { amountOf, hoursOf, type QuoteVendor } from './quotes.ts';

/**
 * What to ask a supplier, and a message that asks it.
 *
 * Round five of the planning brief: help that reads the screen it is on. On
 * the quotes table the useful help is not a paragraph about photography, it
 * is the list of things this supplier has not told us yet and a message
 * that asks for them — with the wedding's own facts in it, so the supplier
 * does not have to ask back.
 *
 * Everything here is deterministic and is the whole of the manual workflow.
 * The model, when there is a key, rewrites the same facts and the same
 * questions more warmly; when there is not, or it fails, this message goes
 * out as it is. Either way the facts come from rows the couple can see, and
 * a question is only ever asked about a field that is actually blank.
 *
 * The message is never sent from here. It opens in WhatsApp, or is copied,
 * and a person presses send.
 */

export type QuestionKey = 'amount' | 'hours' | 'scope' | 'includes' | 'extras' | 'terms';

/** The blanks on this quote, in the order a supplier answers them. */
export function questionsFor(v: QuoteVendor): QuestionKey[] {
  const out: QuestionKey[] = [];
  if (amountOf(v) === null) out.push('amount');
  if (hoursOf(v) === null) out.push('hours');
  if (!v.quote_scope.trim()) out.push('scope');
  if (!v.quote_includes.trim()) out.push('includes');
  if (!v.quote_extras.trim()) out.push('extras');
  if (!v.quote_terms.trim()) out.push('terms');
  return out;
}

export type EventFactsForDraft = {
  eventName: string;
  eventDate: string | null;
  guests: number | null;
  region: string;
  /** Who signs. The producer's brand, or the couple's own names. */
  signAs: string;
};

/** The words the template needs, resolved by the caller in its language. */
export type DraftCopy = {
  greeting: string;      // 'שלום {name},'
  about: string;         // 'אנחנו מתכננים את {event}'
  onDate: string;        // 'בתאריך {date}'
  guests: string;        // 'כ-{n} אורחים'
  inRegion: string;      // 'באזור {region}'
  haveQuote: string;     // 'קיבלנו את ההצעה שלכם'
  askIntro: string;      // 'כמה שאלות כדי שנוכל להשוות:'
  questions: Record<QuestionKey, string>;
  closing: string;       // 'תודה, {sign}'
};

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/** One line of what is known, for the "facts" column beside the draft. The
 *  screen draws these as facts and the draft as a suggestion, and the two
 *  are never in the same box. */
export function factLines(v: QuoteVendor, f: EventFactsForDraft, c: DraftCopy, dateText: string | null): string[] {
  const out: string[] = [];
  out.push(fill(c.about, { event: f.eventName }));
  if (dateText) out.push(fill(c.onDate, { date: dateText }));
  if (f.guests) out.push(fill(c.guests, { n: f.guests }));
  if (f.region.trim()) out.push(fill(c.inRegion, { region: f.region.trim() }));
  const amount = amountOf(v);
  const hours = hoursOf(v);
  if (amount !== null) out.push(`${c.questions.amount.replace(/\?$/, '')}: ${amount}`);
  if (hours !== null) out.push(`${c.questions.hours.replace(/\?$/, '')}: ${hours}`);
  if (v.quote_scope.trim()) out.push(v.quote_scope.trim());
  if (v.quote_includes.trim()) out.push(v.quote_includes.trim());
  if (v.quote_extras.trim()) out.push(v.quote_extras.trim());
  if (v.quote_terms.trim()) out.push(v.quote_terms.trim());
  return out;
}

/**
 * The message, written from the template.
 *
 * Short on purpose: a supplier reads it on a phone between two events. The
 * facts first so they know which wedding, then the questions as a list so
 * they can answer them in order, then a name to reply to.
 */
export function templateDraft(v: QuoteVendor, f: EventFactsForDraft, c: DraftCopy, dateText: string | null): string {
  const lines: string[] = [];
  lines.push(fill(c.greeting, { name: v.name }));
  lines.push('');
  const about = [
    fill(c.about, { event: f.eventName }),
    dateText ? fill(c.onDate, { date: dateText }) : '',
    f.guests ? fill(c.guests, { n: f.guests }) : '',
    f.region.trim() ? fill(c.inRegion, { region: f.region.trim() }) : '',
  ].filter(Boolean).join(', ');
  lines.push(`${about}.`);

  const qs = questionsFor(v);
  const hasAny = qs.length < 6;
  if (hasAny) lines.push(c.haveQuote + '.');
  if (qs.length > 0) {
    lines.push('');
    lines.push(c.askIntro);
    for (const q of qs) lines.push(`• ${c.questions[q]}`);
  }
  lines.push('');
  lines.push(fill(c.closing, { sign: f.signAs }));
  return lines.join('\n');
}
