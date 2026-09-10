/**
 * The arithmetic of keeping two diaries the same.
 *
 * One side is this platform: weddings, dated tasks, dated payments, and the
 * producer's own entries. The other is one Google calendar, created by the
 * platform in the producer's account, that only the platform and the
 * producer's phone write to. This file decides what to write, in which
 * direction, and imports nothing, so the decisions can be tested with a
 * handful of rows and no Google.
 *
 * The rules:
 *   · Every dated row here has one twin there. A twin is found by the link
 *     table, never by title.
 *   · A row whose fingerprint has not changed since its twin was written is
 *     not written again.
 *   · A twin Google reports as cancelled deletes an entry here, and unlinks
 *     (but never deletes) a wedding, a task or a payment: the phone is not
 *     where a wedding gets cancelled.
 *   · A Google event with no twin, on our calendar, becomes an entry here.
 *   · A twin whose date moved on the phone moves the row here.
 */

export type SyncKind = 'event' | 'task' | 'payment' | 'entry';

export type SyncItem = {
  kind: SyncKind;
  id: string;
  title: string;
  /** yyyy-mm-dd in the event zone. */
  date: string;
  /** hh:mm, or empty for an all-day item. */
  time: string;
  durationMin: number;
  /** The second line: the couple's name, the venue, the note. */
  detail: string;
  /** Where a tap on the phone should land. */
  href: string;
};

export type Link = { kind: SyncKind; item_id: string; google_event_id: string; fingerprint: string };

/** Google's event, the fields this cares about. */
export type GEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  updated?: string;
  extendedProperties?: { private?: Record<string, string> };
};

/** What one item looks like once written; a change in any of these is a
 *  write, anything else is not. */
export const fingerprint = (i: SyncItem): string =>
  [i.kind, i.title, i.date, i.time, i.time ? i.durationMin : 0, i.detail].join('');

/* A glyph in front of the title says what kind of thing it is on a phone
   that shows only titles. Not the currency sign for payments: on a Hebrew
   phone a sign beside a number reorders, and the amount is in the detail. */
const PREFIX: Record<SyncKind, string> = { event: '💍 ', task: '☐ ', payment: '💳 ', entry: '' };
const PREFIXES = new RegExp(`^(${Object.values(PREFIX).filter(Boolean).map((p) => p.trim()).join('|')})\\s*`, 'u');

/** yyyy-mm-dd plus n days. */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** hh:mm plus minutes, as [date, hh:mm], rolling over midnight. */
export function addMinutes(date: string, hhmm: string, minutes: number): [string, string] {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const day = Math.floor(total / 1440);
  const rest = total - day * 1440;
  const hh = String(Math.floor(rest / 60)).padStart(2, '0');
  const mm = String(rest % 60).padStart(2, '0');
  return [day > 0 ? addDays(date, day) : date, `${hh}:${mm}`];
}

/** The body Google's events.insert and events.patch take. All-day items
 *  are all-day events (end is the day after, exclusive, as Google counts);
 *  timed ones carry the zone by name so the phone shows them where the
 *  wedding is, whatever zone the phone is in. */
export function toGoogleEvent(i: SyncItem, zone: string, siteUrl: string): Record<string, unknown> {
  const summary = `${PREFIX[i.kind]}${i.title}`.slice(0, 250);
  const description = [i.detail, i.href ? `${siteUrl}${i.href}` : ''].filter(Boolean).join('\n');
  const base = {
    summary,
    description,
    extendedProperties: { private: { liverKind: i.kind, liverId: i.id } },
  };
  if (!i.time) {
    return { ...base, start: { date: i.date }, end: { date: addDays(i.date, 1) } };
  }
  const [endDate, endTime] = addMinutes(i.date, i.time, i.durationMin || 60);
  return {
    ...base,
    start: { dateTime: `${i.date}T${i.time}:00`, timeZone: zone },
    end: { dateTime: `${endDate}T${endTime}:00`, timeZone: zone },
  };
}

/** A Google event read back as the fields an entry here has. The prefix
 *  the platform put on a title is taken off again, so a task renamed on the
 *  phone does not come back with a checkbox in its name. */
