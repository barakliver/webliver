import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { currentAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { optional } from '@/lib/env';
import { FONT_PAIR_KEYS, PALETTE_ROLES, readBrand, type WeddingBrand } from '@/content/brandKit';

/**
 * The inspiration board, read as a creative director reads it.
 *
 * Up to twelve of the couple's photographs go to the model in one request,
 * with whatever the producer typed about the vibe, and what comes back is a
 * brand sheet: five colours with a role each, one of the Hebrew-capable font
 * pairings, three words, the motifs that repeat, a voice, and which
 * direction won when two pictures disagreed.
 *
 * Like the receipt reader, this writes nothing. The sheet lands in a form
 * the producer is looking at, and the save is a separate press; a reading
 * the producer disagrees with is corrected before it becomes the brand.
 *
 * Producer only, by the cost of the call and by the role: the couple sees
 * the result and picks between the options, they do not run the reading.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = optional('ANTHROPIC_MODEL', 'claude-opus-5');
const MAX_IMAGES = 12;
const MAX_BYTES = 5 * 1024 * 1024;
const MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type Media = (typeof MEDIA)[number];

const DIRECTOR = `את/ה מנהל/ת קריאייטיב לחתונות. לא בלוג חתונות: החלטי/ת, בטוח/ה, עם דעה.
מולך לוח השראה של זוג (תמונות שהם אספו) וכמה מילים שלהם. הפק/י מהלוח מותג שלם.

מה להפיק:
· פלטה של חמישה צבעים, כל אחד עם תפקיד: ראשי, משני, הדגשה, נייר (הבהיר), דיו (הכהה). הקסדצימלי מדויק, ושם קצר בעברית לכל צבע.
· זוג גופנים מהרשימה בלבד. כולם מכילים עברית. הראשון לשמות, השני לטקסט.
· שלוש מילים שמסכמות את העולם החזותי. הן הקול של המותג.
· שניים עד שלושה מוטיבים או פרטים שחוזרים בתמונות (למשל: כלי זכוכית מחורצים, עלי דקל יבשים, שולי נייר קרועים).
· קול המותג בשני משפטים.
· הכיוון: אם שתי תמונות סותרות, בחר/י את הכיוון החזק ואמור/אמרי למה. שלוש עד חמש שורות.
· לאיזו מהגרסאות הלוח נוטה: השקטה או הנועזת, ולמה במשפט.

כללים:
· צבעים שהזוג ביקש נכנסים; צבעים שאסרו לא נכנסים.
· אל תמציא/י מה שאין בתמונות. אם הלוח דל, אמור/אמרי שהקריאה רזה בשדה הכיוון.
· עברית טבעית, בלי קו מפריד ארוך, בלי סימני קריאה.`;

const TOOL: Anthropic.Tool = {
  name: 'brand_sheet',
  description: 'דף המותג שנקרא מהלוח.',
  input_schema: {
    type: 'object',
    properties: {
      palette: {
        type: 'array', minItems: 5, maxItems: 5,
        items: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: [...PALETTE_ROLES] },
            hex: { type: 'string', description: '#RRGGBB' },
            name: { type: 'string', description: 'שם קצר בעברית' },
          },
          required: ['role', 'hex', 'name'], additionalProperties: false,
        },
      },
      fonts: { type: 'string', enum: FONT_PAIR_KEYS },
      words: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'string' } },
      motifs: { type: 'array', minItems: 2, maxItems: 3, items: { type: 'string' } },
      voice: { type: 'string' },
      direction: { type: 'string' },
      lean: { type: 'string', enum: ['safe', 'bold'] },
      leanReason: { type: 'string' },
    },
    required: ['palette', 'fonts', 'words', 'motifs', 'voice', 'direction', 'lean', 'leanReason'],
    additionalProperties: false,
  },
};

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const key = optional('ANTHROPIC_API_KEY');
  if (!key) return fail('nokey', 503);

  const account = await currentAccount();
  if (!account) return fail('צריך להתחבר.', 401);
  if (account.role === 'client') return fail('אין לך הרשאה לפעולה הזאת.', 403);

  let body: unknown;
  try { body = await req.json(); } catch { return fail('בקשה לא תקינה.'); }
  const { client_id: clientId, inputs } = (body ?? {}) as { client_id?: unknown; inputs?: unknown };
  if (typeof clientId !== 'string' || !clientId) return fail('חסר מזהה אירוע.');
  const inp = (inputs && typeof inputs === 'object' ? inputs : {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 160) : '');

  const sb = await supabaseServer();
  const { data: client } = await sb.from('clients')
    .select('id,display_name,event_date,venue,guest_estimate').eq('id', clientId).maybeSingle();
  if (!client) return fail('אין לך הרשאה לאירוע הזה.', 403);

  const { data: rows } = await sb.from('moodboards').select('image_path,caption,category')
    .eq('client_id', clientId).order('created_at', { ascending: false }).limit(MAX_IMAGES);
  if (!rows || rows.length === 0) return fail('noimages', 422);

  const { data: signed } = await sb.storage.from('moodboards')
    .createSignedUrls(rows.map((r) => r.image_path), 300);

  /* The photographs, fetched here rather than sent up from the browser: they
     are already in the bucket, and a phone should not upload twelve images
     twice. Anything too large or not an image is skipped, not fatal. */
  const images: { media: Media; data: string; caption: string }[] = [];
  for (const [i, r] of rows.entries()) {
    const url = signed?.[i]?.signedUrl;
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
      if (!MEDIA.includes(type as Media)) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > MAX_BYTES) continue;
      images.push({ media: type as Media, data: buf.toString('base64'), caption: r.caption ?? '' });
    } catch { /* one missing file is not the board */ }
  }
  if (images.length === 0) return fail('noimages', 422);

  const brief = [
    `הזוג: ${client.display_name}.`,
    client.event_date ? `תאריך: ${client.event_date}.` : '',
    client.venue ? `מקום: ${client.venue}.` : '',
    client.guest_estimate ? `אורחים: ${client.guest_estimate}.` : '',
    s(inp.words) ? `שלוש מילים שלהם: ${s(inp.words)}.` : '',
    s(inp.reference) ? `מותג או מעצב שהם אוהבים: ${s(inp.reference)}.` : '',
    s(inp.colorsIn) ? `צבעים שחייבים: ${s(inp.colorsIn)}.` : '',
    s(inp.colorsOut) ? `צבעים שאסור: ${s(inp.colorsOut)}.` : '',
    `${images.length} תמונות מהלוח מצורפות.`,
  ].filter(Boolean).join('\n');

  const content: Anthropic.MessageParam['content'] = [];
  images.forEach((img, i) => {
    content.push({ type: 'image', source: { type: 'base64', media_type: img.media, data: img.data } });
    if (img.caption) content.push({ type: 'text', text: `תמונה ${i + 1}: ${img.caption}` });
  });
  content.push({ type: 'text', text: `${brief}\n\nקרא/י את הלוח והפק/י את דף המותג.` });

  try {
    const anthropic = new Anthropic({ apiKey: key });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      output_config: { effort: 'high' },
      system: DIRECTOR,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{ role: 'user', content }],
    });

    if (response.stop_reason === 'refusal') {
      console.warn('[brand] refused', response.stop_details);
      return fail('לא הצלחתי לקרוא את הלוח הזה.', 422);
    }
    const use = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === TOOL.name
    );
    if (!use) return fail('לא הצלחתי לקרוא את הלוח.', 422);

    /* Through the same reader the column goes through, so a value the model
       shaped wrongly is dropped here rather than saved and read back broken. */
    const read = readBrand({
      ...(use.input as Record<string, unknown>),
      inputs: { words: s(inp.words), reference: s(inp.reference), colorsIn: s(inp.colorsIn), colorsOut: s(inp.colorsOut) },
      by: 'ai',
      at: new Date().toISOString(),
    }) as WeddingBrand;

    return NextResponse.json({ ok: true, brand: read, images: images.length });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) console.error('[brand] the API key was refused');
    else if (e instanceof Anthropic.RateLimitError) console.error('[brand] rate limited by the API');
    else if (e instanceof Anthropic.APIError) console.error('[brand] API error', { status: e.status, message: e.message });
    else console.error('[brand] failed', e);
    return fail('משהו נתקע בקריאה. אפשר לנסות שוב.', 502);
  }
}
