/* ── Reading and writing the files people actually have ───────────────────
   A guest list arrives as whatever Excel or Google Sheets produced, which is
   rarely the tidy comma-separated text a naive split expects:

   - Excel on Windows writes UTF-8 with a byte order mark. Left in place it
     becomes part of the first header, so a column called "שם" is not found and
     every name lands in the wrong field.
   - Hebrew Excel commonly delimits with a semicolon or a tab, because the
     comma is the decimal separator in several locales it ships for.
   - A name with a comma in it — "כהן, משפחת" — is quoted, and a parser that
     splits on commas turns one guest into two, both of them wrong.
   - Sheets exported from Windows end lines with CRLF, leaving a stray return
     on the last field of every row.

   None of this is exotic; it is what the first file a real person uploads
   looks like. So this is a small parser rather than a split.                */

/** One row of cells. */
export type Row = string[];

const BOM = '﻿';

/** Guesses the delimiter from the header line by counting candidates outside
 *  quotes. Comma wins ties, being the common case. */
export function sniffDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'));
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = 0;
  for (const d of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

/**
 * Parses delimited text into rows of cells.
 *
 * Follows the quoting rule everything from Excel to Sheets agrees on: a field
 * may be wrapped in double quotes, inside which delimiters and newlines are
 * literal, and a doubled quote is one quote character. Blank lines are dropped
 * — a trailing newline is universal and an empty guest is not a guest.
 */
export function parseCsv(input: string, delimiter?: string): Row[] {
  let text = input.startsWith(BOM) ? input.slice(1) : input;
  text = text.replace(/\r\n?/g, '\n');
  const d = delimiter ?? sniffDelimiter(text);

  const rows: Row[] = [];
  let row: Row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === d) { row.push(field); field = ''; continue; }
    if (ch === '\n') {
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }

  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);

  return rows.map((r) => r.map((c) => c.trim()));
}

/**
 * Builds a CSV file that Excel opens correctly in Hebrew.
 *
 * The byte order mark is not decoration. Without it Excel reads a UTF-8 file
 * as the system codepage and every Hebrew name comes out as mojibake — the
 * single most common way an export "does not work", and it looks like the
 * app's fault rather than the spreadsheet's. Everything else opens a file with
 * a BOM without complaint, so it costs nothing.
 */
export function toCsv(rows: Row[]): string {
  const cell = (v: string) =>
    /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  return BOM + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** Matches a header cell against a set of names in either language, ignoring
 *  case, spacing and punctuation, so "Full Name", "full_name" and "שם מלא"
 *  all find the same column. */
export function findColumn(header: Row, names: string[]): number {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-."']/g, '');
  const wanted = names.map(norm);
  return header.findIndex((h) => wanted.includes(norm(h)));
}
