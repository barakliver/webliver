'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { noteFailure } from '@/lib/flash';
import { PORTAL_SECTIONS, readShares } from '@/content/portalSections';

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath(`/app/clients/${clientId}/preview`);
  revalidatePath('/app/portal');
}

/** One switch on the couple's screen, flipped by the producer.
 *
 *  Money goes through its own column, because the row policies on the budget
 *  and the payments read that column and nothing else; every other section
 *  is a key in clients.shared_sections. Only an explicit false closes a
 *  section, so opening one deletes the key rather than writing true — the
 *  column stays a list of closures and an empty object keeps meaning "all
 *  open". */
export async function setSectionShared(form: FormData): Promise<void> {
  const clientId = String(form.get('client_id') ?? '');
  const key = String(form.get('section') ?? '');
  const on = String(form.get('on') ?? '') === 'true';
  const section = PORTAL_SECTIONS.find((s) => s.key === key);
  if (!clientId || !section) return;

  const sb = await supabaseServer();

  if (section.money) {
    const { error } = await sb.from('clients').update({ budget_visible: on }).eq('id', clientId);
    if (error) {
      console.error('[share] budget_visible failed', error);
      await noteFailure('לא הצלחנו לשנות מי רואה את התקציב. אפשר לנסות שוב.');
    }
    touch(clientId);
    return;
  }

  const { data: row, error: readError } = await sb
    .from('clients').select('shared_sections').eq('id', clientId).maybeSingle();
  if (readError || !row) {
    console.error('[share] read failed', readError);
    await noteFailure('לא הצלחנו לשנות מה הזוג רואה. אפשר לנסות שוב.');
    touch(clientId);
    return;
  }

  const shares = readShares(row.shared_sections);
  if (on) delete shares[key]; else shares[key] = false;

  const { error } = await sb.from('clients').update({ shared_sections: shares }).eq('id', clientId);
  if (error) {
    console.error('[share] write failed', error);
    await noteFailure('לא הצלחנו לשנות מה הזוג רואה. אפשר לנסות שוב.');
  }
  touch(clientId);
}
