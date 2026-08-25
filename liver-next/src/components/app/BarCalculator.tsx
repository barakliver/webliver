'use client';

import { useMemo, useState } from 'react';
import { Martini, Printer } from 'lucide-react';
import { planBar, shoppingList, DEFAULT_PRICES, type BarStyle, type Season, type Prices } from '@/lib/bar';
import { barCopy as c } from '@/content/site';
import { Money } from '@/components/Ltr';


const STYLES: BarStyle[] = ['barak', 'classic', 'spirits', 'wine', 'beer', 'light'];
const SEASONS: Season[] = ['summer', 'mild', 'winter'];

function Choice<T extends string>({ label, hint, value, options, labels, onChange }: {
  label: string; hint?: string; value: T; options: readonly T[];
  labels: Record<string, string>; onChange: (v: T) => void;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={o === value}
            onClick={() => onChange(o)}
            className={`inline-flex min-h-[44px] items-center rounded-none border px-4 text-[14px] transition sm:min-h-[38px] ${
              o === value
                ? 'border-ink bg-ink font-medium text-surface'
                : 'border-line-strong text-ink-soft hover:border-accent/40 hover:text-accent'
            }`}
          >
            {labels[o] ?? o}
          </button>
        ))}
      </div>
      {hint && <p className="mt-1.5 text-[12.5px] text-ink-mute">{hint}</p>}
    </div>
  );
}

function Number_({ label, hint, value, onChange, min, max, step = 1, suffix }: {
  label: string; hint?: string; value: number; onChange: (n: number) => void;
  min: number; max: number; step?: number; suffix?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="h-11 flex-1 accent-accent"
        />
        <span className="w-[74px] shrink-0 text-left font-display text-[17px] font-light tabular-nums text-ink">
          {value}{suffix ? ` ${suffix}` : ''}
        </span>
      </div>
      {hint && <p className="mt-1 text-[12.5px] text-ink-mute">{hint}</p>}
    </div>
  );
}

/**
 * How many bottles, and how much ice.
 *
 * Everything recomputes as it is typed, because the value of this screen is
 * watching the number move: a producer learns more from dragging "how many
 * drink" from sixty to eighty than from any single answer it gives.
 *
 * The prices belong to whoever is buying and are therefore editable. A table
 * of prices baked into the code would be wrong for a producer with a supplier
 * and wrong for somebody walking into a shop, and wrong for both within a
 * year. The defaults are a starting point that says so.
 *
 * Nothing is saved. It is a calculator, not a record: the inputs come from the
 * event, the answer is read or printed, and there is no half-finished state to
 * come back to.
 */
