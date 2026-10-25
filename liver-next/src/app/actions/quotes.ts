'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { supabasePublic } from '@/lib/supabase/public';
import { currentAccount } from '@/lib/auth';
import { noteFailure } from '@/lib/flash';
import { publicEnv } from '@/lib/env';
import { sendMail } from '@/lib/notify/mail';
import { priceQuoteEmail } from '@/lib/notify/templates';
import { parseAmount, quoteUrl, safeUrl } from '@/lib/quote';
import { todayInZone } from '@/lib/clock';
import { quoteFor } from '@/content/ui';
import { currentLocale } from '@/lib/serverLocale';

/**
 * A price quote, from the producer's side and from the couple's.
 *
 * What goes out is decided here and nowhere else: the amount is parsed by the
 * same function the tests hold, the two ways to pay are copied onto the quote
 * by the database function rather than read back from settings later, and the
 * letter is best effort on top of a quote that already exists. A quote whose
 * mail failed is still a quote with a link, and the producer is told so rather
 * than being told it was sent.
 */

export type QuoteResult = { ok: boolean; error?: string; url?: string; emailed?: boolean; to?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function touch(leadId?: string) {
  revalidatePath('/app/leads');
  if (leadId) revalidatePath(`/app/leads/${leadId}`);
}

/** Where the producer is paid. Both are optional and at least one is needed to
 *  send a quote, which the database checks again. */
export async function savePayWays(_prev: QuoteResult | null, form: FormData): Promise<QuoteResult> {
  const c = quoteFor(await currentLocale()).settings;
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: c.failed };

  const rawLink = String(form.get('payment_link') ?? '').trim();
  const link = rawLink ? safeUrl(rawLink) : '';
  if (link === null) return { ok: false, error: c.badLink };

  const bank = String(form.get('bank_details') ?? '').trim().slice(0, 1200);

  const sb = await supabaseServer();
  const { data, error } = await sb.from('producers')
    .update({ payment_link: (link ?? '').slice(0, 500), bank_details: bank })
    .eq('id', account.producer.id).select('id');
  if (error || !data?.length) {
    console.error('[quotes] savePayWays failed', { code: error?.code, message: error?.message });
    return { ok: false, error: c.failed };
  }
  revalidatePath('/app/brand');
  revalidatePath('/app/leads');
  return { ok: true };
}

/** Asks nothing the producer did not type, then sends. */
export async function sendQuote(_prev: QuoteResult | null, form: FormData): Promise<QuoteResult> {
  const c = quoteFor(await currentLocale()).composer;
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: c.failed };

  const leadId = String(form.get('lead_id') ?? '');
  if (!leadId) return { ok: false, error: c.failed };

  const amount = parseAmount(String(form.get('amount') ?? ''));
  if (amount === null) return { ok: false, error: c.badAmount };

  const email = String(form.get('email') ?? '').trim();
  if (email && !EMAIL.test(email)) return { ok: false, error: c.emailMissing };

  const title = String(form.get('title') ?? '').trim().slice(0, 160);
  const note = String(form.get('note') ?? '').trim().slice(0, 2000);
  const until = String(form.get('valid_until') ?? '').trim();
  if (until && (!/^\d{4}-\d{2}-\d{2}$/.test(until) || until < todayInZone())) {
    return { ok: false, error: c.failed };
  }

  const sb = await supabaseServer();
  const { data: token, error } = await sb.rpc('create_price_quote', {
    p_lead: leadId, p_amount: amount, p_title: title, p_note: note,
    p_valid_until: until || null, p_email: email,
  });
  if (error || typeof token !== 'string') {
    console.error('[quotes] create failed', { code: error?.code, message: error?.message });
    /* The function raises its refusals in the producer's own words. */
    if (/לאן משלמים/.test(error?.message ?? '')) return { ok: false, error: c.needPay };
    if (/מייל/.test(error?.message ?? '')) return { ok: false, error: c.emailMissing };
    return { ok: false, error: c.failed };
  }

  const url = quoteUrl(publicEnv.siteUrl, token);
  const { data: q } = await sb.from('price_quotes')
    .select('id,to_name,to_email,title').eq('token', token).maybeSingle();
  const row = q as { id: string; to_name: string; to_email: string; title: string } | null;

  let emailed = false;
  if (row) {
    const brand = account.producer.brandName
      ? { name: account.producer.brandName, tagline: account.producer.tagline || undefined }
      : undefined;
    try {
      const res = await sendMail({
        to: row.to_email,
        subject: row.title || c.subjectDefault,
        html: priceQuoteEmail({
          name: row.to_name, title: row.title || c.subjectDefault, amount,
          validUntil: until || null, note, url, brand,
        }),
      });
      emailed = res.sent;
    } catch (e) {
      console.error('[quotes] the quote email did not go out', e);
    }
    if (emailed) await sb.from('price_quotes').update({ emailed_at: new Date().toISOString() }).eq('id', row.id);
  }

  /* The timeline and the stage. Written after the quote exists and best effort
     beside it: the card learning that a proposal went out is a convenience, the
     quote is the record. The stage only ever moves forward from where an
     enquiry still is, never back from won or lost. */
  const { error: evErr } = await sb.from('lead_events').insert({
    lead_id: leadId, type: 'proposal_sent', channel: emailed ? 'email' : '',
    body: [row?.title || c.subjectDefault, String(amount)].join(' · '),
    meta: { quote: row?.id ?? null }, created_by: account.id,
  });
  if (evErr) console.error('[quotes] timeline entry failed', { code: evErr.code, message: evErr.message });
  await sb.from('leads').update({ status: 'proposal_sent' })
    .eq('id', leadId).in('status', ['new', 'contacted', 'meeting']);

  touch(leadId);
  return { ok: true, url, emailed, to: row?.to_email };
}

