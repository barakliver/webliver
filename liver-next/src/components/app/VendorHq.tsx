'use client';

import { useState } from 'react';
import { Check, Copy, MessageCircle, TriangleAlert } from 'lucide-react';
import { count as plural, fill } from '@/lib/copyText';
import { useCopy } from '@/components/app/CopyProvider';
import { Money, ils } from '@/components/Ltr';
import { shortDate } from '@/lib/appDates';
import { todayInZone } from '@/lib/clock';
import { categoryLabelFor } from '@/content/production';
import { updateVendorHq } from '@/app/actions/vendorHq';
import {
  hqRows, atRisk, summary, suggestedMessage,
  type HqVendor, type HqContract, type HqLine, type HqRow, type Tone,
} from '@/lib/vendorHq';

const ROW: Record<Tone, string> = {
  green: '',
  yellow: 'bg-warn-wash/40',
  red: 'bg-bad-wash/50',
};
const DOT: Record<Tone, string> = { green: 'bg-ok', yellow: 'bg-warn', red: 'bg-bad' };

/**
 * Every supplier on the event, with an honest status.
 *
 * The producer's tab and the couple's screen draw the same rows from the
 * same module; the producer's has the controls. Two of them are one press,
 * because they are the two facts that go stale fastest: "we spoke today"
 * and "whose turn it is". The rest sit behind a details button per row.
 */
