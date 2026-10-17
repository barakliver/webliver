import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { optional } from '@/lib/env';
import { receiveInbox, processInbox, type Attachment } from '@/lib/inbox/intake';
import { ensureInboxBucket } from '@/lib/inbound';

/**
 * Mail, received.
 *
 * Resend already carries this product's outgoing mail, and it can receive
 * for a domain too: a message to the receiving address becomes an
 * `email.received` webhook with the envelope and nothing else, and the
 * body and the files are fetched from its API with the same key. One
 * provider, one key, one more webhook.
 *
 * The webhook is signed the Svix way: `${id}.${timestamp}.${body}` under
 * HMAC-SHA256 with the secret after `whsec_`, base64, compared against
 * every `v1,…` in the signature header, with five minutes of tolerance.
 * Written out rather than imported, because it is nine lines and a
 * dependency for nine lines is a dependency.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verified(req: Request, raw: string): boolean {
  const secret = optional('RESEND_WEBHOOK_SECRET');
  if (!secret) return false;
  const id = req.headers.get('svix-id') ?? '';
  const ts = req.headers.get('svix-timestamp') ?? '';
  const sigs = req.headers.get('svix-signature') ?? '';
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest();
  return sigs.split(' ').some((part) => {
    const [, sig] = part.split(',');
    if (!sig) return false;
    const given = Buffer.from(sig, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

type Received = {
  id?: string; subject?: string; text?: string; html?: string; from?: string;
  attachments?: { id: string; filename?: string; content_type?: string; size?: number }[];
};

async function resend(path: string): Promise<Record<string, unknown> | null> {
  const key = optional('RESEND_API_KEY');
  if (!key) return null;
  const res = await fetch(`https://api.resend.com${path}`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) { console.warn('[inbox/email] resend answered', { path, status: res.status }); return null; }
  return (await res.json()) as Record<string, unknown>;
}

const strip = (html: string) => html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const parseFrom = (from: string): { email: string; name: string } => {
  const m = /^(.*?)<([^>]+)>\s*$/.exec(from.trim());
  return m ? { name: m[1].replace(/^"|"$/g, '').trim(), email: m[2].trim().toLowerCase() } : { name: '', email: from.trim().toLowerCase() };
};

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verified(req, raw)) {
    console.warn('[inbox/email] a delivery failed the signature');
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  let event: { type?: string; data?: { email_id?: string; from?: string; subject?: string } };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: 'body must be JSON' }, { status: 400 }); }
  if (event.type !== 'email.received' || !event.data?.email_id) return NextResponse.json({ ok: true, ignored: event.type ?? 'no type' });

  const emailId = event.data.email_id;
  const sb = supabaseAdmin();
  const { data: producerId } = await sb.rpc('public_site_producer');
  if (typeof producerId !== 'string') return NextResponse.json({ ok: false, error: 'no workspace' }, { status: 503 });

  const full = (await resend(`/emails/receiving/${emailId}`)) as Received | null;
  const subject = full?.subject ?? event.data.subject ?? '';
  const from = parseFrom(full?.from ?? event.data.from ?? '');
  const text = (full?.text?.trim() || (full?.html ? strip(full.html) : '')).slice(0, 60000);

  const attachments: Attachment[] = [];
  for (const a of (full?.attachments ?? []).slice(0, 5)) {
    const meta = await resend(`/emails/receiving/${emailId}/attachments/${a.id}`);
    const url = typeof meta?.download_url === 'string' ? meta.download_url : '';
    if (!url) continue;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 25_000_000) continue;
      await ensureInboxBucket(sb);
      const safe = String(a.filename ?? 'file').replace(/[^\w.\-֐-׿]+/g, '_').slice(0, 80);
      const path = `${producerId}/${emailId}/${safe}`;
      const { error } = await sb.storage.from('inbox').upload(path, buf, { contentType: a.content_type ?? 'application/octet-stream', upsert: true });
      if (!error) attachments.push({ name: safe, mime: a.content_type ?? '', path, size: buf.length });
    } catch { /* the message still arrives without it */ }
  }

  const got = await receiveInbox(sb, {
    producerId, channel: 'email', externalId: emailId, fromIdentity: from.email, fromName: from.name,
    subject, bodyText: text, attachments,
  });
  if (!got) return NextResponse.json({ ok: false, error: 'could not store' }, { status: 500 });
  if (got.fresh) await processInbox(sb, got.id);
  return NextResponse.json({ ok: true, id: got.id, fresh: got.fresh });
}

export function GET() {
  return NextResponse.json({ ok: true, configured: Boolean(optional('RESEND_WEBHOOK_SECRET') && optional('RESEND_API_KEY')) });
}
