/**
 * How an amount is written down, and how it survives being added up.
 *
 * Split out of the `Money` component for the same reason the load failures
 * were split out of `safe.ts`: node cannot import a .tsx file, so anything
 * that lives beside JSX cannot be tested, and this is arithmetic and string
 * handling rather than markup.
 *
 * Western digits with comma groups, which is what he-IL produces for this
 * locale anyway.
 *
 * Agorot are kept, and that is a correction. This file used to round every
 * amount to the whole shekel on the way to the screen, with a comment saying
 * a wedding budget is not quoted in agorot and a trailing `.00` on every line
 * is noise. The second half of that is right and is still done; the first
 * half was wrong about a real case. A deposit of 1,250.50 went into the
 * database intact — every money column is `numeric(12,2)` — and came back out
 * onto the screen as 1,251, so the figure a couple checked against their bank
 * was not the figure they had entered. A number that changes between the form
 * and the page is worse than a noisy one.
 *
 * So: agorot are shown when an amount has them and hidden when it does not.
 */

/**
 * The amount in agorot, as a whole number, or null if that is not a number.
 *
 * Everything that adds money up goes through here first. A column of prices
 * held as ordinary JavaScript numbers drifts — 0.1 + 0.2 is famously not 0.3
 * — and while the error is far below an agora, it surfaces as a total that
 * does not equal the sum of its own rows, and as a balance that will not
 * settle to zero on a payment that was paid exactly.
 */
export const toAgorot = (value: number | null | undefined): number =>
  Math.round((Number(value) || 0) * 100);

/**
 * A column of amounts added up without drift: to agorot, summed as integers,
 * and back. Use this anywhere a total is compared against something, which is
 * every place a balance decides whether a line reads as settled.
 */
export const sumIls = (values: Iterable<number | null | undefined>): number => {
  let agorot = 0;
  for (const v of values) agorot += toAgorot(v);
  return agorot / 100;
};

/**
 * What a person typed, as a number, or null if it was not one.
 *
 * Written here rather than in each action because there were four copies of
 * it and they did not agree: one stripped the minus sign, one did not, and
 * one rounded. A thousands separator is allowed on the way in, because people
 * paste amounts out of spreadsheets and out of WhatsApp.
 */
export function parseIls(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const cleaned = String(raw ?? '').replace(/[\s,₪]/g, '').replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  /* To the agora, so what is stored is what `numeric(12,2)` will hold and a
     third decimal cannot come back later as a rounding surprise. */
  return toAgorot(n) / 100;
}

/**
 * `₪125,500`, `₪1,250.50`, and `-₪125,500` when it is a loss.
 *
 * The sign goes in front of the currency rather than between it and the
 * digits. Concatenating the symbol to what `toLocaleString` returns produced
 * `₪-125,500`, which went unnoticed for as long as nothing in the product
 * could be negative — the producer's bottom line is the first figure that
 * can be, and the first time it was rendered the minus was in the middle.
 *
 * Rounding to the agora happens before the sign is chosen, so an amount that
 * rounds to zero is written as zero rather than as minus zero.
 */
export const ils = (value: number | null | undefined): string => {
  const agorot = toAgorot(value);
  const whole = Math.abs(agorot) % 100 === 0;
  const n = Math.abs(agorot) / 100;
  return (agorot < 0 ? '-₪' : '₪') + n.toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

/**
 * The attributes every money field carries, so none of them can be the one
 * that forgets. `step` is the whole of the original bug: without it the
 * browser's default step is 1, and a perfectly good 1250.50 is refused by
 * the field itself with a validation message about the value not being
 * valid — which reads, to the person typing, as the amount being wrong.
 *
 * `inputMode` matters as much on a phone: `numeric` is the keypad with no
 * decimal point on it, so even once the field accepts agorot there is no key
 * to type them with.
 */
export const MONEY_INPUT = {
  type: 'number',
  inputMode: 'decimal',
  step: '0.01',
  min: 0,
} as const;
