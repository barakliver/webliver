'use client';

import { completeCall } from '@/app/actions/leads';
import { formatDate } from '@/lib/dates';
import { leadsCopy } from '@/content/site';
import type { Call } from './LeadRow';

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });

/** Compared on calendar dates so a reminder due today never reads as late. */
function dueState(d: string | null): 'late' | 'today' | 'ahead' {
  if (!d) return 'ahead';
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const t = new Date(d);
  const when = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  return when < today ? 'late' : when === today ? 'today' : 'ahead';
}

export function CallsPanel({ calls, leads }: { calls: Call[]; leads: { id: string; name: string }[] }) {
  const open = calls.filter((c) => !c.done);
  const c = leadsCopy;
  if (open.length === 0) return null;

  const nameOf = (id: string | null) => leads.find((l) => l.id === id)?.name ?? '';

  return (
    <section className="card mt-6">
      <h2 className="font-display text-[18px] font-light text-ink">📞 {c.callsTitle}</h2>
      <ul className="mt-4 space-y-2">
        {open.map((call) => {
          const st = dueState(call.remind_on);
          return (
            <li key={call.id} className={`flex flex-wrap items-center gap-3 rounded-none border px-4 py-3 ${
              st === 'late' ? 'border-bad/25 bg-bad-wash/60' : st === 'today' ? 'border-warn/30 bg-warn-wash/70' : 'border-line'
            }`}>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] text-ink">{call.title}{nameOf(call.lead_id) ? ` · ${nameOf(call.lead_id)}` : ''}</p>
                <p className="text-[12.5px] text-ink-mute">
                  {formatDate(dateFmt, call.remind_on, '·')}
                  {st === 'late' ? ` · ${c.callLate}` : st === 'today' ? ` · ${c.callToday}` : ''}
                </p>
              </div>
              <form action={completeCall}>
                <input type="hidden" name="call_id" value={call.id} />
                <input type="hidden" name="done" value={String(call.done)} />
                <button type="submit" className="btn-ghost px-4 py-1.5 text-[13px]">{c.callDone}</button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
