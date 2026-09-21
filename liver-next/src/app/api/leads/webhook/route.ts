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
 *
 * Two doors, and which one a delivery came through decides whose inbox it
 * lands in.
 *
 *   ?c=<token>   one producer's own channel. The token names the channel, the
 *                channel names the producer and the source, and holding it is
 *                the whole of the authorisation — there is nothing else to
 *                present. This is what a producer pastes into Meta or Google.
 *
 *   no ?c=       the platform's own connections, authorised by the single
 *                LEAD_WEBHOOK_KEY in the environment and attributed to the
 *                platform's workspace. Live and posting today, so it keeps
 *                working exactly as it did.
 *
 * The channel path deliberately never falls back to the shared key. A token
 * that was revoked an hour ago must stop working, not quietly start arriving
 * in somebody else's inbox instead.
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

/** The producer's channel, if this delivery came through one. `c` is short
 *  because it is typed by hand into consoles with short URL fields; `channel`
 *  is accepted too for anybody wiring it up from the documentation. */
function channelToken(url: URL): string {
  return (url.searchParams.get('c') ?? url.searchParams.get('channel') ?? '').trim();
}

/** Whether a token names a live channel. Used only by the handshake — a
 *  delivery proves the same thing by being accepted. */
async function channelExists(token: string): Promise<boolean> {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('lead_channel_exists', { p_token: token });
  if (error) {
    console.error('[leads/webhook] channel lookup failed', { code: error.code, message: error.message });
    return false;
  }
  return data === true;
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

  if (mode !== 'subscribe' || !challenge) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  /* Meta appends its hub.* parameters to whatever URL it was given, so a
     producer's ?c= survives the handshake and is what decides which secret
     the verify token is compared against. Their channel token doubles as it,
     which is one value to copy rather than two. */
  const channel = channelToken(url);
  if (channel) {
    const ok = await channelExists(channel);
    return ok && keyMatches(token, channel)
      ? new NextResponse(challenge, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } })
      : NextResponse.json({ ok: false }, { status: 403 });
  }

  const expected = process.env.LEAD_WEBHOOK_KEY ?? '';
  if (expected && keyMatches(token, expected)) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  return NextResponse.json({ ok: false }, { status: 403 });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const channel = channelToken(url);
  if (channel) return postToChannel(req, channel);

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
    p_location: lead.location,
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

/**
 * A delivery through one producer's own channel.
 *
 * The token is the only credential, and it is not compared here: the database
 * resolves it to a channel or refuses, which keeps "which producer is this
 * for" and "is this allowed" as one question with one answer. There is
 * nothing to compare in constant time either, because a wrong token is a
 * failed lookup rather than a mismatched string.
 *
 * The source is not read from the payload on this path. A producer who named
 * a channel "גוגל אדס" has said what it is; letting the sender overrule that
 * with whatever its form happened to put in a `source` field is how a funnel
 * report ends up measuring the field names of ad platforms.
 */
async function postToChannel(req: Request, token: string) {
  /* The token is checked before the payload is judged, and the order is
     load-bearing twice over.
   *
   * It is the honest refusal: a delivery to a revoked token used to be
   * answered "ok, ignored" whenever it happened to carry no contact details,
   * which tells somebody probing for live tokens that the door is at least
   * listening, and tells a producer whose integration broke nothing at all.
   *
   * It is also what makes the test button on the channel screen a real test.
   * A probe with no contact details now reaches this check, so a 200 means
   * the address resolved to this producer's live channel: DNS, TLS, the
   * route and the token, end to end, without a fake enquiry being written
   * into the list the producer reads every morning. */
  if (!(await channelExists(token))) {
    console.warn('[leads/webhook] delivery presented an unknown channel token');
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const body = await readBody(req);
  const lead = readLead(body, 'webhook');

  if (!lead.full_name && !lead.phone && !lead.email) {
    /* 200 for the same reason as the shared door: retrying an empty payload
       produces the same empty payload forever. */
    console.warn('[leads/webhook] channel delivery had no contact details');
    return NextResponse.json({ ok: true, ignored: 'no contact details' });
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('ingest_lead_via_channel', {
    p_token: token,
    p_full_name: lead.full_name,
    p_phone: lead.phone,
    p_email: lead.email,
    p_kind: lead.kind,
    p_event_date: lead.event_date,
    p_guest_count: lead.guest_count,
    p_message: lead.message,
    p_external_id: lead.external_id,
    p_location: lead.location,
  });

  if (error) {
    /* insufficient_privilege is the channel refusing the token — revoked,
       switched off, or never ours. Answered 401 so the sender stops retrying
       something that will never be accepted, and logged without the token so
       a live secret does not end up in journalctl. */
    if (error.code === '42501') {
      console.warn('[leads/webhook] delivery presented an unknown channel token');
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    console.error('[leads/webhook] channel ingest failed', { code: error.code, message: error.message });
    return NextResponse.json({ ok: false, error: 'could not store the lead' }, { status: 500 });
  }

  console.info('[leads/webhook] stored through a channel', { id: data });
  return NextResponse.json({ ok: true, id: data });
}
