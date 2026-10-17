import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * One line per call to the model, with what it cost.
 *
 * Best effort beside the call it describes: a log that could fail the
 * reading would be a log that costs more than it tells. The price list is a
 * rough one in agorot per million tokens and is here to be corrected, not
 * believed to the shekel; the point is that the month can be added up at
 * all.
 */
const PRICE_PER_MILLION: Record<string, { input: number; output: number }> = {
  /* agorot per million tokens; 100 agorot = 1 shekel. */
  'claude-haiku-5-5': { input: 400, output: 2000 },
  'claude-sonnet-5-5': { input: 1200, output: 6000 },
  'claude-opus-5-5': { input: 6000, output: 30000 },
  'claude-opus-5': { input: 6000, output: 30000 },
};

export function estimateAgorot(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICE_PER_MILLION[model] ?? PRICE_PER_MILLION['claude-sonnet-5-5'];
  return Math.round((inputTokens * p.input + outputTokens * p.output) / 1_000_000);
}

export async function logAiCall(sb: SupabaseClient, row: {
  producer_id: string | null; purpose: string; model: string;
  input_tokens?: number; output_tokens?: number; latency_ms?: number;
  ok?: boolean; error?: string; ref_table?: string; ref_id?: string | null;
}): Promise<void> {
  try {
    const inp = row.input_tokens ?? 0;
    const out = row.output_tokens ?? 0;
    await sb.from('ai_calls').insert({
      producer_id: row.producer_id, purpose: row.purpose.slice(0, 60), model: row.model.slice(0, 80),
      input_tokens: inp, output_tokens: out, latency_ms: row.latency_ms ?? 0,
      cost_agorot: estimateAgorot(row.model, inp, out),
      ok: row.ok ?? true, error: (row.error ?? '').slice(0, 500),
      ref_table: row.ref_table ?? '', ref_id: row.ref_id ?? null,
    });
  } catch (e) {
    console.warn('[ai] could not log the call', { message: e instanceof Error ? e.message : String(e) });
  }
}
