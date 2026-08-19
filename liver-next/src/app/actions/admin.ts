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
