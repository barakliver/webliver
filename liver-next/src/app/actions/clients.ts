'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { sendMail } from '@/lib/notify/mail';
import { clientInviteEmail } from '@/lib/notify/templates';
import { inviteLinkFor } from '@/lib/invite';
import { publicEnv } from '@/lib/env';
import { MIN_EVENT_DATE, MAX_GUESTS } from '@/content/site';

export type ActionResult = { ok: boolean; error?: string; id?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Turns a database complaint into something a producer can act on. The
 *  invariants live in the schema, so this is about wording, not about
 *  deciding what is allowed. */
function readable(message: string): string {
  if (/at most \d+ authorized emails/i.test(message)) return 'לאירוע אפשר לצרף שלוש כתובות לכל היותר';
  if (/cae_client_email_key|duplicate key/i.test(message)) return 'הכתובת הזאת כבר מצורפת לאירוע';
  if (/clients_date_2026/i.test(message)) return 'התאריך צריך להיות משנת 2026 ואילך';
  if (/row-level security/i.test(message)) return 'אין לך הרשאה לפעולה הזאת';
  return 'הפעולה נכשלה. נסו שוב.';
}

export async function createClient(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: 'צריך להתחבר' };
  if (!account.producer) return { ok: false, error: 'אין מרחב הפקה משויך לחשבון' };
  if (account.role !== 'super_admin' && account.producer.status !== 'approved') {
    return { ok: false, error: 'החשבון עדיין ממתין לאישור' };
  }

  const v = (k: string) => String(form.get(k) ?? '').trim();
  const displayName = v('display_name');
  const eventDate = v('event_date');
  const guests = v('guest_estimate');

  if (displayName.length < 2) return { ok: false, error: 'נא למלא שם לאירוע' };
  if (eventDate && eventDate < MIN_EVENT_DATE) {
    return { ok: false, error: 'התאריך צריך להיות משנת 2026 ואילך' };
  }
  let guestCount: number | null = null;
  if (guests) {
    guestCount = Number(guests);
    if (!Number.isFinite(guestCount) || guestCount <= 0 || guestCount > MAX_GUESTS) {
      return { ok: false, error: `כמות אורחים צריכה להיות בין 1 ל-${MAX_GUESTS}` };
    }
  }

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('clients')
    .insert({
      producer_id: account.producer.id,
      display_name: displayName,
      kind: v('kind') === 'corporate' ? 'corporate' : 'wedding',
      event_date: eventDate || null,
      venue: v('venue'),
      guest_estimate: guestCount,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: readable(error.message) };

  revalidatePath('/app/clients');
  redirect(`/app/clients/${data.id}`);
}

/**
 * Correcting the details of an event.
 *
 * The event page could show a date and could not set one, which is a strange
 * thing to discover on a workspace opened from a lead that had no date: the
 * countdown, the calendar entry, the run sheet header and every "how long
 * left" on the platform were all waiting on a field with no way in.
 *
 * Every field is optional and blank means cleared, except the name, which
 * something has to be called. An out of range date is refused rather than
 * silently dropped, because unlike a webhook this is somebody typing while
 * looking at the screen, and they can fix it.
 */
export async function updateClientDetails(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const id = String(form.get('client_id') ?? '');
  const name = String(form.get('display_name') ?? '').trim();
  const date = String(form.get('event_date') ?? '').trim();
  const guestsRaw = String(form.get('guest_estimate') ?? '').trim();

  if (!id) return { ok: false, error: 'חסר מזהה אירוע' };
  if (name.length < 2) return { ok: false, error: 'נא למלא שם לאירוע' };
  if (date && date < MIN_EVENT_DATE) return { ok: false, error: 'התאריך צריך להיות משנת 2026 ואילך' };

  let guests: number | null = null;
  if (guestsRaw) {
    const n = Number(guestsRaw);
    if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'כמות אורחים לא תקינה' };
    if (n > MAX_GUESTS) return { ok: false, error: `כמות האורחים המרבית היא ${MAX_GUESTS}` };
    guests = Math.round(n);
  }

  const sb = await supabaseServer();
  const { error } = await sb
    .from('clients')
    .update({
      display_name: name.slice(0, 120),
      kind: String(form.get('kind') ?? '') === 'corporate' ? 'corporate' : 'wedding',
      /* Blank clears rather than being ignored. A venue that fell through is
         information, and a screen that refuses to forget one is a screen
         somebody stops trusting. */
      event_date: date || null,
      venue: String(form.get('venue') ?? '').trim().slice(0, 160),
      guest_estimate: guests,
    })
    .eq('id', id);

  if (error) {
    console.error('[clients] update failed', error);
    return { ok: false, error: readable(error.message) };
  }

  revalidatePath(`/app/clients/${id}`);
  revalidatePath('/app/clients');
  revalidatePath('/app/calendar');
  revalidatePath('/app');
  return { ok: true, id };
}