/** Taking one back. The link stops answering; nothing already emailed can be
 *  recalled, and the screen says so. */
export async function withdrawQuote(form: FormData): Promise<void> {
  const id = String(form.get('quote_id') ?? '');
  const leadId = String(form.get('lead_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  const { data, error } = await sb.from('price_quotes')
    .update({ status: 'withdrawn' }).eq('id', id).neq('status', 'paid').select('id');
  if (error || !data?.length) {
    console.error('[quotes] withdraw failed', { code: error?.code, message: error?.message });
    await noteFailure(quoteFor(await currentLocale()).list.failed);
  }
  touch(leadId);
}

/** Only the producer writes this: the couple's "we transferred" is a claim, and
 *  the bank statement is in the producer's hands. */
export async function markQuotePaid(form: FormData): Promise<void> {
  const id = String(form.get('quote_id') ?? '');
  const leadId = String(form.get('lead_id') ?? '');
  if (!id) return;
  const account = await currentAccount();
  const sb = await supabaseServer();
  const { data, error } = await sb.from('price_quotes')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'sent').select('id,amount,title');
  if (error || !data?.length) {
    console.error('[quotes] mark paid failed', { code: error?.code, message: error?.message });
    await noteFailure(quoteFor(await currentLocale()).list.failed);
  } else if (leadId) {
    const q = data[0] as { amount: number; title: string };
    await sb.from('lead_events').insert({
      lead_id: leadId, type: 'note', channel: 'system',
      body: `${quoteFor('he').stages.paid}: ${q.title || quoteFor('he').composer.subjectDefault} · ${q.amount}`,
      created_by: account?.id ?? null,
    });
  }
  touch(leadId);
}

/** The couple, with nothing but the link. Records which way they said they
 *  will pay, and the database rings the producer. */
export async function chooseQuoteWay(_prev: QuoteResult | null, form: FormData): Promise<QuoteResult> {
  const c = quoteFor(await currentLocale()).page;
  const token = String(form.get('token') ?? '');
  const choice = String(form.get('choice') ?? '');
  if (token.length < 32 || (choice !== 'link' && choice !== 'bank')) return { ok: false, error: c.failed };
  const { error } = await supabasePublic().rpc('price_quote_choose', { p_token: token, p_choice: choice });
  if (error) {
    console.error('[quotes] choose failed', { code: error.code });
    return { ok: false, error: c.failed };
  }
  revalidatePath(`/q/${token}`);
  return { ok: true };
}
