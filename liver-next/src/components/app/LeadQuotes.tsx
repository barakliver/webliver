'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Send, Copy, Check, MessageCircle, Ban, BadgeCheck } from 'lucide-react';
import { sendQuote, withdrawQuote, markQuotePaid, type QuoteResult } from '@/app/actions/quotes';
import { Money } from '@/components/Ltr';
import { EVENT_ZONE } from '@/lib/clock';
import { TONE } from '@/lib/tone';
import type { QuoteStage } from '@/lib/quote';
import type { QuoteCopy } from '@/content/ui';
import type { Locale } from '@/lib/locale';

export type QuoteItem = {
  id: string; title: string; amount: number; stage: QuoteStage; created_at: string;
  valid_until: string | null; url: string; live: boolean;
};

const CHIP: Record<QuoteStage, string> = {
  sent: TONE.camel.wash, opened: TONE.boho.wash, chose_link: TONE.rubine.wash, chose_bank: TONE.rubine.wash,
  paid: TONE.tamarind.wash, expired: 'bg-surface-200 text-ink-mute', withdrawn: 'bg-surface-200 text-ink-mute',
};

function Go({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-60">
      <Send size={15} strokeWidth={1.5} aria-hidden />{pending ? busy : idle}
    </button>
  );
}

function CopyLink({ url, label, done }: { url: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button" className="btn-ghost inline-flex items-center gap-1.5 text-body"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch { /* the link is on screen and can be selected by hand */ }
      }}
    >
      {copied ? <Check size={14} strokeWidth={1.5} aria-hidden className="text-ok" /> : <Copy size={14} strokeWidth={1.5} aria-hidden />}
      {copied ? done : label}
    </button>
  );
}

/**
 * The quote, on the enquiry card.
 *
 * It asks for one thing, the amount, and everything else has a default: the
 * title is a sentence, the address is the lead's, and the date it holds until
 * is left blank unless the producer wants one. The composer is not drawn at all
 * until there is a place to be paid, because a quote with no way to pay it is
 * the one the couple answers with "so where do I send it".
 *
 * Under it are the quotes already sent, each with the stage it has reached and
 * the three things a producer does next: copy the link, send it on WhatsApp,
 * and the two that end it. Marking paid is the producer's alone; what the
 * couple pressed is shown as what they said.
 */
export function LeadQuotes({ leadId, defaultEmail, quotes, copy, ready, locale }: {
  leadId: string; defaultEmail: string; quotes: QuoteItem[]; copy: QuoteCopy; ready: boolean; locale: Locale;
}) {
  const c = copy.composer;
  const l = copy.list;
  const [state, action] = useActionState<QuoteResult | null, FormData>(sendQuote, null);
  const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'short', timeZone: EVENT_ZONE });
  const day = (iso: string) => fmt.format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso));
  const stages = copy.stages as Record<string, string>;

  return (
    <section className="card" aria-labelledby="lead-quote">
      <h2 id="lead-quote" className="head-section">{c.title}</h2>

      {!ready ? (
        <div className="mt-3 space-y-2">
          <p className="text-body text-ink-soft">{c.needPay}</p>
          <Link href="/app/brand#pay" className="btn-ghost inline-flex">{c.toSettings}</Link>
        </div>
      ) : (
        <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="lead_id" value={leadId} />
          <p className="text-body text-ink-soft sm:col-span-2">{c.intro}</p>
          <label className="text-meta font-medium text-ink-soft">
            {c.amount}
            <input name="amount" required inputMode="decimal" dir="ltr" autoComplete="off"
              placeholder={c.amountPh} className="field mt-1" />
            <span className="mt-1 block text-micro font-normal text-ink-mute">{c.amountHint}</span>
          </label>
          <label className="text-meta font-medium text-ink-soft">
            {c.validUntil}
            <input name="valid_until" type="date" dir="ltr" className="field mt-1 block" />
          </label>
          <label className="text-meta font-medium text-ink-soft sm:col-span-2">
            {c.subject}
            <input name="title" defaultValue={c.subjectDefault} autoComplete="off" className="field mt-1" />
          </label>
          <label className="text-meta font-medium text-ink-soft sm:col-span-2">
            {c.note}
            <textarea name="note" rows={3} placeholder={c.notePh} className="field mt-1" />
          </label>
          <label className="text-meta font-medium text-ink-soft sm:col-span-2">
            {c.email}
            <input name="email" type="email" dir="ltr" inputMode="email" autoComplete="off"
              defaultValue={defaultEmail} className="field mt-1" />
            {!defaultEmail && <span className="mt-1 block text-micro font-normal text-ink-mute">{c.emailMissing}</span>}
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Go idle={c.send} busy={c.sending} />
            {state && !state.ok && <span role="alert" className="text-body text-bad">{state.error}</span>}
          </div>

          {state?.ok && (
            <div role="status" className="rounded-card-sm bg-accent-wash p-3 sm:col-span-2">
              <p className={`text-body ${state.emailed ? 'text-ok' : 'text-bad'}`}>
                {state.emailed ? `${c.sentTo} ${state.to}` : c.mailFailed}
              </p>
              {state.url && (
                <p dir="ltr" className="mt-2 overflow-x-auto rounded-xl2 border border-line bg-surface-100 px-3 py-2 text-start font-mono text-meta text-ink-soft">
                  {state.url}
                </p>
              )}
            </div>
          )}
        </form>
      )}

      <h3 className="head-sub mt-6">{l.title}</h3>
      {quotes.length === 0 ? (
        <p className="mt-2 text-body text-ink-mute">{l.empty}</p>
      ) : (
        <ul className="mt-3 list-none space-y-3 p-0">
          {quotes.map((q) => (
            <li key={q.id} className="rounded-card-sm border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-lead text-ink"><Money value={q.amount} /></span>
                <span className={`rounded-full px-2.5 py-0.5 text-meta ${CHIP[q.stage]}`}>{stages[q.stage] ?? q.stage}</span>
              </div>
              <p className="mt-1 text-meta text-ink-mute">
                {q.title ? `${q.title} · ` : ''}{l.sentOn} {day(q.created_at)}
                {q.valid_until ? ` · ${l.validUntil} ${day(q.valid_until)}` : ''}
              </p>
              {q.live && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CopyLink url={q.url} label={l.copy} done={l.copied} />
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${l.waText}\n${q.url}`)}`}
                    target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex items-center gap-1.5 text-body"
                  >
                    <MessageCircle size={14} strokeWidth={1.5} aria-hidden />{l.whatsapp}
                  </a>
                  {q.stage !== 'expired' && (
                    <form action={markQuotePaid}>
                      <input type="hidden" name="quote_id" value={q.id} />
                      <input type="hidden" name="lead_id" value={leadId} />
                      <button type="submit" className="btn-ghost inline-flex items-center gap-1.5 text-body">
                        <BadgeCheck size={14} strokeWidth={1.5} aria-hidden />{l.paid}
                      </button>
                    </form>
                  )}
                  <form action={withdrawQuote}>
                    <input type="hidden" name="quote_id" value={q.id} />
                    <input type="hidden" name="lead_id" value={leadId} />
                    <button type="submit" className="btn-quiet inline-flex items-center gap-1.5 text-body">
                      <Ban size={14} strokeWidth={1.5} aria-hidden />{l.withdraw}
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {quotes.some((q) => q.live) && <p className="mt-2 text-meta text-ink-mute">{l.withdrawNote}</p>}
    </section>
  );
}
