/**
 * A number, kept in the order it was written.
 *
 * Under `direction: rtl` the neutral characters — the slash, the shekel sign,
 * the colon, the hyphen — take their direction from whatever runs beside them.
 * So `218 / 340` renders as `340 / 218` and `₪228,000` puts the sign on the
 * wrong end. Neither is a font problem or a formatting problem; the string is
 * correct and the paragraph reorders it.
 *
 * Two things fix it together, and both are needed:
 *
 *   `unicode-bidi: isolate` cuts the span out of the surrounding bidi run, so
 *   the neutrals resolve against the digits rather than against the Hebrew.
 *
 *   `white-space: nowrap` stops a value breaking across two lines, which is
 *   the other way `₪228,000` ends up with the sign stranded. A KPI value that
 *   wraps also overflows its own row.
 *
 * Applies to every mixed number and every currency string on every screen:
 * amounts, counts written as `x / y`, dates written with dots, times, phone
 * numbers and email addresses.
 *
 * **Not for a date formatted in Hebrew.** `15 באוקטובר 2025` is a Hebrew
 * sentence with digits in it, not a neutral string, and isolating it as LTR
 * lays it out left to right inside a right to left paragraph — which puts
 * the day at the far end and makes it read `באוקטובר 2025 15`. Six screens
 * shipped that way in one afternoon before anybody looked at one. A date
 * written `27.08.26` is the opposite case and does need this.
 */
export function Ltr({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span dir="ltr" style={{ unicodeBidi: 'isolate', whiteSpace: 'nowrap' }} className={className}>
      {children}
    </span>
  );
}

/**
 * Money, formatted and isolated in one step.
 *
 * Western digits with comma groups, which is what `he-IL` produces anyway for
 * this locale, and what the handoff asks for by name. Rounded, because a
 * wedding budget is not quoted in agorot and a trailing `.00` on every line is
 * noise on a screen that is mostly numbers.
 *
 * The nine local copies of this that used to live in nine components are gone.
 * Each of them concatenated the sign to the string with no isolate, so every
 * amount in the app rendered with the shekel on the wrong side inside a Hebrew
 * sentence — visible on every screen, and never reported, because it is the
 * sort of thing the eye reads past.
 */
export function Money({ value, className }: { value: number | null | undefined; className?: string }) {
  return <Ltr className={className}>{ils(value)}</Ltr>;
}

/** The string on its own, for the places that need text rather than an element:
 *  a title attribute, an aria-label, a CSV cell, an email body. */
export const ils = (value: number | null | undefined): string =>
  '₪' + Math.round(Number(value) || 0).toLocaleString('en-US');

/** `218 / 340`, isolated. Written out rather than left to a template literal
 *  at each call site, because the spaces around the slash are part of why it
 *  reorders and every call site got them slightly differently. */
export function Ratio({ of, total, className }: { of: number; total: number; className?: string }) {
  return (
    <Ltr className={className}>
      {of.toLocaleString('en-US')} / {total.toLocaleString('en-US')}
    </Ltr>
  );
}
