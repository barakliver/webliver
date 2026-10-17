import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateAction, QUIET_KINDS } from '@/lib/inbox/kinds';
import { toggleTask } from '@/app/actions/tasks';

/**
 * Turning a yes into a row.
 *
 * The one place a suggested action becomes a write. It takes the row as
 * stored, validates the payload again (the model's proposal is data, and
 * data is checked at the moment it is used, not the moment it arrived),
 * writes exactly the columns the kind allows, and records what it did in
 * the activity log. A refusal is a result, and the action is marked
 * failed with the reason, so the screen says why rather than "applied"
 * over nothing.
 *
 * Runs under whichever client the caller holds. From the screen that is
 * the producer's own session and row level security decides; from a
 * webhook it is the service role and the producer id on the action
 * decides. Either way the client id on the action is checked against the
 * producer before anything is written: an action pointing at somebody
 * else's event is the kind of row a model could be talked into proposing.
 */

export type StoredAction = {
  id: string; producer_id: string; client_id: string | null; kind: string;
  payload: unknown; inbox_item_id: string | null; title: string;
};

export type ApplyResult = { ok: true; ref?: { table: string; id: string } } | { ok: false; error: string };

async function clientBelongs(sb: SupabaseClient, clientId: string, producerId: string): Promise<boolean> {
  const { data } = await sb.from('clients').select('id').eq('id', clientId).eq('producer_id', producerId).maybeSingle();
  return Boolean(data);
}

