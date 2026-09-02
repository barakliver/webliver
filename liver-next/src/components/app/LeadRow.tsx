'use client';

import { useActionState, useState } from 'react';
import { formatDate } from '@/lib/dates';
import { useFormStatus } from 'react-dom';
import { setLeadStatus, setLeadNote, bookCall, convertLead, type LeadActionResult } from '@/app/actions/leads';
import { leadsCopy, appCopy, EVENT_KINDS } from '@/content/site';

export type Lead = {
  id: string; full_name: string; email: string; phone: string;
  kind: 'wedding' | 'corporate'; event_date: string | null;
  guest_count: number | null; message: string; note: string;
  status: keyof typeof leadsCopy.statuses; created_at: string;
  source: string;
};
export type Call = { id: string; lead_id: string | null; title: string; remind_on: string | null; done: boolean };

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
const show = (d: string | null) => formatDate(dateFmt, d, '·');

/** A channel nobody has named yet is shown as it was stored rather than
 *  hidden. A new source that starts working is then visible on day one,
 *  instead of on the day somebody remembers to add a label for it. */
const sourceLabel = (s: string) => leadsCopy.sources[s] ?? s.replace(/_/g, ' ');

function Book() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-ghost whitespace-nowrap px-4 py-2 text-[13.5px]" disabled={pending}>
      {pending ? leadsCopy.callBooking : leadsCopy.callBook}
    </button>
  );
}

export function LeadRow({ lead, calls }: { lead: Lead; calls: Call[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<LeadActionResult | null, FormData>(bookCall, null);
  const c = leadsCopy;
  const kind = EVENT_KINDS.find((k) => k.value === lead.kind)?.label ?? lead.kind;
  const openCalls = calls.filter((x) => !x.done);

  return (
    <li className="rounded-xl2 border border-line">
      <div className="flex flex-wrap items-center gap-3 p-4">
        {/* A floor, not just `min-w-0`. In a wrapping row a fully shrinkable
            flex-1 child absorbs all the squeeze before anything wraps, so at
            412px the lead's name was rendering one word per line beside an
            intact status select. With a floor the fixed controls wrap below
            instead, which is what the wrap was for. */}
        <div className="min-w-[200px] flex-1">
          <p className="font-medium text-ink">{lead.full_name}</p>
          <p className="text-[12.5px] text-ink-mute" dir="ltr">
            {[lead.phone, lead.email].filter(Boolean).join(' · ') || '·'}
          </p>
          <p className="mt-0.5 text-[12.5px] text-ink-mute">
            {kind}
            {lead.event_date ? ` · ${show(lead.event_date)}` : ''}
            {lead.guest_count ? ` · ${lead.guest_count}` : ''}
            {lead.source ? ` · ${sourceLabel(lead.source)}` : ''}
          </p>
        </div>

        {openCalls.length > 0 && (
          <span className="rounded-xl2 bg-warn-wash px-3 py-1 text-[12.5px] text-warn">
            {c.callTitle} · {show(openCalls[0].remind_on)}
          </span>
        )}

        <form action={setLeadStatus}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <select
            name="status" defaultValue={lead.status}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="field w-[140px] py-1.5 text-[13.5px]"
            aria-label={appCopy.leads.cols.status}
          >
            {Object.entries(c.statuses).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </form>

        <button type="button" className="btn-quiet px-3 py-1.5 text-[13px]" onClick={() => setOpen((v) => !v)}>
          {open ? c.close : c.open}
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-line bg-surface-100 p-4">
          {lead.message && (
            <p className="rounded-xl2 bg-card px-4 py-3 text-[14px] leading-relaxed text-ink-soft">“{lead.message}”</p>
          )}

          <form action={setLeadNote} className="flex flex-wrap gap-2">
            <input type="hidden" name="lead_id" value={lead.id} />
            <input name="note" defaultValue={lead.note} placeholder={c.notePh} autoComplete="off"
                   className="field flex-1 min-w-[200px]" aria-label={c.note} />
            <button type="submit" className="btn-ghost px-4 py-2 text-[13.5px]">{c.saveNote}</button>
          </form>

          <form action={action} className="flex flex-wrap gap-2">
            <input type="hidden" name="lead_id" value={lead.id} />
            <input type="hidden" name="phone" value={lead.phone} />
            <input name="title" defaultValue={c.callTitle} className="field flex-1 min-w-[160px]" aria-label={c.callTitle} />
            <input name="remind_on" type="date" required className="field w-[160px]" aria-label={c.callWhen} />
            <Book />
          </form>
          {state && !state.ok && state.error && (
            <p role="alert" className="rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">{state.error}</p>
          )}

          <form action={convertLead}>
            <input type="hidden" name="lead_id" value={lead.id} />
            <button type="submit" className="btn-primary px-5 py-2 text-[14px]">{c.convert}</button>
          </form>
        </div>
      )}
    </li>
  );
}
