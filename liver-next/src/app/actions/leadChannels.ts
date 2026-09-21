'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { serverCopy } from '@/lib/serverLocale';
import { noteFailure } from '@/lib/flash';
import { channelUrl, isChannelKind } from '@/content/channels';
import { publicEnv } from '@/lib/env';

/**
 * The doors a producer opens for their own enquiries.
 *
 * Everything here is the producer acting on their own rows, so the policy on
 * `lead_channels` is the check and there is nothing to verify a second time.
 * The two exceptions call functions instead: making a channel and rotating one
 * both need a token generated where `extensions` is on the search path, which
 * is the database's job rather than this file's.
 */

export type ChannelResult = { ok: boolean; error?: string };

function touch() {
  revalidatePath('/app/leads');
  revalidatePath('/app/insights');
}

/** Opens a channel and hands back the row, token and all. The producer sees
 *  their own secret; nobody else can read the row at all. */
export async function addChannel(_prev: ChannelResult | null, form: FormData): Promise<ChannelResult> {
  const c = (await serverCopy()).channel;
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: c.needProducer };

  const label = String(form.get('label') ?? '').trim();
  if (!label) return { ok: false, error: c.needName };
  if (label.length > 40) return { ok: false, error: c.tooLong };

  const kind = String(form.get('kind') ?? '');
  if (!isChannelKind(kind)) return { ok: false, error: c.failed };

  const sb = await supabaseServer();
  const { error } = await sb.rpc('new_lead_channel', { p_label: label, p_source: kind });

  if (error) {
    console.error('[leadChannels] create failed', error);
    if (error.code === '23505') return { ok: false, error: c.taken };
    return { ok: false, error: c.failed };
  }
  touch();
  return { ok: true };
}

/** The name and what it is. The token is untouched: renaming a channel must
 *  never invalidate a URL already sitting in somebody's ad console. */
export async function renameChannel(_prev: ChannelResult | null, form: FormData): Promise<ChannelResult> {
  const c = (await serverCopy()).channel;
  const id = String(form.get('channel_id') ?? '');
  if (!id) return { ok: false, error: c.failed };

  const label = String(form.get('label') ?? '').trim();
  if (!label) return { ok: false, error: c.needName };
  if (label.length > 40) return { ok: false, error: c.tooLong };

  const kind = String(form.get('kind') ?? '');
  if (!isChannelKind(kind)) return { ok: false, error: c.failed };

  const sb = await supabaseServer();
  const { error } = await sb
    .from('lead_channels')
    .update({ label, source: kind })
    .eq('id', id);

  if (error) {
    console.error('[leadChannels] rename failed', error);
    if (error.code === '23505') return { ok: false, error: c.taken };
    return { ok: false, error: c.failed };
  }
  touch();
  return { ok: true };
}

/**
 * Off, and on again.
 *
 * The state is read from the form rather than flipped in SQL so that two
 * clicks on a slow connection settle on what the producer last saw, instead of
 * toggling twice and landing back where they started.
 */
export async function setChannelEnabled(form: FormData): Promise<void> {
  const id = String(form.get('channel_id') ?? '');
  if (!id) return;
  const enabled = String(form.get('enabled') ?? '') === 'on';

  const sb = await supabaseServer();
  const { error } = await sb.from('lead_channels').update({ enabled }).eq('id', id);
  if (error) {
    console.error('[leadChannels] toggle failed', error);
    await noteFailure('לא הצלחנו לשנות את מצב הערוץ. אפשר לנסות שוב.');
  }
  touch();
}

/** A new secret for a URL that leaked, keeping everything the channel has
 *  already collected. The old URL stops working the moment this returns. */
export async function rotateChannel(form: FormData): Promise<void> {
  const id = String(form.get('channel_id') ?? '');
  if (!id) return;

  const sb = await supabaseServer();
  const { error } = await sb.rpc('rotate_lead_channel', { p_id: id });
  if (error) {
    console.error('[leadChannels] rotate failed', error);
    await noteFailure('לא הצלחנו להחליף את הכתובת. אפשר לנסות שוב.');
  }
  touch();
}

/**
 * Deleted, with the leads left where they are.
 *
 * `leads.source` is a text stamp rather than a reference, so an enquiry keeps
 * saying it came from Instagram after the Instagram channel is gone. That is
 * the honest record: the lead did come from there, and a producer closing a
 * channel is not saying last summer never happened.
 */
export async function removeChannel(form: FormData): Promise<void> {
  const id = String(form.get('channel_id') ?? '');
  if (!id) return;

  const sb = await supabaseServer();
  const { error } = await sb.from('lead_channels').delete().eq('id', id);
  if (error) {
    console.error('[leadChannels] delete failed', error);
    await noteFailure('לא הצלחנו למחוק את הערוץ. אפשר לנסות שוב.');
  }
  touch();
}

/**
 * Does this address actually receive?
 *
 * The producer's own question, answered without leaving the screen and
 * without a fake enquiry landing in the list they read every morning. The
 * probe is a real HTTP POST to the real public address, exactly the request
 * Meta will make: it leaves this server, goes out through the certificate and
 * the proxy, comes back in through the route, and the token is resolved in
 * the database. What it deliberately does not carry is a name or a phone
 * number, so the route answers "nothing to call back on" and stores nothing.
 *
 * Calling `ingest_lead_via_channel` from here would have been one line and
 * would have proved the wrong thing. Every way this breaks in the field is
 * outside the database: a domain that stopped resolving, a certificate nobody
 * renewed, a proxy rule, a token the producer rotated and did not re-paste.
 * A test that skips all of that is a test that says yes on the morning the
 * leads stopped arriving.
 *
 * The three failures are told apart on purpose, because they need different
 * things done about them: refused means re-paste the address, unreachable
 * means the platform is having a bad minute, and anything else is ours.
 */
export async function testChannel(_prev: ChannelResult | null, form: FormData): Promise<ChannelResult> {
  const c = (await serverCopy()).channel;
  const id = String(form.get('channel_id') ?? '');
  if (!id) return { ok: false, error: c.failed };

  const sb = await supabaseServer();
  /* The policy scopes this to the producer's own rows, so a channel id that
     is not theirs reads as one that does not exist. */
  const { data: row, error } = await sb
    .from('lead_channels')
    .select('token,enabled')
    .eq('id', id)
    .maybeSingle();

  if (error || !row) {
    console.error('[leadChannels] test could not read the channel', error);
    return { ok: false, error: c.failed };
  }
  /* Answered here rather than by sending a probe that is certain to be
     refused: "switched off" is a thing the producer did, not a fault. */
  if (!row.enabled) return { ok: false, error: c.testOff };

  let res: Response;
  try {
    res = await fetch(channelUrl(publicEnv.siteUrl, row.token), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ liver_probe: true }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error('[leadChannels] probe could not reach the address', e);
    return { ok: false, error: c.testUnreachable };
  }

  if (res.status === 401) return { ok: false, error: c.testRefused };
  if (!res.ok) {
    console.error('[leadChannels] probe was answered badly', { status: res.status });
    return { ok: false, error: c.testBroken };
  }
  return { ok: true };
}
