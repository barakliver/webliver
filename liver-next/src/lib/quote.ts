/* Relative imports, so the rules below can be tested by `node --test`, which
   does not resolve `@/`. */
import { parseCell } from './budgetGrid.ts';

/**
 * The rules of a price quote, in one pure place.
 *
 * Three things here are the kind that are obviously right and quietly wrong,
 * and each has a test.
 *
 * The amount is what the producer typed and never a guess: blank, zero and
 * anything that is not a number are refused rather than read as nothing, because
 * a quote for nothing that reaches a couple's inbox cannot be recalled.
 *
 * A payment address is only ever a web address. It is pasted by the producer and
 * rendered as a link on a public page, and `javascript:` is also a thing that can
 * be pasted; the check runs where it is saved and again where it is drawn,
 * because the second is what the visitor is protected by.
 *
 * And a status is a ladder read top-down, withdrawn first. A quote the producer
 * took back must read as withdrawn whatever the couple said before, and a paid
 * one must not read as expired because its date has gone.
 */

/** What the producer typed, as a sum. `12k` and `12 אלף` are numbers too. */
export function parseAmount(raw: string): number | null {
  const n = parseCell(raw);
  if (n === null || n === undefined) return null;
  if (!(n > 0) || n >= 100_000_000) return null;
  return n;
}

/** The address, or null. Only http and https, and nothing with a space in it. */
export function safeUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s || /\s/.test(s)) return null;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  return u.toString();
}

/** A bank block as the lines somebody wrote, blanks dropped. */
export function bankLines(text: string | null | undefined): string[] {
  return (text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

export type QuoteRow = {
  status: string;
  choice: string | null;
  viewed_at: string | null;
  valid_until: string | null;
};

export type QuoteStage = 'withdrawn' | 'paid' | 'expired' | 'chose_bank' | 'chose_link' | 'opened' | 'sent';

/** `today` is a date in the events' zone, `YYYY-MM-DD`. The last day counts. */
export function quoteStage(q: QuoteRow, today: string): QuoteStage {
  if (q.status === 'withdrawn') return 'withdrawn';
  if (q.status === 'paid') return 'paid';
  if (q.valid_until && q.valid_until < today) return 'expired';
  if (q.choice === 'bank') return 'chose_bank';
  if (q.choice === 'link') return 'chose_link';
  if (q.viewed_at) return 'opened';
  return 'sent';
}

/** Whether the couple can still do anything with it. */
export function isPayable(q: Pick<QuoteRow, 'status' | 'valid_until'>, today: string): boolean {
  return q.status === 'sent' && !(q.valid_until && q.valid_until < today);
}

/** Text going into a letter's HTML. The couple's names and the producer's note
 *  are typed by people, and a letter is the one place nobody sees the markup. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The address a couple opens. On the business's own host, which is the one
 *  every guest-facing link names. */
export function quoteUrl(base: string, token: string): string {
  return `${base.replace(/\/+$/, '')}/q/${token}`;
}
