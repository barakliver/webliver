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

/** Moves an event to another producer.
 *
 *  Root only, and enforced by the policy rather than by this function:
 *  clients_write already restricts every write to the owning producer or the
 *  super admin, so a producer calling this against somebody else's event
 *  changes nothing.
 *
 *  Everything on the event moves with it, because everything on the event is
 *  keyed to the event and not to whoever was producing it. The couple keeps
 *  their logins, their tasks and their guest list; the person answering
 *  changes. */
export async function reassignClient(formData: FormData): Promise<void> {
  const clientId = String(formData.get('client_id') ?? '');
  const producerId = String(formData.get('producer_id') ?? '');
  if (!clientId || !producerId) return;

  const sb = await supabaseServer();
  await sb.from('clients').update({ producer_id: producerId }).eq('id', clientId);

  revalidatePath('/app/admin');
  revalidatePath('/app/clients');
  revalidatePath(`/app/clients/${clientId}`);
}