export function BarCalculator({ guestEstimate, confirmedGuests }: {
  guestEstimate: number | null; confirmedGuests: number;
}) {
  /* Confirmed seats beat an estimate the moment there are any, because by then
     the estimate is a memory of what somebody guessed in January. */
  const [guests, setGuests] = useState(confirmedGuests || guestEstimate || 150);
  const [childrenPct, setChildrenPct] = useState(10);
  const [drinkersPct, setDrinkersPct] = useState(70);
  const [hours, setHours] = useState(5);
  const [style, setStyle] = useState<BarStyle>('barak');
  const [season, setSeason] = useState<Season>('summer');
  const [prices, setPrices] = useState<Prices>(DEFAULT_PRICES);
  const [showPrices, setShowPrices] = useState(false);

  const plan = useMemo(
    () => planBar({ guests, childrenPct, drinkersPct }, { hours, style, season }),
    [guests, childrenPct, drinkersPct, hours, style, season]
  );
  const { lines, total } = useMemo(() => shoppingList(plan, prices), [plan, prices]);

  /* Beer is bought two ways and calculated one way. His sheet answers in 330ml
     singles and that stays the answer; a supplier quote and a shop shelf are
     both priced by the six-pack, so the list can be read either way without
     anybody dividing by six at the till. The litres never move. */
  const [beerPacks, setBeerPacks] = useState(false);

  return (
    <section className="card">
      <style>{`
        @media print {
          body > * { display: none !important; }
          body > .bar-print { display: block !important; }
          .no-print { display: none !important; }
          .bar-print { padding: 0; color: #000; background: #fff; }
          @page { margin: 16mm 14mm; }
        }
      `}</style>

      <div className="no-print">
        <h2 className="inline-flex items-center gap-2 font-display text-[18px] font-light text-ink">
          <Martini size={18} aria-hidden strokeWidth={1.5} />
          {c.title}
        </h2>
        <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>

        <div className="mt-6 space-y-5">
          <Number_ label={c.guests} value={guests} onChange={setGuests} min={10} max={1500} step={10} />
          <Number_ label={c.children} hint={c.childrenHint} value={childrenPct} onChange={setChildrenPct} min={0} max={50} suffix="%" />
          <Number_ label={c.drinkers} hint={c.drinkersHint} value={drinkersPct} onChange={setDrinkersPct} min={0} max={100} suffix="%" />
          {/* Hidden under his own rule rather than shown and ignored. A control
              that visibly does nothing is worse than one that is not there. */}
          {style !== 'barak' && (
            <Number_ label={c.hours} hint={c.hoursHint} value={hours} onChange={setHours} min={1} max={12} />
          )}
          <Choice label={c.style} value={style} options={STYLES} labels={c.styles} onChange={setStyle} />
          <Choice label={c.season} value={season} options={SEASONS} labels={c.seasons} onChange={setSeason} />
        </div>
      </div>

      <div className="bar-print mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
          <h3 className="font-display text-[18px] font-light text-ink">{c.planTitle}</h3>
          <p className="text-[13px] tabular-nums text-ink-mute">
            {plan.litres} {c.litresOut}
            {style !== 'barak' && ` · ${plan.servings} ${c.servingsOut}`}
            {` · ${plan.drinkers} ${c.drinkersOut}`}
          </p>
        </div>

        {style === 'barak' && (
          <p className="mt-3 text-[13px] leading-relaxed text-ink-mute">{c.barakNote}</p>
        )}

        <ul className="mt-4 space-y-2">
          {lines.map((l) => (
            <li key={l.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line py-2.5 last:border-0">
              <span className="min-w-0 flex-1 text-[15px] text-ink">{c.items[l.key]}</span>
              <span className="font-display text-[16px] font-light tabular-nums text-ink">
                {l.key === 'beer' && beerPacks ? plan.beerSixPacks : l.qty}{' '}
                <span className="text-[13px] font-normal text-ink-mute">
                  {l.key === 'beer' && beerPacks ? c.beerAsPacks : c.units[l.key]}
                </span>
              </span>
              {l.total > 0 && (
                <span className="w-[86px] shrink-0 text-left text-[14px] tabular-nums text-ink-soft"><Money value={l.total} /></span>
              )}
            </li>
          ))}
        </ul>

        {total > 0 && (
          <p className="mt-4 text-left text-[15px] text-ink-soft">
            {c.grandTotal} <b className="font-display text-[19px] tabular-nums text-ink"><Money value={total} /></b>
          </p>
        )}
      </div>

      {/* Only offered when there is beer to count. A switch that changes
          nothing is a switch somebody presses twice looking for the effect. */}
      {plan.bottles.beer > 0 && (
        <div className="no-print mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
          <span className="text-[13px] text-ink-mute">{c.beerUnit}</span>
          <div role="group" className="flex">
            {([false, true] as const).map((packs) => (
              <button
                key={String(packs)}
                type="button"
                onClick={() => setBeerPacks(packs)}
                aria-pressed={beerPacks === packs}
                className={[
                  'min-h-[44px] border-b px-3 text-[13.5px] tracking-[.04em] transition-colors duration-300',
                  beerPacks === packs
                    ? 'border-accent-line text-ink'
                    : 'border-transparent text-ink-mute hover:text-ink',
                ].join(' ')}
              >
                {packs ? c.beerAsPacks : c.beerAsBottles}
              </button>
            ))}
          </div>
          {beerPacks && <span className="text-[12.5px] text-ink-mute">{c.beerPackNote}</span>}
        </div>
      )}

      <div className="no-print mt-6 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-quiet text-[13.5px]" onClick={() => setShowPrices((v) => !v)}>
          {c.prices}
        </button>
        <button type="button" className="btn-ghost text-[14px]" onClick={() => window.print()}>
          <Printer size={16} aria-hidden strokeWidth={1.5} />
          {c.print}
        </button>
      </div>

      {showPrices && (
        <div className="no-print mt-4 rounded-none border border-line bg-surface-100 p-4">
          <p className="text-[13px] text-ink-mute">{c.pricesHint}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(prices) as (keyof Prices)[]).map((k) => (
              <div key={k}>
                <label className="label" htmlFor={`price-${k}`}>{c.items[k]}</label>
                <input
                  id={`price-${k}`}
                  type="number" min={0} step="0.5" inputMode="decimal"
                  value={prices[k]}
                  onChange={(e) => setPrices({ ...prices, [k]: Number(e.target.value) })}
                  className="field"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <details className="no-print mt-5">
        <summary className="cursor-pointer text-[13px] text-ink-mute hover:text-ink">{c.assumptions}</summary>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-ink-soft">
          {c.assumptionLines.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </details>
    </section>
  );
}
