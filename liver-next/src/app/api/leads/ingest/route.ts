import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { intakeLead } from '@/lib/leadIntake';
import { normalizePhone } from '@/lib/phone';

/**
 * One door, one shape, every source.
 *
 * The webhook next door reads six envelopes loosely, because ad platforms
 * name the same six fields differently and cannot be argued with. This one
 * is the opposite: a shape of our own, for the senders we write ourselves,
 * the card game's shop, a Make scenario reading Instagram, a mail parser,
 * anything that can be asked to send `contact` and `event` under their own
 * names. Both doors end in the same place.
 *
 * The secret is a lead channel's token, which is already a per-source
 * credential a producer can mint, read back and revoke, with the source
 * stamped on the channel rather than trusted from the payload. A second
 * secret scheme beside it would be a second thing to leak.
 *
 * Thirty a minute per address, counted in memory. One server, one process,
 * and the limit is there to stop a loop, not a siege.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_MS = 60_000;
const PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > PER_WINDOW;
}

type Body = {
  source?: unknown; secret?: unknown; raw?: unknown; message?: unknown;
  contact?: { fullName?: unknown; partnerName?: unknown; phone?: unknown; email?: unknown; instagram?: unknown };
  event?: {
    date?: unknown; dateFlexible?: unknown; guestCount?: unknown; budgetMin?: unknown;
    budgetMax?: unknown; region?: unknown; venueBooked?: unknown; kind?: unknown;
  };
};

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v: unknown, lo: number, hi: number): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= lo && r <= hi ? r : null;
};
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const isoDate = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v.trim());
  return m && !Number.isNaN(Date.parse(m[1] + 'T00:00:00Z')) ? m[1] : null;
};

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
  if (limited(ip)) return NextResponse.json({ ok: false, error: 'too many' }, { status: 429 });

  let body: Body;
  try { body = (await req.json()) as Body; } catch {
    return NextResponse.json({ ok: false, error: 'body must be JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'body must be an object' }, { status: 400 });
  }

  const secret = str(body.secret, 200)
    || (req.headers.get('x-api-key') ?? '').trim()
    || (/^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')?.[1] ?? '').trim();
  if (!secret) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const c = body.contact ?? {};
  const e = body.event ?? {};
  const fullName = str(c.fullName, 120);
  const phone = str(c.phone, 40);
  const email = str(c.email, 160).toLowerCase();
  const message = str(body.message, 4000);
  const instagram = str(c.instagram, 80).replace(/^@/, '');

  if (!fullName && !phone && !email && !instagram) {
    return NextResponse.json({ ok: false, error: 'contact needs a name, a phone, an email or an instagram handle' }, { status: 400 });
  }
  if (phone && !normalizePhone(phone)) {
    return NextResponse.json({ ok: false, error: 'phone is not a number', field: 'contact.phone' }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'email is not an address', field: 'contact.email' }, { status: 400 });
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('ingest_lead_via_channel', {
    p_token: secret,
    p_full_name: fullName || (instagram ? `@${instagram}` : ''),
    p_phone: phone,
    p_email: email,
    p_kind: str(e.kind, 20) === 'corporate' ? 'corporate' : 'wedding',
    p_event_date: isoDate(e.date),
    p_guest_count: int(e.guestCount, 1, 1500),
    p_message: message,
    p_external_id: null,
    p_location: str(e.region, 120),
  });

  if (error) {
    if (error.code === '42501') return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    console.error('[leads/ingest] store failed', { code: error.code, message: error.message });
    return NextResponse.json({ ok: false, error: 'could not store the lead' }, { status: 500 });
  }
  const id = String(data ?? '');
  if (!id) return NextResponse.json({ ok: false, error: 'could not store the lead' }, { status: 500 });

  /* Read, score, ring. Awaited: a webhook caller is a machine and can wait
     the two seconds, and a response that says "stored" after the reading
     ran is a response that can also say what it read. */
  await intakeLead(id, {
    extra: {
      partner_name: str(c.partnerName, 120),
      instagram_handle: instagram,
      event_date_flexible: bool(e.dateFlexible),
      budget_min: int(e.budgetMin, 0, 10_000_000),
      budget_max: int(e.budgetMax, 0, 10_000_000),
      venue_booked: bool(e.venueBooked),
      source_payload: body.raw ?? null,
    },
  });

  return NextResponse.json({ ok: true, id });
}

/** A GET answers whether the door is there, and nothing else. */
export function GET() {
  return NextResponse.json({ ok: true, accepts: 'POST application/json { secret, contact, event?, message?, raw? }' });
}
