import { TriangleAlert } from 'lucide-react';
import { Money } from '@/components/Ltr';
import { ledgerOf, type PaidLine, type CostLine, type CrewLine } from '@/lib/finance';
import type { MoneyCopy } from '@/content/appUi';

/**
 * What is left of the event, which nothing in this product could previously say.
 *
 * The couple's summary answers whether the wedding is inside the number they
 * started with. It is a complete answer to that question and it is the wrong
 * question for the person running the business: a producer stands between two
 * relationships, money arriving from a couple and money leaving to suppliers
 * and crew, and those two halves met on no screen anywhere. The crew's fees in
 * particular were a column that nothing had ever summed.
 *
 * Producer-only, and the reason is not squeamishness about profit. What a
 * producer keeps for putting an evening together is a fact about their
 * business rather than a line on their client's bill, and a couple reading it
 * on the same screen as their own payments would reasonably read it as a
 * charge they had not agreed.
 *
 * A loss is shown as a loss. This is the one number that is worth having
 * precisely on the events where it is unwelcome, and a figure that flatters
 * an event running under water until the week of the wedding is worse than
 * no figure at all.
 */
export function ProducerLedger({ c, payments, items, crew }: {
  c: MoneyCopy['ledger'];
  payments: readonly PaidLine[];
  items: readonly CostLine[];
  crew: readonly CrewLine[];
}) {
  const l = ledgerOf(payments, items, crew);

  const nothingYet = l.billed === 0 && l.costs === 0;

  return (
    <section className="card" aria-labelledby="ledger-title">
      <h2 id="ledger-title" className="font-display text-[18px] font-semibold text-ink">{c.title}</h2>
      <p className="mt-1 text-[13.5px] text-ink-soft">{c.sub}</p>

      {nothingYet ? (
        <p className="mt-5 text-[14.5px] text-ink-mute">{c.none}</p>
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[14px] sm:grid-cols-3">
            <Figure label={c.billed} value={l.billed} />
            <Figure label={c.received} value={l.received} />
            <Figure label={c.outstanding} value={l.outstanding} />
            <Figure label={c.suppliers} value={l.suppliers} />
            <Figure label={c.crew} value={l.crew} />
            <Figure label={c.costs} value={l.costs} />
          </dl>

          <div className="mt-5 border-t border-line pt-4">
            {/* Costs before any billing is the ordinary shape of an event
                three months out, not a business in trouble. Reporting it as a
                loss would be arithmetically defensible and would teach a
                producer to stop reading this panel. */}
            {l.costsWithoutBilling ? (
              <p className="text-[14px] leading-relaxed text-ink-soft">{c.early}</p>
            ) : (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[14px] text-ink-mute">{c.margin}</span>
                <span className="flex items-baseline gap-2">
                  <b className={l.margin < 0 ? 'text-[20px] text-bad' : 'text-[20px] text-ink'}>
                    <Money value={l.margin} />
                  </b>
                  {l.marginPct !== null && (
                    <span className="text-[13px] text-ink-soft">
                      {c.marginPct.replace('{n}', String(l.marginPct))}
                    </span>
                  )}
                </span>
              </div>
            )}

            {l.margin < 0 && !l.costsWithoutBilling && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-xl2 border border-bad/25 bg-bad-wash px-3 py-2 text-[13.5px] text-bad">
                <TriangleAlert size={16} strokeWidth={1.5} aria-hidden />
                {c.loss}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-ink-mute">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink"><Money value={value} /></dd>
    </div>
  );
}
