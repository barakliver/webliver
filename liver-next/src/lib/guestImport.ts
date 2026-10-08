/* ── Turning somebody's list into guests ───────────────────────────────────
   Two readers, because there are two kinds of list. Everything down to
   `dedupe` reads a spreadsheet; everything after it reads the thing a couple
   actually pastes, which is a chat. `readGuestList` picks between them.

   Pure, and in its own module for two reasons. A 'use server' file may export
   async functions and nothing else, so a parser living beside the action would
   resolve to undefined the moment a component imported it. And the interesting
   part of an importer is its judgement — which line is a header, which run of
   digits is a phone and which is how many of them are coming, what counts as
   the same person twice — which deserves testing without a database attached.
   It said that for a year and was not tested, for the reason below. */

/* Relative and with the extension, not '@/lib/csv': the node tests run this
   file without a bundler, and an alias is a bare specifier to node. One
   import was the whole barrier. */
import { parseCsv, findColumn } from './csv.ts';

export const MAX_GUESTS_IMPORT = 1500;

export type ImportRow = { name: string; side: string; phone: string; party: number };
export type ImportReport = {
  ok: boolean;
  error?: string;
  /** Set when nothing was written: this is the reading, not the result.
   *  Two hundred guests is the one write on this screen that cannot be
   *  undone by hand, and the reading is the only place the split between
   *  name, phone and party size can be checked before it becomes rows. */
  preview?: true;
  /** On a write: how many went in. */
  added?: number;
  /** On a reading: how many would. */
  ready?: number;
  /** The first of them, so somebody can see the lines came apart where they
   *  meant them to. A count is not a check. */
  sample?: ImportRow[];
  /** The names that were set aside as already on the list, for the same
   *  reason: the one way the rule can be wrong costs a guest. */
  repeated?: string[];
  /** Rows skipped, and why. Line numbers are the ones in their file. */
  skipped?: { line: number; reason: string }[];
  duplicates?: number;
};

/** How many rows the preview shows. Enough to see the shape of the split
 *  and few enough that the confirm button is still on the screen under it. */
export const PREVIEW_ROWS = 8;

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
): { fresh: ImportRow[]; duplicates: number; repeated: ImportRow[] } {
  const seenPhone = new Set(existing.map((g) => phoneKey(g.phone ?? '')).filter(Boolean));
  const seenName = new Set(existing.map((g) => g.full_name.trim().toLowerCase()));

  const fresh: ImportRow[] = [];
  /* The ones set aside, and not only how many. The rule has exactly one way
     to be wrong - two people genuinely called the same thing with no phone
     between them - and its cost is a guest who silently never arrives on the
     list. A number cannot be checked and a name can. */
  const repeated: ImportRow[] = [];

  for (const r of rows) {
    const pk = phoneKey(r.phone);
    const nk = r.name.trim().toLowerCase();
    if ((pk && seenPhone.has(pk)) || (!pk && seenName.has(nk))) { repeated.push(r); continue; }
    if (pk) seenPhone.add(pk);
    seenName.add(nk);
    fresh.push(r);
  }

  return { fresh, duplicates: repeated.length, repeated };
}

/* ── A list that was never a table ─────────────────────────────────────────
   Everything above assumes a spreadsheet, and that assumption is right for a
   file and wrong for the thing a couple actually does, which is paste what
   their mother sent on WhatsApp:

       דני כהן 050-1234567
       משפחת לוי 4
       שרה אברהם
       יוסי ומיכל מזרחי - 052 999 8877 - חתן

   Read as a table that is four one-column rows, so every phone and every
   count ended up inside the name. The list imported, nothing was reported as
   skipped, and the couple got four guests called things like "דני כהן
   050-1234567" with no phone on any of them. It is the quietest kind of
   wrong: a screen that says 183 added, and 183 rows that have to be retyped.

   So a line is read rather than split. The phone comes out wherever it sits,
   the count comes off the end, the side comes off the end after it, and
   whatever is left is the name. Nobody is asked to tidy anything first,
   which is the whole point: a couple who can tidy a list into columns did
   not need this field.                                                     */

/** An Israeli number, however somebody wrote it down.
 *
 *  Anchored on the prefix rather than matching any run of digits, because the
 *  thing most likely to sit next to a name on a guest list is a small number
 *  that means how many of them are coming, and a greedy pattern eats it. The
 *  word boundary before the `0` is what keeps it out of the middle of a
 *  longer number: `2050` is not a phone and `01/05/2026` is a date. */
const PHONE_IN_LINE = /(?:\+?972[-.\s]*|\b0)(?:\d[-.\s]*){7,8}\d/;

/** How many of them are coming, taken only off the end of the line.
 *  `+3`, `(3)`, `x3` and `3 איש` cannot be part of a name. A bare trailing
 *  number can be, which is why it is last and capped: a guest list says
 *  "משפחת לוי 4" constantly and never "משפחת לוי 400". */
