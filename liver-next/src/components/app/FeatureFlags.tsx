'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { appCopy } from '@/content/site';
import { setFeatureFlag } from '@/app/actions/admin';
import type { Flag } from '@/lib/directory';
import { cn } from '@/lib/utils';

const c = appCopy.admin.flags;

/**
 * Which modules each kind of couple may open.
 *
 * Two toggles per module rather than one, because the axis is not "on or off",
 * it is which customer gets it. A couple handed a finished workspace by a
 * producer and a couple planning their own wedding with the tools are not the
 * same buyer, and the difference between them belongs on a screen rather than
 * in a deploy.
 *
 * Each row saves itself. A page-wide save button on a list of switches means
 * the state on screen and the state in the database disagree for as long as
 * somebody is reading it, and a governance screen that lies about what is
 * switched on is worse than no screen.
 */
export function FeatureFlags({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) return null;
  return (
    <section>
      <h2 className="eyebrow mb-1">{c.title}</h2>
      <p className="mb-3 text-[13.5px] text-ink-soft">{c.sub}</p>

      <div className="card">
        <ul className="list-none space-y-1 p-0">
          {flags.map((f) => <Row key={f.key} flag={f} />)}
        </ul>
        <p className="mt-3 text-[12.5px] text-ink-mute">{c.note}</p>
      </div>
    </section>
  );
}

function Row({ flag }: { flag: Flag }) {
  /* Held locally so the switch moves under the finger, then reconciled by the
     revalidate the action triggers. Waiting for a round trip to show a toggle
     move is how somebody taps it three times. */
  const [diy, setDiy] = useState(flag.diy);
  const [managed, setManaged] = useState(flag.managed);
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();

  const save = (next: { diy: boolean; managed: boolean }) => {
    setDiy(next.diy);
    setManaged(next.managed);
    start(async () => {
      const form = new FormData();
      form.set('key', flag.key);
      form.set('label', flag.label);
      if (next.diy) form.set('diy', 'on');
      if (next.managed) form.set('managed', 'on');
      await setFeatureFlag(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    });
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 py-2 last:border-0">
      <span className="text-[15px] text-ink">
        {flag.label || flag.key}
        {saved && <span className="ms-2 text-[12.5px] text-ok">{c.saved}</span>}
      </span>

      <div className="flex gap-2">
        <Toggle
          label={c.diy}
          on={diy}
          onClick={() => save({ diy: !diy, managed })}
        />
        <Toggle
          label={c.managed}
          on={managed}
          onClick={() => save({ diy, managed: !managed })}
        />
      </div>
    </li>
  );
}

/** A switch that reads without colour: the word is there either way, and the
 *  tick is a shape rather than a hue. */
function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'inline-flex min-h-[44px] items-center gap-1.5 rounded-none border px-4 text-[13.5px] font-medium transition-colors',
        on
          ? 'border-ok bg-ok-wash text-ok'
          : 'border-line-strong bg-surface-100 text-ink-mute',
      )}
    >
      {on && <Check size={14} aria-hidden strokeWidth={1.5} />}
      {label}
      <span className="sr-only">{on ? c.on : c.off}</span>
    </button>
  );
}
