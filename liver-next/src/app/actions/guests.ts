'use server';

import { whyNotSaved } from '@/lib/writeFailure';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { DIETS } from '@/content/lists';
import {
  readGuestList, dedupe, MAX_GUESTS_IMPORT, PREVIEW_ROWS,
  type ImportReport, type ImportRow,
} from '@/lib/guestImport';
import { noteFailure } from '@/lib/flash';

export type GuestResult = {
  ok: boolean; error?: string; added?: number;
  /** Lines that carried no usable name. Reported rather than dropped: the
   *  answer to "why are there eleven and not twelve" has to be on the screen
   *  that added them. */
  skipped?: number;
};

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
}

/**
 * Guests arrive by the handful, not one at a time, so the form takes a pasted
 * list.
 *
 * It had a parser of its own, which was `line.split(',')` and nothing else.
 * That is the right reading of a spreadsheet row and the wrong one of what
 * somebody pastes into a box on a screen, so "דני כהן 050-1234567" became a
 * guest called that, with no phone, and a line reading "משפחת לוי 4" became
 * one person. It also dropped anything it could not use without saying so.
 *
 * It reads through `readGuestList` now, the same function the importer uses,
 * so the two boxes on this screen cannot come to different conclusions about
 * the same four lines. The side on the form is the fallback for a line that
 * does not name one, which is what it was always for.
 */
export async function addGuests(_prev: GuestResult | null, form: FormData): Promise<GuestResult> {
  const clientId = String(form.get('client_id') ?? '');
  const bulk = String(form.get('names') ?? '');
  const side = String(form.get('side') ?? '').trim();

  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const { rows, skipped } = readGuestList(bulk);
  if (rows.length === 0) return { ok: false, error: 'נא לכתוב לפחות שם אחד' };
  if (rows.length > 300) return { ok: false, error: 'עד 300 אורחים בבת אחת' };

  const sb = await supabaseServer();
  const { error } = await sb.from('guests_rsvp').insert(rows.map((r) => ({
    client_id: clientId,
    full_name: r.name,
    side: r.side || side,
    phone: r.phone,
    party_size: r.party,
  })));
  if (error) return { ok: false, error: whyNotSaved(error) };

  touch(clientId);
  return { ok: true, added: rows.length, skipped: skipped.length };
}

/**
 * Correcting a guest, which until now meant deleting them.
 *
 * A name typed wrong, a phone with a digit missing, a cousin moved to the
 * other side of the family. There was no update, so the only way to fix any
 * of it was `deleteGuest` and type them again — and that takes their reply
 * with it. `status`, `party_size` and `responded_at` all live on the same
 * row, so a typo in a name cost somebody their RSVP and a phone call to the
 * aunt asking a second time whether she is coming.
 *
 * Nobody makes that call for a spelling, so the name simply stays wrong, and
 * then it is printed on the seating chart.
 *
 * Which is why this writes only the four fields the form carries and never
 * touches the reply. Editing who somebody is and recording what they
 * answered are two different acts; `setGuestStatus` is the other one.
 *
 * No ownership check and none wanted: the policy on `guests_rsvp` is the
 * check, so an id from somebody else's wedding updates nothing and says so.
 */
