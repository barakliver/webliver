'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { DIETS } from '@/content/lists';
import { readGuestCsv, dedupe, MAX_GUESTS_IMPORT, type ImportReport } from '@/lib/guestImport';

export type GuestResult = { ok: boolean; error?: string; added?: number };

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
}

/** Guests arrive by the handful, not one at a time, so the form takes a
 *  pasted list: one guest per line, optionally "name, side, phone". */
export async function addGuests(_prev: GuestResult | null, form: FormData): Promise<GuestResult> {
  const clientId = String(form.get('client_id') ?? '');
  const bulk = String(form.get('names') ?? '');
  const side = String(form.get('side') ?? '').trim();

  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const rows = bulk
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, lineSide, phone] = line.split(',').map((p) => (p ?? '').trim());
      return {
        client_id: clientId,
        full_name: name,
        side: lineSide || side,
        phone: phone || '',
      };
    })
    .filter((r) => r.full_name.length >= 2);

  if (rows.length === 0) return { ok: false, error: 'נא לכתוב לפחות שם אחד' };
  if (rows.length > 300) return { ok: false, error: 'עד 300 אורחים בבת אחת' };

  const sb = await supabaseServer();
  const { error } = await sb.from('guests_rsvp').insert(rows);
  if (error) return { ok: false, error: 'לא הצלחנו לשמור את האורחים' };

  touch(clientId);
  return { ok: true, added: rows.length };
}

export async function deleteGuest(form: FormData): Promise<void> {
  const id = String(form.get('guest_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('guests_rsvp').delete().eq('id', id);
  touch(clientId);
}

/** Recording a reply that came in by phone. The guest's own link writes
 *  through the token function instead, which is the only path open to
 *  somebody without an account. */
export async function setGuestStatus(form: FormData): Promise<void> {
  const id = String(form.get('guest_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const status = String(form.get('status') ?? '');
  if (!id || !['pending', 'attending', 'declined'].includes(status)) return;

  const sb = await supabaseServer();
  await sb
    .from('guests_rsvp')
    .update({
      status,
      party_size: status === 'declined' ? 0 : 1,
      responded_at: status === 'pending' ? null : new Date().toISOString(),
    })
    .eq('id', id);
  touch(clientId);
}

/* ── Importing a list somebody already has ─────────────────────────────────
   Nobody types four hundred names into a web form. They have a spreadsheet,
   and the job is to accept it as it is rather than asking them to reshape it
   first. Columns are found by name in either language, a file with no header
   is read positionally, and every row that cannot be used is reported with its
   line number instead of being dropped in silence.                          */

export async function importGuests(_prev: ImportReport | null, form: FormData): Promise<ImportReport> {
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const file = form.get('file');
  const pasted = String(form.get('text') ?? '');
  const text = file instanceof File && file.size > 0 ? await file.text() : pasted;
  if (!text.trim()) return { ok: false, error: 'נא לבחור קובץ או להדביק רשימה' };
  if (text.length > 2_000_000) return { ok: false, error: 'הקובץ גדול מדי' };

  const { rows, skipped } = readGuestCsv(text);
  if (rows.length === 0) {
    return { ok: false, error: 'לא נמצאו שורות עם שם', skipped };
  }
  if (rows.length > MAX_GUESTS_IMPORT) return { ok: false, error: `${MAX_GUESTS_IMPORT} אורחים לכל היותר בייבוא אחד` };

  const sb = await supabaseServer();

  /* Importing the same file twice is a normal accident — a spreadsheet gets
     re-sent with four names added. Matching on phone first and name second
     means the second run adds the four and leaves the rest alone, instead of
     doubling a four-hundred-person list. */
  /* Importing the same file twice is a normal accident — a spreadsheet gets
     re-sent with four names added. The right outcome is four new guests, not
     a doubled list. */
  const { data: existing } = await sb
    .from('guests_rsvp').select('full_name,phone').eq('client_id', clientId);
  const { fresh, duplicates } = dedupe(rows, existing ?? []);

  if (fresh.length === 0) {
    return { ok: true, added: 0, duplicates, skipped };
  }

  const { error } = await sb.from('guests_rsvp').insert(
    fresh.map((r) => ({
      client_id: clientId,
      full_name: r.name,
      side: r.side,
      phone: r.phone,
      party_size: r.party,
    }))
  );
  if (error) return { ok: false, error: 'לא הצלחנו לשמור את הרשימה', skipped };

  touch(clientId);
  return { ok: true, added: fresh.length, duplicates, skipped };
}