const PARTY_AT_END =
  /\s*(?:\+\s*(\d{1,2})|[xX\u00D7]\s*(\d{1,2})|\((\d{1,2})\)|(\d{1,2})\s*(?:איש|אנשים|מוזמנים|guests?|ppl|pax)|(\d{1,2}))\s*$/;

/** Which side, where somebody wrote it at the end behind a separator. */
const SIDE_AT_END = /[\s]*[-\u2013,|:]\s*(כלה|חתן|משותף|bride|groom|both|shared)\s*$/i;

/** A bullet, a dash or a numbering that a list carries and a name does not. */
const MARKER_AT_START = /^\s*(?:\d{1,3}[.)]\s+|[-\u2013*\u2022]\s+)/;

/** What is left of a line once the fields have been taken out of it: a name
 *  with the separators that were holding them apart still clinging to it. */
const trimEdges = (s: string) => s.replace(/^[\s\-\u2013,|:]+|[\s\-\u2013,|:]+$/g, '').trim();

/**
 * One pasted line, read as one guest.
 *
 * The order is load-bearing. The phone comes out before the count, because a
 * phone ends in digits and a count is digits at the end: run them the other
 * way round and the last two digits of every number become a party of 67.
 */
export function readGuestLine(raw: string): ImportRow | { reason: string } {
  let rest = (raw ?? '').replace(MARKER_AT_START, '').trim();
  if (rest === '') return { reason: 'שורה ריקה' };

  let phone = '';
  const hit = PHONE_IN_LINE.exec(rest);
  if (hit) {
    const key = phoneKey(hit[0]);
    if (key.startsWith('0') && (key.length === 9 || key.length === 10)) {
      phone = hit[0].trim();
      rest = rest.slice(0, hit.index) + ' ' + rest.slice(hit.index + hit[0].length);
    }
  }

  /* The separator the phone was sitting behind is left dangling once it is
     taken out, and the two patterns below both anchor on the end of the
     line. Without this, "יוסי - 052 999 8877 - חתן" keeps its side inside
     its name whenever somebody wrote the two in the other order. */
  rest = trimEdges(rest);

  let side = '';
  const sideHit = SIDE_AT_END.exec(rest);
  if (sideHit) {
    side = SIDE_WORDS[sideHit[1].toLowerCase()] ?? sideHit[1];
    rest = rest.slice(0, sideHit.index);
  }

  let party = 1;
  const partyHit = PARTY_AT_END.exec(rest);
  if (partyHit) {
    /* A plus means one more than the person named and every other notation
       means how many altogether: "דני +2" is three people and "משפחת לוי (2)"
       is two. That is the literal reading of each, it is the way these lists
       are actually written, and the difference it makes is one person per
       line. It is also the single most likely thing in this whole importer to
       be wrong about somebody's list, which is the reason the preview exists
       and the reason the counts are the first thing it shows. */
    const plus = partyHit[1] !== undefined;
    const n = Number(partyHit[1] ?? partyHit[2] ?? partyHit[3] ?? partyHit[4] ?? partyHit[5]);
    const left = trimEdges(rest.slice(0, partyHit.index));
    /* A number with no name in front of it is not a party of anything, and
       taking it would leave a guest with no name and a reason nobody can
       act on. */
    if (n >= 1 && n <= 20 && left.length >= 2) {
      party = Math.min(plus ? n + 1 : n, 20);
      rest = rest.slice(0, partyHit.index);
    }
  }

  const name = trimEdges(rest);
  if (name.length < 2) {
    return { reason: phone ? 'מספר בלי שם' : name ? 'שם קצר מדי' : 'אין שם' };
  }
  return { name: name.slice(0, 120), side: side.slice(0, 40), phone: phone.slice(0, 40), party };
}

/** The whole paste, one line at a time. Line numbers are the ones somebody
 *  can count down to in the box they pasted into. */
export function readGuestLines(text: string): {
  rows: ImportRow[];
  skipped: { line: number; reason: string }[];
} {
  const rows: ImportRow[] = [];
  const skipped: { line: number; reason: string }[] = [];

  text.replace(/\r\n?/g, '\n').split('\n').forEach((raw, i) => {
    if (raw.trim() === '') return;
    const got = readGuestLine(raw);
    if ('reason' in got) skipped.push({ line: i + 1, reason: got.reason });
    else rows.push(got);
  });

  return { rows, skipped };
}

/**
 * Whichever of the two this text is.
 *
 * A table is recognised by most of its lines having more than one cell in
 * them, which is what a spreadsheet produces and what pasted prose does not.
 * Decided on the text rather than on which box it arrived in, because a
 * couple pastes a spreadsheet into the box as often as they attach it, and
 * saves the WhatsApp list to a file as often as they paste it.
 */
export function readGuestList(text: string): {
  rows: ImportRow[];
  skipped: { line: number; reason: string }[];
} {
  const table = parseCsv(text);
  const wide = table.filter((r) => r.filter((c) => c.trim() !== '').length > 1).length;
  return wide * 2 > table.length ? readGuestCsv(text) : readGuestLines(text);
}
