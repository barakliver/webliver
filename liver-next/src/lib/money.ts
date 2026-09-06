/**
 * How an amount is written down.
 *
 * Split out of the `Money` component for the same reason the load failures
 * were split out of `safe.ts`: node cannot import a .tsx file, so anything
 * that lives beside JSX cannot be tested, and this is arithmetic and string
 * handling rather than markup.
 *
 * Western digits with comma groups, which is what he-IL produces for this
 * locale anyway. Rounded, because a wedding budget is not quoted in agorot
 * and a trailing .00 on every line is noise on a screen that is mostly
 * numbers.
 */

/**
 * `₪125,500`, and `-₪125,500` when it is a loss.
 *
 * The sign goes in front of the currency rather than between it and the
 * digits. Concatenating the symbol to what `toLocaleString` returns produced
 * `₪-125,500`, which went unnoticed for as long as nothing in the product
 * could be negative — the producer's bottom line is the first figure that
 * can be, and the first time it was rendered the minus was in the middle.
 *
 * Rounding happens before the sign is chosen, so an amount that rounds to
 * zero is written as zero rather than as minus zero.
 */
export const ils = (value: number | null | undefined): string => {
  const n = Math.round(Number(value) || 0);
  return (n < 0 ? '-₪' : '₪') + Math.abs(n).toLocaleString('en-US');
};
