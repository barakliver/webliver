'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { currentLocale } from '@/lib/serverLocale';
import { noteFailure, saidFor } from '@/lib/flash';
import { VENUE_FLAGS } from '@/lib/venues';

/**
 * The halls, and choosing one.
 *
 * Every write here is fenced by `can_read_client` in the database, so these
 * functions do not try to decide who may touch which event a second time.
 * What they do is the part the database cannot: refuse a price that is not a
 * number, keep an uploaded quote inside its own event's folder, and give the
 * screen a sentence rather than a Postgres error.
 *
 * The couple edits this panel as much as the producer does — they are the ones
 * who toured the halls — so the sentences follow the language the screen is
 * being read in rather than the Hebrew the console is written in.
 */

export type VenueResult = { ok: boolean; error?: string };

const said = async () => saidFor(await currentLocale());

/* Inside this event's own folder and nowhere else. The storage policy says the
   same thing; saying it here too makes a mistake a sentence on the screen
   rather than a refusal with no explanation. */
function ownPath(clientId: string, path: string): boolean {
  return path.startsWith(`${clientId}/`) && !path.includes('..');
}

/** A price off a form. Anything that is not a number is zero rather than NaN,
 *  which would otherwise reach the database as null and the screen as a blank
 *  where a figure should be. */
function money(form: FormData, key: string, max = 10_000_000): number {
  const raw = String(form.get(key) ?? '').replace(/[^\d.-]/g, '');
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n * 100) / 100, max);
}

function percent(form: FormData, key: string): number {
  const n = Number.parseFloat(String(form.get(key) ?? ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n * 100) / 100, 100);
}

export async function saveVenue(_prev: VenueResult | null, form: FormData): Promise<VenueResult> {
  const clientId = String(form.get('client_id') ?? '');
  const id = String(form.get('id') ?? '');
  const name = String(form.get('venue_name') ?? '').trim();
  const quote = String(form.get('quote_path') ?? '').trim();

  if (!clientId) return { ok: false, error: (await said()).notSaved };
  if (name.length < 1) return { ok: false, error: 'נא לכתוב את שם האולם' };
  if (quote && !ownPath(clientId, quote)) {
    return { ok: false, error: 'הקובץ לא נשמר במקום הנכון' };
  }

  const account = await currentAccount();
  if (!account) return { ok: false, error: 'צריך להתחבר' };

  const barType = String(form.get('bar_type') ?? '') === 'per_person' ? 'per_person' : 'flat';
  const row = {
    client_id: clientId,
    venue_name: name.slice(0, 120),
    location: String(form.get('location') ?? '').trim().slice(0, 120),
    contact: String(form.get('contact') ?? '').trim().slice(0, 120),
    phone: String(form.get('phone') ?? '').trim().slice(0, 40),
    toured_on: String(form.get('toured_on') ?? '').trim() || null,
    notes: String(form.get('notes') ?? '').trim().slice(0, 2000),
    plate_price: money(form, 'plate_price'),
    is_vat_included: String(form.get('is_vat_included') ?? '') === 'on',
    bar_cost: money(form, 'bar_cost'),
    bar_type: barType,
    sound_lighting_cost: money(form, 'sound_lighting_cost'),
    ancillary_fees: money(form, 'ancillary_fees'),
    service_percent: percent(form, 'service_percent'),
    service_flat: money(form, 'service_flat'),
    ...(quote ? { quote_path: quote } : {}),
  };

  const sb = await supabaseServer();

  if (id) {
    const { error } = await sb.from('venue_comparisons').update(row).eq('id', id);
    if (error) {
      console.error('[venues] update failed', error);
      /* The picture of the failure that matters: the hall is still on the
         screen showing the old numbers, which look exactly like saved ones. */
      return { ok: false, error: (await said()).notSaved };
    }
  } else {
    /* At the end of the row of columns. A hall added third belongs third,
       because that is the order they were toured in and the order the couple
       is holding in their head. */
    const { data: last } = await sb.from('venue_comparisons')
      .select('sort').eq('client_id', clientId).order('sort', { ascending: false }).limit(1).maybeSingle();

    const { error } = await sb.from('venue_comparisons')
      .insert({ ...row, sort: (last?.sort ?? 0) + 1 });
    if (error) {
      console.error('[venues] insert failed', error);
      /* A file in the bucket with no row is a file nobody can see and nobody
         can remove. It goes with the row that failed. */
      if (quote) await sb.storage.from('files').remove([quote]);
      return { ok: false, error: (await said()).notSaved };
    }
  }

  touch(clientId);
  return { ok: true };
}

