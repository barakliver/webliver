'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentAccount } from '@/lib/auth';
import { applyAction, type StoredAction } from '@/lib/inbox/apply';
import { processInbox } from '@/lib/inbox/intake';

/**
 * The yes, the no, and "this is about somebody else".
 *
 * Every write here starts from a row read through the producer's own
 * session, so an action id that is not theirs is simply not found. A yes
 * goes through applyAction, which validates again and writes exactly the
 * columns the kind allows; a no writes nothing to the event, ever, which
 * the brief says in capitals and the test holds. An edit before a yes
 * keeps the model's payload beside the producer's, because the difference
 * between the two is the one thing that teaches the prompt.
 */

export type InboxResult = { ok: true; applied?: number; failed?: number } | { ok: false; error: string };

function touch() {
  revalidatePath('/app/inbox');
  revalidatePath('/app');
}

type Row = StoredAction & { status: string };

async function rows(ids: string[]): Promise<Row[]> {
  if (!ids.length) return [];
  const sb = await supabaseServer();
  const { data } = await sb.from('suggested_actions')
    .select('id,producer_id,client_id,kind,payload,inbox_item_id,title,status').in('id', ids);
  return ((data ?? []) as Row[]).filter((r) => r.status === 'pending');
}

/** Approve the given actions, or every pending one on an item. */
export async function approveActions(_prev: InboxResult | null, form: FormData): Promise<InboxResult> {
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'לא מחוברים' };
  const sb = await supabaseServer();

  let ids = form.getAll('action_id').map(String).filter(Boolean);
  const itemId = String(form.get('item_id') ?? '');
  if (!ids.length && itemId) {
    const { data } = await sb.from('suggested_actions').select('id').eq('inbox_item_id', itemId).eq('status', 'pending');
    ids = (data ?? []).map((r) => (r as { id: string }).id);
  }
  if (!ids.length) return { ok: false, error: 'לא נבחרה פעולה' };

  /* An edited payload travels as JSON under the action's own id. */
  const edits = new Map<string, unknown>();
  for (const id of ids) {
    const raw = form.get(`payload_${id}`);
    if (typeof raw === 'string' && raw.trim()) {
      try { edits.set(id, JSON.parse(raw)); } catch { return { ok: false, error: 'העריכה לא תקינה' }; }
    }
  }

  let applied = 0;
  let failed = 0;
  for (const r of await rows(ids)) {
    const edited = edits.get(r.id);
    const res = await applyAction(sb, { ...r, payload: edited ?? r.payload });
    await sb.from('suggested_actions').update({
      status: res.ok ? 'applied' : 'failed',
      decided_by: account.id, decided_at: new Date().toISOString(),
      applied_at: res.ok ? new Date().toISOString() : null,
      error: res.ok ? '' : res.error,
      feedback: edited !== undefined ? { original: r.payload, edited, decision: 'edited' } : null,
    }).eq('id', r.id);
    if (res.ok) applied += 1; else failed += 1;
  }
  touch();
  if (!applied && failed) return { ok: false, error: 'הפעולות נכשלו. הסיבה כתובה על כל אחת.' };
  return { ok: true, applied, failed };
}

export async function rejectActions(_prev: InboxResult | null, form: FormData): Promise<InboxResult> {
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'לא מחוברים' };
  const sb = await supabaseServer();
  let ids = form.getAll('action_id').map(String).filter(Boolean);
  const itemId = String(form.get('item_id') ?? '');
  if (!ids.length && itemId) {
    const { data } = await sb.from('suggested_actions').select('id').eq('inbox_item_id', itemId).eq('status', 'pending');
    ids = (data ?? []).map((r) => (r as { id: string }).id);
  }
  if (!ids.length) return { ok: false, error: 'לא נבחרה פעולה' };
  const reason = String(form.get('reason') ?? '').trim().slice(0, 300);
  const { error } = await sb.from('suggested_actions').update({
    status: 'rejected', decided_by: account.id, decided_at: new Date().toISOString(),
    feedback: { decision: 'rejected', reason },
  }).in('id', ids).eq('status', 'pending');
  if (error) {
    console.error('[inbox] reject failed', { code: error.code, message: error.message });
    return { ok: false, error: 'לא הצלחנו לדחות' };
  }
  touch();
  return { ok: true };
}

/** The sorting box's answer: whose this is, or nobody's. Read again under
 *  the right event, by the service role, because the reading needs the
 *  bucket and the model and runs the same way it does at the door. */
export async function rematchItem(_prev: InboxResult | null, form: FormData): Promise<InboxResult> {
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'לא מחוברים' };
  const itemId = String(form.get('item_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!itemId) return { ok: false, error: 'חסר פריט' };

  const sb = await supabaseServer();
  const { data: item } = await sb.from('inbox_items').select('id').eq('id', itemId).maybeSingle();
  if (!item) return { ok: false, error: 'הפריט לא נמצא' };

  if (!clientId || clientId === 'none') {
    const { error } = await sb.from('inbox_items').update({ status: 'ignored', match_reason: 'לא קשור לאירוע' }).eq('id', itemId);
    if (error) return { ok: false, error: 'לא הצלחנו לסמן' };
    await sb.from('suggested_actions').update({ status: 'rejected', decided_by: account.id, decided_at: new Date().toISOString() })
      .eq('inbox_item_id', itemId).eq('status', 'pending');
    touch();
    return { ok: true };
  }

  const { data: client } = await sb.from('clients').select('id').eq('id', clientId).maybeSingle();
  if (!client) return { ok: false, error: 'האירוע לא נמצא' };
  try {
    await processInbox(supabaseAdmin(), itemId, clientId);
  } catch (e) {
    console.error('[inbox] rematch failed', { message: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: 'הקריאה מחדש נכשלה' };
  }
  touch();
  return { ok: true };
}

export async function ignoreItem(_prev: InboxResult | null, form: FormData): Promise<InboxResult> {
  const f = new FormData();
  f.set('item_id', String(form.get('item_id') ?? ''));
  f.set('client_id', 'none');
  return rematchItem(null, f);
}
