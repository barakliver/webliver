import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount, isLive } from '@/lib/auth';
import { COPILOT_SYSTEM, eventContext, situation } from '@/lib/ai/copilot';
import { checkLimit } from '@/lib/ai/limit';
import { optional } from '@/lib/env';

/**
 * The producer's assistant.
 *
 * Signed in only, and only a producer: the route reads the event through the
 * caller's own session, so it can never say more than the screen would. The
 * rate limit is per account rather than per address, because an account is
 * the thing the bill is about.
 *
 * Same wire shape as the concierge: newline-delimited JSON when asked to
 * stream, one object otherwise. The first line carries the name of the event
 * the answer is about, so the widget can say so.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = optional('ANTHROPIC_MODEL', 'claude-opus-5');
const MAX_MESSAGE_CHARS = 2000;
const MAX_TURNS = 24;

type Incoming = { role: 'user' | 'assistant'; content: string };

function readHistory(body: unknown): Incoming[] | null {
  if (!body || typeof body !== 'object') return null;
  const raw = (body as { messages?: unknown }).messages;
  if (!Array.isArray(raw)) return null;
  const out: Incoming[] = [];
  for (const item of raw.slice(-MAX_TURNS)) {
    if (!item || typeof item !== 'object') continue;
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string') continue;
    const text = content.trim().slice(0, MAX_MESSAGE_CHARS);
    if (text) out.push({ role, content: text });
  }
  return out.length > 0 ? out : null;
}

const say = (reply: string, extra: Record<string, unknown> = {}) => NextResponse.json({ reply, ...extra });

const OFF = 'העוזר לא פעיל כרגע. מפתח ה-API לא הוגדר בשרת.';
const BUSY = 'הרבה בקשות ברצף. קחו רגע ונמשיך.';
const BROKE = 'משהו נתקע אצלי. נסו שוב בעוד רגע.';
const NO_WORDS = 'לא הצלחתי לנסח תשובה. אפשר לנסות לשאול אחרת?';

function logFailure(e: unknown): void {
  if (e instanceof Anthropic.AuthenticationError) console.error('[copilot] the API key was refused');
  else if (e instanceof Anthropic.RateLimitError) console.error('[copilot] rate limited by the API');
  else if (e instanceof Anthropic.APIError) console.error('[copilot] API error', { status: e.status, message: e.message });
  else console.error('[copilot] failed', e);
}

export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account || account.role === 'client' || !isLive(account)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const key = optional('ANTHROPIC_API_KEY');
  if (!key) {
    console.error('[copilot] ANTHROPIC_API_KEY is not set');
    return say(OFF, { off: true });
  }

  const verdict = checkLimit(`account:${account.id}`);
  if (!verdict.ok) return say(BUSY, { limited: true, retryInSec: verdict.retryInSec });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad request' }, { status: 400 }); }

  const history = readHistory(body);
  if (!history) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const clientId = typeof (body as { clientId?: unknown }).clientId === 'string'
    ? (body as { clientId: string }).clientId
    : null;

  const sb = await supabaseServer();
  const event = await eventContext(sb, clientId).catch((e) => { console.error('[copilot] context failed', e); return null; });
  const eventName = event ? event.split('\n')[0].replace(/^אירוע: /, '').replace(/ \(.*\)$/, '') : null;

  const today = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const brand = account.producer?.brandName || 'ההפקה';

  const client = new Anthropic({ apiKey: key });
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 1500,
    output_config: { effort: 'low' },
    /* The book and the playbook cached; the situation after them, so the
       cached prefix is identical on every request from every producer. */
    system: [
      { type: 'text', text: COPILOT_SYSTEM, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: situation({ brand, today, event }) },
    ],
    messages,
  });

  const wantsStream = (body as { stream?: unknown }).stream === true;

  if (!wantsStream) {
    try {
      const final = await stream.finalMessage();
      const text = final.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('').trim();
      return say(text || NO_WORDS, { event: eventName });
    } catch (e) {
      logFailure(e);
      return say(BROKE, { failed: true });
    }
  }

  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      const line = (o: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(o)}\n`));
      let any = false;
      line({ event: eventName });
      try {
        for await (const ev of stream) {
          if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta' && ev.delta.text) {
            any = true;
            line({ delta: ev.delta.text });
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') { console.warn('[copilot] refused', final.stop_details); }
        if (!any) line({ delta: NO_WORDS });
        line({ done: true });
      } catch (e) {
        logFailure(e);
        if (!any) line({ delta: BROKE });
        line({ done: true, failed: true });
      }
      controller.close();
    },
  });

  return new Response(out, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
}
