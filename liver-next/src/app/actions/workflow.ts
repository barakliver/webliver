'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { requireLiveProducer } from '@/lib/auth';
import { MEETING_TEMPLATES } from '@/content/meetings';
import { FIRST_PLAN } from '@/content/plan';

export type WorkflowResult = { ok: boolean; error?: string; added?: number };

type Step = {
  title: string;
  offset_days: number;
  owner: 'producer' | 'client';
  note?: string;
  /** Whether the couple sees this one. Absent means yes, which is what the
   *  RPC already defaults to and what almost every step wants. */
  visible_to_client?: boolean;
};

/** A step, as it is allowed to be stored. Offsets are clamped to five years
 *  either side: a template with a step ten thousand days out is a typo, and it
 *  would land a task on a date nobody will ever look at. */
function cleanStep(raw: unknown): Step | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const title = String(o.title ?? '').trim().slice(0, 200);
  if (!title) return null;

  const days = Math.round(Number(o.offset_days) || 0);
  return {
    title,
    offset_days: Math.max(-1825, Math.min(1825, days)),
    owner: o.owner === 'client' ? 'client' : 'producer',
    note: String(o.note ?? '').trim().slice(0, 500) || undefined,
    /* Carried rather than dropped. This used to fall off here, which nothing
       noticed while every seeded step was visible anyway. The production plan
       has steps that are deliberately not — supplier balances, the equipment
       call sheet — and losing the flag on an edit would quietly show a couple
       the machinery the next time their producer renamed a step. */
    visible_to_client: o.visible_to_client === false ? false : undefined,
  };
}

export async function saveTemplate(input: {
  id?: string; name: string; kind?: string; steps: unknown[];
}): Promise<WorkflowResult> {
  const account = await requireLiveProducer();
  const producerId = account.producer?.id;
  if (!producerId) return { ok: false, error: 'אין מרחב הפקה פעיל' };

  const name = String(input.name ?? '').trim().slice(0, 120);
  if (!name) return { ok: false, error: 'צריך שם לתבנית' };

  const steps = (Array.isArray(input.steps) ? input.steps : [])
    .map(cleanStep)
    .filter((s): s is Step => s !== null)
    .slice(0, 200);

  if (steps.length === 0) return { ok: false, error: 'תבנית בלי שלבים לא תעשה כלום' };

  const kind = ['tasks', 'meetings', 'budget', 'suppliers'].includes(String(input.kind))
    ? String(input.kind) : 'tasks';

  const sb = await supabaseServer();
  const fields = { name, kind, steps };

  const { error } = input.id
    ? await sb.from('producer_workflow_templates').update(fields).eq('id', input.id)
    : await sb.from('producer_workflow_templates').insert({ ...fields, producer_id: producerId });

  if (error) return { ok: false, error: 'לא הצלחנו לשמור את התבנית' };

  revalidatePath('/app/knowledge');
  return { ok: true };
}

export async function deleteTemplate(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('producer_workflow_templates').delete().eq('id', id);
  revalidatePath('/app/knowledge');
}

/**
 * Applying one to an event, dated from the wedding.
 *
 * The database does the dating and the duplicate check, so applying twice
 * fills in what is missing rather than refusing over one step that already
 * exists. An event with no date yet still gets its checklist, undated — the
 * week a file is opened is exactly when the list is most wanted.
 */
export async function applyTemplate(clientId: string, templateId: string): Promise<WorkflowResult> {
  if (!clientId || !templateId) return { ok: false, error: 'חסרים פרטים' };

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('apply_workflow_template', {
    p_client: clientId, p_template: templateId,
  });

  if (error) {
    console.error('[workflow] apply refused', { message: error.message });
    return { ok: false, error: 'לא הצלחנו להחיל את התבנית' };
  }

  revalidatePath(`/app/clients/${clientId}`);
  return { ok: true, added: Number(data) || 0 };
}

/**
 * The four standard meetings, as a starting template a producer can then edit.
 *
 * Seeded rather than compiled in, so the first thing a producer does with them
 * is change them. A template nobody can change is a template nobody uses, and
 * these four dates are Barak's habits rather than laws of weddings.
 */
export async function seedMeetingTemplate(): Promise<WorkflowResult> {
  const account = await requireLiveProducer();
  const producerId = account.producer?.id;
  if (!producerId) return { ok: false, error: 'אין מרחב הפקה פעיל' };

  const sb = await supabaseServer();
  const { error } = await sb.from('producer_workflow_templates').insert({
    producer_id: producerId,
    name: 'ארבע פגישות התיאום',
    kind: 'meetings',
    steps: MEETING_TEMPLATES.map((m) => ({
      title: `${m.title} · ${m.when}`,
      offset_days: m.offsetDays,
      owner: 'producer',
      note: m.blurb,
    })),
  });

  if (error) return { ok: false, error: 'לא הצלחנו ליצור את התבנית' };

  revalidatePath('/app/knowledge');
  return { ok: true, added: MEETING_TEMPLATES.length };
}

/* The name it is stored under. Used to find it again rather than making a
   second copy, so a producer who asks for the plan twice gets one plan. */
const PLAN_NAME = 'תוכנית הפקה מלאה';

/**
 * The plan a first event actually needs, seeded and applied in one go.
 *
 * The book's third first step is "load a schedule from a template", and a
 * producer who signed up this morning owns no templates, so that step has
 * always pointed at an empty screen. This is the step doing what it says: the
 * twenty-eight-step production plan lands as an ordinary editable template and
 * is applied to the event in the same click.
 *
 * Two things it deliberately does not do. It does not make a second copy for a
 * producer who asks twice — it finds the one they have and applies that, so
 * the plan stays one document they are editing rather than a pile of
 * near-identical templates. And it does not overwrite: `apply_workflow_template`
 * skips a title already on the event, so applying it to a wedding that is
 * halfway planned fills in the gaps and leaves the existing work alone.
 */
export async function startFirstPlan(clientId: string): Promise<WorkflowResult> {
  if (!clientId) return { ok: false, error: 'חסר אירוע' };

  const account = await requireLiveProducer();
  const producerId = account.producer?.id;
  if (!producerId) return { ok: false, error: 'אין מרחב הפקה פעיל' };

  const sb = await supabaseServer();

  /* Row level security already scopes this to the producer, so the name is
     enough to find their own copy and cannot reach anybody else's. */
  const { data: existing } = await sb
    .from('producer_workflow_templates')
    .select('id')
    .eq('name', PLAN_NAME)
    .limit(1)
    .maybeSingle();

  let templateId = existing?.id as string | undefined;

  if (!templateId) {
    const { data: made, error } = await sb
      .from('producer_workflow_templates')
      .insert({
        producer_id: producerId,
        name: PLAN_NAME,
        kind: 'tasks',
        steps: FIRST_PLAN.map((s) => ({
          title: s.title,
          offset_days: s.offsetDays,
          owner: s.owner,
          note: s.note,
          visible_to_client: s.visibleToClient,
        })),
      })
      .select('id')
      .single();

    if (error || !made) {
      console.error('[workflow] could not seed the first plan', { message: error?.message });
      return { ok: false, error: 'לא הצלחנו ליצור את התוכנית' };
    }
    templateId = made.id as string;
  }

  const applied = await applyTemplate(clientId, templateId);
  revalidatePath('/app/knowledge');
  revalidatePath('/app');
  return applied;
}