export function VendorHq({ clientId, vendors, contracts, lines, couple, date, signAs, viewer }: {
  clientId: string;
  vendors: HqVendor[];
  contracts: HqContract[];
  lines: HqLine[];
  couple: string;
  date: string | null;
  signAs: string;
  viewer: 'producer' | 'client';
}) {
  const ui = useCopy();
  const c = ui.vendor.hq;
  const locale = ui.locale;
  const dateFmt = shortDate(locale);
  const today = todayInZone();
  const rows = hqRows(vendors, contracts, lines, today);
  const risky = atRisk(rows);
  const sum = summary(rows, today);
  const [editing, setEditing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fmt = (iso: string | null) => (iso ? dateFmt.format(new Date(`${iso}T12:00:00Z`)) : '');
  const actionWord = (r: HqRow) => (r.action === 'own' ? r.ownAction : c.actions[r.action]);
  const lastSpoke = (r: HqRow) =>
    r.silentDays === null ? c.never : r.silentDays === 0 ? c.today : plural(c.daysAgo, r.silentDays);
  const msgOpts = { couple, date: fmt(date), signAs };

  const copyText = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* on screen anyway */ }
  };
  const wa = (phone: string, text: string) =>
    `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '972')}?text=${encodeURIComponent(text)}`;

  if (rows.length === 0) {
    return (
      <section className="card">
        <h2 className="font-display text-[18px] font-semibold text-ink">{c.title}</h2>
        <p className="mt-3 text-[14.5px] text-ink-mute">{c.none}</p>
      </section>
    );
  }

  const week = rows.filter((r) => r.tone !== 'green');

  return (
    <section className="card">
      <h2 className="font-display text-[18px] font-semibold text-ink">{c.title}</h2>
      <p className="mt-1 max-w-prose2 text-[14px] leading-relaxed text-ink-soft">{viewer === 'client' ? c.subCouple : c.sub}</p>

      {/* The four lines first: they are what the Monday letter says, and
          what somebody opening this on a phone wants before the table. */}
      <ol className="mt-4 space-y-1 rounded-xl2 bg-surface-100 px-4 py-3 text-[14px] leading-relaxed text-ink">
        <li>{fill(c.locked, { n: sum.locked, total: sum.total })}</li>
        <li>{fill(c.depositsPaid, { n: sum.depositsPaid })}</li>
        <li>{fill(c.dueSoon, { amount: ils(sum.dueSoon) })}</li>
        <li className={sum.first ? 'font-medium' : ''}>
          {sum.first ? fill(c.biggest, { what: `${sum.first.vendor.name}: ${actionWord(sum.first)}` }) : c.biggestNone}
        </li>
      </ol>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-[12.5px] text-ink-mute">
              <th scope="col" className="py-2 text-start font-medium">{c.colVendor}</th>
              <th scope="col" className="py-2 text-start font-medium">{c.colContract}</th>
              <th scope="col" className="py-2 text-start font-medium">{c.colDeposit}</th>
              <th scope="col" className="py-2 text-start font-medium">{c.colBalance}</th>
              <th scope="col" className="py-2 text-start font-medium">{c.colLast}</th>
              <th scope="col" className="py-2 text-start font-medium">{c.colTurn}</th>
              <th scope="col" className="py-2 text-start font-medium">{c.colAction}</th>
              {viewer === 'producer' && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.vendor.id} className={`border-b border-line align-top last:border-0 ${ROW[r.tone]}`}>
                <td className="py-2.5 pe-3">
                  <span className="inline-flex items-center gap-2 font-medium text-ink">
                    <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${DOT[r.tone]}`} />
                    {r.vendor.name}
                  </span>
                  <span className="block text-[12px] text-ink-mute">{categoryLabelFor(r.vendor.category, locale)}</span>
                  {r.flags.length > 0 && (
                    <span className="mt-1 block text-[12px] text-bad">{r.flags.map((f) => c.flags[f]).join(' · ')}</span>
                  )}
                </td>
                <td className="whitespace-nowrap py-2.5 pe-3 text-ink-soft">{c.contract[r.contract]}</td>
                <td className="whitespace-nowrap py-2.5 pe-3 text-ink-soft">
                  {c.deposit[r.depositState]}
                  {r.deposit !== null && <span className="block tabular-nums text-ink"><Money value={r.deposit} /></span>}
                </td>
                <td className="whitespace-nowrap py-2.5 pe-3 text-ink-soft">
                  {r.balance === null ? c.noPrice : <span className="tabular-nums text-ink"><Money value={r.balance} /></span>}
                  {r.balanceDue && <span className="block text-[12px]">{fill(c.dueOn, { date: fmt(r.balanceDue) })}</span>}
                </td>
                <td className="whitespace-nowrap py-2.5 pe-3 text-ink-soft">{lastSpoke(r)}</td>
                <td className="whitespace-nowrap py-2.5 pe-3 text-ink-soft">{r.waitingOn ? c.turn[r.waitingOn] : c.turn.none}</td>
                <td className={`py-2.5 pe-3 ${r.tone === 'red' ? 'font-semibold text-bad' : r.tone === 'yellow' ? 'font-medium text-warn' : 'text-ink-soft'}`}>
                  {actionWord(r) || c.actions.wait}
                </td>
                {viewer === 'producer' && (
                  <td className="py-2 text-end">
                    <div className="flex flex-wrap justify-end gap-1">
                      <form action={updateVendorHq}>
                        <input type="hidden" name="id" value={r.vendor.id} />
                        <input type="hidden" name="client_id" value={clientId} />
                        <input type="hidden" name="spoke" value="today" />
                        <button type="submit" className="btn-quiet whitespace-nowrap px-2 py-1 text-[12.5px]">{c.spoke}</button>
                      </form>
                      <form action={updateVendorHq} className="inline-flex items-center gap-1">
                        <input type="hidden" name="id" value={r.vendor.id} />
                        <input type="hidden" name="client_id" value={clientId} />
                        <select
                          name="waiting_on" defaultValue={r.waitingOn ?? ''} aria-label={c.setTurn}
                          onChange={(e) => e.currentTarget.form?.requestSubmit()}
                          className="field min-h-[32px] px-2 py-1 text-[12.5px]"
                        >
                          <option value="">{c.turn.none}</option>
                          <option value="me">{c.turn.me}</option>
                          <option value="them">{c.turn.them}</option>
                        </select>
                      </form>
                      <button type="button" onClick={() => setEditing(editing === r.vendor.id ? null : r.vendor.id)} className="btn-quiet px-2 py-1 text-[12.5px]">
                        {editing === r.vendor.id ? c.close : c.edit}
                      </button>
                    </div>
                    {editing === r.vendor.id && (
                      <form action={updateVendorHq} className="mt-2 grid gap-2 text-start" onSubmit={() => setEditing(null)}>
                        <input type="hidden" name="id" value={r.vendor.id} />
                        <input type="hidden" name="client_id" value={clientId} />
                        <label className="text-[12px] text-ink-mute">{c.depositAmount}
                          <input name="deposit" type="number" min={0} inputMode="numeric" defaultValue={r.vendor.deposit ?? ''} className="field mt-0.5 w-full" />
                        </label>
                        <label className="text-[12px] text-ink-mute">{c.depositPaidOn}
                          <input name="deposit_paid_on" type="date" defaultValue={r.vendor.deposit_paid_on ?? ''} className="field mt-0.5 w-full" />
                        </label>
                        <label className="text-[12px] text-ink-mute">{c.balanceDueOn}
                          <input name="balance_due_on" type="date" defaultValue={r.vendor.balance_due_on ?? ''} className="field mt-0.5 w-full" />
                        </label>
                        <label className="text-[12px] text-ink-mute">{c.nextAction}
                          <input name="next_action" maxLength={200} defaultValue={r.vendor.next_action} placeholder={c.nextActionPh} className="field mt-0.5 w-full" />
                        </label>
                        <button type="submit" className="btn-primary text-[13px]">{c.save}</button>
                      </form>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* This week: every red and amber row, what to do, and the message. */}
      <h3 className="mt-6 text-[14px] font-semibold text-ink">{c.weekTitle}</h3>
      <p className="mt-1 text-[12.5px] text-ink-mute">{c.weekSub}</p>
      {week.length === 0 ? (
        <p className="mt-2 text-[14px] text-ok">{c.weekNone}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {week.map((r) => {
            const text = suggestedMessage(r, msgOpts);
            return (
              <li key={r.vendor.id} className={`rounded-xl2 border px-4 py-3 ${r.tone === 'red' ? 'border-bad/30' : 'border-warn/30'}`}>
                <p className="flex items-center gap-2 text-[14px] font-medium text-ink">
                  <span aria-hidden className={`size-2.5 rounded-full ${DOT[r.tone]}`} />
                  {r.vendor.name}: {actionWord(r)}
                </p>
                {text && viewer === 'producer' && (
                  <>
                    <p className="mt-2 whitespace-pre-line rounded-xl2 bg-surface-100 px-3 py-2 text-[13.5px] leading-relaxed text-ink-soft">{text}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => copyText(r.vendor.id, text)} className="btn-ghost text-[13px]">
                        {copied === r.vendor.id ? <Check size={13} aria-hidden strokeWidth={1.5} /> : <Copy size={13} aria-hidden strokeWidth={1.5} />}
                        {copied === r.vendor.id ? c.copied : c.copy}
                      </button>
                      {r.vendor.phone && (
                        <a href={wa(r.vendor.phone, text)} target="_blank" rel="noreferrer" className="btn-ghost text-[13px]">
                          <MessageCircle size={13} aria-hidden strokeWidth={1.5} />{c.whatsapp}
                        </a>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* The three to watch. */}
      <h3 className="mt-6 inline-flex items-center gap-2 text-[14px] font-semibold text-ink">
        <TriangleAlert size={15} aria-hidden strokeWidth={1.5} className="text-warn" />{c.riskTitle}
      </h3>
      <p className="mt-1 text-[12.5px] text-ink-mute">{c.riskSub}</p>
      {risky.length === 0 ? (
        <p className="mt-2 text-[14px] text-ok">{c.riskNone}</p>
      ) : (
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-[14px] text-ink">
          {risky.map((r) => (
            <li key={r.vendor.id}>
              <b>{r.vendor.name}</b>{' '}
              <span className="text-ink-soft">
                {r.flags.includes('silent') && r.silentDays !== null ? fill(c.riskWhy.silent, { n: r.silentDays })
                  : r.contract !== 'signed' && r.vendor.status === 'booked' ? c.riskWhy.noContract
                    : r.balance ? fill(c.riskWhy.balance, { amount: ils(r.balance) })
                      : c.riskWhy.fine}
              </span>
            </li>
          ))}
        </ol>
      )}

      {viewer === 'producer' && <p className="mt-4 text-[12.5px] text-ink-mute">{c.mondayNote}</p>}
    </section>
  );
}
