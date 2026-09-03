'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { referralCopy as c } from '@/content/site';
import { Ltr } from '@/components/Ltr';

export type ReferralRow = {
  producer_id: string;
  brand: string;
  referral_code: string | null;
  referred_by: string | null;
  referred_brand: string | null;
  invited_total: number;
  clients_total: number;
};

/**
 * Who brought whom, and how many events each is carrying.
 *
 * Every column here is a count or a brand name. That is the same boundary 0030
 * drew and this extends it by exactly one fact — which producer arrived through
 * whose link — because a referral is a governance question and not a private
 * one. No couple, no event name and no money crosses this table, and the panel
 * says so on the screen rather than only in a migration.
 */
export function Referrals({ rows, siteUrl, mine }: {
  rows: ReferralRow[]; siteUrl: string; mine: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const link = mine ? `${siteUrl.replace(/\/+$/, '')}/login?ref=${mine}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* A clipboard the browser refuses is not an error worth a red box: the
         link is on screen and can be selected by hand. */
    }
  };

  const sorted = [...rows].sort((a, b) => b.invited_total - a.invited_total);

  return (
    <section className="card">
      <h2 className="font-display text-[17px] font-semibold text-ink">{c.title}</h2>
      <p className="mt-1 text-[13.5px] text-ink-soft">{c.sub}</p>

      {link && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-card-sm bg-surface-100 p-3">
          <span className="text-[12.5px] text-ink-mute">{c.myLink}</span>
          <code className="min-w-0 flex-1 truncate text-[13px] text-ink" dir="ltr">{link}</code>
          <button type="button" onClick={() => void copy()} className="btn-quiet inline-flex items-center gap-1.5 px-3 text-[13.5px]">
            {copied
              ? <><Check size={14} aria-hidden strokeWidth={1.5} />{c.copied}</>
              : <><Copy size={14} aria-hidden strokeWidth={1.5} />{c.copy}</>}
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="mt-5 text-[14.5px] text-ink-mute">{c.none}</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[14px]">
            <thead>
              <tr className="border-b border-line text-start text-[12.5px] text-ink-mute">
                <th className="py-2 text-start font-normal">{c.producer}</th>
                <th className="py-2 text-start font-normal">{c.code}</th>
                <th className="py-2 text-start font-normal">{c.invitedBy}</th>
                <th className="py-2 text-end font-normal">{c.invited}</th>
                <th className="py-2 text-end font-normal">{c.clients}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.producer_id} className="border-b border-line last:border-0">
                  <td className="py-2.5 text-ink">{r.brand}</td>
                  <td className="py-2.5 text-ink-mute">
                    {r.referral_code ? <Ltr>{r.referral_code}</Ltr> : '·'}
                  </td>
                  <td className="py-2.5 text-ink-soft">{r.referred_brand ?? c.direct}</td>
                  <td className="py-2.5 text-end tabular-nums text-ink">
                    <Ltr>{r.invited_total}</Ltr>
                  </td>
                  <td className="py-2.5 text-end tabular-nums text-ink">
                    <Ltr>{r.clients_total}</Ltr>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
