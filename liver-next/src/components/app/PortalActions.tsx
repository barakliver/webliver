'use client';

import { useState } from 'react';
import { Phone, MessageCircle, CalendarDays, TriangleAlert } from 'lucide-react';
import { appCopy } from '@/content/site';
import { Sheet } from '@/components/app/Sheet';
import { Ltr } from '@/components/Ltr';
import { normalizePhone, displayPhone } from '@/lib/phone';
import { cn } from '@/lib/utils';

const c = appCopy.sheets;

/**
 * The two things a couple needs at a moment they cannot plan for.
 *
 * Reaching the producer, and saying something is wrong. Both live behind
 * floating buttons rather than in a menu, because both are wanted at the point
 * of noticing rather than at the point of looking.
 *
 * The two are deliberately different sizes and different weights. The one for
 * talking to a person is solid and larger; the one for reporting a problem is
 * quieter. A screen that offers "call" and "something is broken" at equal
 * volume is a screen that expects things to be broken.
 */
export function PortalActions({
  producerName, phone, whatsapp, bookingUrl, onReport,
}: {
  producerName: string;
  phone: string;
  whatsapp: string;
  bookingUrl: string;
  onReport: (topic: string, body: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [sheet, setSheet] = useState<'contact' | 'report' | null>(null);
  const tel = normalizePhone(phone);
  const wa = normalizePhone(whatsapp || phone);

  return (
    <>
      {/* Clear of the bottom bar and of the home indicator under it. */}
      <div
        className="pointer-events-none fixed inset-x-0 z-30 flex items-center justify-between px-5"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
      >
        <button
          type="button"
          onClick={() => setSheet('contact')}
          title={c.contact.open}
          aria-label={c.contact.open}
          className="pointer-events-auto grid h-[52px] w-[52px] place-items-center rounded-full
                     bg-ink text-surface shadow-fab transition-colors duration-300 hover:bg-ink-soft"
        >
          <Phone size={20} strokeWidth={1.5} aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => setSheet('report')}
          title={c.report.open}
          aria-label={c.report.open}
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full
                     border border-line-strong bg-surface-100 text-ink-soft
                     transition-colors duration-300 hover:text-ink"
        >
          <TriangleAlert size={18} strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      <Sheet
        open={sheet === 'contact'}
        onClose={() => setSheet(null)}
        title={producerName ? `${producerName} · ${c.contact.title.split(' · ')[1]}` : c.contact.title}
        sub={c.contact.sub}
      >
        <ul className="list-none space-y-2 p-0">
          {tel && (
            <Row
              href={`tel:${tel}`}
              icon={<Phone size={18} strokeWidth={1.5} aria-hidden />}
              label={c.contact.call}
              meta={<Ltr>{displayPhone(tel)}</Ltr>}
              primary
            />
          )}
          {wa && (
            <Row
              href={`https://wa.me/${wa.replace('+', '')}`}
              icon={<MessageCircle size={18} strokeWidth={1.5} aria-hidden />}
              label={c.contact.whatsapp}
              meta={c.contact.whatsappMeta}
            />
          )}
          {bookingUrl && (
            <Row
              href={bookingUrl}
              icon={<CalendarDays size={18} strokeWidth={1.5} aria-hidden />}
              label={c.contact.meeting}
              meta={c.contact.meetingMeta}
            />
          )}
        </ul>
      </Sheet>

      <Sheet
        open={sheet === 'report'}
        onClose={() => setSheet(null)}
        title={c.report.title}
        sub={c.report.sub}
      >
        <ReportForm onSubmit={onReport} onDone={() => setSheet(null)} />
      </Sheet>
    </>
  );
}

function Row({ href, icon, label, meta, primary }: {
  href: string; icon: React.ReactNode; label: string; meta: React.ReactNode; primary?: boolean;
}) {
  const external = href.startsWith('http');
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className={cn(
          'flex min-h-[52px] items-center gap-3 px-3 text-[15px] transition-colors duration-300',
          primary ? 'bg-ink text-surface hover:bg-ink-soft' : 'border border-line text-ink hover:bg-surface',
        )}
      >
        {icon}
        <span className="flex-1">{label}</span>
        <span className={cn('text-[12.5px]', primary ? 'text-surface/65' : 'text-ink-mute')}>{meta}</span>
      </a>
    </li>
  );
}

function ReportForm({ onSubmit, onDone }: {
  onSubmit: (topic: string, body: string) => Promise<{ ok: boolean; error?: string }>;
  onDone: () => void;
}) {
  const [topic, setTopic] = useState<string>(c.report.topics[0]);
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const send = async () => {
    if (body.trim().length < 2) { setError(c.report.empty); return; }
    setState('sending'); setError('');
    const r = await onSubmit(topic, body.trim());
    if (r.ok) {
      setState('sent');
      /* Left on screen long enough to be read, then out of the way. A sheet
         that closes the instant it succeeds leaves somebody wondering. */
      setTimeout(onDone, 1400);
    } else {
      setState('error');
      setError(r.error ?? c.report.failed);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {c.report.topics.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTopic(t)}
            aria-pressed={topic === t}
            className={cn(
              'min-h-[40px] border px-3 text-[13px] transition-colors duration-300',
              topic === t ? 'border-ink text-ink' : 'border-line text-ink-mute hover:text-ink',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={1000}
        placeholder={c.report.placeholder}
        className="field mt-4 resize-none"
      />

      {error && <p role="alert" className="mt-2 text-[13.5px] text-bad">{error}</p>}

      <button
        type="button"
        onClick={send}
        disabled={state === 'sending' || state === 'sent'}
        className={cn('btn mt-5 w-full', state === 'sent' ? 'bg-ok text-surface' : 'btn-primary')}
      >
        {state === 'sending' ? c.report.sending : state === 'sent' ? c.report.sent : c.report.submit}
      </button>
    </div>
  );
}