export async function removeVenue(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;

  const sb = await supabaseServer();
  const { data: row } = await sb.from('venue_comparisons').select('quote_path').eq('id', id).maybeSingle();

  const { error } = await sb.from('venue_comparisons').delete().eq('id', id);
  if (error) {
    console.error('[venues] delete failed', error);
    await noteFailure((await said()).notRemoved);
  } else if (row?.quote_path) {
    /* Only once the row is gone, so a refused delete cannot leave a hall
       pointing at a quote that is no longer there. */
    await sb.storage.from('files').remove([row.quote_path]);
  }
  touch(clientId);
}

/**
 * The buffer slider, and the flags.
 *
 * One function for the small edits rather than three, and a fixed list of
 * fields rather than whatever the form names — a generic setter that takes a
 * column name from a request body is a setter that can write `is_selected`.
 */
export async function tuneVenue(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const field = String(form.get('field') ?? '');
  if (!id) return;

  const sb = await supabaseServer();
  let patch: Record<string, unknown> | null = null;

  if (field === 'contingency_percent') {
    patch = { contingency_percent: percent(form, 'value') };
  } else if (field === 'flags') {
    /* Only keys from the list, and each once. The column is jsonb and will
       hold anything at all, so what may go into it is decided here. */
    const wanted = form.getAll('flag').map(String);
    patch = { pros_cons: [...new Set(wanted.filter((f) => (VENUE_FLAGS as readonly string[]).includes(f)))] };
  }

  if (!patch) {
    console.error('[venues] tune asked for a field that is not tunable', { field });
    return;
  }

  const { error } = await sb.from('venue_comparisons').update(patch).eq('id', id);
  if (error) {
    console.error('[venues] tune failed', error);
    await noteFailure((await said()).notSaved);
  }
  touch(clientId);
}

/**
 * How many people they are committing to.
 *
 * Written to the event rather than to this screen, because it is the same
 * number the bar calculator and the budget already work from. A second copy
 * of "how many are coming" is a number that quietly disagrees with the first.
 */
export async function setGuestCommitment(form: FormData): Promise<void> {
  const clientId = String(form.get('client_id') ?? '');
  const raw = Number.parseInt(String(form.get('guests') ?? ''), 10);
  if (!clientId || !Number.isFinite(raw) || raw < 0 || raw > 5000) return;

  const sb = await supabaseServer();
  const { error } = await sb.from('clients').update({ guest_estimate: raw }).eq('id', clientId);
  if (error) {
    console.error('[venues] guest commitment failed', error);
    await noteFailure((await said()).notSaved);
  }
  touch(clientId);
}

/**
 * They chose one.
 *
 * The database does all three parts of this in one call — marks the hall,
 * writes it onto the event, and puts its total into the budget as the line
 * everything else is planned around — because doing them from here would be
 * three writes with two gaps in the middle, and the gaps are where an event
 * ends up with a venue name and no budget line.
 *
 * The total is computed there rather than sent from here for the same reason
 * the share token is minted there: a number a browser can choose is not a
 * number to build somebody's wedding budget on.
 */
export async function chooseVenue(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const guests = Number.parseInt(String(form.get('guests') ?? ''), 10);
  if (!id) return;

  const sb = await supabaseServer();
  const { error } = await sb.rpc('choose_venue', {
    p_venue: id,
    p_guests: Number.isFinite(guests) && guests > 0 ? guests : 0,
  });
  if (error) {
    console.error('[venues] choose failed', error);
    await noteFailure('האולם לא נבחר. אפשר לנסות שוב.');
  }
  touch(clientId);
}

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
}
