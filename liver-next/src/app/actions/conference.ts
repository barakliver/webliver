'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentAccount } from '@/lib/auth';
import { noteFailure } from '@/lib/flash';
import { publicEnv, optional } from '@/lib/env';
import { sendMail } from '@/lib/notify/mail';
import { broadcastEmail } from '@/lib/notify/templates';
import { mayBeWritten, unsubscribeUrl } from '@/lib/campaign';
import { site } from '@/content/site';

/**
 * The conference, from the side of the person who runs it.
 *
 * Everything here is the root address's and is checked on the action, because a
 * form on a screen is a suggestion and an action is a URL anybody can post to.
 * The database refuses the same people through its policies; this is the first
 * of two doors, not the only one.
 */

export type ConferenceResult = {
  ok: boolean; error?: string;
  preview?: { count: number; sample: string[]; subject: string; body: string; campaign: string };
  sent?: number;
};

async function root() {
  const a = await currentAccount();
  return a?.role === 'super_admin' ? a : null;
}

const touch = () => revalidatePath('/app/admin/conference');

export async function createCampaign(_prev: ConferenceResult | null, form: FormData): Promise<ConferenceResult> {
  if (!(await root())) return { ok: false, error: 'אין הרשאה' };
  const name = String(form.get('name') ?? '').trim().slice(0, 120);
  const kind = String(form.get('kind') ?? 'producer');
  const max = Math.round(Number(form.get('max_signups') ?? 500));
  const until = String(form.get('expires') ?? '').trim();
  if (!name) return { ok: false, error: 'נא לתת שם לכנס' };
  if (kind !== 'producer' && kind !== 'dj') return { ok: false, error: 'סוג לא מוכר' };
  if (!(max >= 1 && max <= 5000)) return { ok: false, error: 'מספר ההרשמות צריך להיות בין 1 ל-5000' };
  if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return { ok: false, error: 'תאריך לא תקין' };

  const sb = await supabaseServer();
  const { error } = await sb.from('signup_campaigns').insert({
    token: randomBytes(24).toString('hex'), name, kind, max_signups: max,
    /* The end of that day in Israel, give or take the clock change. */
    expires_at: until ? `${until}T21:00:00Z` : null,
  });
  if (error) {
    console.error('[conference] createCampaign failed', { code: error.code, message: error.message });
    return { ok: false, error: 'לא הצלחנו ליצור' };
  }
  touch();
  return { ok: true };
}

export async function setCampaignActive(form: FormData): Promise<void> {
  if (!(await root())) return;
  const id = String(form.get('id') ?? '');
  const active = form.get('active') === '1';
  if (!id) return;
  const sb = await supabaseServer();
  const { data, error } = await sb.from('signup_campaigns').update({ active }).eq('id', id).select('id');
  if (error || !data?.length) {
    console.error('[conference] setCampaignActive failed', { code: error?.code, message: error?.message });
    await noteFailure('לא הצלחנו לעדכן את הקמפיין. אפשר לנסות שוב.');
  }
  touch();
}

/** Somebody asked to be forgotten, or typed their address wrong. A row goes
 *  entirely: the record of what they accepted goes with them, which is what
 *  the request is. */
