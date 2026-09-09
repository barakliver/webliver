'use server';

import { revalidatePath } from 'next/cache';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseServer } from '@/lib/supabase/server';
import { optional } from '@/lib/env';
import { meetingTemplate, type MeetingTemplate } from '@/content/meetings';
import {
  cleanAnswers, writeSummary, summaryPrompt, readModelSummary, joinSummary,
} from '@/lib/ai/meeting';
import { templateFromRow, type MeetingTemplateRow } from '@/lib/meetingTemplates';
import { noteFailure } from '@/lib/flash';

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
  /** For kind 'custom': the producer's own template this was written from. */
  templateId?: string;
  title?: string;
  heldOn?: string;
  answers: Record<string, unknown>;
  visibleToClient?: boolean;
  /** False writes the record only. The producer asks for the paragraph. */
  withModel?: boolean;
}): Promise<MeetingResult> {
  if (!input.clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const sb = await supabaseServer();
  const template = await resolveTemplate(sb, input.kind, input.templateId);
  if (!template) return { ok: false, error: 'סוג פגישה לא מוכר' };

  /* Only keys this template defines survive, and each one is coerced to the
     shape its field declares. A questionnaire posted from a browser is
     attacker controlled. */
  const answers = cleanAnswers(template, input.answers);
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

  const fields = {
    kind: template.kind,
    template_id: template.kind === 'custom' ? (template.id ?? null) : null,
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

/**
 * Which questions this meeting answers.
 *
 * A compiled-in kind resolves from code. A producer's own resolves from their
 * row, read under row level security so a template id that belongs to some
 * other producer comes back as nothing, and nothing is refused above. An
 * archived template still resolves: the log that points at it is being
 * edited, and its questions are exactly the ones it needs.
 */
async function resolveTemplate(
  sb: Awaited<ReturnType<typeof supabaseServer>>, kind: string, templateId?: string,
): Promise<MeetingTemplate | undefined> {
  if (kind !== 'custom') return meetingTemplate(kind);
  if (!templateId) return undefined;
  const { data, error } = await sb.from('meeting_templates')
    .select('id,name,when_text,offset_days,blurb,sections,archived_at')
    .eq('id', templateId)
    .maybeSingle();
  if (error || !data) return undefined;
  return templateFromRow(data as MeetingTemplateRow);
}

export async function deleteMeeting(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  /* The error used to be discarded outright rather than logged: a delete that
     the database refused looked exactly like one it performed, on the screen
     and in the log both. */
  const { error } = await sb.from('meeting_logs').delete().eq('id', id);
  if (error) {
    console.error('[meetings] delete failed', error);
    await noteFailure('לא הצלחנו למחוק את הפגישה. אפשר לנסות שוב.');
  }
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
