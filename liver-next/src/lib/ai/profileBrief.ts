import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { optional } from '@/lib/env';
import { logAiCall } from '@/lib/ai/log';
import { INTAKE } from '@/content/intake';
import { answerText, type Answer } from '@/lib/intake';

/**
 * One page before the first meeting.
 *
 * Who they are, three things to remember, three open questions to ask,
 * and anything that reads as a flag. From the answers alone: the model
 * sees the questionnaire and nothing else about the event, and the page
 * is kept in `couple_profiles_private`, which the couple has no policy
 * on, because it quotes the private chapter.
 */
const SYSTEM = `אתה עוזר למפיק אירועים ישראלי להתכונן לפגישת היכרות ראשונה עם זוג, מתוך שאלון שהם מילאו.
כתוב בעברית, חם וענייני, בלי שמות תואר מיותרים ובלי קווים מפרידים ארוכים.
מבנה קבוע, בכותרות קצרות:
מי הם (שלוש עד חמש שורות)
שלושה דברים לזכור
שלוש שאלות פתוחות לפגישה
דגלים (רגישויות, פערים בין בני הזוג, לחצים). אם אין, כתוב "אין".
אל תמציא מה שלא נכתב. אם שאלה לא נענתה, אל תנחש.`;

export async function writeBrief(sb: SupabaseClient, clientId: string, producerId: string | null): Promise<{ ok: boolean; error?: string }> {
  const key = optional('ANTHROPIC_API_KEY');
  if (!key) return { ok: false, error: 'המודל לא מוגדר בשרת' };

  const { data } = await sb.from('questionnaire_responses')
    .select('question_key,answered_by,value,visibility,updated_at').eq('client_id', clientId).eq('form_key', 'couple_intake');
  const answers = (data ?? []) as Answer[];
  if (answers.length === 0) return { ok: false, error: 'עוד אין תשובות לקרוא' };

  const writers = [...new Set(answers.map((a) => a.answered_by))];
  const who = (id: string) => `בן זוג ${writers.indexOf(id) + 1}`;
  const lines: string[] = [];
  for (const ch of INTAKE) {
    lines.push(`## ${ch.he}${ch.private ? ' (כל אחד לבד)' : ''}`);
    for (const q of ch.questions) {
      const rows = answers.filter((a) => a.question_key === q.key);
      for (const a of rows) {
        const t = answerText(q, a.value);
        if (t) lines.push(`- ${q.he}${rows.length > 1 || ch.private ? ` (${who(a.answered_by)})` : ''}: ${t}`);
      }
    }
  }

  const model = optional('ANTHROPIC_MODEL', 'claude-sonnet-5-5');
  const started = Date.now();
  try {
    const anthropic = new Anthropic({ apiKey: key });
    const res = await anthropic.messages.create({
      model, max_tokens: 1200, system: SYSTEM,
      messages: [{ role: 'user', content: `השאלון:\n${lines.join('\n').slice(0, 24000)}` }],
    });
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
    await logAiCall(sb, {
      producer_id: producerId, purpose: 'profile_brief', model,
      input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens, latency_ms: Date.now() - started,
      ok: Boolean(text), ref_table: 'clients', ref_id: clientId,
    });
    if (!text) return { ok: false, error: 'המודל לא החזיר תקציר' };
    const { error } = await sb.from('couple_profiles_private')
      .upsert({ client_id: clientId, brief: text.slice(0, 12000), brief_at: new Date().toISOString() }, { onConflict: 'client_id' });
    if (error) return { ok: false, error: 'התקציר נכתב ולא נשמר' };
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logAiCall(sb, { producer_id: producerId, purpose: 'profile_brief', model, latency_ms: Date.now() - started, ok: false, error: message, ref_table: 'clients', ref_id: clientId });
    console.error('[profileBrief] failed', { message });
    return { ok: false, error: 'המודל לא הצליח לכתוב את התקציר' };
  }
}
