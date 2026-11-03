'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Send } from 'lucide-react';
import { previewBroadcast, sendBroadcast, type ConferenceResult } from '@/app/actions/conference';

function Go({ idle, busy, quiet }: { idle: string; busy: string; quiet?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${quiet ? 'btn-ghost' : 'btn-primary'} inline-flex items-center gap-1.5 disabled:opacity-60`}>
      {!quiet && <Send size={15} strokeWidth={1.5} aria-hidden />}{pending ? busy : idle}
    </button>
  );
}

/**
 * A message to the list, in two presses.
 *
 * The first reads the list and shows how many it would reach and three of the
 * addresses; nothing is sent. The second sends, and carries what the first
 * showed in the form rather than in memory on a server. Between the two the
 * list is read again, so somebody who left in the meantime is not written to.
 * Pasting a mailing and pressing once is the one write here that has no way
 * back.
 */
export function BroadcastPanel({ campaigns }: { campaigns: { id: string; name: string }[] }) {
  const [shown, preview] = useActionState<ConferenceResult | null, FormData>(previewBroadcast, null);
  const [done, send] = useActionState<ConferenceResult | null, FormData>(sendBroadcast, null);
  const p = shown?.preview;

  if (done?.ok) {
    return (
      <div className="card" role="status">
        <h3 className="head-sub">יצאה לדרך</h3>
        <p className="mt-2 text-body text-ink-soft">
          ההודעה נשלחת עכשיו ל-{done.sent} אנשים, אחד אחרי השני. אפשר לסגור את המסך.
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <form action={preview} className="space-y-3">
        <label className="block text-meta font-medium text-ink-soft">
          למי
          <select name="campaign" className="field mt-1" defaultValue="">
            <option value="">כל מי שאישר רשימה, בכל הכנסים</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block text-meta font-medium text-ink-soft">
          נושא
          <input name="subject" required maxLength={200} autoComplete="off" className="field mt-1" />
        </label>
        <label className="block text-meta font-medium text-ink-soft">
          תוכן
          <textarea name="body" required rows={6} maxLength={8000} className="field mt-1" />
          <span className="mt-1 block text-micro font-normal text-ink-mute">
            טקסט רגיל. בתחתית כל הודעה נוסף לבד מי שולח, למה קיבלו אותה וקישור להסרה.
          </span>
        </label>
        <Go idle="מי יקבל?" busy="בודק" quiet />
      </form>

      {shown && !shown.ok && <p role="alert" className="text-body text-bad">{shown.error}</p>}

      {p && (
        <form action={send} className="space-y-3 rounded-card-sm border border-line-strong p-4">
          <input type="hidden" name="campaign" value={p.campaign} />
          <input type="hidden" name="subject" value={p.subject} />
          <input type="hidden" name="body" value={p.body} />
          <p className="text-body text-ink">
            ההודעה תישלח ל-<strong>{p.count}</strong> אנשים שאישרו ולא הסירו את עצמם, למשל{' '}
            <span dir="ltr" className="font-mono text-meta">{p.sample.join(', ')}</span>.
          </p>
          <Go idle={`שליחה ל-${p.count}`} busy="שולח" />
          {done && !done.ok && <p role="alert" className="text-body text-bad">{done.error}</p>}
        </form>
      )}
    </div>
  );
}