export async function updateGuest(_prev: GuestResult | null, form: FormData): Promise<GuestResult> {
  const id = String(form.get('guest_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const fullName = String(form.get('full_name') ?? '').trim();

  if (!id || !clientId) return { ok: false, error: 'חסר מזהה אורח' };
  if (fullName.length < 2) return { ok: false, error: 'נא לכתוב שם' };

  const diet = String(form.get('diet') ?? '').trim();
  if (diet && !DIETS.some((d) => d.value === diet)) {
    return { ok: false, error: 'העדפת האוכל לא מוכרת' };
  }

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('guests_rsvp')
    .update({
      full_name: fullName,
      side: String(form.get('side') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      diet,
    })
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[guests] updateGuest failed', error);
    return { ok: false, error: whyNotSaved(error) };
  }
  /* An update that matched nothing is not a success. Saying "saved" over an
     unchanged name is the one outcome worse than failing. */
  if (!data || data.length === 0) {
    /* Not a fault: the row is gone, and in practice it was deleted in
       another tab. The classifier has the sentence for that, so this hands
       it the code PostgREST uses for "no rows where one was expected"
       rather than inventing a second way of saying it. */
    return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };
  }

  touch(clientId);
  return { ok: true };
}

export async function deleteGuest(form: FormData): Promise<void> {
  const id = String(form.get('guest_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  const { error } = await sb.from('guests_rsvp').delete().eq('id', id);
  if (error) {
    console.error('[guests] deleteGuest failed', error);
    await noteFailure('האורח לא נמחק. אפשר לנסות שוב.');
  }
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
  const { error } = await sb
    .from('guests_rsvp')
    .update({
      status,
      party_size: status === 'declined' ? 0 : 1,
      responded_at: status === 'pending' ? null : new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.error('[guests] setGuestStatus failed', error);
    await noteFailure('הסטטוס לא נשמר. אפשר לנסות שוב.');
  }
  touch(clientId);
}

/**
 * The same answer for many people at once.
 *
 * One phone call with a family settles six or eight names, and until now that
 * was six or eight separate presses down a list of three hundred. The press
 * is identical each time, which is the definition of work a screen should be
 * doing.
 *
 * It writes exactly what `setGuestStatus` writes for one guest, through the
 * same three fields, rather than a second idea of what answering means. The
 * ids are capped: a form can carry whatever somebody puts in it, and an
 * unbounded `in` list is a request that can be made very large by hand.
 *
 * `party_size` goes back to one on an answer that is not "declined" for the
 * same reason it does for one guest, and that is worth knowing before using
 * this on a family who had already typed their numbers: it resets them. The
 * screen says so above the button.
 */
export async function setManyGuestStatus(form: FormData): Promise<void> {
  const clientId = String(form.get('client_id') ?? '');
  const status = String(form.get('status') ?? '');
  const ids = form.getAll('guest_id').map(String).filter(Boolean).slice(0, 500);

  if (!clientId || !ids.length) return;
  if (!['pending', 'attending', 'declined'].includes(status)) return;

  const sb = await supabaseServer();
  const { error } = await sb
    .from('guests_rsvp')
    .update({
      status,
      party_size: status === 'declined' ? 0 : 1,
      responded_at: status === 'pending' ? null : new Date().toISOString(),
    })
    .in('id', ids)
    .eq('client_id', clientId);

  if (error) {
    console.error('[guests] setManyGuestStatus failed', error);
    await noteFailure('הסטטוס לא נשמר. אפשר לנסות שוב.');
  }
  touch(clientId);
}

/* ── Importing a list somebody already has ─────────────────────────────────
   Nobody types four hundred names into a web form. They have a spreadsheet,
   and the job is to accept it as it is rather than asking them to reshape it
   first. Columns are found by name in either language, a file with no header
   is read positionally, and every row that cannot be used is reported with its
   line number instead of being dropped in silence.                          */

/**
 * Reading the list, and reading it again before writing it.
 *
 * `importGuests` used to be the only door: paste two hundred lines, press
 * once, and they are rows. That is the one write on this screen with no way
 * back - deleting two hundred guests one at a time is not a recovery - and
 * it is also the write most likely to be subtly wrong, because the whole job
 * is guessing where a line comes apart. A couple who pasted their mother's
 * WhatsApp list had no way to find out that every phone had ended up inside
 * a name until they scrolled their own guest list.
 *
 * So the reading is handed back first and nothing is written. Both doors run
 * the same two functions over the same text, so the preview is the plan and
 * not an impression of it. The text is carried between them by the form
 * rather than held on the server: a server that remembers what somebody
 * pasted is a server with somebody's guest list sitting in it, and re-reading
 * the same text gives the same answer because the reader is pure.
 *
 * The one thing that can move between the two presses is the list itself, if
 * the producer adds somebody in another tab. That is handled rather than
 * guarded: the write dedupes again, so the difference shows up as one more
 * duplicate and never as a doubled guest.
 */
async function plan(form: FormData): Promise<
  | { ok: false; error: string; skipped?: { line: number; reason: string }[] }
  | { ok: true; clientId: string; fresh: ImportRow[]; duplicates: number;
      repeated: ImportRow[]; skipped: { line: number; reason: string }[] }
> {
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const file = form.get('file');
  const pasted = String(form.get('text') ?? '');
  const text = file instanceof File && file.size > 0 ? await file.text() : pasted;
  if (!text.trim()) return { ok: false, error: 'נא לבחור קובץ או להדביק רשימה' };
  if (text.length > 2_000_000) return { ok: false, error: 'הקובץ גדול מדי' };

  const { rows, skipped } = readGuestList(text);
  if (rows.length === 0) return { ok: false, error: 'לא נמצאו שורות עם שם', skipped };
  if (rows.length > MAX_GUESTS_IMPORT) {
    return { ok: false, error: `${MAX_GUESTS_IMPORT} אורחים לכל היותר בייבוא אחד`, skipped };
  }

  const sb = await supabaseServer();
  /* Importing the same file twice is a normal accident: a spreadsheet gets
     re-sent with four names added. The right outcome is four new guests, not
     a doubled list. */
  const { data: existing } = await sb
    .from('guests_rsvp').select('full_name,phone').eq('client_id', clientId);
  const { fresh, duplicates, repeated } = dedupe(rows, existing ?? []);

  return { ok: true, clientId, fresh, duplicates, repeated, skipped };
}

/** What the list says, with nothing written. */
export async function previewGuests(_prev: ImportReport | null, form: FormData): Promise<ImportReport> {
  const p = await plan(form);
  if (!p.ok) return { ok: false, error: p.error, skipped: p.skipped };
  return {
    ok: true,
    preview: true,
    ready: p.fresh.length,
    sample: p.fresh.slice(0, PREVIEW_ROWS),
    duplicates: p.duplicates,
    repeated: p.repeated.slice(0, 30).map((r) => r.name),
    skipped: p.skipped,
  };
}

export async function importGuests(_prev: ImportReport | null, form: FormData): Promise<ImportReport> {
  const p = await plan(form);
  if (!p.ok) return { ok: false, error: p.error, skipped: p.skipped };

  if (p.fresh.length === 0) {
    return { ok: true, added: 0, duplicates: p.duplicates, skipped: p.skipped };
  }

  const sb = await supabaseServer();
  const { error } = await sb.from('guests_rsvp').insert(
    p.fresh.map((r) => ({
      client_id: p.clientId,
      full_name: r.name,
      side: r.side,
      phone: r.phone,
      party_size: r.party,
    }))
  );
  /* The form carries this back to the screen, so it says why rather than
     collecting a flash the way the actions that return nothing have to. */
  if (error) return { ok: false, error: whyNotSaved(error), skipped: p.skipped };

  touch(p.clientId);
  return { ok: true, added: p.fresh.length, duplicates: p.duplicates, skipped: p.skipped };
}
