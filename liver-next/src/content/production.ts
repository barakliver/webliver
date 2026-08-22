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

export const stateLabel = (v: string) =>
  VENDOR_STATES.find((s) => s.value === v)?.label ?? v;
