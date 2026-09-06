import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { brandFor } from '@/lib/branding';
import { loadPortal } from '@/lib/portal';
import { companionSystem, coupleFacts } from '@/lib/ai/companion';
import { checkLimit } from '@/lib/ai/limit';
import { optional } from '@/lib/env';
import { daysBetween, todayInZone } from '@/lib/clock';

/**
 * The couple's assistant.
 *
 * Couples only, and only about their own event. The event is read with
 * `loadPortal` — the same function their screen is built from — rather than
 * with queries written again here, so the assistant sees exactly what the
 * portal sees and cannot drift into knowing more. Row level security decides
 * the rest.
 *
 * The producer's gates ride on top of that. A producer who hid the budget
 * from this couple made a decision about their client relationship, and the
 * numbers never reach the model at all: not refused, absent.
 *
 * Same wire shape as the other two assistants, so the widget is the same
 * shape too.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = optional('ANTHROPIC_MODEL', 'claude-opus-5');
const MAX_MESSAGE_CHARS = 1200;
const MAX_TURNS = 16;

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

/* Written as the producer would write them. A couple reading an error here is
   reading it from their producer, so none of these mentions a key, a server or
   a model. */
const OFF = 'אי אפשר לענות כאן כרגע. כתבו לנו ונחזור אליכם.';
const BUSY = 'הרבה שאלות ברצף. קחו רגע ונמשיך.';
const BROKE = 'משהו לא עבד לי כרגע. נסו שוב בעוד רגע.';
const NO_WORDS = 'לא הצלחתי לנסח תשובה. אפשר לנסות לשאול אחרת?';

function logFailure(e: unknown): void {
  if (e instanceof Anthropic.AuthenticationError) console.error('[companion] the API key was refused');
  else if (e instanceof Anthropic.RateLimitError) console.error('[companion] rate limited by the API');
  else if (e instanceof Anthropic.APIError) console.error('[companion] API error', { status: e.status, message: e.message });
  else console.error('[companion] failed', e);
}

export async function POST(req: Request) {
  const account = await currentAccount();
  /* Couples only. A producer has their own assistant, which knows more and is
     allowed to. */
  if (!account || account.role !== 'client') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const key = optional('ANTHROPIC_API_KEY');
  if (!key) {
    console.error('[companion] ANTHROPIC_API_KEY is not set');
    return say(OFF, { off: true });
  }

  const verdict = checkLimit(account.id, 'couple');
  if (!verdict.ok) return say(BUSY, { limited: true, retryInSec: verdict.retryInSec });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad request' }, { status: 400 }); }

  const history = readHistory(body);
  if (!history) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const sb = await supabaseServer();
  const brand = await brandFor(account);

  /* Their own workspace, through their own session. The requested id is not
     taken from the body: a couple has one area, and reading it from the
     request would be inviting somebody to name a different one. */
  const data = await loadPortal(sb, { asClient: true }).catch((e) => {
    console.error('[companion] could not read the event', e);
    return null;
  });
  const workspace = data?.workspaces[0] ?? null;
  if (!data || !workspace) return say(OFF, { off: true });

  const id = workspace.id;
  const gates = {
    /* Both must agree. `can` is the module the workspace is sold, and
       budget_visible is this producer's choice for this couple. */
    budget: data.can(id, 'budget') && workspace.budget_visible,
    guests: data.can(id, 'guests'),
    runsheet: data.can(id, 'runsheet'),
  };

  const guests = data.guestsFor(id);
  const facts = coupleFacts({
    coupleName: workspace.display_name,
    eventDate: workspace.event_date,
    venue: workspace.venue ?? '',
    daysToEvent: workspace.event_date ? daysBetween(todayInZone(), workspace.event_date) : null,
    gates,
    openTasks: data.tasksFor(id).filter((t) => !t.done)
      .map((t) => ({ title: t.title, due_on: t.due_on, owner: t.owner })),
    payments: data.paymentsFor(id)
      .map((p) => ({ title: p.title, amount: p.amount, due_on: p.due_on, paid: p.paid })),
    budgetTotal: workspace.budget_target === null ? null : Number(workspace.budget_target),
    guests: {
      invited: guests.length,
      coming: guests.filter((g) => g.status === 'attending').length,
      pending: guests.filter((g) => g.status === 'pending').length,
    },
    schedule: data.dayFor(id).map((d) => ({ at_time: d.at_time, title: d.title })),
  });

  const reachOut = brand.whatsapp
    ? `אפשר לכתוב לנו בוואטסאפ ${brand.whatsapp}`
    : 'אפשר לכתוב לנו כאן ונחזור אליכם';

  const client = new Anthropic({ apiKey: key });
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  /* The instructions are not cached across tenants on purpose: the producer's
     name is inside them, and a cache prefix shared between two businesses is
     exactly the mistake this product must not make. */
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 900,
    output_config: { effort: 'low' },
    system: [
      { type: 'text', text: companionSystem(brand.name || 'ההפקה', reachOut) },
      { type: 'text', text: `נתוני האירוע:\n${facts}` },
    ],
    messages,
  });

  if ((body as { stream?: unknown }).stream !== true) {
    try {
      const final = await stream.finalMessage();
      const text = final.content.filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text).join('').trim();
      return say(text || NO_WORDS);
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
      try {
        for await (const ev of stream) {
          if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta' && ev.delta.text) {
            any = true;
            line({ delta: ev.delta.text });
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') console.warn('[companion] refused', final.stop_details);
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