export async function applyAction(sb: SupabaseClient, action: StoredAction, actor: 'producer' | 'system' = 'producer'): Promise<ApplyResult> {
  const v = validateAction(action.kind, action.payload);
  if (!v.ok) return v;
  const { kind, data } = v;

  const needsClient = !['vendor_create', 'vendor_update', 'reply_draft'].includes(kind);
  if (needsClient) {
    if (!action.client_id) return { ok: false, error: 'הפעולה לא משויכת לאירוע' };
    if (!(await clientBelongs(sb, action.client_id, action.producer_id))) return { ok: false, error: 'האירוע לא שייך למפיק הזה' };
  }
  const clientId = action.client_id as string;

  let ref: { table: string; id: string } | undefined;
  let logTitle = action.title;
  let logKind = 'ai_action';

  try {
    switch (kind) {
      case 'budget_add_item': {
        const { data: row, error } = await sb.from('budget_items')
          .insert({ client_id: clientId, ...data, source: `ai_suggestion:${action.id}` }).select('id').single();
        if (error) throw error;
        ref = { table: 'budget_items', id: row.id }; logKind = 'budget_change';
        break;
      }
      case 'budget_update_item': {
        const { id, ...fields } = data as { id: string } & Record<string, unknown>;
        const { data: rows, error } = await sb.from('budget_items').update(fields).eq('id', id).eq('client_id', clientId).select('id');
        if (error) throw error;
        if (!rows?.length) return { ok: false, error: 'שורת התקציב לא נמצאה' };
        ref = { table: 'budget_items', id }; logKind = 'budget_change';
        break;
      }
      case 'budget_mark_paid': {
        const d = data as { id?: string; item_id?: string; amount?: number; reference?: string; paid_on: string | null };
        if (d.item_id) {
          const { data: row, error } = await sb.from('budget_payments')
            .insert({ item_id: d.item_id, client_id: clientId, amount: d.amount, reference: d.reference ?? '',
              paid_at: d.paid_on ?? new Date().toISOString().slice(0, 10) })
            .select('id').single();
          if (error) throw error;
          ref = { table: 'budget_payments', id: row.id }; logKind = 'budget_change';
          break;
        }
        const { id, paid_on } = d as { id: string; paid_on: string | null };
        const { data: rows, error } = await sb.from('payments')
          .update({ paid: true, paid_on: paid_on ?? new Date().toISOString().slice(0, 10) })
          .eq('id', id).eq('client_id', clientId).select('id');
        if (error) throw error;
        if (!rows?.length) return { ok: false, error: 'התשלום לא נמצא' };
        ref = { table: 'payments', id }; logKind = 'budget_change';
        break;
      }
      case 'vendor_create': {
        const { status, ...fields } = data as { status: string } & Record<string, unknown>;
        const { data: v1, error } = await sb.from('vendors')
          .upsert({ producer_id: action.producer_id, ...fields }, { onConflict: 'producer_id,name', ignoreDuplicates: false })
          .select('id').single();
        if (error) throw error;
        ref = { table: 'vendors', id: v1.id };
        /* Onto the event too, when there is one: a supplier who quoted for
           this wedding belongs on its suppliers tab, not only in the book. */
        if (action.client_id && (await clientBelongs(sb, action.client_id, action.producer_id))) {
          await sb.from('event_vendors').insert({
            client_id: action.client_id, vendor_id: v1.id, name: fields.name, category: fields.category,
            phone: fields.phone, status,
          });
        }
        break;
      }
      case 'vendor_update': {
        const { id, ...fields } = data as { id: string } & Record<string, unknown>;
        const { data: rows, error } = await sb.from('vendors').update(fields).eq('id', id).eq('producer_id', action.producer_id).select('id');
        if (error) throw error;
        if (!rows?.length) return { ok: false, error: 'הספק לא נמצא' };
        ref = { table: 'vendors', id };
        break;
      }
      case 'task_create': {
        const { notes, ...fields } = data as { notes: string } & Record<string, unknown>;
        const { data: row, error } = await sb.from('tasks').insert({ client_id: clientId, ...fields, notes }).select('id').single();
        if (error) throw error;
        ref = { table: 'tasks', id: row.id };
        break;
      }
      case 'task_complete': {
        /* The tick has one writer, toggleTask, because it is the one that
           revalidates every screen the task is on; the actions check holds
           every file to that. Read first so a task that is not this
           event's is "not found" rather than toggled, and read after so
           the answer is what the row says and not what was asked. */
        const { id } = data as { id: string };
        const { data: before } = await sb.from('tasks').select('id,done').eq('id', id).eq('client_id', clientId).maybeSingle();
        if (!before) return { ok: false, error: 'המשימה לא נמצאה' };
        if (!(before as { done: boolean }).done) {
          const f = new FormData();
          f.set('task_id', id);
          f.set('client_id', clientId);
          f.set('done', 'false');
          await toggleTask(f);
          const { data: after } = await sb.from('tasks').select('done').eq('id', id).maybeSingle();
          if (!(after as { done?: boolean } | null)?.done) return { ok: false, error: 'המשימה לא נסגרה' };
        }
        ref = { table: 'tasks', id }; logKind = 'task_done';
        break;
      }
      case 'timeline_update': {
        const { id, ...fields } = data as { id: string | null; title: string; at_time: string; note: string };
        if (id) {
          const { data: rows, error } = await sb.from('day_schedule').update(fields).eq('id', id).eq('client_id', clientId).select('id');
          if (error) throw error;
          if (!rows?.length) return { ok: false, error: 'שורת הלוז לא נמצאה' };
          ref = { table: 'day_schedule', id };
        } else {
          const { data: row, error } = await sb.from('day_schedule').insert({ client_id: clientId, track: 'shared', ...fields }).select('id').single();
          if (error) throw error;
          ref = { table: 'day_schedule', id: row.id };
        }
        break;
      }
      case 'couple_field_update': {
        const { field, value } = data as { field: string; value: unknown };
        const { data: rows, error } = await sb.from('clients').update({ [field]: value }).eq('id', clientId).select('id');
        if (error) throw error;
        if (!rows?.length) return { ok: false, error: 'האירוע לא נמצא' };
        ref = { table: 'clients', id: clientId };
        break;
      }
      case 'meeting_summary': {
        const { title, summary, held_on } = data as { title: string; summary: string; held_on: string | null };
        const { data: row, error } = await sb.from('meeting_logs').insert({
          client_id: clientId, kind: 'other', title, summary, summary_by: 'model',
          held_on: held_on ?? new Date().toISOString().slice(0, 10),
        }).select('id').single();
        if (error) throw error;
        ref = { table: 'meeting_logs', id: row.id }; logKind = 'meeting';
        break;
      }
      case 'reply_draft':
        /* Nothing to write. The draft is on the screen and in the hand. */
        logTitle = `טיוטת תשובה: ${String((data as { text: string }).text).slice(0, 80)}`;
        break;
    }
  } catch (e) {
    const msg = (e as { message?: string }).message ?? String(e);
    console.error('[inbox] apply failed', { kind, message: msg });
    return { ok: false, error: 'הכתיבה נכשלה: ' + msg.slice(0, 120) };
  }

  if (!QUIET_KINDS.has(kind) || actor === 'system') {
    await sb.from('activity_log').insert({
      producer_id: action.producer_id, client_id: action.client_id, kind: logKind,
      title: logTitle, ref_table: ref?.table ?? '', ref_id: ref?.id ?? null, actor,
    });
  }
  return { ok: true, ref };
}
