/* Relative, with the extension, for the same reason lib/ai/meeting.ts is:
   the test runner has no bundler, and this file has to be testable without
   one. */
import {
  FIELD_KINDS, meetingTemplate, type Field, type FieldKind, type MeetingTemplate, type Section,
} from '../content/meetings.ts';

/**
 * A producer's own meeting form, read from the database and made safe.
 *
 * `sections` is a jsonb column, and a jsonb column is attacker controlled in
 * the only sense that matters here: it was posted from a browser once, and
 * whatever landed is what every screen that renders it will get. So the row
 * is not trusted to be the shape the type says. Every section, every field
 * and every option is walked and coerced, and a field with no label or an
 * unknown kind is dropped rather than drawn as an empty box.
 *
 * Ids are the part that has to survive: a log's answers are keyed by them,
 * and a field whose id changed between two saves is a question whose old
 * answers vanished. A field arrives with the id the builder gave it; one that
 * arrives without is given one from its position, which is stable as long as
 * nothing is reordered — the best that can be done for a row somebody wrote
 * by hand.
 */

export type MeetingTemplateRow = {
  id: string;
  name: string;
  when_text: string;
  offset_days: number | null;
  blurb: string;
  sections: unknown;
  archived_at: string | null;
};

const ID_RE = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_SECTIONS = 40;
const MAX_FIELDS = 40;
const MAX_OPTIONS = 20;

const text = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);

/** One field, or nothing. Exported for the builder, which cleans what it is
 *  about to save with the same rule the reader applies, so a template never
 *  looks different after a round trip than it did in the editor. */
export function readField(raw: unknown, fallbackId: string): Field | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const label = text(o.label, 120);
  if (!label) return null;

  const kind = (FIELD_KINDS as readonly string[]).includes(String(o.kind))
    ? (String(o.kind) as FieldKind) : 'text';

  const rawId = text(o.id, 40);
  const id = ID_RE.test(rawId) ? rawId : fallbackId;

  const field: Field = { id, label, kind };

  const hint = text(o.hint, 200);
  if (hint) field.hint = hint;

  if (kind === 'choice') {
    const options = (Array.isArray(o.options) ? o.options : [])
      .map((x) => text(x, 80))
      .filter((x, i, all) => x !== '' && all.indexOf(x) === i)
      .slice(0, MAX_OPTIONS);
    /* A choice with nothing to choose is a text field that lies about
       itself. Downgraded rather than dropped: the label is still a question. */
    if (options.length === 0) return { ...field, kind: 'text' };
    field.options = options;
  }
  return field;
}

/** The sections, in order, with every field cleaned and ids kept unique
 *  across the whole template. Two fields with one id would share an answer. */
export function readSections(raw: unknown): Section[] {
  if (!Array.isArray(raw)) return [];
  const used = new Set<string>();
  const out: Section[] = [];

  raw.slice(0, MAX_SECTIONS).forEach((s, si) => {
    if (typeof s !== 'object' || s === null) return;
    const o = s as Record<string, unknown>;
    const title = text(o.title, 80);
    const fields: Field[] = [];

    (Array.isArray(o.fields) ? o.fields : []).slice(0, MAX_FIELDS).forEach((f, fi) => {
      const field = readField(f, `s${si + 1}q${fi + 1}`);
      if (!field) return;
      if (used.has(field.id)) field.id = `s${si + 1}q${fi + 1}_${used.size}`;
      used.add(field.id);
      fields.push(field);
    });

    if (fields.length === 0) return;
    out.push({ title, fields });
  });

  return out;
}

/** A row as the drawer wants it: the same shape as a compiled-in template,
 *  with the row's id on it so a log can point back. */
export function templateFromRow(row: MeetingTemplateRow): MeetingTemplate {
  return {
    kind: 'custom',
    id: row.id,
    title: text(row.name, 120) || '·',
    when: text(row.when_text, 120),
    offsetDays: typeof row.offset_days === 'number' && Number.isFinite(row.offset_days)
      ? row.offset_days : null,
    blurb: text(row.blurb, 400),
    sections: readSections(row.sections),
    archived: row.archived_at !== null,
  };
}

/**
 * Which template a log was written from.
 *
 * The compiled-in kinds resolve by kind; a custom one resolves by the pointer
 * the log carries, against the producer's own list — which includes the
 * archived ones, because an archived template is exactly one that still has
 * logs pointing at it. Nothing found means the log is shown as a summary
 * with no form, which is the honest thing: the answers are there, the
 * questions are not.
 */
export function templateOf(
  log: { kind: string; template_id?: string | null },
  own: readonly MeetingTemplate[],
): MeetingTemplate | undefined {
  if (log.kind === 'custom') {
    if (!log.template_id) return undefined;
    return own.find((t) => t.id === log.template_id);
  }
  return meetingTemplate(log.kind);
}

/** How many questions a template asks, for the line under its name. */
export const questionCount = (t: MeetingTemplate): number =>
  t.sections.reduce((n, s) => n + s.fields.length, 0);
