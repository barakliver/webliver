'use client';

import { useFormStatus } from 'react-dom';
import { setSectionShared } from '@/app/actions/share';
import { useCopy } from '@/components/app/CopyProvider';
import { PORTAL_SECTIONS, type SharedSections, sectionOpen } from '@/content/portalSections';

/** One door on the couple's screen, and whether it is open.
 *
 *  A switch rather than a checkbox, because the question is not "is this
 *  true" but "is this on", and because the state has to be legible from
 *  across the room: a producer glancing at the prep tab should know at once
 *  whether the couple can see the envelopes. The word beside the knob says
 *  which way it is set, so colour alone never carries the answer.
 *
 *  It used to say it three times: the knob, an eye, and "open to the couple".
 *  Twenty rows of that is a wall, and the third signal cost the most because
 *  it was the widest. The eye went rather than the word, because a word
 *  survives being read by somebody who does not know what an outlined eye
 *  means, and the word itself lost "to the couple", which the heading above
 *  the list already says twenty times over.
 *
 *  On is the accent rather than green. It was green while the accent was
 *  bronze and green was the only thing in the palette that read as yes; now
 *  that the brand is a blue, a green switch is the one control on the screen
 *  that belongs to a system nobody else is using. Open is not a success
 *  either, it is a setting, and success has its own colour to keep. */
function Knob({ on, label, word }: { on: boolean; label: string; word: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={pending}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl2 px-1.5 text-[12.5px] transition disabled:opacity-60 sm:min-h-[36px]"
    >
      <span
        aria-hidden
        className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5 transition-colors ${
          on ? 'justify-end border-accent bg-accent' : 'justify-start border-line-strong bg-surface-200'
        }`}
      >
        <span className={`h-3.5 w-3.5 rounded-full transition-colors ${on ? 'bg-surface-100' : 'bg-ink-mute'}`} />
      </span>
      <span className={`w-[3.2rem] text-start ${on ? 'text-accent' : 'text-ink-mute'}`}>{word}</span>
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
 *  is one scroll apart.
 *
 *  Twenty rows, so the shape of the list matters more than any one row in it.
 *  The count sits in the heading because it is the only question somebody
 *  arrives with, and the answer used to require counting twenty knobs: a
 *  producer opening this wants to know whether they have handed over most of
 *  the wedding or almost none of it. Three columns on a wide screen rather
 *  than two, and rows that are a row high rather than a control high, because
 *  the previous shape filled a laptop with a list that has nothing in it but
 *  yes and no.
 *
 *  Not a "switch everything on" button. One press that changes twenty rows is
 *  a press somebody makes by accident once and cannot undo by memory, and the
 *  thing it would be undoing is what a couple is allowed to see. */
export function ShareSwitches({ clientId, shares, moneyOn }: {
  clientId: string; shares: SharedSections; moneyOn: boolean;
}) {
  const ui = useCopy();
  const c = ui.preview;
  const openCount = PORTAL_SECTIONS.filter(
    (s) => (s.money ? moneyOn : sectionOpen(shares, s.key)),
  ).length;

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-[18px] font-semibold text-ink">{c.switchesTitle}</h2>
        <p className="text-[13px] tabular-nums text-ink-mute">
          {c.openTally.replace('{n}', String(openCount)).replace('{of}', String(PORTAL_SECTIONS.length))}
        </p>
      </div>
      <p className="mt-1 max-w-prose2 text-[14px] leading-relaxed text-ink-soft">{c.switchesSub}</p>
      <ul className="mt-4 grid list-none gap-x-8 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {PORTAL_SECTIONS.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-2 border-t border-line">
            <span className="min-w-0 truncate text-[14px] text-ink">{ui.portal[s.row] as string}</span>
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
