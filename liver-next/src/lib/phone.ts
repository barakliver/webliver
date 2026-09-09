/**
 * One shape for a phone number, on this side of the wire.
 *
 * The database has `normalize_phone()` and everything stored there is E.164.
 * This is the same rule written twice, deliberately: the browser has to be
 * able to say "that is not a number" before a code is sent, and the server has
 * to agree with the database about what the number *is* before it asks
 * Supabase to text it. A number that normalises one way here and another way
 * in SQL does not fail loudly — it quietly creates a second person, which is
 * the whole thing 0022 exists to prevent. So the two must be kept in step, and
 * the rules below are a line for line reading of that function.
 */

/** E.164, or null when the digits cannot be one. Never throws: the caller
 *  decides what to tell somebody who typed a number wrong. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, '');
  if (d === '') return null;

  /* Israeli numbers, in the forms people actually type. Anything already
     carrying a country code is left alone, so a number from somewhere else is
     not quietly mangled into an Israeli one. */
  if (/^0[5][0-9]{8}$/.test(d)) return `+972${d.slice(1)}`;
  if (/^0[2-9][0-9]{7,8}$/.test(d)) return `+972${d.slice(1)}`;
  if (/^972[0-9]{8,9}$/.test(d)) return `+${d}`;
  if (d.length >= 8 && d.length <= 15) return `+${d}`;
  return null;
}

/** How a number is shown back to the person who typed it, so they can check it
 *  is theirs before waiting for a text that will never arrive. Israeli numbers
 *  are grouped the way they are read aloud here; anything else keeps E.164,
 *  because guessing at another country's grouping gets it wrong. */
export function displayPhone(e164: string): string {
  const m = /^\+972(\d{1,2})(\d{3})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `0${m[1]}-${m[2]}-${m[3]}`;
}

/** True when the text looks like somebody is reaching for a number rather than
 *  an address, used to pick the right keyboard and the right error. */
export function looksLikePhone(raw: string): boolean {
  return /^[+0-9()\-\s.]+$/.test(raw.trim()) && (raw.match(/\d/g)?.length ?? 0) >= 7;
}
