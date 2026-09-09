import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { supabaseServer } from '@/lib/supabase/server';
import { readLead } from '@/lib/leadPayload';

/**
 * The door an enquiry comes through when it did not come through our form.
 *
 * Instagram and Meta lead ads, Google's lead form extension, and Zapier wired
 * to anything else all post here. The money spent on those ads is spent
 * whether or not the lead arrives, so the guiding rule is that a delivery is
 * kept unless there is genuinely nothing in it. Coercion happens in
 * ingest_lead(); this end is about who is allowed to post, and about reading
 * six different envelopes as one letter.
 *
 * There is no service role key here, and there does not need to be:
 * ingest_lead() is a security definer function the anon role may execute, and
 * nothing else about the database opens up because of it.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Compared in constant time, so the endpoint cannot be used to work out the
 *  key one character at a time. */
function keyMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  /* timingSafeEqual throws on a length mismatch, which would itself leak the
     length, so a wrong length is compared against the real key to keep the
     work the same and then refused. */
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

function presentedKey(req: Request, url: URL, body: unknown): string {
  const header = req.headers.get('x-api-key') ?? '';
  if (header) return header;

  const auth = req.headers.get('authorization') ?? '';
  const bearer = /^Bearer\s+(.+)$/i.exec(auth);
  if (bearer) return bearer[1].trim();

  /* Google's lead form extension cannot set a header. It puts the shared
     secret in the body, under a name it chose, and refusing it on principle
     would mean not being able to receive Google leads at all. */
  if (body && typeof body === 'object') {
    const g = (body as Record<string, unknown>).google_key;
    if (typeof g === 'string' && g) return g;
  }

  return url.searchParams.get('key') ?? '';
}

async function readBody(req: Request): Promise<unknown> {
  const type = req.headers.get('content-type') ?? '';
  const raw = await req.text();
  if (!raw) return {};

  if (type.includes('json')) {
    try { return JSON.parse(raw); } catch { /* fall through and try the rest */ }
  }
  if (type.includes('form')) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  /* No usable content type, which is common enough from form builders. Try
     both rather than refuse: the sender is not going to fix their headers
     because we asked. */
  try { return JSON.parse(raw); } catch { /* not json */ }
  const params = new URLSearchParams(raw);
  if ([...params.keys()].length > 0) return Object.fromEntries(params);
  return { message: raw.slice(0, 4000) };
}

/**
 * Meta's subscription handshake, and nothing else.
 *
 * Meta will not deliver to a URL until it has GET one with a challenge and
 * been echoed the value back. Answering it is the whole reason this handler
 * exists; a GET without a challenge is not a lead and gets nothing.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token') ?? '';
  const challenge = url.searchParams.get('hub.challenge') ?? '';
  const expected = process.env.LEAD_WEBHOOK_KEY ?? '';

  if (mode === 'subscribe' && expected && challenge && keyMatches(token, expected)) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  return NextResponse.json({ ok: false }, { status: 403 });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const expected = process.env.LEAD_WEBHOOK_KEY ?? '';

  if (!expected) {
    /* Refuse rather than accept: an endpoint that takes anything from anybody
       fills the leads screen with junk, and junk in the one place a producer
       looks for real enquiries is worse than a webhook that is not connected
       yet. The log line is for whoever is setting it up. */
    console.error('[leads/webhook] LEAD_WEBHOOK_KEY is not set; refusing every delivery');
    return NextResponse.json({ ok: false, error: 'not configured' }, { status: 503 });
  }

  const body = await readBody(req);

  if (!keyMatches(presentedKey(req, url, body), expected)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const lead = readLead(body, url.searchParams.get('source') ?? 'webhook');

  if (!lead.full_name && !lead.phone && !lead.email) {
    /* Nothing to call anybody back on. Answered 200 on purpose: Meta and
       Zapier both retry a failure, and retrying an empty payload produces the
       same empty payload forever. */
    console.warn('[leads/webhook] delivery had no contact details', { source: lead.source });
    return NextResponse.json({ ok: true, ignored: 'no contact details' });
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('ingest_lead', {
    p_full_name: lead.full_name,
    p_phone: lead.phone,
    p_email: lead.email,
    p_kind: lead.kind,
    p_event_date: lead.event_date,
    p_guest_count: lead.guest_count,
    p_message: lead.message,
    p_source: lead.source,
    p_external_id: lead.external_id,
  });

  if (error) {
    /* A failure here is answered with a 500 deliberately, so the sender
       retries and the lead is not lost to a database hiccup. */
    console.error('[leads/webhook] ingest failed', { source: lead.source, code: error.code, message: error.message });
    return NextResponse.json({ ok: false, error: 'could not store the lead' }, { status: 500 });
  }

  console.info('[leads/webhook] stored', { source: lead.source, id: data });
  return NextResponse.json({ ok: true, id: data });
}
