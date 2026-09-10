'use client';

import { useMemo, useState } from 'react';
import { CalendarRange, Check, AlertTriangle } from 'lucide-react';
import { count as plural, fill } from '@/lib/copyText';
import { useCopy } from '@/components/app/CopyProvider';
import { shortDate } from '@/lib/appDates';
import { todayInZone } from '@/lib/clock';
import { applyTimeline, type TimelineResult } from '@/app/actions/timeline';
import {
  buildTimeline, TIMELINE_CATEGORIES, type Owner, type TimelineCategory,
} from '@/content/timeline';

type Owners = Partial<Record<TimelineCategory, Owner>>;

/**
 * The year's plan for this wedding, shown before it is written.
 *
 * A table first and a button second, on purpose. The first version of every
 * planning tool applies the whole list in one press and is then unpicked by
 * hand for twenty minutes. Here the producer sees what would land, moves an
 * area of work to the couple, ticks "abroad" and watches the invitations
 * jump to nine months out, and only then adds it. What is added is built
 * again on the server from the same three inputs, so the table and the
 * tasks cannot disagree.
 *
 * The three tips at the bottom are the steps couples underestimate most.
 * They are copy, not rows: a warning read once at the right moment does more
 * than a task nobody opens.
 */
export function TimelineBuilder({ clientId, eventDate, guestEstimate, defaultOpen = false }: {
  clientId: string; eventDate: string | null; guestEstimate: number | null;
  /** Open on arrival. The gallery uses it; the overview does not. */
  defaultOpen?: boolean;
}) {
  const ui = useCopy();
  const c = ui.timeline;
  const dateFmt = shortDate(ui.locale);
  const [open, setOpen] = useState(defaultOpen);
  const [guests, setGuests] = useState<string>(guestEstimate ? String(guestEstimate) : '');
  const [abroad, setAbroad] = useState(false);
  const [owners, setOwners] = useState<Owners>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TimelineResult | null>(null);

  const today = todayInZone();
  const plan = useMemo(() => {
    if (!eventDate) return null;
    const n = Number(guests);
    return buildTimeline({
      eventDate, today,
      guests: Number.isFinite(n) && n > 0 ? n : null,
      abroad, owners,
    });
  }, [eventDate, today, guests, abroad, owners]);

  const setOwner = (cat: TimelineCategory, v: string) =>
    setOwners((prev) => {
      const next = { ...prev };
      if (v === 'producer' || v === 'client') next[cat] = v; else delete next[cat];
      return next;
    });

  const go = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    const n = Number(guests);
    const r = await applyTimeline(clientId, {
      guests: Number.isFinite(n) && n > 0 ? n : null, abroad, owners,
    });
    setBusy(false);
    setResult(r);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl2 border border-line-strong bg-card px-4 py-2.5 text-[14px] font-medium text-ink transition hover:border-accent/40 hover:text-accent"
      >
        <CalendarRange size={16} aria-hidden strokeWidth={1.5} />
        {c.open}
      </button>
    );
  }

  const late = plan?.rows.filter((r) => r.atRisk) ?? [];
  const ownerWord = (o: Owner) => (o === 'client' ? c.ownerClient : c.ownerProducer);

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[18px] font-semibold text-ink">{c.title}</h2>
          <p className="mt-1 max-w-prose2 text-[14px] leading-relaxed text-ink-soft">{c.sub}</p>
        </div>
        <button type="button" className="btn-quiet text-[13.5px]" onClick={() => setOpen(false)}>{c.close}</button>
      </div>

      {!eventDate || !plan ? (
        <p className="mt-4 rounded-xl2 bg-surface-200 px-4 py-3 text-[13.5px] text-ink-soft">{c.noDate}</p>
      ) : (
        <>
          {/* The three inputs the plan bends to. */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-[12.5px] text-ink-mute">
              {c.guests}
              <input
                type="number" inputMode="numeric" min={0} value={guests}
                onChange={(e) => setGuests(e.target.value)}
                className="field mt-1 w-full"
              />
            </label>
            <label className="flex min-h-[44px] items-start gap-2.5 text-[14px] text-ink sm:mt-5">
              <input
                type="checkbox" checked={abroad} onChange={(e) => setAbroad(e.target.checked)}
                className="mt-1 size-5 shrink-0 rounded border-line-strong accent-accent"
              />
              <span>
                {c.abroad}
                <span className="block text-[12.5px] text-ink-mute">{c.abroadHint}</span>
              </span>
            </label>
          </div>

          <h3 className="mt-6 text-[13px] font-semibold text-accent">{c.ownersTitle}</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {TIMELINE_CATEGORIES.map((cat) => (
              <label key={cat} className="text-[12.5px] text-ink-mute">
                {c.categories[cat]}
                <select
                  value={owners[cat] ?? ''}
                  onChange={(e) => setOwner(cat, e.target.value)}
                  className="field mt-1 w-full"
                  aria-label={c.categories[cat]}
                >
                  <option value="">{c.ownerDefault}</option>
                  <option value="producer">{c.ownerProducer}</option>
                  <option value="client">{c.ownerClient}</option>
                </select>
              </label>
            ))}
          </div>

          {/* The runway, and what it means. */}
          <p className="mt-6 text-[13.5px] text-ink-soft">
            {plural(c.runway, plan.runway)} · {plural(c.stepsCount, plan.rows.length)}
          </p>
          {plan.warnings.map((w) => (
            <p key={w} role="alert" className="mt-2 flex items-start gap-2 rounded-xl2 border border-warn/30 bg-warn-wash px-4 py-2.5 text-[13.5px] text-warn">
              <AlertTriangle size={15} aria-hidden strokeWidth={1.5} className="mt-0.5 shrink-0" />
              {w === 'short' ? c.warnShort : c.warnAbroad}
            </p>
          ))}

          {/* Rows on a phone, a table from tablet up. */}
          <ul className="mt-4 space-y-2 sm:hidden">
            {plan.rows.map((r) => (
              <li key={r.id} className={`rounded-xl2 border px-3.5 py-2.5 ${r.atRisk ? 'border-warn/40 bg-warn-wash/40' : 'border-line'}`}>
                <p className="text-[14.5px] text-ink">
                  {r.title}
                  {r.atRisk && <span className="ms-2 rounded-xl2 bg-warn-wash px-2 py-0.5 text-[11.5px] font-semibold text-warn">{c.atRisk}</span>}
                </p>
                <p className="mt-0.5 text-[12.5px] text-ink-mute">
                  {dateFmt.format(new Date(`${r.dueOn}T12:00:00Z`))}
                  {' · '}{c.categories[r.category]}{' · '}{ownerWord(r.owner)}{' · '}{plural(c.remind, r.remindDays)}
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{r.note}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-[12.5px] text-ink-mute">
                  <th scope="col" className="py-2 text-start font-medium">{c.colTask}</th>
                  <th scope="col" className="py-2 text-start font-medium">{c.colDate}</th>
                  <th scope="col" className="py-2 text-start font-medium">{c.colCategory}</th>
                  <th scope="col" className="py-2 text-start font-medium">{c.colOwner}</th>
                  <th scope="col" className="py-2 text-start font-medium">{c.colRemind}</th>
                  <th scope="col" className="py-2 text-start font-medium">{c.colNote}</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((r) => (
                  <tr key={r.id} className={`border-b border-line last:border-0 ${r.atRisk ? 'bg-warn-wash/40' : ''}`}>
                    <td className={`py-2.5 pe-3 ${r.atRisk ? 'font-semibold text-warn' : 'text-ink'}`}>{r.title}</td>
                    <td className="whitespace-nowrap py-2.5 pe-3 tabular-nums text-ink-soft">{dateFmt.format(new Date(`${r.dueOn}T12:00:00Z`))}</td>
                    <td className="whitespace-nowrap py-2.5 pe-3 text-ink-soft">{c.categories[r.category]}</td>
                    <td className="whitespace-nowrap py-2.5 pe-3 text-ink-soft">{ownerWord(r.owner)}</td>
                    <td className="whitespace-nowrap py-2.5 pe-3 text-ink-soft">{plural(c.remind, r.remindDays)}</td>
                    <td className="py-2.5 text-[12.5px] leading-relaxed text-ink-mute">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {late.length > 0 && (
            <div className="mt-5 rounded-xl2 border border-warn/30 bg-warn-wash/50 px-4 py-3">
              <h3 className="text-[13.5px] font-semibold text-warn">{c.atRiskTitle}</h3>
              <p className="mt-0.5 text-[12.5px] text-ink-soft">{c.atRiskSub}</p>
              <ul className="mt-2 list-disc ps-5 text-[13.5px] text-ink">
                {late.map((r) => <li key={r.id}>{r.title}</li>)}
              </ul>
            </div>
          )}

          <h3 className="mt-6 text-[13px] font-semibold text-accent">{c.underestimated}</h3>
          <ol className="mt-2 list-decimal space-y-1 ps-5 text-[13.5px] leading-relaxed text-ink-soft">
            {c.tips.map((t) => <li key={t}>{t}</li>)}
          </ol>
          <p className="mt-3 text-[12.5px] text-ink-mute">{c.basis}</p>

          {result && !result.ok && (
            <p role="alert" className="mt-4 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
              {result.error ?? c.failed}
            </p>
          )}
          {result?.ok && (
            <p role="status" className="mt-4 inline-flex items-center gap-2 rounded-xl2 border border-ok/30 bg-ok-wash px-4 py-2.5 text-[14px] text-ok">
              <Check size={15} aria-hidden strokeWidth={1.5} />
              {(result.added ?? 0) === 0 ? c.added.none : fill(c.added.many, { n: result.added ?? 0 })}
              {(result.skipped ?? 0) > 0 && (result.added ?? 0) > 0 ? ` · ${plural(c.skipped, result.skipped ?? 0)}` : ''}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={go} disabled={busy || plan.rows.length === 0} className="btn-primary">
              {busy ? c.adding : plural(c.add, plan.rows.length)}
            </button>
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <h3 className="text-[13.5px] font-semibold text-ink">{c.calendarTitle}</h3>
            <p className="mt-1 max-w-prose2 text-[13.5px] leading-relaxed text-ink-soft">{c.calendarSub}</p>
          </div>
        </>
      )}
    </section>
  );
}
