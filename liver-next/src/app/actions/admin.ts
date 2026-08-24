'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';

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
  await sb.from('producers').update({ status }).eq('id', id);

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
  if (error) console.error('[admin] transfer failed', error);

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
  if (error) console.error('[admin] flag failed', error);

  revalidatePath('/app/admin');
}
