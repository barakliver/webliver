'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { VENDOR_CATEGORIES } from '@/content/production';

/** One supplier as the browser parsed it out of the sheet. Every field is
 *  text or absent; the numbers are read here, once, under one rule. */
export type ImportRow = {
  name: string;
  category?: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  area?: string;
  notes?: string;
  agreed_price?: string;
  deposit_paid?: string;
};

export type ImportResult = {
  ok: boolean; error?: string;
  added: number; updated: number; skipped: number;
};

const MAX_ROWS = 500;
const CATEGORY_KEYS = new Set<string>(VENDOR_CATEGORIES.map((c) => c.value));

/** A shekel figure as people type it into a sheet: with a currency sign, with
 *  thousands separators, sometimes with the word "ש״ח". Anything that is not
 *  a number once those are stripped is left empty rather than guessed. */
function money(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** The category as a key. The sheet may say the Hebrew label, the key
 *  itself, or something near either; a miss is "other" rather than a
 *  refusal, because the florist matters more than her shelf. */
function category(raw: string | undefined): string {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v) return 'other';
  if (CATEGORY_KEYS.has(v)) return v;
  const hit = VENDOR_CATEGORIES.find((c) => c.label === v || v.includes(c.label) || c.label.includes(v));
  return hit?.value ?? 'other';
}

const clean = (v: string | undefined, max: number) => String(v ?? '').trim().slice(0, max);

/**
 * The producer's spreadsheet, brought into the directory whole.
 *
 * Matched on the name, folded the way the unique index folds it: a supplier
 * already in the book is updated with whatever the sheet says about them,
 * and only with what it says, so a blank cell never erases a phone number
 * somebody typed in by hand last year. A supplier not in the book is added.
 *
 * Two round trips, however many rows: one read of the names, one insert.
 * Updates go one by one because each touches a different row, and five
 * hundred is the ceiling, which is more suppliers than any one producer has.
 */
export async function importVendors(rows: ImportRow[]): Promise<ImportResult> {
  const nothing = { added: 0, updated: 0, skipped: 0 };
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'אין מרחב הפקה משויך לחשבון', ...nothing };
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: 'לא נמצאו שורות לייבוא', ...nothing };

  const producerId = account.producer.id;
  const sb = await supabaseServer();

  const { data: existing, error: readErr } = await sb
    .from('vendors')
    .select('id,name')
    .eq('producer_id', producerId);
  if (readErr) {
    console.error('[vendors] import read failed', readErr);
    return { ok: false, error: 'לא הצלחנו לקרוא את הספקים הקיימים', ...nothing };
  }

  const fold = (s: string) => s.trim().toLowerCase();
  const byName = new Map((existing ?? []).map((v) => [fold(v.name), v.id]));

  const inserts: Record<string, unknown>[] = [];
  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  let skipped = 0;
  const seen = new Set<string>();

  for (const raw of rows.slice(0, MAX_ROWS)) {
    const name = clean(raw?.name, 120);
    if (name.length < 2) { skipped += 1; continue; }
    const key = fold(name);
    /* The same name twice in one sheet is one supplier; the second row would
       only fight the first for the unique index. */
    if (seen.has(key)) { skipped += 1; continue; }
    seen.add(key);

    const fields: Record<string, unknown> = {
      category: category(raw.category),
      contact_name: clean(raw.contact_name, 120),
      phone: clean(raw.phone, 40),
      email: clean(raw.email, 160).toLowerCase(),
      area: clean(raw.area, 80),
      notes: clean(raw.notes, 1000),
      agreed_price: money(raw.agreed_price),
      deposit_paid: money(raw.deposit_paid),
    };

    const id = byName.get(key);
    if (id) {
      /* Only what the sheet actually says. An empty cell is silence, not an
         instruction to erase. */
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v === null || v === '') continue;
        if (k === 'category' && !raw.category) continue;
        patch[k] = v;
      }
      if (Object.keys(patch).length > 0) updates.push({ id, patch });
      else skipped += 1;
    } else {
      inserts.push({ producer_id: producerId, name, ...fields });
    }
  }

  let added = 0;
  if (inserts.length > 0) {
    const { error, data } = await sb.from('vendors').insert(inserts).select('id');
    if (error) {
      console.error('[vendors] import insert failed', error);
      return { ok: false, error: 'הייבוא נכשל באמצע. נסו שוב.', added: 0, updated: 0, skipped };
    }
    added = data?.length ?? inserts.length;
  }

  let updated = 0;
  for (const u of updates) {
    const { error } = await sb.from('vendors').update(u.patch).eq('id', u.id);
    if (error) { console.error('[vendors] import update failed', error); skipped += 1; }
    else updated += 1;
  }

  revalidatePath('/app/vendors');
  return { ok: true, added, updated, skipped };
}
