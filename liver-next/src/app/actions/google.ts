'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentAccount } from '@/lib/auth';
import { noteFailure } from '@/lib/flash';
import { optional } from '@/lib/env';
import { syncProducer } from '@/lib/google/sync';

/** Both directions, now, for the producer pressing the button. */
export async function syncGoogleNow(): Promise<void> {
  const account = await currentAccount();
  if (!account?.producer) return;
  if (!optional('SUPABASE_SERVICE_ROLE_KEY')) {
    await noteFailure('הסנכרון דורש את מפתח השירות בשרת.');
    return;
  }
  const rep = await syncProducer(account.producer.id, supabaseAdmin());
  if (rep.error) await noteFailure(`הסנכרון עם גוגל נכשל: ${rep.error}`);
  revalidatePath('/app/calendar');
}

/** Lets go of the tokens and the twins. The events already in Google stay
 *  there; they are the producer's calendar to keep or clear. */
export async function disconnectGoogle(): Promise<void> {
  const account = await currentAccount();
  if (!account?.producer) return;
  const sb = await supabaseServer();
  const { error } = await sb.rpc('disconnect_google_calendar');
  if (error) {
    console.error('[google] disconnect failed', error);
    await noteFailure('לא הצלחנו לנתק. אפשר לנסות שוב.');
  }
  revalidatePath('/app/calendar');
}