export async function deleteContact(form: FormData): Promise<void> {
  if (!(await root())) return;
  const id = String(form.get('id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  const { data, error } = await sb.from('contacts').delete().eq('id', id).select('id');
  if (error || !data?.length) {
    console.error('[conference] deleteContact failed', { code: error?.code, message: error?.message });
    await noteFailure('לא הצלחנו למחוק. אפשר לנסות שוב.');
  }
  touch();
}

export async function saveContactNote(form: FormData): Promise<void> {
  if (!(await root())) return;
  const id = String(form.get('id') ?? '');
  const note = String(form.get('note') ?? '').trim().slice(0, 2000);
  if (!id) return;
  const sb = await supabaseServer();
  const { data, error } = await sb.from('contacts').update({ note, updated_at: new Date().toISOString() }).eq('id', id).select('id');
  if (error || !data?.length) {
    console.error('[conference] saveContactNote failed', { code: error?.code, message: error?.message });
    await noteFailure('ההערה לא נשמרה. אפשר לנסות שוב.');
  }
  touch();
}

type Row = {
  name: string; email: string; unsubscribe_token: string | null;
  broadcast_consent: boolean; broadcast_revoked_at: string | null;
};

async function audience(campaign: string): Promise<{ to: (Row & { unsubscribe_token: string })[]; campaignName: string }> {
  const sb = await supabaseServer();
  let q = sb.from('contacts')
    .select('name,email,unsubscribe_token,broadcast_consent,broadcast_revoked_at,campaign_id')
    .limit(5000);
  if (campaign) q = q.eq('campaign_id', campaign);
  const { data } = await q;
  const to = mayBeWritten((data ?? []) as Row[]).filter((r): r is Row & { unsubscribe_token: string } => Boolean(r.unsubscribe_token));
  let campaignName = '';
  if (campaign) {
    const { data: c } = await sb.from('signup_campaigns').select('name').eq('id', campaign).maybeSingle();
    campaignName = (c as { name?: string } | null)?.name ?? '';
  }
  return { to, campaignName };
}

/** The first press: who it would reach, and nothing sent. */
export async function previewBroadcast(_prev: ConferenceResult | null, form: FormData): Promise<ConferenceResult> {
  if (!(await root())) return { ok: false, error: 'אין הרשאה' };
  const subject = String(form.get('subject') ?? '').trim().slice(0, 200);
  const body = String(form.get('body') ?? '').trim().slice(0, 8000);
  const campaign = String(form.get('campaign') ?? '');
  if (!subject || !body) return { ok: false, error: 'נא למלא נושא ותוכן' };
  const { to } = await audience(campaign);
  if (to.length === 0) return { ok: false, error: 'אין אף אחד שאישר קבלת עדכונים ולא הסיר את עצמו' };
  return { ok: true, preview: { count: to.length, sample: to.slice(0, 3).map((r) => r.email), subject, body, campaign } };
}

/** The second press. The list is read again here and not carried from the
 *  preview, because somebody may have left it in between and the send must go
 *  by who may be written to now. The mail goes out after the answer, one at a
 *  time, so the screen is not held for as long as it takes. */
export async function sendBroadcast(_prev: ConferenceResult | null, form: FormData): Promise<ConferenceResult> {
  const account = await root();
  if (!account) return { ok: false, error: 'אין הרשאה' };
  const subject = String(form.get('subject') ?? '').trim().slice(0, 200);
  const body = String(form.get('body') ?? '').trim().slice(0, 8000);
  const campaign = String(form.get('campaign') ?? '');
  if (!subject || !body) return { ok: false, error: 'נא למלא נושא ותוכן' };

  const { to, campaignName } = await audience(campaign);
  if (to.length === 0) return { ok: false, error: 'אין אף אחד שאישר קבלת עדכונים ולא הסיר את עצמו' };

  const sb = await supabaseServer();
  const { data: made, error } = await sb.from('broadcasts').insert({
    subject, body, campaign_id: campaign || null, recipients: to.length, created_by: account.id,
  }).select('id').maybeSingle();
  if (error || !made) {
    console.error('[conference] could not record a mailing', { code: error?.code, message: error?.message });
    return { ok: false, error: 'לא הצלחנו להתחיל את השליחה' };
  }
  const id = (made as { id: string }).id;
  const brand = { name: account.producer?.brandName || site.brand };
  const why = campaignName
    ? `קיבלת הודעה זו כי אישרת קבלת עדכונים בהרשמה ל${campaignName}.`
    : 'קיבלת הודעה זו כי אישרת קבלת עדכונים בהרשמה.';

  after(async () => {
    let sent = 0, failed = 0;
    for (const r of to) {
      try {
        const res = await sendMail({
          to: r.email, subject,
          html: broadcastEmail({
            subject, body, why, leaveLabel: 'להסרה מהרשימה',
            leaveUrl: unsubscribeUrl(publicEnv.siteUrl, r.unsubscribe_token), brand,
          }),
        });
        if (res.sent) sent += 1; else failed += 1;
      } catch (e) {
        failed += 1;
        console.error('[conference] a mailing letter failed', e);
      }
      /* Resend answers two requests a second; a little under that is polite. */
      await new Promise((ok) => setTimeout(ok, 600));
    }
    if (optional('SUPABASE_SERVICE_ROLE_KEY')) {
      await supabaseAdmin().from('broadcasts').update({ sent, failed, status: 'done' }).eq('id', id);
    }
  });

  touch();
  return { ok: true, sent: to.length };
}
