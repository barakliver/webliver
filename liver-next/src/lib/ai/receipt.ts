/**
 * What a photographed receipt is allowed to become.
 *
 * The model reads a crumpled thermal print and reports what it saw. That is a
 * best effort on smudged ink, so nothing it returns is used as-is: this file is
 * where a reading turns into four fields, and where a reading that would be
 * wrong in a plausible way turns into a blank instead.
 *
 * Kept out of the route so it can be tested without a network, an API key, or
 * a photograph. It is the only part of the feature that can quietly put a
 * wrong number in front of somebody.
 */

export type Receipt = {
  vendor: string;
  label: string;
  amount: number;
  date: string;
  /** Whether the fields are worth trusting at a glance. Low means the screen
   *  says so rather than presenting a guess as a reading. */
  sure: boolean;
};

/** Above this it is a misread decimal separator, not a wedding. */
const ABSURD = 10_000_000;

export function readReceipt(input: Record<string, unknown>): Receipt {
  const str = (k: string, max: number) =>
    (typeof input[k] === 'string' ? (input[k] as string) : '').trim().slice(0, max);

  const raw = Number(input.amount);
  /* Zero or below means nothing was found, which is a blank field rather than
     an error: a receipt whose total is smudged still names its supplier, and
     that is worth filling in. */
  const amount = Number.isFinite(raw) && raw > 0 && raw < ABSURD
    ? Math.round(raw * 100) / 100
    : 0;

  const date = str('date', 10);
  return {
    vendor: str('vendor', 80),
    label: str('label', 80),
    amount,
    /* A date is either the shape a date has or it is absent. A half-parsed one
       is the kind of value that reaches a database looking fine. */
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    /* Confident *and* carrying a number. A model that is sure it could not
       read the total is not a reading anybody should act on without looking. */
    sure: input.confidence === 'high' && amount > 0,
  };
}
