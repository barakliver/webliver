'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount, ROOT_ADMIN_EMAIL } from '@/lib/auth';
import { sendMail } from '@/lib/notify/mail';
import { clientInviteEmail } from '@/lib/notify/templates';
import { inviteLinkFor } from '@/lib/invite';
import { publicEnv } from '@/lib/env';
import { MIN_EVENT_DATE, MAX_GUESTS } from '@/content/site';
import { STANDING_CHECKLIST } from '@/content/eventFile';
import { explainRefusal } from '@/lib/rls';

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

  if (error) {
    /* A refusal here used to end as "אין לך הרשאה לפעולה הזאת" whatever had
       actually happened, and that sentence sends nobody anywhere. When it is
       row level security, ask the policy's own conditions who said no. */
    if (/row-level security/i.test(error.message)) {
      const why = await explainRefusal(sb, account.producer.id);
      console.error('[clients] create refused', {
        code: (error as { code?: string }).code,
        message: error.message,
        producerId: account.producer.id,
        producerStatus: account.producer.status,
        role: account.role,
        seenByDatabase: why.detail,
      });
      /* The root account is the one person who can act on the raw finding,
         and the one person who cannot read the server's log from a phone.
         Everybody else gets the sentence and nothing else. */
      const isRoot = account.email.toLowerCase() === ROOT_ADMIN_EMAIL;
      /* The database's own sentence travels with it. Postgres says which side
         of the statement refused — a WITH CHECK violation and a USING one on a
         RETURNING clause are different sentences and different bugs — and that
         distinction was invisible from a phone. */
      return {
        ok: false,
        error: isRoot ? `${why.message} · ${error.message} · ${why.detail}` : why.message,
      };
    }
    console.error('[clients] create failed', {
      code: (error as { code?: string }).code,
      message: error.message,
      details: (error as { details?: string }).details,
      hint: (error as { hint?: string }).hint,
    });
    return { ok: false, error: readable(error.message) };
  }

  /* The standing checklist, without being asked for.
   *
   * The other templates are pickers, and rightly so: half of a planning list
   * does not apply to any given event. This one is different because it is
   * the list that is on every wedding, and a list somebody has to remember to
   * apply is a list that is missing from the first three events before anyone
   * notices. Every line stays editable and deletable.
   *
   * Failure here does not fail the event. A wedding that exists without its
   * checklist is a wedding somebody can add lines to; a creation that rolls
   * back because a seed insert failed is an event that does not exist. */
  const seed = STANDING_CHECKLIST.flatMap((group) =>
    group.tasks.map((t) => ({
      client_id: data.id,
      phase: group.title,
      title: t.note ? `${t.title} · ${t.note}` : t.title,
      visible_to_client: t.shared,
    })),
  );
  const { error: seedError } = await sb.from('tasks').insert(seed);
  if (seedError) console.error('[clients] the standing checklist did not seed', seedError);

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
 *  The cap of three and the role rebinding are both enforced in the database;
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
    /* A tenant's letter signs with the tenant's identity, and their couples
       are pointed at the tenant's own number — never the platform's. Only a
       producer with no brand of their own (the platform itself) falls back to
       the platform's signature and phone. */
    const tenantBrand = account.producer?.brandName
      ? { name: account.producer.brandName, tagline: account.producer.tagline || undefined }
      : undefined;
    const phone = tenantBrand ? account.producer?.whatsapp : publicEnv.whatsapp;
    await sendMail({
      to: email,
      subject: 'האזור האישי שלכם מוכן',
      html: clientInviteEmail({
        eventName: client.display_name,
        producerName: account.producer?.brandName || account.fullName || 'ההפקה',
        signInUrl: link.url,
        oneClick: link.kind === 'magic',
        installUrl: `${publicEnv.siteUrl.replace(/\/+$/, '')}/install`,
        producerPhone: phone || undefined,
        brand: tenantBrand,
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
/**
 * Closing an event, and reopening one.
 *
 * Closing goes through `close_event` rather than setting the flag here, and
 * that is the whole of a bug worth writing down: 0042 added the snapshot the
 * archive shelf is built from, and this action went on setting `archived_at`
 * by itself. Every event closed in between was closed, correct, and invisible
 * on a page that reads snapshots. The database now does all three things in
 * one call — mark it closed, freeze the supplier sheet and the money, schedule
 * next year's anniversary — so a second way to close an event cannot drift
 * from the first, because there is no longer a second way.
 *
 * Reopening still writes the column directly, deliberately. It is one field
 * and it has no snapshot to take; the frozen record stays exactly where it is,
 * because a reopen is almost always a correction being made a week later and
 * throwing away the record of the night in order to make one is backwards.
 */
export async function setArchived(form: FormData): Promise<void> {
  const id = String(form.get('client_id') ?? '');
  const archived = String(form.get('archived') ?? '') === '1';
  if (!id) return;

  const sb = await supabaseServer();

  if (archived) {
    const { error } = await sb.rpc('close_event', { p_client: id, p_note: '' });
    if (error) {
      console.error('[clients] close_event refused', { message: error.message });
      return;
    }
  } else {
    await sb.from('clients').update({ archived_at: null }).eq('id', id);
  }

  revalidatePath('/app/clients');
  revalidatePath('/app/clients/archive');
  revalidatePath(`/app/clients/${id}`);
  revalidatePath('/app');
}
