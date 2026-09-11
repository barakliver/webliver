'use client';

import { Rocket } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { Ltr } from '@/components/Ltr';
import { fill } from '@/lib/copyText';
import { servesLive, shortSha, type ReleaseState as State } from '@/lib/release';

/**
 * The release agent's last word, on the owner's console.
 *
 * For five days every release failed its screen check on the droplet and was
 * put back, and the only thing that said so was a log file on the machine.
 * The email that should have gone out needs a key that was never set. So
 * the console reads the agent's own files and says, in words: what is live,
 * what this screen is running on, how the last release ended, and whether
 * the agent has given up on something and is waiting for a fix.
 *
 * The result is a word with a chip beside it, never a colour alone. The log
 * tail is shown as the agent wrote it, left to right, with connection
 * strings already removed by the reader.
 */
export function ReleaseState({ state }: { state: State }) {
  const c = useCopy().admin.release;
  const serving = servesLive(state);
  const result = {
    'ok': { chip: 'chip-ok', text: c.ok },
    'build-failed': { chip: 'chip-warn', text: c.buildFailed },
    'rolled-back': { chip: 'chip-bad', text: c.rolledBack },
    'broken': { chip: 'chip-bad', text: c.broken },
    'failed': { chip: 'chip-warn', text: c.failed },
    'unknown': { chip: 'chip-mute', text: c.unknown },
  }[state.result];

  return (
    <section className="card" aria-labelledby="release-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="release-title" className="flex items-center gap-2 font-display text-[17px] font-semibold text-ink">
            <Rocket size={16} aria-hidden strokeWidth={1.5} />
            {c.title}
          </h2>
          <p className="mt-1 max-w-prose2 text-[13.5px] text-ink-soft">{c.sub}</p>
        </div>
        {state.found && <span className={result.chip}>{result.text}</span>}
      </div>

      {!state.found ? (
        <p className="mt-4 text-[14px] text-ink-mute">{c.none}</p>
      ) : (
        <>
          <dl className="mt-4 grid gap-x-8 gap-y-2 text-[14px] sm:grid-cols-3">
            <Row label={c.running} value={state.running} />
            <Row label={c.live} value={shortSha(state.live) || '·'} />
            <Row label={c.previous} value={shortSha(state.previous) || '·'} />
          </dl>

          {state.gaveUp && (
            <p role="alert" className="mt-4 rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
              {fill(c.gaveUp, { tag: shortSha(state.gaveUp) })}
            </p>
          )}
          {serving === false && (
            <p className="mt-3 rounded-control border border-warn/25 bg-warn-wash px-4 py-2.5 text-[14px] text-warn">
              {c.mismatch}
            </p>
          )}

          {state.lines.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-[13.5px] text-accent">
                {c.log}{state.at ? ` · ${fill(c.at, { when: state.at.replace('T', ' ').replace('Z', ' UTC') })}` : ''}
              </summary>
              <pre dir="ltr" className="mt-2 max-h-64 overflow-auto rounded-control bg-surface-200 p-3 text-start text-[12px] leading-relaxed text-ink-soft">
                {state.lines.join('\n')}
              </pre>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 sm:block sm:border-0 sm:py-0">
      <dt className="text-[12.5px] text-ink-mute">{label}</dt>
      <dd className="m-0 font-mono text-[13.5px] text-ink"><Ltr>{value}</Ltr></dd>
    </div>
  );
}
