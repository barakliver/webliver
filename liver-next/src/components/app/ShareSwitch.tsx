'use client';

import { useFormStatus } from 'react-dom';
import { Eye, EyeOff } from 'lucide-react';
import { setSectionShared } from '@/app/actions/share';
import { useCopy } from '@/components/app/CopyProvider';
import { PORTAL_SECTIONS, type SharedSections, sectionOpen } from '@/content/portalSections';

/** One door on the couple's screen, and whether it is open.
 *
 *  A switch rather than a checkbox, because the question is not "is this
 *  true" but "is this on", and because the state has to be legible from
 *  across the room: a producer glancing at the prep tab should know at once
 *  whether the couple can see the envelopes. The word beside the knob says
 *  which way it is set, so colour alone never carries the answer. */
function Knob({ on, label, word }: { on: boolean; label: string; word: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={pending}
      className="inline-flex min-h-[44px] items-center gap-2.5 rounded-xl2 px-2 text-[13px] transition disabled:opacity-60 sm:min-h-0"
    >
      <span
        aria-hidden
        className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors ${
          on ? 'justify-end border-ok bg-ok' : 'justify-start border-line-strong bg-surface-200'
        }`}
      >
        <span className={`h-4 w-4 rounded-full transition-colors ${on ? 'bg-surface' : 'bg-ink-mute'}`} />
      </span>
      <span className={`inline-flex items-center gap-1.5 ${on ? 'text-ok' : 'text-ink-mute'}`}>
        {on ? <Eye size={14} aria-hidden strokeWidth={1.5} /> : <EyeOff size={14} aria-hidden strokeWidth={1.5} />}
        {word}
      </span>
    </button>
  );
}

export function ShareSwitch({ clientId, section, on, label }: {
  clientId: string; section: string; on: boolean; label: string;
}) {
  const c = useCopy().preview;
  return (
    <form action={setSectionShared} className="inline-flex">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="on" value={String(!on)} />
      <Knob on={on} label={label} word={on ? c.sharedOn : c.sharedOff} />
    </form>
  );
}

/** The switches for one producer tab, in a row above its panels. Most tabs
 *  are one door; the prep tab is three, because the faces, the envelopes and
 *  the cars are three sections on the couple's screen. Renders nothing for a
 *  tab the couple never sees, like the bar and the meetings. */
export function TabShare({ clientId, tab, shares, moneyOn }: {
  clientId: string; tab: string; shares: SharedSections; moneyOn: boolean;
}) {
  const ui = useCopy();
  const sections = PORTAL_SECTIONS.filter((s) => s.tab === tab);
  if (sections.length === 0) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl2 border border-line bg-surface-100 px-3 py-1.5">
      <span className="text-[12.5px] text-ink-mute">{ui.preview.coupleSees}</span>
      {sections.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-2">
          {sections.length > 1 && <span className="text-[13px] text-ink">{ui.portal[s.row] as string}</span>}
          <ShareSwitch
            clientId={clientId}
            section={s.key}
            on={s.money ? moneyOn : sectionOpen(shares, s.key)}
            label={ui.portal[s.row] as string}
          />
        </span>
      ))}
    </div>
  );
}

/** Every door at once: the page of switches on the producer's preview of the
 *  couple's screen, where flipping one and seeing the section appear or go
 *  is one scroll apart. */
export function ShareSwitches({ clientId, shares, moneyOn }: {
  clientId: string; shares: SharedSections; moneyOn: boolean;
}) {
  const ui = useCopy();
  const c = ui.preview;
  return (
    <section className="card">
      <h2 className="font-display text-[18px] font-semibold text-ink">{c.switchesTitle}</h2>
      <p className="mt-1 max-w-prose2 text-[14px] leading-relaxed text-ink-soft">{c.switchesSub}</p>
      <ul className="mt-4 grid list-none gap-x-8 p-0 sm:grid-cols-2">
        {PORTAL_SECTIONS.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3 border-t border-line py-1">
            <span className="text-[14.5px] text-ink">{ui.portal[s.row] as string}</span>
            <ShareSwitch
              clientId={clientId}
              section={s.key}
              on={s.money ? moneyOn : sectionOpen(shares, s.key)}
              label={ui.portal[s.row] as string}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
