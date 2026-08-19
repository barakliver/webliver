'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { site, MAX_GUESTS } from '@/content/site';

const SEASONS = [
  { v: 'spring', label: 'אביב או סתיו', k: 1.0 },
  { v: 'summer', label: 'קיץ',           k: 1.14 },
  { v: 'winter', label: 'חורף',          k: 0.9 },
] as const;

const DAYS = [
  { v: 'weekday', label: 'אמצע שבוע', k: 0.92 },
  { v: 'friday',  label: 'שישי',       k: 1.06 },
  { v: 'saturday',label: 'שבת',        k: 1.12 },
] as const;

const STYLES = [
  { v: 'classic', label: 'קלאסי',     k: 1.0 },
  { v: 'modern',  label: 'מודרני',    k: 1.08 },
  { v: 'rustic',  label: 'כפרי',      k: 0.95 },
  { v: 'lux',     label: 'יוקרתי',    k: 1.32 },
] as const;

/** Per guest base in shekels, split across the lines a producer actually
 *  negotiates. Deliberately a range anchor, not a quote. */
const LINES: { key: string; label: string; perGuest: number }[] = [
  { key: 'venue',    label: 'מקום וקייטרינג', perGuest: 330 },
  { key: 'photo',    label: 'צילום ווידאו',    perGuest: 92 },
  { key: 'music',    label: 'מוזיקה והגברה',   perGuest: 58 },
  { key: 'design',   label: 'עיצוב ופרחים',    perGuest: 74 },
  { key: 'bar',      label: 'בר ואלכוהול',     perGuest: 46 },
  { key: 'extras',   label: 'הפקה ונלוות',     perGuest: 60 },
];

const ils = (n: number) => '₪' + Math.round(n).toLocaleString('he-IL');

export function BudgetSimulator() {
  const [season, setSeason] = useState<string>('spring');
  const [day, setDay] = useState<string>('saturday');
  const [style, setStyle] = useState<string>('classic');
  const [guests, setGuests] = useState<number>(250);

  const result = useMemo(() => {
    const g = Math.max(0, Math.min(MAX_GUESTS, guests || 0));
    const k =
      (SEASONS.find(s => s.v === season)?.k ?? 1) *
      (DAYS.find(d => d.v === day)?.k ?? 1) *
      (STYLES.find(s => s.v === style)?.k ?? 1);
    const rows = LINES.map(l => ({ ...l, amount: l.perGuest * g * k }));
    const total = rows.reduce((a, r) => a + r.amount, 0);
    return { rows, total, perGuest: g ? total / g : 0, g };
  }, [season, day, style, guests]);

  const Chips = ({ items, value, onChange, label }: {
    items: readonly { v: string; label: string }[]; value: string;
    onChange: (v: string) => void; label: string;
  }) => (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map(i => (
          <button
            key={i.v} type="button" onClick={() => onChange(i.v)}
            aria-pressed={value === i.v}
            className={`rounded-full px-4 py-2 text-[14px] transition ${
              value === i.v ? 'bg-ink text-white shadow-soft' : 'border border-line bg-white/70 text-ink-soft hover:bg-white'
            }`}
          >{i.label}</button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
      <div className="card space-y-6">
        <Chips items={SEASONS} value={season} onChange={setSeason} label="עונה" />
        <Chips items={DAYS} value={day} onChange={setDay} label="יום בשבוע" />
        <Chips items={STYLES} value={style} onChange={setStyle} label="סגנון" />
        <div>
          <label className="label" htmlFor="bsim-guests">כמות אורחים</label>
          <input
            id="bsim-guests" type="number" min={0} max={MAX_GUESTS} value={guests}
            onChange={e => setGuests(Math.min(MAX_GUESTS, Math.max(0, Number(e.target.value) || 0)))}
            className="field"
          />
          <p className="mt-1.5 text-[12.5px] text-ink-mute">עד {MAX_GUESTS} אורחים</p>
        </div>
      </div>

      <div className="card flex flex-col">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[13px] text-ink-mute">הערכת תקציב</p>
            <p className="font-display text-display font-semibold tabular-nums text-ink">{ils(result.total)}</p>
          </div>
          <p className="pb-2 text-[14px] text-ink-mute tabular-nums">{ils(result.perGuest)} לאורח</p>
        </div>

        <ul className="mt-6 space-y-3" aria-label="חלוקה לפי סעיפים">
          {result.rows.map(r => {
            const pct = result.total ? (r.amount / result.total) * 100 : 0;
            return (
              <li key={r.key}>
                <div className="flex items-baseline justify-between gap-3 text-[14.5px]">
                  <span className="text-ink-soft">{r.label}</span>
                  <span className="tabular-nums text-ink">{ils(r.amount)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-haze-200">
                  <div className="h-full rounded-full bg-azure-300 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 border-t border-line pt-6">
          <p className="text-[15px] text-ink-soft">{site.budget.closing}</p>
          <Link href="#contact" className="btn-primary mt-4">{site.closing.cta}</Link>
        </div>
      </div>
    </div>
  );
}
