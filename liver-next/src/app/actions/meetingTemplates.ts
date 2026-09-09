'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { requireLiveProducer } from '@/lib/auth';
import { noteFailure } from '@/lib/flash';
import { readSections } from '@/lib/meetingTemplates';
import { meetingTemplate } from '@/content/meetings';

export type MeetingTemplateResult = { ok: boolean; error?: string; id?: string };

const NO_SPACE = 'אין מרחב הפקה פעיל';
const FAILED = 'לא הצלחנו לשמור את התבנית';

const refresh = () => {
  revalidatePath('/app/knowledge');
  /* Every event file's meetings tab offers the list; the page is dynamic, so
     this is belt and braces rather than the thing that makes it fresh. */
  revalidatePath('/app/clients/[id]', 'page');
};

/**
 * A producer's own meeting form, saved.
 *
 * The sections are cleaned here with the same function that cleans them on
 * the way out, so what the builder shows after saving is exactly what it
 * showed before. A template with no questions is refused: a meeting form
 * that asks nothing is a title, and a title is not worth a row.
 */
export async function saveMeetingTemplate(input: {
  id?: string;
  name: string;
  when?: string;
  blurb?: string;
  offsetDays?: number | null;
  sections: unknown;
}): Promise<MeetingTemplateResult> {
  const account = await requireLiveProducer();
  const producerId = account.producer?.id;
  if (!producerId) return { ok: false, error: NO_SPACE };

  const name = String(input.name ?? '').trim().slice(0, 120);
  if (!name) return { ok: false, error: 'צריך שם לתבנית' };

  const sections = readSections(input.sections);
  if (sections.length === 0) return { ok: false, error: 'תבנית בלי שאלות לא תשאל כלום' };

  const offset = input.offsetDays === null || input.offsetDays === undefined
    ? null
    : Math.max(-1825, Math.min(1825, Math.round(Number(input.offsetDays) || 0)));

  const sb = await supabaseServer();
  const fields = {
    name,
    when_text: String(input.when ?? '').trim().slice(0, 120),
    blurb: String(input.blurb ?? '').trim().slice(0, 400),
    offset_days: offset,
    sections,
  };

  if (input.id) {
    const { error } = await sb.from('meeting_templates').update(fields).eq('id', input.id);
    if (error) {
      console.error('[meeting-templates] update failed', { message: error.message });
      return { ok: false, error: FAILED };
    }
    refresh();
    return { ok: true, id: input.id };
  }

  const { data, error } = await sb.from('meeting_templates')
    .insert({ ...fields, producer_id: producerId })
    .select('id')
    .maybeSingle();
  if (error || !data) {
    console.error('[meeting-templates] insert failed', { message: error?.message });
    return { ok: false, error: FAILED };
  }
  refresh();
  return { ok: true, id: data.id as string };
}

/**
 * A compiled-in template, copied into the producer's own list so they can
 * change it. The copy is theirs from the first keystroke; the original stays
 * as it was for everybody else.
 */
export async function copyBuiltInTemplate(kind: string): Promise<MeetingTemplateResult> {
  const account = await requireLiveProducer();
  const producerId = account.producer?.id;
  if (!producerId) return { ok: false, error: NO_SPACE };

  const source = meetingTemplate(kind);
  if (!source) return { ok: false, error: 'סוג פגישה לא מוכר' };

  const sb = await supabaseServer();
  const { data, error } = await sb.from('meeting_templates')
    .insert({
      producer_id: producerId,
      name: source.title,
      when_text: source.when,
      blurb: source.blurb,
      offset_days: source.offsetDays,
      sections: source.sections,
    })
    .select('id')
    .maybeSingle();
  if (error || !data) {
    console.error('[meeting-templates] copy failed', { message: error?.message });
    return { ok: false, error: FAILED };
  }
  refresh();
  return { ok: true, id: data.id as string };
}

/**
 * Gone from the list. Deleted outright when no meeting was ever written
 * from it; archived when one was, because that log's answers are keyed by
 * this template's questions and a log with numbers and no labels is not a
 * record of anything. Either way the button says the same thing and the
 * template is not offered again.
 */
export async function removeMeetingTemplate(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!id) { await noteFailure('חסרים פרטים'); return; }
  const sb = await supabaseServer();

  const { count, error: countErr } = await sb.from('meeting_logs')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', id);
  if (countErr) {
    console.error('[meeting-templates] count failed', { message: countErr.message });
    await noteFailure('לא הצלחנו למחוק. אפשר לנסות שוב.');
    return;
  }

  const { error } = (count ?? 0) > 0
    ? await sb.from('meeting_templates').update({ archived_at: new Date().toISOString() }).eq('id', id)
    : await sb.from('meeting_templates').delete().eq('id', id);
  if (error) {
    console.error('[meeting-templates] remove failed', { message: error.message });
    await noteFailure('לא הצלחנו למחוק. אפשר לנסות שוב.');
    return;
  }
  refresh();
}
