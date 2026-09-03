'use client';

import { useMemo, useState } from 'react';
import { MAX_GUESTS } from '@/content/site';
import type { BudgetSimCopy } from '@/content/ui';
import { BookMeeting } from './BookMeeting';
import {
  computeBudget, TIER_PLATE, ils, ilsRounded,
  type Tier, type Day, type Season, type Style, type Bar, type Scale,
} from '@/lib/budget';
import { Money } from '@/components/Ltr';

/* The values, without their words. The maths branches on these, so a
   translation cannot rename an option out from under it; the label is looked
   up from the copy by the same key. */
const TIERS: Tier[] = ['garden', 'hall', 'boutique', 'field'];
const DAYS: Day[] = ['weekday', 'friday', 'saturday'];
const SEASONS: Season[] = ['spring', 'summer', 'winter'];
const STYLES: Style[] = ['classic', 'modern', 'rustic', 'lux'];
const BARS: Bar[] = ['venue', 'external', 'none'];
const RATES = [0.75, 0.85, 0.95];

function Chips<T extends string>({ items, words, value, onChange, label }: {
  items: readonly T[]; words: Record<T, string>;
  value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((v) => (
          <button
            key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
            className={`inline-flex min-h-[44px] items-center rounded-xl2 px-4 text-[14px] transition sm:min-h-0 sm:py-2 ${
              value === v ? 'bg-ink text-surface' : 'border border-line bg-card/70 text-ink-soft hover:bg-card'
            }`}
          >{words[v]}</button>
        ))}
      </div>
    </fieldset>
  );
}

export function BudgetSimulator({ copy: c, closing, bookLabel }: {
  copy: BudgetSimCopy;
  /* The sentence under the result and the words on the button below it belong
     to the editable site copy rather than to this block, so they arrive
     already resolved: reading the Hebrew constant in here was the one line on
     an English page still in Hebrew. */
  closing: string;
  bookLabel: string;
}) {
  /* The two numbers are held as the text that was typed, not as a clamped
     number. Clamping on every keystroke makes the field impossible to clear
     and fights whoever is halfway through typing a figure. */
  const [invitedText, setInvitedText] = useState('300');
  const [plateText, setPlateText] = useState(String(TIER_PLATE.garden));
  const [plateTouched, setPlateTouched] = useState(false);

  const [tier, setTierRaw] = useState<Tier>('garden');
  const [day, setDay] = useState<Day>('saturday');
  const [season, setSeason] = useState<Season>('spring');
  const [style, setStyle] = useState<Style>('classic');
  const [bar, setBar] = useState<Bar>('venue');
  const [attendance, setAttendance] = useState(0.85);

  /* Picking a venue type moves the plate price with it, until the couple sets
     their own number. After that their number is the one that counts. */
  const setTier = (v: Tier) => {
    setTierRaw(v);
    if (!plateTouched) setPlateText(String(TIER_PLATE[v]));
  };

  const r = useMemo(
    () => computeBudget({
      invited: Number(invitedText) || 0,
      attendance, tier,
      plate: Number(plateText) || 0,
      day, season, style, bar,
    }),
    [invitedText, plateText, attendance, tier, day, season, style, bar]
  );

  return (
    <div>
      <p className="mb-6 rounded-xl2 border border-warn/30 bg-warn-wash px-4 py-3 text-[14px] leading-relaxed text-warn">
        {c.note}
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
        <div className="card space-y-6">
          <div>
            <label className="label" htmlFor="bsim-invited">{c.invited}</label>
            <input
              id="bsim-invited" type="number" inputMode="numeric" min={0} max={MAX_GUESTS}
              value={invitedText} onChange={(e) => setInvitedText(e.target.value)}
              className="field"
            />
          </div>

          <fieldset>
            <legend className="label">{c.attending}</legend>
            <div className="flex flex-wrap gap-2">
              {RATES.map((v) => (
                <button
                  key={v} type="button" onClick={() => setAttendance(v)} aria-pressed={attendance === v}
                  className={`inline-flex min-h-[44px] items-center rounded-xl2 px-4 text-[14px] transition sm:min-h-0 sm:py-2 ${
                    attendance === v ? 'bg-ink text-surface' : 'border border-line bg-card/70 text-ink-soft hover:bg-card'
                  }`}
                >{Math.round(v * 100)}%</button>
              ))}
            </div>
            <p className="mt-1.5 text-[12.5px] text-ink-mute">
              {c.attendingHint}
            </p>
          </fieldset>

          <Chips items={TIERS} words={c.tier} value={tier} onChange={setTier} label={c.tierLabel} />

          <div>
            <label className="label" htmlFor="bsim-plate">{c.plate}</label>
            <input
              id="bsim-plate" type="number" inputMode="numeric" min={0} max={2000}
              value={plateText}
              onChange={(e) => { setPlateText(e.target.value); setPlateTouched(true); }}
              className="field"
            />
            <p className="mt-1.5 text-[12.5px] text-ink-mute">
              {c.plateHint}
            </p>
          </div>

          <Chips items={DAYS} words={c.day} value={day} onChange={setDay} label={c.dayLabel} />
          <Chips items={SEASONS} words={c.season} value={season} onChange={setSeason} label={c.seasonLabel} />
          <Chips items={STYLES} words={c.style} value={style} onChange={setStyle} label={c.styleLabel} />
          <Chips items={BARS} words={c.bar} value={bar} onChange={setBar} label={c.barLabel} />
        </div>

        <div className="card flex flex-col">
          <p className="text-[13px] text-ink-mute">{c.rangeLabel}</p>
          {/* "עד" rather than a dash. A range written with a dash reads
              ambiguously in a right-to-left line, where the eye cannot tell
              which end it started from; the word cannot be read backwards. */}
          <p className="font-display text-display font-semibold text-ink">
            <span className="tabular-nums">{ilsRounded(r.low)}</span>
            <span className="mx-2 text-[0.6em] font-normal text-ink-mute">{c.to}</span>
            <span className="tabular-nums">{ilsRounded(r.high)}</span>
          </p>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-ink-mute">
            <span>{c.attendingCount}: <b className="text-ink">{r.attending}</b></span>
            <span>{c.tables}: <b className="text-ink">{r.tables}</b></span>
            <span>{c.perGuest}: <b className="tabular-nums text-ink"><Money value={r.perGuest} /></b></span>
          </div>

          <ul className="mt-6 space-y-3" aria-label={c.breakdown}>
            {r.lines.map((l) => {
              const pct = r.total ? (l.amount / r.total) * 100 : 0;
              return (
                <li key={l.key}>
                  <div className="flex items-baseline justify-between gap-3 text-[14.5px]">
                    <span className="text-ink-soft">
                      {c.line[l.key as keyof typeof c.line]} <span className="text-[11.5px] text-ink-mute">{c.scale[l.scale]}</span>
                    </span>
                    <span className="tabular-nums text-ink"><Money value={l.amount} /></span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-200">
                    <div className="h-full rounded-xl2 bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-6 rounded-xl2 bg-accent-wash px-4 py-3 text-[14px] text-ink-soft">
            {c.marginal}: <b className="tabular-nums text-ink"><Money value={r.marginalTen} /></b>
          </p>

          <div className="mt-6 border-t border-line pt-6">
            <p className="text-[15px] text-ink-soft">{closing}</p>
            <BookMeeting className="btn-primary mt-4 inline-flex items-center gap-2" label={bookLabel} />
          </div>
        </div>
      </div>
    </div>
  );
}
