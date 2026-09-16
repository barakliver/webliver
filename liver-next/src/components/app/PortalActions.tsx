'use client';

import { useState } from 'react';
import { Phone, MessageCircle, CalendarDays, TriangleAlert } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { Sheet } from '@/components/app/Sheet';
import { Ltr } from '@/components/Ltr';
import { normalizePhone, displayPhone } from '@/lib/phone';
import { cn } from '@/lib/utils';


/**
 * The two things a couple needs at a moment they cannot plan for.
 *
 * Reaching the producer, and saying something is wrong. Both are wanted at the
 * point of noticing rather than at the point of looking, so both float.
 *
 * They used to be two circles, and with the way around beside them and the
 * accessibility button the layout puts on every screen, the bottom of a
 * phone carried four floating controls over the content. He said so: too
 * much. So it is **one** button now, and the sheet behind it carries both
 * jobs - the ways to reach a person first, and "something is not working"
 * underneath them, quieter and after. That ordering is the whole of what the
 * two sizes used to say: a screen that offers "call" and "something is
 * broken" at equal volume is a screen that expects things to be broken.
 *
 * The other half of this was a real dead end. Every row in the contact sheet
 * is conditional on the producer having filled that field in, so a producer
 * with no number on their brand gave a button that opened a sheet with
 * nothing in it at all. It is not possible to reach that state now: the
 * report row is unconditional, and a sheet with no way to call says so in a
 * sentence.
 */
export function PortalActions({
  /** The way around the screen, dropped into the same dock. A slot rather
   *  than an import, because what it lists is read off the page it is on and
   *  this component does not know what page that is. */
  jump,
  producerName, phone, whatsapp, bookingUrl, onReport,
}: {
  jump?: React.ReactNode;
  producerName: string;
  phone: string;
  whatsapp: string;
  bookingUrl: string;
  onReport: (topic: string, body: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const c = useCopy().sheets;
  const [sheet, setSheet] = useState<'contact' | 'report' | null>(null);
  const tel = normalizePhone(phone);
  const wa = normalizePhone(whatsapp || phone);

  return (
    <>
      {/* One dock, centred, clear of the bottom bar and of the home
          indicator under it.
          These two used to sit at the far edges of the screen, and the one on
          the start edge was in exactly the same place as the accessibility
          button the layout puts on every screen — two controls stacked on one
          another, the lower of them unreachable. Grouped in the middle they
          cannot collide with it, they read as one thing rather than as
          debris, and there is room between them for the way around, which is
          what a long screen was actually missing. */}
      <div
        className="pointer-events-none fixed inset-x-0 z-30 flex items-center justify-center gap-2 px-5"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
      >
        {jump}
        <button
          type="button"
          onClick={() => setSheet('contact')}
          title={c.contact.open}
          aria-label={c.contact.open}
          className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full
                     bg-ink text-surface shadow-fab transition-colors duration-300 hover:bg-ink-soft"
        >
          <Phone size={19} strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      <Sheet
        open={sheet === 'contact'}
        onClose={() => setSheet(null)}
        title={producerName ? `${producerName} · ${c.contact.title}` : c.contact.title}
        sub={c.contact.sub}
      >
        <ul className="list-none space-y-2 p-0">
          {!tel && !wa && !bookingUrl && (
            <li className="px-3 py-2 text-[14px] text-ink-soft">{c.contact.none}</li>
          )}
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
          {/* Last and quietest, and a button rather than a link because it
              swaps this sheet for the other one. Unconditional: it is the row
              that makes an empty contact sheet impossible. */}
          <li className="border-t border-line pt-2">
            <button
              type="button"
              onClick={() => setSheet('report')}
              className="flex min-h-[52px] w-full items-center gap-3 px-3 text-start text-[15px] text-ink-soft transition-colors duration-300 hover:text-ink"
            >
              <TriangleAlert size={18} strokeWidth={1.5} aria-hidden />
              <span className="flex-1">{c.report.open}</span>
            </button>
          </li>
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
  const c = useCopy().sheets;
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
