'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check } from 'lucide-react';
import { createCampaign, type ConferenceResult } from '@/app/actions/conference';

function Make() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? 'יוצר' : 'יצירת קוד חדש'}</button>;
}

/**
 * A new code. It asks for a name, who it is for, when it ends and how many it
 * lets in, and it says what the last two are for: a code left open forever on
 * a printed sheet is a door nobody remembers.
 */
export function CampaignForm() {
  const [state, action] = useActionState<ConferenceResult | null, FormData>(createCampaign, null);
  return (
    <form action={action} className="card grid gap-3 sm:grid-cols-2">
      <label className="text-meta font-medium text-ink-soft sm:col-span-2">
        שם הכנס
        <input name="name" required maxLength={120} autoComplete="off" className="field mt-1" placeholder="למשל: כנס מפיקים, נובמבר" />
      </label>
      <label className="text-meta font-medium text-ink-soft">
        למי הקוד
        <select name="kind" className="field mt-1" defaultValue="producer">
          <option value="producer">מפיקי אירועים</option>
          <option value="dj">DJים</option>
        </select>
      </label>
      <label className="text-meta font-medium text-ink-soft">
        נסגר ב
        <input name="expires" type="date" dir="ltr" className="field mt-1 block" />
        <span className="mt-1 block text-micro font-normal text-ink-mute">בסוף היום הזה. בלי תאריך הקוד פתוח עד שתכבה אותו.</span>
      </label>
      <label className="text-meta font-medium text-ink-soft">
        עד כמה נרשמים
        <input name="max_signups" type="number" dir="ltr" inputMode="numeric" min={1} max={5000} defaultValue={300} className="field mt-1" />
        <span className="mt-1 block text-micro font-normal text-ink-mute">אחרי המספר הזה הקוד נסגר לבד.</span>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Make />
        {state?.ok && <span role="status" className="inline-flex items-center gap-1 text-body text-ok"><Check size={15} aria-hidden />נוצר</span>}
        {state && !state.ok && <span role="alert" className="text-body text-bad">{state.error}</span>}
      </div>
    </form>
  );
}
