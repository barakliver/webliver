/* ── Turning somebody's spreadsheet into guests ────────────────────────────
   Pure, and in its own module for two reasons. A 'use server' file may export
   async functions and nothing else, so a parser living beside the action would
   resolve to undefined the moment a component imported it. And the interesting
   part of an importer is its judgement — which line is a header, what counts as
   the same person twice — which deserves testing without a database attached. */

import { parseCsv, findColumn } from '@/lib/csv';

export const MAX_GUESTS_IMPORT = 1500;

export type ImportRow = { name: string; side: string; phone: string; party: number };
export type ImportReport = {
  ok: boolean;
  error?: string;
  added?: number;
  /** Rows skipped, and why. Line numbers are the ones in their file. */
  skipped?: { line: number; reason: string }[];
  duplicates?: number;
};

const SIDE_WORDS: Record<string, string> = {
  'כלה': 'כלה', 'bride': 'כלה', 'חתן': 'חתן', 'groom': 'חתן',
  'משותף': 'משותף', 'both': 'משותף', 'shared': 'משותף',
};

/** Israeli numbers arrive as 050-111-1111, +972 50 111 1111 or 0501111111.
 *  Comparing them needs one shape; storing them keeps whatever was typed, so
 *  the producer still recognises their own list. */
export function phoneKey(raw: string): string {
  const d = (raw ?? '').replace(/\D/g, '');
  if (d.startsWith('972')) return '0' + d.slice(3);
  return d;
}

/**
 * Reads a guest list out of whatever the spreadsheet produced.
 *
 * Columns are found by name in either language, so a file headed "Full Name,
 * Phone" and one headed "שם מלא, טלפון" both work without anybody reshaping
 * them first. A file with no recognisable header is read positionally rather
 * than having its first line eaten — that line is somebody's first guest.
 *
 * Unusable rows are reported with the line number from their own file, so the
 * answer to "why are there 398 and not 400" is two line numbers rather than a
 * search.
 */
export function readGuestCsv(text: string): {
  rows: ImportRow[];
  skipped: { line: number; reason: string }[];
} {
  const table = parseCsv(text);
  const skipped: { line: number; reason: string }[] = [];
  if (table.length === 0) return { rows: [], skipped };

  const header = table[0];
  const nameCol = findColumn(header, ['full name', 'name', 'שם', 'שם מלא', 'guest', 'אורח']);
  const hasHeader = nameCol !== -1;

  const idx = hasHeader
    ? {
        name: nameCol,
        side: findColumn(header, ['side', 'צד', 'שיוך']),
        phone: findColumn(header, ['phone', 'טלפון', 'mobile', 'נייד']),
        party: findColumn(header, ['party', 'party size', 'כמות', 'מוזמנים', 'אורחים']),
      }
    : { name: 0, side: 1, phone: 2, party: 3 };

  const body = hasHeader ? table.slice(1) : table;
  const rows: ImportRow[] = [];

  body.forEach((r, i) => {
    const line = i + (hasHeader ? 2 : 1);
    const at = (n: number) => (n >= 0 && n < r.length ? r[n] : '');
    const name = at(idx.name);

    if (name.length < 2) {
      skipped.push({ line, reason: name ? 'שם קצר מדי' : 'אין שם' });
      return;
    }

    const partyRaw = Number(at(idx.party));
    rows.push({
      name: name.slice(0, 120),
      side: SIDE_WORDS[at(idx.side).toLowerCase()] ?? at(idx.side).slice(0, 40),
      phone: at(idx.phone).slice(0, 40),
      party: Number.isFinite(partyRaw) && partyRaw > 0 ? Math.min(Math.round(partyRaw), 20) : 1,
    });
  });

  return { rows, skipped };
}

/**
 * Which of these guests are already on the list.
 *
 * Re-sending a spreadsheet with four names added is a normal accident, and the
 * wrong answer to it is a four-hundred-person list that becomes eight hundred.
 * Phone is the identity where there is one, because two cousins genuinely
 * called the same thing are two guests; where there is no phone, the name has
 * to do.
 */
export function dedupe(
  rows: ImportRow[],
  existing: { full_name: string; phone: string | null }[]
): { fresh: ImportRow[]; duplicates: number } {
  const seenPhone = new Set(existing.map((g) => phoneKey(g.phone ?? '')).filter(Boolean));
  const seenName = new Set(existing.map((g) => g.full_name.trim().toLowerCase()));

  const fresh: ImportRow[] = [];
  let duplicates = 0;

  for (const r of rows) {
    const pk = phoneKey(r.phone);
    const nk = r.name.trim().toLowerCase();
    if ((pk && seenPhone.has(pk)) || (!pk && seenName.has(nk))) { duplicates++; continue; }
    if (pk) seenPhone.add(pk);
    seenName.add(nk);
    fresh.push(r);
  }

  return { fresh, duplicates };
}
