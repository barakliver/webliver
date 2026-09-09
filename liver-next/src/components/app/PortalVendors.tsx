import { Phone } from 'lucide-react';
import type { Vendor } from '@/lib/portal';
import type { PortalCopy } from '@/content/appUi';
import type { Locale } from '@/lib/locale';
import { categoryLabelFor } from '@/content/production';
import { Ltr } from '@/components/Ltr';

/**
 * The suppliers, as the couple sees them.
 *
 * Read only, on purpose. Hiring happens by ticking the checklist above, which
 * asks who and for how much and writes the row; and the status is the
 * producer's call. What the couple needs here is the answer to "who did we
 * close with, and what is their number", grouped the way the producer groups
 * them so the two screens agree.
 */
export function PortalVendors({ vendors, c, locale }: { vendors: Vendor[]; c: PortalCopy; locale: Locale }) {
  const groups = new Map<string, Vendor[]>();
  for (const v of vendors) {
    const key = v.category || 'other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(v);
  }
  const ordered = [...groups.entries()].sort((a, b) =>
    categoryLabelFor(a[0], locale).localeCompare(categoryLabelFor(b[0], locale), locale));

  const status = (s: string) =>
    s === 'booked' ? c.vendorBooked : s === 'cancelled' ? c.vendorCancelled : c.vendorShortlist;
  const tone = (s: string) =>
    s === 'booked' ? 'bg-ok-wash text-ok' : s === 'cancelled' ? 'bg-surface-200 text-ink-mute line-through' : 'bg-warn-wash text-warn';

  return (
    <section className="card">
      <h2 className="font-display text-[22px] font-semibold text-ink">{c.vendorsTitle}</h2>
      <p className="mt-1 text-[13.5px] text-ink-mute">{c.vendorsSub}</p>

      {vendors.length === 0 ? (
        <p className="mt-5 text-[14.5px] text-ink-mute">{c.vendorsEmpty}</p>
      ) : (
        <div className="mt-5 space-y-5">
          {ordered.map(([category, list]) => (
            <div key={category}>
              <h3 className="mb-2 text-[12.5px] font-semibold text-accent">{categoryLabelFor(category, locale)}</h3>
              <ul className="divide-y divide-line border-t border-line">
                {list.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[15px] text-ink">{v.name}</p>
                      {v.phone && (
                        <a href={`tel:${v.phone}`} className="mt-0.5 inline-flex items-center gap-1 text-[13px] text-ink-soft hover:text-ink">
                          <Phone size={12} aria-hidden strokeWidth={1.5} />
                          <Ltr>{v.phone}</Ltr>
                        </a>
                      )}
                    </div>
                    <span className={`rounded-xl2 px-2 py-0.5 text-[11.5px] ${tone(v.status)}`}>{status(v.status)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
