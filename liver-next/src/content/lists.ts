/** Choice lists shared by the server actions that validate them and the forms
 *  that offer them.
 *
 *  They used to live in the action files themselves, which was wrong in a way
 *  that only showed at runtime: a 'use server' module may export async
 *  functions and nothing else. A client component importing a constant from
 *  one gets `undefined` rather than the array, and the first `.filter` or
 *  `.map` on it takes the whole page down — which is exactly what happened to
 *  the event page, three times over in one render. A plain module has no such
 *  rule, so both sides can read the same list. */

export const BOARD_CATEGORIES = [
  { value: 'chuppah', label: 'חופה' },
  { value: 'floral',  label: 'פרחים' },
  { value: 'table',   label: 'הגשה ושולחנות' },
  { value: 'light',   label: 'תאורה' },
  { value: 'dress',   label: 'לוק ולבוש' },
  { value: 'other',   label: 'אחר' },
] as const;

export const DIETS = [
  { value: 'none',        label: 'רגיל' },
  { value: 'vegetarian',  label: 'צמחוני' },
  { value: 'vegan',       label: 'טבעוני' },
  { value: 'gluten_free', label: 'ללא גלוטן' },
  { value: 'kosher',      label: 'כשר' },
] as const;

export const RSVP_LABELS: Record<string, string> = {
  pending: 'טרם ענו',
  attending: 'מגיעים',
  declined: 'לא מגיעים',
};

export const TRACKS = ['shared', 'partner_a', 'partner_b'] as const;
export type Track = (typeof TRACKS)[number];

/** Who a run-sheet line is for. Empty on a line means everyone.
 *  Mirrors the day_audience_known check constraint; the database is the
 *  authority and this list must not drift from it. */
export const AUDIENCES = [
  { value: 'couple',  label: 'הזוג' },
  { value: 'photo',   label: 'צילום' },
  { value: 'vendors', label: 'ספקים' },
  { value: 'crew',    label: 'צוות' },
] as const;
export type Audience = (typeof AUDIENCES)[number]['value'];
