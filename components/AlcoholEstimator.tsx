'use client';

import { useMemo, useState } from 'react';
import {
  ALCOHOL_DEFAULTS,
  estimateAlcohol,
  type AgeDistribution,
  type AlcoholInput,
  type PartyStyle,
  type Season,
  type VenueSupply,
} from '@/lib/domain/alcohol';

/**
 * Smart bar & alcohol estimator — מחשבון אלכוהול ובר חכם
 *
 * All maths lives in `lib/domain/alcohol.ts`; this is the interactive shell.
 * It recomputes on every change, so there is no "calculate" round-trip.
 */

const SEASONS: { key: Season; he: string }[] = [
  { key: 'summer', he: 'קיץ' },
  { key: 'shoulder', he: 'עונת מעבר' },
  { key: 'winter', he: 'חורף' },
];

const STYLES: { key: PartyStyle; he: string; hint: string }[] = [
  { key: 'seated', he: 'ישיבה ומנות', hint: 'ארוחה מסודרת, קצב שתייה מתון' },
  { key: 'mixed', he: 'מעורב', hint: 'קבלת פנים ורחבה' },
  { key: 'dancing', he: 'רחבה דומיננטית', hint: 'אירוע ריקודים ארוך' },
];

const SUPPLY: { key: VenueSupply; he: string }[] = [
  { key: 'none', he: 'אנחנו מביאים הכל' },
  { key: 'partial', he: 'האולם מספק יין ובירה' },
  { key: 'bottles', he: 'בקבוקים לשולחן' },
  { key: 'open', he: 'בר פתוח מלא מהאולם' },
];

const AGE_FIELDS: { key: keyof AgeDistribution; he: string }[] = [
  { key: 'under25', he: 'עד 25' },
  { key: 'age25to40', he: '25–40' },
  { key: 'age40to60', he: '40–60' },
  { key: 'over60', he: '60+' },
];

const ils = (n: number) => `₪${Math.round(n).toLocaleString('en-US')}`;

interface Props {
  /** Seeds the guest count from the event file. */
  initialGuests?: number;
  initialSeason?: Season;
}