/** Authorises an address on a workspace and tells that person it is there.
 *  The cap of two and the role rebinding are both enforced in the database;
 *  a failed email must never undo an invitation that was already recorded. */
export async function inviteToClient(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const clientId = String(form.get('client_id') ?? '');
  const email = String(form.get('email') ?? '').trim().toLowerCase();

  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'כתובת האימייל לא תקינה' };

  const account = await currentAccount();
  if (!account) return { ok: false, error: 'צריך להתחבר' };

  const sb = await supabaseServer();
  const { data: client } = await sb
    .from('clients')
    .select('id,display_name')
    .eq('id', clientId)
    .maybeSingle();
  if (!client) return { ok: false, error: 'האירוע לא נמצא' };

  /* The cap trigger fires before the unique index, so re-adding an address
     to a workspace that already holds two reports "at most two" rather than
     "already attached". Checking first gives the producer the real reason. */
  const { data: existing } = await sb
    .from('client_authorized_emails')
    .select('id')
    .eq('client_id', clientId)
    .eq('email', email)
    .maybeSingle();
  if (existing) return { ok: false, error: 'הכתובת הזאת כבר מצורפת לאירוע' };

  const { error } = await sb
    .from('client_authorized_emails')
    .insert({ client_id: clientId, email });
  if (error) return { ok: false, error: readable(error.message) };

  /* The invitation is already saved. Mail is best effort on top of it: the
     access exists whether or not the letter arrives, and the producer can
     resend from the same screen. */
  try {
    const link = await inviteLinkFor(email);
    await sendMail({
      to: email,
      subject: 'האזור האישי שלכם מוכן',
      html: clientInviteEmail({
        eventName: client.display_name,
        producerName: account.producer?.brandName || account.fullName || 'ההפקה',
        signInUrl: link.url,
        oneClick: link.kind === 'magic',
        installUrl: `${publicEnv.siteUrl.replace(/\/+$/, '')}/install`,
        producerPhone: publicEnv.whatsapp || undefined,
      }),
    });
  } catch (e) {
    console.error('[clients] the invitation email did not go out', e);
  }

  revalidatePath(`/app/clients/${clientId}`);
  return { ok: true };
}

export async function revokeInvite(form: FormData): Promise<void> {
  const id = String(form.get('invite_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;

  const sb = await supabaseServer();
  await sb.from('client_authorized_emails').delete().eq('id', id);
  revalidatePath(`/app/clients/${clientId}`);
}

/** Closes a finished event, or reopens one closed too early.
 *
 *  Nothing is deleted: the guests, the payments and the run sheet are the
 *  record of what happened, and they are wanted long after the evening is
 *  over. This only decides whether the event still counts as live work.
 *
 *  Deliberately never automatic. A date passing is a prompt to close a file,
 *  not the closing of it — there is usually a last payment to chase or a
 *  supplier to settle, and an event that tidied itself away on the morning
 *  after would take those with it. */
export async function setArchived(form: FormData): Promise<void> {
  const id = String(form.get('client_id') ?? '');
  const archived = String(form.get('archived') ?? '') === '1';
  if (!id) return;

  const sb = await supabaseServer();
  await sb
    .from('clients')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id);

  revalidatePath('/app/clients');
  revalidatePath(`/app/clients/${id}`);
  revalidatePath('/app');
}
