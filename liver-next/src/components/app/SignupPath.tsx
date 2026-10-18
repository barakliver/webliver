import Link from 'next/link';
import { chooseMyPath } from '@/app/actions/signupPath';
import type { AppUi } from '@/content/appUi';

/** One answer, as a card that is also the button. Pressing it is the whole
 *  step: there is no second "send" under it, because a choice followed by a
 *  confirmation is two presses for one thought. */
function Choice({ intent, label, note }: { intent: string; label: string; note: string }) {
  return (
    <form action={chooseMyPath}>
      <input type="hidden" name="intent" value={intent} />
      <button
        type="submit"
        className="w-full rounded-card-sm border border-line bg-card p-4 text-start transition hover:border-accent hover:bg-surface-100"
      >
        <span className="block text-lead font-medium text-ink">{label}</span>
        <span className="mt-1 block text-body text-ink-mute">{note}</span>
      </button>
    </form>
  );
}


type Intent = 'producer' | 'wedding' | 'business';

/**
 * What a not-yet-let-in account sees under the page title: the question the
 * first time, and afterwards what was asked and who is deciding.
 *
 * Its own file so it can be looked at. /app/pending is behind a real session,
 * which made the one screen every new person sees the one nobody could open
 * without being somebody new.
 *
 * Two steps in the address bar rather than in component state, so the back
 * button does what a person expects and nothing here needs a script.
 */
export function SignupPath({ p, step, change, intent, status, mayAnswer }: {
  p: AppUi['pending'];
  step?: string;
  change?: string;
  intent: Intent | null;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  mayAnswer: boolean;
}) {
  const asking = mayAnswer && (intent === null || change === '1');
  const here = change === '1' ? '/app/pending?change=1' : '/app/pending';

  if (asking) {
    return (
      <div className="card space-y-5">
        <p className="text-head leading-relaxed text-ink-soft">
          {step === 'event' ? p.ask.eventSub : p.ask.sub}
        </p>

        {step === 'event' ? (
          <>
            <h2 className="head-sub">{p.ask.eventTitle}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice intent="wedding" label={p.ask.wedding} note={p.ask.weddingNote} />
              <Choice intent="business" label={p.ask.business} note={p.ask.businessNote} />
            </div>
            <Link
              href={here}
              className="inline-flex min-h-[44px] items-center text-body text-ink-mute underline-offset-4 hover:text-ink hover:underline"
            >
              {p.ask.back}
            </Link>
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice intent="producer" label={p.ask.producer} note={p.ask.producerNote} />
            {/* A link rather than a form: this one asks a second question
                and writes nothing yet. */}
            <Link
              href={change === '1' ? '/app/pending?change=1&step=event' : '/app/pending?step=event'}
              className="block w-full rounded-card-sm border border-line bg-card p-4 text-start transition hover:border-accent hover:bg-surface-100"
            >
              <span className="block text-lead font-medium text-ink">{p.ask.event}</span>
              <span className="mt-1 block text-body text-ink-mute">{p.ask.eventNote}</span>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      {/* What was asked, on a swatch of the tamarind: the one sentence on this
          screen that is about the person reading it. */}
      {intent && (
        <p className="rounded-card-sm bg-tone-tamarind px-4 py-3.5 font-display text-subhead font-light text-tone-tamarind-on">
          {p.sent[intent]}
        </p>
      )}
      {(intent ? [p.sent.waiting] : p.body).map((line) => (
        <p key={line} className="text-head leading-relaxed text-ink-soft">{line}</p>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-body">
        <span className="flex items-center gap-2">
          <span className="text-ink-mute">{p.statusLabel}:</span>
          <b className="text-ink">{p.statuses[status]}</b>
        </span>
        {mayAnswer && intent && (
          <Link
            href="/app/pending?change=1"
            className="inline-flex min-h-[44px] items-center text-ink-mute underline underline-offset-4 hover:text-ink"
          >
            {p.sent.change}
          </Link>
        )}
      </div>
    </div>
  );
}
