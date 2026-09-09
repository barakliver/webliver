/** Choice lists for the people side of an event, shared by the actions that
 *  validate them and the forms that offer them. A plain module, for the reason
 *  in content/lists.ts: a 'use server' file may export async functions and
 *  nothing else, and a client component importing a constant from one gets
 *  undefined rather than the array. */

export const VENDOR_CATEGORIES = [
  { value: 'venue',      label: 'לוקיישן' },
  { value: 'catering',   label: 'קייטרינג' },
  { value: 'photo',      label: 'צילום' },
  { value: 'music',      label: 'מוזיקה ודיג׳יי' },
  { value: 'floral',     label: 'עיצוב ופרחים' },
  { value: 'light',      label: 'תאורה והגברה' },
  { value: 'rental',     label: 'השכרת ציוד' },
  { value: 'power',      label: 'גנרטורים וחשמל' },
  { value: 'sanitation', label: 'מים ושירותים' },
  { value: 'transport',  label: 'הסעות' },
  { value: 'security',   label: 'אבטחה ובטיחות' },
  { value: 'other',      label: 'אחר' },
] as const;

export const VENDOR_STATES = [
  { value: 'shortlist', label: 'בבדיקה' },
  { value: 'booked',    label: 'סגור' },
  { value: 'cancelled', label: 'בוטל' },
] as const;

export type VendorState = (typeof VENDOR_STATES)[number]['value'];

/** The jobs that come up on almost every evening. Free text underneath, because
 *  the twelfth one is always something nobody listed. */
export const CREW_ROLES = [
  'מפיק בשטח',
  'עוזר הפקה',
  'תאורן',
  'סאונדמן',
  'צלם',
  'וידאו',
  'דיג׳יי',
  'מלצרות',
  'אבטחה',
  'חובש',
  'הכוונת חניה',
  'נהג',
] as const;

export const categoryLabel = (v: string) =>
  VENDOR_CATEGORIES.find((c) => c.value === v)?.label ?? v;

/** The same twelve, for a couple reading in English. The producer's console
 *  is Hebrew; the couple's screen is whichever they chose. */
const CATEGORY_EN: Record<string, string> = {
  venue: 'Venue', catering: 'Catering', photo: 'Photography', music: 'Music and DJ',
  floral: 'Design and flowers', light: 'Lighting and sound', rental: 'Equipment hire',
  power: 'Generators and power', sanitation: 'Water and facilities', transport: 'Transport',
  security: 'Security and safety', other: 'Other',
};
export const categoryLabelFor = (v: string, locale: 'he' | 'en') =>
  (locale === 'en' ? CATEGORY_EN[v] : undefined) ?? categoryLabel(v);

/**
 * The checklist's supplier categories, mapped onto the event file's.
 *
 * The standing checklist names what a couple is choosing ('dj', 'flowers',
 * 'photobooth'); the event file groups suppliers the way a producer runs an
 * evening ('music', 'floral', 'photo'). A supplier captured by ticking a task
 * has to land in the second list, and this is the one place the two are
 * joined. Anything unmapped is 'other', which is a real group rather than a
 * refusal. The same table lives in 0069 for the rows copied across.
 */
const CHECKLIST_TO_PRODUCTION: Record<string, string> = {
  venue: 'venue', catering: 'catering', bar: 'catering',
  photography: 'photo', video: 'photo', magnets: 'photo', photobooth: 'photo',
  dj: 'music', sound: 'light', lighting: 'light',
  decor: 'floral', flowers: 'floral', transport: 'transport',
};
export const productionCategoryOf = (checklistKey: string): string =>
  CHECKLIST_TO_PRODUCTION[checklistKey] ?? (VENDOR_CATEGORIES.some((c) => c.value === checklistKey) ? checklistKey : 'other');

export const stateLabel = (v: string) =>
  VENDOR_STATES.find((s) => s.value === v)?.label ?? v;
