'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { CREW_SLOTS, isSlot } from '@/lib/crewNeeds';
import { noteFailure } from '@/lib/flash';

export type CrewMemberResult = { ok: boolean; error?: string; id?: string };

function touchDirectory() {
  revalidatePath('/app/crew');
}

function touchEvent(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
}

/**
 * An address, or nothing.
 *
 * Nothing is the common case and always will be: most of a crew is reached by
 * phone and has never been sent a link. A field that refuses to save without
 * an address is a field that keeps Tal out of the directory entirely.
 */
function readEmail(form: FormData): string {
  const raw = String(form.get('email') ?? '').trim().toLowerCase();
  if (!raw) return '';
  /* Deliberately not a clever pattern. The only thing worth catching here is
     a value that could not possibly be reached, and anything past that is a
     rule that eventually refuses somebody's real address. */
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(raw) ? raw.slice(0, 160) : '';
}

/** The roles ticked on the form, in the fixed order, with anything unknown
 *  dropped rather than saved for the database to refuse. */
function readRoles(form: FormData): string[] {
  const picked = new Set(form.getAll('roles').map((r) => String(r)));
  return CREW_SLOTS.filter((s) => picked.has(s));
}

function memberFields(form: FormData) {
  const name = String(form.get('name') ?? '').trim();
  if (name.length < 2) return 'נא למלא שם';

  const email = String(form.get('email') ?? '').trim();
  const clean = readEmail(form);
  if (email && !clean) return 'כתובת המייל לא נראית תקינה';

  return {
    name: name.slice(0, 120),
    phone: String(form.get('phone') ?? '').trim().slice(0, 40),
    email: clean,
    roles: readRoles(form),
    notes: String(form.get('notes') ?? '').trim().slice(0, 1000),
  };
}

export async function addCrewMember(
  _prev: CrewMemberResult | null, form: FormData,
): Promise<CrewMemberResult> {
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'אין מרחב הפקה משויך לחשבון' };

  const f = memberFields(form);
  if (typeof f === 'string') return { ok: false, error: f };

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('crew_members')
    .insert({ producer_id: account.producer.id, ...f })
    .select('id')
    .single();

  if (error) {
    console.error('[crew_members] insert failed', error);
    /* The unique indexes are the point of a directory, so their refusal gets
       a sentence of its own: two rows for Tal means two phone numbers, and
       the wrong one is the one that gets called at eleven at night. */
    if (/crew_members_producer_name_key/i.test(error.message)) {
      return { ok: false, error: 'כבר יש איש צוות בשם הזה' };
    }
    if (/crew_members_producer_email_key/i.test(error.message)) {
      return { ok: false, error: 'כתובת המייל הזו כבר רשומה אצל איש צוות אחר' };
    }
    return { ok: false, error: 'לא הצלחנו לשמור' };
  }

  touchDirectory();
  return { ok: true, id: data?.id };
}

export async function updateCrewMember(
  _prev: CrewMemberResult | null, form: FormData,
): Promise<CrewMemberResult> {
  const id = String(form.get('member_id') ?? '');
  if (!id) return { ok: false, error: 'חסר מזהה' };

  const f = memberFields(form);
  if (typeof f === 'string') return { ok: false, error: f };

  const sb = await supabaseServer();
  const { error } = await sb.from('crew_members').update(f).eq('id', id);
  if (error) {
    console.error('[crew_members] update failed', error);
    if (/crew_members_producer_name_key/i.test(error.message)) {
      return { ok: false, error: 'כבר יש איש צוות בשם הזה' };
    }
    if (/crew_members_producer_email_key/i.test(error.message)) {
      return { ok: false, error: 'כתובת המייל הזו כבר רשומה אצל איש צוות אחר' };
    }
    return { ok: false, error: 'לא הצלחנו לשמור' };
  }

  touchDirectory();
  return { ok: true, id };
}

/**
 * Retired, not deleted.
 *
 * Somebody who no longer works with you still worked last August's wedding,
 * and deleting the row would blank the crew on a finished file rather than
 * tidy anything. The same decision vendors made, for the same reason.
 */
export async function archiveCrewMember(form: FormData): Promise<void> {
  const id = String(form.get('member_id') ?? '');
  const archived = String(form.get('archived') ?? '') === '1';
  if (!id) return;

  const sb = await supabaseServer();
  const { error } = await sb
    .from('crew_members')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id);

  if (error) {
    console.error('[crew_members] archive failed', error);
    await noteFailure('לא הצלחנו לעדכן את איש הצוות');
    return;
  }
  touchDirectory();
}

/* ── putting one of them on an evening ──────────────────────────────────── */

/**
 * Assign, through the database function rather than an insert here.
 *
 * `assign_crew` takes the copy of the name and phone the same way from every
 * screen that ever assigns somebody, and it is the thing that knows pressing
 * assign twice is a change of role rather than a second card.
 */
export async function assignCrew(form: FormData): Promise<void> {
  const clientId = String(form.get('client_id') ?? '');
  const memberId = String(form.get('member_id') ?? '');
  const raw = String(form.get('slot') ?? '');
  if (!clientId || !memberId) return;

  const sb = await supabaseServer();
  const { error } = await sb.rpc('assign_crew', {
    p_client: clientId,
    p_member: memberId,
    p_slot: isSlot(raw) ? raw : null,
  });

  if (error) {
    console.error('[crew] assign failed', error);
    await noteFailure('לא הצלחנו לשבץ');
    return;
  }
  touchEvent(clientId);
  touchDirectory();
}

/** The role somebody is filling tonight, changed without taking them off and
 *  putting them back on. */
export async function setCrewSlot(form: FormData): Promise<void> {
  const id = String(form.get('crew_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const raw = String(form.get('slot') ?? '');
  if (!id || !clientId) return;

  const sb = await supabaseServer();
  const { error } = await sb
    .from('crew')
    .update({ slot: isSlot(raw) ? raw : null })
    .eq('id', id);

  if (error) {
    console.error('[crew] slot failed', error);
    await noteFailure('לא הצלחנו לעדכן את התפקיד');
    return;
  }
  touchEvent(clientId);
  touchDirectory();
}
