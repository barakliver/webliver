import { site, type SiteCopy } from './site.ts';

/**
 * Which sentences on the public site can be changed without a deploy.
 *
 * An explicit list rather than "anything in the copy object". A free-form key
 * would let a typo write a value nothing ever reads and look like it worked,
 * and the person typing would find out weeks later that the sentence they
 * changed is still the old one. Everything offered here is rendered by
 * something; nothing rendered by a component that has not been wired up is
 * offered.
 *
 * The default for every field is read from the shipped copy rather than
 * repeated, so the editor cannot drift from what the site actually says when
 * nothing is overridden.
 */

export type FieldKind = 'line' | 'paragraphs';

export type EditableField = {
  /** A dotted path into the copy object. Mirrors site_content.key. */
  key: string;
  label: string;
  kind: FieldKind;
  /** Shown under the field when the wording needs a word of explanation. */
  hint?: string;
};

export type EditableGroup = {
  id: string;
  title: string;
  sub: string;
  fields: EditableField[];
};

export const EDITABLE: EditableGroup[] = [
  {
    id: 'hero',
    title: 'הפתיחה',
    sub: 'מה שרואים בשנייה הראשונה, לפני שגוללים.',
    fields: [
      { key: 'hero.eyebrow',  label: 'שורה עליונה', kind: 'line' },
      { key: 'hero.headline', label: 'כותרת ראשית', kind: 'line' },
      { key: 'hero.name',     label: 'שם', kind: 'line' },
      { key: 'hero.body',     label: 'טקסט הפתיחה', kind: 'paragraphs', hint: 'כל שורה כאן היא פסקה נפרדת באתר.' },
      { key: 'hero.cta',      label: 'כפתור', kind: 'line' },
    ],
  },
  {
    id: 'begin',
    title: 'מאיפה מתחילים',
    sub: 'שלושת הצעדים שמוצגים מיד אחרי הפתיחה. הסדר קבוע, המילים שלך.',
    fields: [
      { key: 'begin.title',         label: 'כותרת', kind: 'line' },
      { key: 'begin.steps.0.title', label: 'צעד 1', kind: 'line' },
      { key: 'begin.steps.0.body',  label: 'צעד 1, שורת הסבר', kind: 'line' },
      { key: 'begin.steps.1.title', label: 'צעד 2', kind: 'line' },
      { key: 'begin.steps.1.body',  label: 'צעד 2, שורת הסבר', kind: 'line' },
      { key: 'begin.steps.2.title', label: 'צעד 3', kind: 'line' },
      { key: 'begin.steps.2.body',  label: 'צעד 3, שורת הסבר', kind: 'line' },
    ],
  },
  {
    id: 'philosophy',
    title: 'הגישה',
    sub: 'למה עובדים ככה, ולא איך.',
    fields: [
      { key: 'philosophy.title', label: 'כותרת', kind: 'line' },
      { key: 'philosophy.body',  label: 'טקסט', kind: 'paragraphs' },
      { key: 'value.title',      label: 'כותרת הפרק הבא', kind: 'line' },
      { key: 'value.body',       label: 'טקסט', kind: 'paragraphs' },
    ],
  },
  {
    id: 'journey',
    title: 'התהליך',
    sub: 'השלבים מהפנייה ועד האירוע.',
    fields: [
      { key: 'journey.title', label: 'כותרת', kind: 'line' },
      { key: 'journey.steps', label: 'השלבים', kind: 'paragraphs', hint: 'כל שורה היא שלב. הסדר הוא הסדר שמופיע באתר.' },
      { key: 'journey.link',  label: 'קישור בסוף', kind: 'line' },
    ],
  },
  {
    id: 'about',
    title: 'על המפיק',
    sub: 'מי עומד מאחורי ההפקה.',
    fields: [
      { key: 'about.title', label: 'כותרת', kind: 'line' },
      { key: 'about.body',  label: 'טקסט', kind: 'paragraphs' },
      { key: 'dayOf.title', label: 'כותרת "ביום החתונה"', kind: 'line' },
      { key: 'dayOf.body',  label: 'טקסט', kind: 'paragraphs' },
    ],
  },
  {
    id: 'work',
    title: 'עבודות',
    sub: 'הכותרת מעל גלריית התמונות.',
    fields: [
      { key: 'work.title', label: 'כותרת', kind: 'line' },
      { key: 'work.sub',   label: 'תת כותרת', kind: 'line' },
    ],
  },
  {
    id: 'budget',
    title: 'מחשבון התקציב',
    sub: 'הכותרות סביב המחשבון. המספרים עצמם לא נערכים כאן.',
    fields: [
      { key: 'budget.title',   label: 'כותרת', kind: 'line' },
      { key: 'budget.sub',     label: 'תת כותרת', kind: 'line' },
      { key: 'budget.closing', label: 'שורת סיום', kind: 'line' },
    ],
  },
  {
    id: 'academy',
    title: 'הקורס',
    sub: 'למי שרוצה לתכנן לבד.',
    fields: [
      { key: 'academy.title', label: 'כותרת', kind: 'line' },
      { key: 'academy.body',  label: 'טקסט', kind: 'paragraphs' },
      { key: 'academy.cta',   label: 'כפתור', kind: 'line' },
    ],
  },
  {
    id: 'closing',
    title: 'הסיום ויצירת קשר',
    sub: 'הפסקה האחרונה והטופס.',
    fields: [
      { key: 'closing.title', label: 'כותרת', kind: 'line' },
      { key: 'closing.body',  label: 'טקסט', kind: 'paragraphs' },
      { key: 'closing.cta',   label: 'כפתור', kind: 'line' },
      { key: 'lead.title',    label: 'כותרת הטופס', kind: 'line' },
      { key: 'lead.sub',      label: 'תת כותרת הטופס', kind: 'line' },
      { key: 'footer',        label: 'שורת התחתית', kind: 'line' },
    ],
  },
];

/** Every editable key, for the server action to check a key against before it
 *  writes one. A key that is not offered here is not written. */
export const EDITABLE_KEYS = new Map<string, EditableField>(
  EDITABLE.flatMap((g) => g.fields.map((f) => [f.key, f] as const))
);

/** The shipped value at a dotted path, as text. Paragraph fields become one
 *  line per paragraph, which is the shape the textarea edits and the shape the
 *  database stores. */
export function defaultAt(key: string): string {
  const raw = key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    site as unknown as SiteCopy
  );
  if (Array.isArray(raw)) return raw.join('\n');
  return typeof raw === 'string' ? raw : '';
}
