'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { noteDone, noteFailure } from '@/lib/flash';

const ALLOWED = ['approved', 'rejected', 'suspended', 'pending'] as const;
type Status = (typeof ALLOWED)[number];

/** Approving a producer is the root admin's decision. The check here is a
 *  courtesy for the UI; the database refuses the write on its own if anybody
 *  else reaches this action. */
export async function setProducerStatus(formData: FormData): Promise<void> {
  const id = String(formData.get('producer_id') ?? '');
  const status = String(formData.get('status') ?? '') as Status;

  if (!id || !ALLOWED.includes(status)) return;

  const account = await currentAccount();
  if (!account || account.role !== 'super_admin') return;

  const sb = await supabaseServer();
  const { error } = await sb.from('producers').update({ status }).eq('id', id);
  if (error) {
    console.error('[admin] setProducerStatus failed', error);
    await noteFailure('הסטטוס לא נשמר. אפשר לנסות שוב.');
  }

  revalidatePath('/app/admin');
}

/**
 * Hands one of your own events to another producer.
 *
 * This used to move any event between any two producers, because root could
 * read every workspace. Root cannot now, and pushing a workspace into a tenant
 * from outside it is not an operation a platform with a real boundary should
 * have.
 *
 * What survives is the honest version, enforced in the database: the event
 * must be one the caller owns, and the destination must be an approved
 * producer. Handing over data you already hold is a real thing a production
 * business does; reaching into somebody else's books is not.
 *
 * Everything on the event moves with it, because everything on the event is
 * keyed to the event and not to whoever was producing it. The couple keeps
 * their logins, their tasks and their guest list; the person answering
 * changes.
 */
export async function transferClient(formData: FormData): Promise<void> {
  const clientId = String(formData.get('client_id') ?? '');
  const producerId = String(formData.get('producer_id') ?? '');
  if (!clientId || !producerId) return;

  const sb = await supabaseServer();
  const { error } = await sb.rpc('transfer_client', {
    p_client: clientId,
    p_to_producer: producerId,
  });
  if (error) {
    console.error('[admin] transfer failed', error);
    await noteFailure('האירוע לא הועבר. אפשר לנסות שוב.');
  }

  revalidatePath('/app/admin');
  revalidatePath('/app/clients');
  revalidatePath(`/app/clients/${clientId}`);
}

/** Which modules each kind of couple may open. */
export async function setFeatureFlag(formData: FormData): Promise<void> {
  const key = String(formData.get('key') ?? '');
  const label = String(formData.get('label') ?? '');
  if (!key) return;

  const account = await currentAccount();
  if (!account || account.role !== 'super_admin') return;

  const sb = await supabaseServer();
  const { error } = await sb.rpc('set_feature_flag', {
    p_key: key,
    p_label: label,
    /* An unchecked checkbox sends nothing at all, which is the whole reason
       this reads presence rather than a value. */
    p_diy: formData.get('diy') === 'on',
    p_managed: formData.get('managed') === 'on',
  });
  if (error) {
    console.error('[admin] flag failed', error);
    await noteFailure('הדגל לא נשמר. אפשר לנסות שוב.');
  }

  revalidatePath('/app/admin');
}

/**
 * What a sign-up actually is.
 *
 * Everybody who signs up is guessed to be a producer, because the platform has
 * no way of knowing. This is the correction, and it has three answers: a
 * production business, a couple planning alone, or a couple whose producer
 * will invite them onto an event.
 *
 * The check below is a courtesy for the screen. The real one is in
 * `set_account_kind`, which refuses anybody but root and refuses the root
 * account as a target — because this writes profiles.role, and a check that
 * lives only in a screen is a check that a fetch call goes around.
 */
export async function setAccountKind(formData: FormData): Promise<void> {
  const owner = String(formData.get('owner_id') ?? '');
  const kind = String(formData.get('kind') ?? '');
  if (!owner || !['producer', 'diy', 'managed'].includes(kind)) return;

  const account = await currentAccount();
  if (!account || account.role !== 'super_admin') return;

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('set_account_kind', { p_owner: owner, p_kind: kind });
  if (error) {
    console.error('[admin] kind failed', error);
    await noteFailure('ההרשאה לא השתנתה. אפשר לנסות שוב.');
  } else {
    await noteDone(SAID[String(data)] ?? SAID.managed);
  }

  revalidatePath('/app/admin');
  revalidatePath('/app/clients');
}

/* What the database says it did, said back. This is the one screen in the
   product where the effect of a press is mostly somewhere else — a workspace
   opened for somebody, an approval queue a name left — so the press that
   looked like it did nothing gets a sentence saying what it did.

   Keyed by the word the function returns, which is why it returns one. */
const SAID: Record<string, string> = {
  producer: 'נרשמה כמפיקה. הסטטוס חזר להמתנה, ואישור ייתן גישה.',
  managed: 'נרשמו כזוג של מפיק. הם ממתינים שמפיק יזמין אותם לאירוע שלו.',
  'diy-created': 'נרשמו כזוג שמתכנן לבד, ונפתח להם מרחב עבודה משלהם.',
  'diy-existing': 'נרשמו כזוג שמתכנן לבד. כבר היה להם אירוע, והוא סומן כשלהם.',
};
