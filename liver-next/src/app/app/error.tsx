'use client';

import { useEffect } from 'react';
import { RotateCw, ArrowRight } from 'lucide-react';

/** Something in the workspace threw. Without this file the whole screen went
 *  blank with a browser-level message, which told nobody anything: the event
 *  page was down for a day because a client component imported a constant from
 *  a 'use server' module and the only symptom was a white page.
 *
 *  So: say what happened, offer the two things that actually help — try again,
 *  or go back — and show the digest, which is the one string that points at the
 *  matching line in the server log. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[app] render failed', error); }, [error]);

  return (
    <div className="card measure text-center">
      <h1 className="font-display text-title font-semibold text-ink">משהו נפל בעמוד הזה</h1>
      <p className="mt-3 text-[15.5px] text-ink-soft">
        התקלה אצלנו, לא אצלכם, ושום דבר שהזנתם לא נמחק. אפשר לנסות לטעון שוב.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary inline-flex items-center gap-2">
          <RotateCw size={17} aria-hidden strokeWidth={1.5} />
          <span>לנסות שוב</span>
        </button>
        <a href="/app" className="btn-ghost inline-flex items-center gap-2">
          <ArrowRight size={17} aria-hidden strokeWidth={1.5} />
          <span>חזרה למסך הראשי</span>
        </a>
      </div>

      {error.digest && (
        <p className="mt-7 text-[12.5px] text-ink-mute">
          קוד לתקלה: <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </div>
  );
}