export function fromGoogleEvent(ev: GEvent): {
  title: string; date: string; time: string; durationMin: number; note: string; cancelled: boolean;
} {
  const cancelled = ev.status === 'cancelled';
  const raw = (ev.summary ?? '').trim();
  const title = raw.replace(PREFIXES, '').trim();
  let date = '', time = '', durationMin = 60;
  if (ev.start?.date) {
    date = ev.start.date;
  } else if (ev.start?.dateTime) {
    /* The dateTime carries an offset; the calendar date and clock are what
       the string says before the offset, which is the wall time in the
       event's zone when we wrote it and the phone's zone when they did. */
    const m = ev.start.dateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (m) { date = m[1]; time = m[2]; }
    const e = ev.end?.dateTime?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (m && e) {
      const startMin = Number(m[2].slice(0, 2)) * 60 + Number(m[2].slice(3));
      const endMin = Number(e[2].slice(0, 2)) * 60 + Number(e[2].slice(3));
      const days = Math.round((new Date(`${e[1]}T00:00:00Z`).getTime() - new Date(`${m[1]}T00:00:00Z`).getTime()) / 86_400_000);
      durationMin = Math.max(5, Math.min(1440, days * 1440 + endMin - startMin));
    }
  }
  /* The description is ours on the way out (detail plus a link) and theirs
     on the way in; a link we wrote is not a note they typed. */
  const note = (ev.description ?? '').split('\n').filter((l) => !/^https?:\/\//.test(l.trim())).join('\n').trim();
  return { title, date, time, durationMin, note, cancelled };
}

export type Plan = {
  /** Items with no twin yet. */
  create: SyncItem[];
  /** Items whose twin is stale, with the twin's id. */
  update: { item: SyncItem; eventId: string }[];
  /** Twins whose item is gone. */
  remove: Link[];
};

/** Push direction: what to write to Google so it matches here. */
export function plan(items: SyncItem[], links: Link[]): Plan {
  const byKey = new Map(links.map((l) => [`${l.kind}:${l.item_id}`, l]));
  const seen = new Set<string>();
  const out: Plan = { create: [], update: [], remove: [] };
  for (const i of items) {
    const key = `${i.kind}:${i.id}`;
    seen.add(key);
    const link = byKey.get(key);
    if (!link) out.create.push(i);
    else if (link.fingerprint !== fingerprint(i)) out.update.push({ item: i, eventId: link.google_event_id });
  }
  for (const l of links) if (!seen.has(`${l.kind}:${l.item_id}`)) out.remove.push(l);
  return out;
}

export type Pull =
  | { action: 'entry-upsert'; entryId: string | null; title: string; date: string; time: string; durationMin: number; note: string; eventId: string }
  | { action: 'entry-delete'; entryId: string; eventId: string }
  | { action: 'move'; kind: Exclude<SyncKind, 'entry'>; itemId: string; date: string; eventId: string }
  | { action: 'unlink'; kind: SyncKind; itemId: string; eventId: string }
  | { action: 'ignore'; eventId: string };

/** Pull direction: what one changed Google event means for the rows here.
 *  `linkOf` finds the twin by Google's id; `dateOf` is the row's current
 *  date, so a title edit on the phone does not count as a move. */
export function interpret(ev: GEvent, linkOf: (googleId: string) => Link | null, dateOf: (l: Link) => string | null): Pull {
  const link = linkOf(ev.id);
  const read = fromGoogleEvent(ev);

  if (!link) {
    /* Not ours yet. A cancelled stranger is nothing; a live one becomes an
       entry. One we ourselves wrote a moment ago (the private property says
       so) but have not linked yet is also nothing: the link is on its way. */
    if (read.cancelled || !read.date || !read.title) return { action: 'ignore', eventId: ev.id };
    if (ev.extendedProperties?.private?.liverId) return { action: 'ignore', eventId: ev.id };
    return { action: 'entry-upsert', entryId: null, ...read, eventId: ev.id };
  }

  if (link.kind === 'entry') {
    if (read.cancelled) return { action: 'entry-delete', entryId: link.item_id, eventId: ev.id };
    if (!read.date || !read.title) return { action: 'ignore', eventId: ev.id };
    return { action: 'entry-upsert', entryId: link.item_id, ...read, eventId: ev.id };
  }

  /* A wedding, a task or a payment: the phone may move it and nothing else.
     Cancelling it on the phone only lets go of the twin; the row stays. */
  if (read.cancelled) return { action: 'unlink', kind: link.kind, itemId: link.item_id, eventId: ev.id };
  const current = dateOf(link);
  if (read.date && current && read.date !== current) {
    return { action: 'move', kind: link.kind, itemId: link.item_id, date: read.date, eventId: ev.id };
  }
  return { action: 'ignore', eventId: ev.id };
}
