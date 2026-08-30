'use server';

import { revalidatePath } from 'next/cache';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseServer } from '@/lib/supabase/server';
import { optional } from '@/lib/env';
import { meetingTemplate } from '@/content/meetings';
import {
  cleanAnswers, writeSummary, summaryPrompt, readModelSummary, joinSummary,
} from '@/lib/ai/meeting';

export type MeetingResult = { ok: boolean; error?: string; id?: string; summary?: string };

const refresh = (clientId: string) => {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
};

/**
 * A meeting, saved with what was said in it.
 *
 * The summary is written here rather than by the screen, so a log saved from
 * anywhere carries one. Two ways, and the plain one is not a fallback: it is
 * the record, built from the answers with no model and no network, and it is
 * what the version history keeps. The model, when there is a key, adds a
 * paragraph on top saying what was decided. If it fails, the record stands and
 * nothing about the save changes.
 */
export async function saveMeeting(input: {
  id?: string;
  clientId: string;
  kind: string;
  title?: string;
  heldOn?: string;
  answers: Record<string, unknown>;
  visibleToClient?: boolean;
  /** False writes the record only. The producer asks for the paragraph. */
  withModel?: boolean;
}): Promise<MeetingResult> {
  const template = meetingTemplate(input.kind);
  if (!template) return { ok: false, error: 'סוג פגישה לא מוכר' };
  if (!input.clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  /* Only keys this template defines survive, and each one is coerced to the
     shape its field declares. A questionnaire posted from a browser is
     attacker controlled. */
  const answers = cleanAnswers(input.kind, input.answers);
  const record = writeSummary(template, answers);

  let prose = '';
  let by: 'none' | 'model' | 'person' = record ? 'person' : 'none';

  if (input.withModel && record) {
    prose = await askForProse(template.title, summaryPrompt(template, answers));
    if (prose) by = 'model';
  }

  const summary = joinSummary(prose, record);
  const heldOn = /^\d{4}-\d{2}-\d{2}$/.test(String(input.heldOn ?? ''))
    ? String(input.heldOn) : null;

  const sb = await supabaseServer();
  const fields = {
    kind: input.kind,
    title: String(input.title ?? template.title).trim().slice(0, 200),
    held_on: heldOn,
    answers,
    summary,
    summary_by: by,
    visible_to_client: input.visibleToClient === true,
  };

  if (input.id) {
    const { error } = await sb.from('meeting_logs').update(fields).eq('id', input.id);
    if (error) return { ok: false, error: 'לא הצלחנו לשמור את הפגישה' };
    refresh(input.clientId);
    return { ok: true, id: input.id, summary };
  }

  const { data, error } = await sb
    .from('meeting_logs')
    .insert({ ...fields, client_id: input.clientId })
    /* Selected back by id rather than by `returning *`, because a select
       policy is applied to the returned row and the producer's own policy
       admits it. 0036 is the whole story of getting that wrong. */
    .select('id')
    .maybeSingle();

  if (error || !data) return { ok: false, error: 'לא הצלחנו לשמור את הפגישה' };

  refresh(input.clientId);
  return { ok: true, id: data.id as string, summary };
}

export async function deleteMeeting(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('meeting_logs').delete().eq('id', id);
  refresh(clientId);
}

/**
 * The paragraph, when there is a key for one.
 *
 * Given the answers and nothing else — no guest list, no budget, no other
 * event. It cannot fail loudly: every path out of here returns a string, and
 * an empty one means the record stands on its own.
 */
async function askForProse(title: string, prompt: string): Promise<string> {
  const key = optional('ANTHROPIC_API_KEY');
  if (!key) return '';

  try {
    const anthropic = new Anthropic({ apiKey: key });
    const res = await anthropic.messages.create({
      model: optional('ANTHROPIC_MODEL', 'claude-opus-5'),
      max_tokens: 900,
      system:
        'את/ה מסכם/ת פגישות הפקה של אירועים בישראל. כותב/ת בעברית, בגוף שלישי, '
        + 'קצר ועובדתי. אסור להמציא פרט שלא נמסר, אסור להמליץ, ואסור לציין מה חסר.',
      messages: [{ role: 'user', content: prompt }],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    return readModelSummary(text);
  } catch (e) {
    /* Named in the log because a producer pressing "write me a summary" and
       silently getting only the record deserves an explanation somewhere. */
    console.error('[meetings] the model could not write a summary', {
      title, message: e instanceof Error ? e.message : String(e),
    });
    return '';
  }
}
