import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { currentAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { optional } from '@/lib/env';
import { readReceipt } from '@/lib/ai/receipt';

/**
 * A photograph of a receipt, read into the fields of a budget line.
 *
 * The whole design of this route is in one sentence: **it never writes
 * anything.** It reads an image and hands back what it thinks it says, and a
 * person presses the button that saves it. A misread receipt that quietly
 * becomes a budget line is worse than no scanner at all, because the number is
 * now wrong in the one place nobody re-checks.
 *
 * So: no database write, no storage, the photograph is not kept. It exists for
 * the length of one request and the only thing that survives is four fields in
 * a form somebody is looking at.
 *
 * Authenticated, and authorised against the event. Row level security already
 * limits which events this account can read, so the lookup below is the check:
 * a client id that comes back empty is one this account has no business
 * spending money on.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = optional('ANTHROPIC_MODEL', 'claude-opus-5');

/* A phone photograph of a receipt is around 300KB once the browser has scaled
   it down, and 4MB if it has not. The cap is on the base64, which is what
   actually arrives, and it is generous enough that the only thing it stops is
   somebody sending the original. */
const MAX_BASE64 = 7_000_000;

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type Media = (typeof ALLOWED)[number];

const READER = `את/ה קורא/ת קבלות וחשבוניות של ספקים לאירועים בישראל.

מהתמונה חלץ/י:
· שם הספק או העסק
· על מה התשלום, בשתיים עד ארבע מילים
· הסכום הסופי לתשלום כולל מע"מ, כמספר בלבד
· תאריך המסמך

כללים שאסור לשבור:
· אם ערך לא מופיע במסמך או שאינו קריא, החזר/י אותו ריק. אל תשלים/י ואל תנחש/י
· הסכום הוא הסופי לתשלום. לא ביניים, לא לפני מע"מ, ולא שורה בודדת מתוך כמה
· אם התמונה אינה קבלה או חשבונית, החזר/י הכל ריק וסמן/י confidence כ-low
· התאריך בפורמט YYYY-MM-DD בלבד`;

const RECEIPT_TOOL: Anthropic.Tool = {
  name: 'record_receipt',
  description: 'מוסר את מה שנקרא מהקבלה. שדה שלא נקרא נשאר ריק.',
  input_schema: {
    type: 'object',
    properties: {
      vendor: { type: 'string', description: 'שם הספק. ריק אם לא ברור.' },
      label:  { type: 'string', description: 'על מה התשלום, שתיים עד ארבע מילים.' },
      amount: { type: 'number', description: 'הסכום הסופי כולל מע"מ. 0 אם לא נקרא.' },
      date:   { type: 'string', description: 'YYYY-MM-DD, או מחרוזת ריקה.' },
      confidence: { type: 'string', enum: ['high', 'low'], description: 'low כשמשהו מנוחש.' },
    },
    required: ['vendor', 'label', 'amount', 'date', 'confidence'],
    additionalProperties: false,
  },
};

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const key = optional('ANTHROPIC_API_KEY');
  if (!key) return fail('קריאת קבלות לא מוגדרת בשרת.', 503);

  const account = await currentAccount();
  if (!account) return fail('צריך להתחבר.', 401);
  /* A couple may see the budget; only the producer adds to it. Reading a
     receipt is part of adding to it. */
  if (account.role === 'client') return fail('אין לך הרשאה לפעולה הזאת.', 403);

  let body: unknown;
  try { body = await req.json(); } catch { return fail('בקשה לא תקינה.'); }

  const { client_id: clientId, media_type: mediaType, data } =
    (body ?? {}) as { client_id?: unknown; media_type?: unknown; data?: unknown };

  if (typeof clientId !== 'string' || !clientId) return fail('חסר מזהה אירוע.');
  if (typeof data !== 'string' || !data) return fail('לא התקבלה תמונה.');
  if (data.length > MAX_BASE64) return fail('התמונה גדולה מדי. נסו לצלם שוב.');
  if (!ALLOWED.includes(mediaType as Media)) return fail('אפשר לצלם או להעלות תמונה בלבד.');

  /* Authorisation, through the policies rather than around them. */
  const sb = await supabaseServer();
  const { data: client } = await sb.from('clients').select('id').eq('id', clientId).maybeSingle();
  if (!client) return fail('אין לך הרשאה לאירוע הזה.', 403);

  try {
    const anthropic = new Anthropic({ apiKey: key });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      /* Reading a photograph of a crumpled thermal receipt is the part of this
         that is actually hard, and it is the part that decides whether the
         number is right. Not the place to save a second. */
      output_config: { effort: 'high' },
      system: READER,
      tools: [RECEIPT_TOOL],
      /* Forced, because there is exactly one thing to do with this image and a
         paragraph describing the receipt is not it. */
      tool_choice: { type: 'tool', name: RECEIPT_TOOL.name },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType as Media, data } },
          { type: 'text', text: 'קרא/י את הקבלה הזאת.' },
        ],
      }],
    });

    if (response.stop_reason === 'refusal') {
      console.warn('[receipt] refused', response.stop_details);
      return fail('לא הצלחתי לקרוא את התמונה הזאת.', 422);
    }

    const use = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === RECEIPT_TOOL.name
    );
    if (!use) return fail('לא הצלחתי לקרוא את הקבלה. אפשר למלא ידנית.', 422);

    return NextResponse.json({ ok: true, receipt: readReceipt(use.input as Record<string, unknown>) });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      console.error('[receipt] the API key was refused');
    } else if (e instanceof Anthropic.RateLimitError) {
      console.error('[receipt] rate limited by the API');
    } else if (e instanceof Anthropic.APIError) {
      console.error('[receipt] API error', { status: e.status, message: e.message });
    } else {
      console.error('[receipt] failed', e);
    }
    return fail('משהו נתקע בקריאה. אפשר למלא ידנית.', 502);
  }
}