export default function AlcoholEstimator({ initialGuests, initialSeason }: Props) {
  const [input, setInput] = useState<AlcoholInput>({
    ...ALCOHOL_DEFAULTS,
    guests: initialGuests ?? ALCOHOL_DEFAULTS.guests,
    season: initialSeason ?? ALCOHOL_DEFAULTS.season,
  });

  const estimate = useMemo(() => estimateAlcohol(input), [input]);

  const set = <K extends keyof AlcoholInput>(key: K, value: AlcoholInput[K]) =>
    setInput((current) => ({ ...current, [key]: value }));

  const setAge = (key: keyof AgeDistribution, value: number) =>
    setInput((current) => ({
      ...current,
      ageDistribution: { ...current.ageDistribution, [key]: Math.max(0, value) },
    }));

  const ageTotal = AGE_FIELDS.reduce((sum, f) => sum + (input.ageDistribution[f.key] || 0), 0);

  function copyShoppingList() {
    const lines = estimate.lines.map(
      (l) => `${l.labelHe}: ${l.bottles} בקבוקים (${l.bottleSizeL}L) — ${ils(l.cost)}`,
    );
    lines.push(`קרח: ${estimate.iceKg} ק"ג`, `משקאות קלים: ${estimate.softDrinkLiters} ליטר`);
    lines.push(`סה"כ משוער: ${ils(estimate.totalCost)}`);
    void navigator.clipboard?.writeText(lines.join('\n'));
  }

  return (
    <section className="stack" aria-labelledby="alc-title">
      <div>
        <h2 id="alc-title" style={{ fontSize: 22 }}>
          🥂 מחשבון אלכוהול ובר חכם
        </h2>
        <p className="muted small">
          הערכת כמויות לפי גילאי האורחים, משך האירוע, אופי המסיבה והעונה.
        </p>
      </div>

      <div className="card stack">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          <div>
            <label htmlFor="a-guests">כמות אורחים</label>
            <input
              id="a-guests"
              type="number"
              min={0}
              max={5000}
              value={input.guests}
              onChange={(e) => set('guests', Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="a-drinkers">% שותים אלכוהול</label>
            <input
              id="a-drinkers"
              type="number"
              min={0}
              max={100}
              value={input.drinkersPct ?? 75}
              onChange={(e) => set('drinkersPct', Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="a-hours">שעות אירוע</label>
            <input
              id="a-hours"
              type="number"
              min={1}
              max={16}
              step={0.5}
              value={input.hours ?? 6}
              onChange={(e) => set('hours', Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="a-season">עונה</label>
            <select
              id="a-season"
              value={input.season ?? 'summer'}
              onChange={(e) => set('season', e.target.value as Season)}
            >
              {SEASONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.he}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset style={{ border: 'none' }}>
          <legend className="muted small" style={{ fontWeight: 700, marginBottom: 6 }}>
            התפלגות גילאים (באחוזים או במספרים — מנורמל אוטומטית)
          </legend>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))' }}>
            {AGE_FIELDS.map((f) => (
              <div key={f.key}>
                <label htmlFor={`age-${f.key}`}>{f.he}</label>
                <input
                  id={`age-${f.key}`}
                  type="number"
                  min={0}
                  max={100}
                  value={input.ageDistribution[f.key]}
                  onChange={(e) => setAge(f.key, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
          {ageTotal === 0 && (
            <p className="muted small" style={{ marginTop: 6 }}>
              לא הוזנה התפלגות — נעשה שימוש בפילוח ממוצע לחתונה.
            </p>
          )}
        </fieldset>

        <div>
          <label>אופי האירוע</label>
          <div className="row">
            {STYLES.map((s) => (
              <button
                key={s.key}
                type="button"
                className="chip"
                aria-pressed={(input.style ?? 'mixed') === s.key}
                title={s.hint}
                onClick={() => set('style', s.key)}
              >
                {s.he}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="a-supply">מה האולם מספק</label>
          <select
            id="a-supply"
            value={input.venueSupply ?? 'none'}
            onChange={(e) => set('venueSupply', e.target.value as VenueSupply)}
          >
            {SUPPLY.map((s) => (
              <option key={s.key} value={s.key}>
                {s.he}
              </option>
            ))}
          </select>
        </div>

        {input.venueSupply === 'bottles' && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
            <div>
              <label htmlFor="a-tables">מספר שולחנות</label>
              <input
                id="a-tables"
                type="number"
                min={1}
                value={input.tables ?? Math.ceil(input.guests / 12)}
                onChange={(e) => set('tables', Number(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="a-bpt">בקבוקים לשולחן</label>
              <input
                id="a-bpt"
                type="number"
                min={0}
                max={12}
                value={input.bottlesPerTable ?? 2}
                onChange={(e) => set('bottlesPerTable', Number(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
        <Metric value={`${estimate.totalLiters}L`} label="סה״כ צריכה" />
        <Metric value={`${estimate.suppliedLiters}L`} label="מהאולם" />
        <Metric
          value={`${estimate.purchaseLiters}L`}
          label="לרכישה"
          tone={estimate.purchaseLiters > 0 ? 'var(--gold)' : 'var(--green)'}
        />
        <Metric value={`${estimate.iceKg} ק״ג`} label="קרח" />
        <Metric value={`${estimate.softDrinkLiters}L`} label="משקאות קלים" />
        <Metric value={ils(estimate.totalCost)} label="עלות משוערת" tone="var(--gold)" />
      </div>

      {estimate.lines.length > 0 ? (
        <div className="card">
          <div className="spread">
            <b>רשימת קניות</b>
            <button type="button" className="btn btn-ghost btn-xs" onClick={copyShoppingList}>
              העתקת הרשימה
            </button>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['פריט', 'ליטרים', 'בקבוקים', 'מחיר ליח׳', 'סה״כ'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'start',
                        padding: '8px 6px',
                        borderBottom: '1px solid var(--line)',
                        fontSize: 11,
                        letterSpacing: '.06em',
                        color: 'var(--muted)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estimate.lines.map((line) => (
                  <tr key={line.key}>
                    <td style={cell}>{line.labelHe}</td>
                    <td style={cell}>{line.liters}</td>
                    <td style={cell}>
                      <b>{line.bottles}</b>{' '}
                      <span className="muted small">({line.bottleSizeL}L)</span>
                    </td>
                    <td style={cell}>{ils(line.unitPrice)}</td>
                    <td style={cell}>{ils(line.cost)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...cell, fontWeight: 700 }} colSpan={4}>
                    סה״כ
                  </td>
                  <td style={{ ...cell, fontWeight: 700 }}>{ils(estimate.totalCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>
            מחירים אינדיקטיביים לקנייה קמעונאית בישראל — עדכנו מול הספק שלכם.
          </p>
        </div>
      ) : (
        <div className="alert alert-ok">האולם מכסה את כל הצריכה הצפויה — אין צורך ברכישה נפרדת.</div>
      )}

      <div className="card">
        <b className="small">הערות מקצועיות</b>
        <ul className="stack" style={{ gap: 8, marginTop: 8, paddingInlineStart: 18 }}>
          {estimate.notes.map((note, i) => (
            <li key={i} className="small">
              {note.he}
            </li>
          ))}
        </ul>
        <p className="muted small" style={{ marginTop: 10 }}>
          מקדמים: גיל ×{estimate.factors.age} · עונה ×{estimate.factors.season} · אופי ×
          {estimate.factors.style} · משך ×{estimate.factors.duration}
        </p>
      </div>
    </section>
  );
}

const cell: React.CSSProperties = {
  padding: '8px 6px',
  borderBottom: '1px solid var(--line)',
  textAlign: 'start',
};

function Metric({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 12 }}>
      <div className="serif" style={{ fontSize: 21, color: tone ?? 'inherit' }}>
        {value}
      </div>
      <div className="muted small">{label}</div>
    </div>
  );
}
