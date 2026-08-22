/**
 * Guest list parsing.
 *
 * Kept out of the `'use server'` action module for two reasons: a Server Action
 * file may only export async functions, and pure parsers are far easier to test
 * on their own.
 */

import { z } from 'zod';

export const mealPreferenceSchema = z.enum([
  'regular',
  'vegan',
  'vegetarian',
  'gluten_free',
  'kosher',
  'child',
]);
export const guestSideSchema = z.enum(['partner_a', 'partner_b', 'shared']);

export const guestInputSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  side: guestSideSchema.default('shared'),
  party_size: z.coerce.number().int().min(0).max(20).default(1),
  meal_preference: mealPreferenceSchema.default('regular'),
  allergies: z.string().trim().max(200).optional().or(z.literal('')),
});

export type GuestInput = z.infer<typeof guestInputSchema>;
export type GuestField = keyof typeof guestInputSchema.shape;

/** Column aliases, Hebrew and English, as they actually appear in exported guest lists. */
const CSV_HEADERS: Record<string, GuestField> = {
  name: 'full_name',
  'full name': 'full_name',
  fullname: 'full_name',
  שם: 'full_name',
  'שם מלא': 'full_name',
  email: 'email',
  mail: 'email',
  מייל: 'email',
  אימייל: 'email',
  'דוא"ל': 'email',
  phone: 'phone',
  mobile: 'phone',
  טלפון: 'phone',
  נייד: 'phone',
  side: 'side',
  צד: 'side',
  guests: 'party_size',
  'party size': 'party_size',
  quantity: 'party_size',
  כמות: 'party_size',
  'מספר אורחים': 'party_size',
  meal: 'meal_preference',
  'meal preference': 'meal_preference',
  מנה: 'meal_preference',
  'העדפת מנה': 'meal_preference',
  allergies: 'allergies',
  אלרגיות: 'allergies',
  הערות: 'allergies',
};

const MEAL_ALIASES: Record<string, GuestInput['meal_preference']> = {
  vegan: 'vegan',
  טבעוני: 'vegan',
  טבעונית: 'vegan',
  vegetarian: 'vegetarian',
  צמחוני: 'vegetarian',
  צמחונית: 'vegetarian',
  'gluten free': 'gluten_free',
  gluten_free: 'gluten_free',
  'ללא גלוטן': 'gluten_free',
  kosher: 'kosher',
  כשר: 'kosher',
  child: 'child',
  kids: 'child',
  ילד: 'child',
  ילדים: 'child',
  regular: 'regular',
  רגיל: 'regular',
};

const SIDE_ALIASES: Record<string, GuestInput['side']> = {
  a: 'partner_a',
  partner_a: 'partner_a',
  bride: 'partner_a',
  כלה: 'partner_a',
  b: 'partner_b',
  partner_b: 'partner_b',
  groom: 'partner_b',
  חתן: 'partner_b',
  shared: 'shared',
  both: 'shared',
  משותף: 'shared',
};

/**
 * Minimal RFC 4180 parser: quoted fields, doubled quotes as an escape, and
 * CRLF or LF line endings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export interface GuestCsvResult {
  rows: GuestInput[];
  /** Human-readable reasons, so a bad row is reported rather than dropped silently. */
  skipped: string[];
}

export function parseGuestCsv(csv: string): GuestCsvResult {
  // Strip a UTF-8 BOM, which Excel writes on every Hebrew export.
  const table = parseCsv(csv.replace(/^﻿/, ''));
  const skipped: string[] = [];
  if (table.length === 0) return { rows: [], skipped };

  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const mapped = header.map((h) => CSV_HEADERS[h]);
  const hasHeader = mapped.some(Boolean);
  // With no recognizable header, treat the first column as the name.
  const columns: (GuestField | undefined)[] = hasHeader ? mapped : ['full_name'];
  const body = hasHeader ? table.slice(1) : table;

  const rows: GuestInput[] = [];

  body.forEach((cells, index) => {
    const lineNumber = index + (hasHeader ? 2 : 1);
    const record: Record<string, string> = {};

    columns.forEach((key, col) => {
      if (!key) return;
      record[key] = (cells[col] ?? '').trim();
    });

    if (!record.full_name) {
      skipped.push(`Row ${lineNumber}: missing a name`);
      return;
    }
    if (record.meal_preference) {
      record.meal_preference = MEAL_ALIASES[record.meal_preference.toLowerCase()] ?? 'regular';
    }
    if (record.side) {
      record.side = SIDE_ALIASES[record.side.toLowerCase()] ?? 'shared';
    }
    // A malformed address should not cost us the guest.
    if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
      record.email = '';
    }
    if (record.party_size && !/^\d+$/.test(record.party_size)) {
      record.party_size = '1';
    }

    const parsed = guestInputSchema.safeParse(record);
    if (!parsed.success) {
      skipped.push(`Row ${lineNumber}: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
      return;
    }
    rows.push(parsed.data);
  });

  return { rows, skipped };
}
