import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { optional, publicEnv } from '@/lib/env';
import { routeWhatsApp, fetchIntoInbox } from '@/lib/inbound';
import type { Attachment } from '@/lib/inbox/intake';

/**
 * The business WhatsApp number, listening.
 *
 * Two providers speak here, because which one the producer ends up with is
 * a commercial decision and not ours: Twilio, which posts a form and signs
 * it, and Green API, which posts JSON and carries a bearer token. Each is
 * verified the way its maker documents, and a delivery that fails its
 * check is a 401 and a line in the log, never a lead.
 *
 * What arrives is handed to lib/inbound, which decides whose it is. Media
 * is pulled into the inbox bucket when the provider gives a URL for it, so
 * a quote photographed on a phone is read like a quote sent as a file.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) { timingSafeEqual(y, y); return false; }
  return timingSafeEqual(x, y);
}

/** Twilio: base64(HMAC-SHA1(token, url + every POST key and value, sorted
 *  by key)). The URL is the one Twilio was given, which behind the proxy
 *  is the public one, not the one Node sees. */
function twilioSigned(req: Request, params: URLSearchParams): boolean {
  const token = optional('TWILIO_AUTH_TOKEN');
  if (!token) return false;
  const given = req.headers.get('x-twilio-signature') ?? '';
  if (!given) return false;
  const here = new URL(req.url);
  const url = `${publicEnv.siteUrl}${here.pathname}${here.search}`;
  const keys = [...params.keys()].sort();
  const data = url + keys.map((k) => k + (params.get(k) ?? '')).join('');
  const expected = createHmac('sha1', token).update(data).digest('base64');
  return safeEqual(given, expected);
}

function greenAuthorised(req: Request): boolean {
  const token = optional('GREEN_API_WEBHOOK_TOKEN');
  if (!token) return false;
  const auth = req.headers.get('authorization') ?? '';
  const given = auth.replace(/^(Bearer|Basic)\s+/i, '').trim();
  return Boolean(given) && safeEqual(given, token);
}

export async function POST(req: Request) {
  const type = req.headers.get('content-type') ?? '';
  const raw = await req.text();
  const sb = supabaseAdmin();

  /* ── Twilio ───────────────────────────────────────────────────────── */
  if (type.includes('form')) {
    const params = new URLSearchParams(raw);
    if (!twilioSigned(req, params)) {
      console.warn('[whatsapp] a form delivery failed the Twilio signature');
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    const from = (params.get('From') ?? '').replace(/^whatsapp:/, '');
    const sid = params.get('MessageSid') ?? params.get('SmsMessageSid') ?? '';
    if (!from || !sid) return NextResponse.json({ ok: true, ignored: 'no sender' });

    const n = Number(params.get('NumMedia') ?? '0') || 0;
    const attachments: Attachment[] = [];
    const producer = await sb.rpc('public_site_producer');
    for (let i = 0; i < Math.min(n, 5); i += 1) {
      const url = params.get(`MediaUrl${i}`);
      const mime = params.get(`MediaContentType${i}`) ?? '';
      if (!url || typeof producer.data !== 'string') continue;
      const sidAuth = Buffer.from(`${optional('TWILIO_ACCOUNT_SID')}:${optional('TWILIO_AUTH_TOKEN')}`).toString('base64');
      const got = await fetchIntoInbox(sb, producer.data, url, `media-${i}.${mime.split('/')[1] ?? 'bin'}`, mime, { authorization: `Basic ${sidAuth}` });
      if (got) attachments.push(got);
    }

    const r = await routeWhatsApp(sb, {
      phone: from, name: params.get('ProfileName') ?? '', text: params.get('Body') ?? '',
      externalId: sid, attachments,
    });
    /* Twilio reads the body as TwiML; an empty response says "no reply". */
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200, headers: { 'content-type': 'text/xml', 'x-routed': `${r.to}:${r.id ?? ''}` },
    });
  }

  /* ── Green API ────────────────────────────────────────────────────── */
  if (!greenAuthorised(req)) {
    console.warn('[whatsapp] a JSON delivery carried no valid token');
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw) as Record<string, unknown>; } catch {
    return NextResponse.json({ ok: false, error: 'body must be JSON' }, { status: 400 });
  }
  const kind = String(body.typeWebhook ?? '');
  if (kind !== 'incomingMessageReceived') return NextResponse.json({ ok: true, ignored: kind });

  const sender = (body.senderData ?? {}) as Record<string, unknown>;
  const msg = (body.messageData ?? {}) as Record<string, unknown>;
  const chat = String(sender.chatId ?? sender.sender ?? '');
  if (!chat || chat.endsWith('@g.us')) return NextResponse.json({ ok: true, ignored: 'group or no sender' });
  const phone = '+' + chat.replace(/@.*$/, '').replace(/\D/g, '');
  const id = String(body.idMessage ?? '');
  const typeMessage = String(msg.typeMessage ?? '');

  let text = '';
  const attachments: Attachment[] = [];
  if (typeMessage === 'textMessage') text = String((msg.textMessageData as Record<string, unknown> | undefined)?.textMessage ?? '');
  else if (typeMessage === 'extendedTextMessage' || typeMessage === 'quotedMessage') text = String((msg.extendedTextMessageData as Record<string, unknown> | undefined)?.text ?? '');
  else if (/^(image|document|video|audio)Message$/.test(typeMessage)) {
    const f = (msg.fileMessageData as Record<string, unknown> | undefined) ?? {};
    text = String(f.caption ?? '');
    const url = String(f.downloadUrl ?? '');
    const producer = await sb.rpc('public_site_producer');
    if (url && typeof producer.data === 'string') {
      const got = await fetchIntoInbox(sb, producer.data, url, String(f.fileName ?? 'file'), String(f.mimeType ?? ''));
      if (got) attachments.push(got);
    }
  } else {
    return NextResponse.json({ ok: true, ignored: typeMessage });
  }
  if (!text && !attachments.length) return NextResponse.json({ ok: true, ignored: 'empty' });

  const at = typeof body.timestamp === 'number' ? new Date(body.timestamp * 1000).toISOString() : undefined;
  const r = await routeWhatsApp(sb, {
    phone, name: String(sender.senderName ?? sender.senderContactName ?? sender.chatName ?? ''),
    text, externalId: id || `${chat}:${body.timestamp ?? Date.now()}`, receivedAt: at, attachments,
  });
  return NextResponse.json({ ok: true, routed: r.to, id: r.id });
}

export function GET() {
  return NextResponse.json({
    ok: true,
    twilio: Boolean(optional('TWILIO_AUTH_TOKEN')),
    green: Boolean(optional('GREEN_API_WEBHOOK_TOKEN')),
  });
}
