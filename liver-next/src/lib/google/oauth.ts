import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { optional, publicEnv } from '@/lib/env';

/**
 * Google's door, without a library.
 *
 * Three calls: build the address the producer is sent to, trade the code
 * Google sends back for tokens, and trade a refresh token for a fresh
 * access token. The scope is the narrow one Google made for exactly this:
 * calendars this app created, and nothing the producer already had. That
 * scope is not "sensitive" in Google's list, so the consent screen does
 * not need a verification review, and the tokens do not expire on the
 * seventh day the way a testing app's do once the project is set to
 * "in production".
 *
 * The state the producer carries through Google is signed here, so the
 * callback can tell a round trip it started from one somebody pasted.
 */

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.app.created',
  'https://www.googleapis.com/auth/userinfo.email',
];

export const googleConfigured = () => !!optional('GOOGLE_CLIENT_ID') && !!optional('GOOGLE_CLIENT_SECRET');

export const redirectUri = () => `${publicEnv.siteUrl}/api/google/callback`;

/* Signed with the cron key, which is already a server-only secret that
   exists on every deployment where the sweep runs. */
const secret = () => optional('CRON_KEY') || optional('GOOGLE_CLIENT_SECRET');

export function makeState(producerId: string): string {
  const nonce = randomBytes(8).toString('hex');
  const body = `${producerId}.${nonce}.${Date.now()}`;
  const sig = createHmac('sha256', secret()).update(body).digest('hex').slice(0, 32);
  return Buffer.from(`${body}.${sig}`).toString('base64url');
}

/** The producer the state was minted for, or null for anything forged,
 *  mangled, or older than a quarter of an hour. */
export function readState(state: string): string | null {
  let raw = '';
  try { raw = Buffer.from(state, 'base64url').toString(); } catch { return null; }
  const parts = raw.split('.');
  if (parts.length !== 4) return null;
  const [producerId, nonce, at, sig] = parts;
  const body = `${producerId}.${nonce}.${at}`;
  const want = createHmac('sha256', secret()).update(body).digest('hex').slice(0, 32);
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  if (Date.now() - Number(at) > 15 * 60 * 1000) return null;
  return producerId;
}

export function authUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: optional('GOOGLE_CLIENT_ID'),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    /* Consent every time, or Google hands back no refresh token on the
       second connect and the link dies with the first access token. */
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

type TokenReply = { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string; error?: string; error_description?: string };

async function tokenCall(params: Record<string, string>): Promise<TokenReply> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: optional('GOOGLE_CLIENT_ID'),
      client_secret: optional('GOOGLE_CLIENT_SECRET'),
      ...params,
    }).toString(),
  });
  return (await res.json()) as TokenReply;
}

export async function exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: string; email: string } | { error: string }> {
  const r = await tokenCall({ code, grant_type: 'authorization_code', redirect_uri: redirectUri() });
  if (!r.access_token || !r.refresh_token) return { error: r.error_description || r.error || 'no tokens' };
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: new Date(Date.now() + (r.expires_in ?? 3600) * 1000).toISOString(),
    email: emailFromIdToken(r.id_token ?? ''),
  };
}

export async function refreshAccess(refreshToken: string): Promise<{ accessToken: string; expiresAt: string } | { error: string }> {
  const r = await tokenCall({ refresh_token: refreshToken, grant_type: 'refresh_token' });
  if (!r.access_token) return { error: r.error_description || r.error || 'no access token' };
  return { accessToken: r.access_token, expiresAt: new Date(Date.now() + (r.expires_in ?? 3600) * 1000).toISOString() };
}

/** The address out of the id token's middle part. Not verified: it is
 *  shown on a screen as "connected as", and the tokens themselves are what
 *  Google verified. */
function emailFromIdToken(idToken: string): string {
  const mid = idToken.split('.')[1];
  if (!mid) return '';
  try {
    const claims = JSON.parse(Buffer.from(mid, 'base64url').toString()) as { email?: unknown };
    return typeof claims.email === 'string' ? claims.email : '';
  } catch { return ''; }
}
