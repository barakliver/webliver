import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabasePublic } from '@/lib/supabase/public';
import { CONCIERGE_SYSTEM, SAVE_ENQUIRY_TOOL } from '@/lib/ai/concierge';
import { checkLimit, visitorKeyFrom } from '@/lib/ai/limit';
import { optional } from '@/lib/env';

/**
 * The concierge on the public site.
 *
 * Three things this route is careful about, in the order they cost money or
 * trust:
 *
 * It is a paid API call made by an anonymous stranger, so it is rate limited
 * before anything else happens and the history it will accept is capped. The
 * ceiling is on the bill, not on politeness.
 *
 * The system prompt lives here and is never accepted from the browser. A
 * widget whose instructions arrive in the request body is a widget anybody can
 * turn into their own chatbot running on this business's account.
 *
 * It can do exactly one thing besides talk: save an enquiry. Not read one. A
 * public endpoint that can query the database is one prompt away from telling
 * a stranger about somebody else's wedding.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = optional('ANTHROPIC_MODEL', 'claude-opus-5');
const MAX_MESSAGE_CHARS = 1000;
const MAX_TURNS = 20;

type Incoming = { role: 'user' | 'assistant'; content: string };

/** Everything the browser sends, treated as text somebody typed. Roles are
 *  narrowed to two, so a crafted body cannot slip in a system turn. */
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

/** Files the enquiry the same way the webhook does, through the one narrow
 *  door the anon role may open. Failure is reported to the model rather than
 *  to the visitor: it can then say "I could not save that, here is the
 *  WhatsApp number" instead of pretending. */
async function saveEnquiry(input: Record<string, unknown>): Promise<string> {
  const str = (k: string) => (typeof input[k] === 'string' ? (input[k] as string).trim() : '');
  const name = str('full_name');
  const phone = str('phone');
  const email = str('email');

  if (!name || (!phone && !email)) return 'לא נשמר: חסר שם או דרך ליצור קשר.';

  const guests = Number(input.guest_count);
  const date = str('event_date');

  try {
    const sb = supabasePublic();
    const { error } = await sb.rpc('ingest_lead', {
      p_full_name: name,
      p_phone: phone,
      p_email: email,
      p_kind: input.kind === 'corporate' ? 'corporate' : 'wedding',
      p_event_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      p_guest_count: Number.isFinite(guests) && guests > 0 ? Math.round(guests) : null,
      p_message: str('message'),
      p_source: 'ai_concierge',
      p_external_id: null,
    });
    if (error) {
      console.error('[concierge] could not save the enquiry', error);
      return 'לא נשמר בגלל תקלה טכנית. הצע לפונה לכתוב בוואטסאפ.';
    }
    return 'נשמר. ברק יקבל את הפנייה.';
  } catch (e) {
    console.error('[concierge] save threw', e);
    return 'לא נשמר בגלל תקלה טכנית. הצע לפונה לכתוב בוואטסאפ.';
  }
}

const say = (reply: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ reply, ...extra });

export async function POST(req: Request) {
  const key = optional('ANTHROPIC_API_KEY');
  if (!key) {
    /* Answered as a normal reply rather than as an error, so a site with no key
       configured has a polite concierge that points at a human instead of a
       widget that looks broken. */
    console.error('[concierge] ANTHROPIC_API_KEY is not set');
    return say('העוזר הדיגיטלי לא פעיל כרגע. אפשר לכתוב לברק בוואטסאפ ונחזור אליכם.', { off: true });
  }

  const verdict = checkLimit(visitorKeyFrom(req.headers));
  if (!verdict.ok) {
    return say(
      verdict.reason === 'visitor'
        ? 'שלחתם הרבה הודעות ברצף. קחו רגע ונמשיך, או כתבו לברק בוואטסאפ.'
        : 'העוזר עמוס כרגע. אפשר לכתוב לברק בוואטסאפ והוא יחזור אליכם.',
      { limited: true, retryInSec: verdict.retryInSec }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  const history = readHistory(body);
  if (!history) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const client = new Anthropic({ apiKey: key });
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  try {
    let saved = false;

    /* At most one round of tool use. The concierge has one tool and one reason
       to call it, so a loop here would only ever be a loop. */
    for (let round = 0; round < 2; round += 1) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        /* Short answers in a chat bubble. Low effort because this is a
           conversation about a wedding, not a problem to reason through, and
           latency is what makes a widget feel alive. */
        output_config: { effort: 'low' },
        system: CONCIERGE_SYSTEM,
        tools: [SAVE_ENQUIRY_TOOL],
        messages,
      });

      if (response.stop_reason === 'refusal') {
        console.warn('[concierge] refused', response.stop_details);
        return say('אני מעדיף לא לענות על זה. אפשר לשאול אותי על התהליך, על מה שכלול, או לקבוע פגישה.');
      }

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );

      if (toolUses.length === 0) {
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        return say(text || 'לא הצלחתי לנסח תשובה. אפשר לנסות לשאול אחרת?', { saved });
      }

      messages.push({ role: 'assistant', content: response.content });

      /* Every result goes back in one user message. Splitting them teaches the
         model to stop calling tools in parallel, and a dropped result leaves
         the conversation with a call nobody answered. */
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        if (use.name !== SAVE_ENQUIRY_TOOL.name) {
          results.push({ type: 'tool_result', tool_use_id: use.id, content: 'כלי לא מוכר.', is_error: true });
          continue;
        }
        const outcome = await saveEnquiry(use.input as Record<string, unknown>);
        if (outcome.startsWith('נשמר')) saved = true;
        results.push({ type: 'tool_result', tool_use_id: use.id, content: outcome });
      }
      messages.push({ role: 'user', content: results });
    }

    return say('קיבלתי את הפרטים. ברק יחזור אליכם.', { saved: true });
  } catch (e) {
    /* Most specific first, so a rate limit and a bad key do not come back as
       the same sentence in the log. The visitor sees one message either way,
       because none of these are their problem to solve. */
    if (e instanceof Anthropic.AuthenticationError) {
      console.error('[concierge] the API key was refused');
    } else if (e instanceof Anthropic.RateLimitError) {
      console.error('[concierge] rate limited by the API');
    } else if (e instanceof Anthropic.APIError) {
      console.error('[concierge] API error', { status: e.status, message: e.message });
    } else {
      console.error('[concierge] failed', e);
    }
    return say('משהו נתקע אצלי. אפשר לכתוב לברק בוואטסאפ והוא יחזור אליכם.', { failed: true });
  }
}
