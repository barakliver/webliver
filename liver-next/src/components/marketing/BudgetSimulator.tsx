'use client';

import { useMemo, useState } from 'react';
import { site, MAX_GUESTS } from '@/content/site';
import { BookMeeting } from './BookMeeting';
import {
  computeBudget, TIER_PLATE, ils, ilsRounded,
  type Tier, type Day, type Season, type Style, type Bar, type Scale,
} from '@/lib/budget';
import { Money } from '@/components/Ltr';

const TIERS: { v: Tier; label: string }[] = [
  { v: 'garden',   label: 'גן אירועים' },
  { v: 'hall',     label: 'אולם' },
  { v: 'boutique', label: 'מקום בוטיק' },
  { v: 'field',    label: 'שטח פתוח' },
];
const DAYS: { v: Day; label: string }[] = [
  { v: 'weekday',  label: 'אמצע שבוע' },
  { v: 'friday',   label: 'שישי' },
  { v: 'saturday', label: 'שבת' },
];
const SEASONS: { v: Season; label: string }[] = [
  { v: 'spring', label: 'אביב או סתיו' },
  { v: 'summer', label: 'קיץ' },
  { v: 'winter', label: 'חורף' },
];
const STYLES: { v: Style; label: string }[] = [
  { v: 'classic', label: 'קלאסי' },
  { v: 'modern',  label: 'מודרני' },
  { v: 'rustic',  label: 'כפרי' },
  { v: 'lux',     label: 'יוקרתי' },
];
const BARS: { v: Bar; label: string }[] = [
  { v: 'venue',    label: 'כלול במקום' },
  { v: 'external', label: 'בר חיצוני' },
  { v: 'none',     label: 'בלי בר' },
];
const RATES = [0.75, 0.85, 0.95];

const SCALE_LABEL: Record<Scale, string> = { guest: 'לפי אורח', table: 'לפי שולחן', fixed: 'קבוע' };

function Chips<T extends string>({ items, value, onChange, label }: {
  items: { v: T; label: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <button
            key={i.v} type="button" onClick={() => onChange(i.v)} aria-pressed={value === i.v}
            className={`inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px] transition sm:min-h-0 sm:py-2 ${
              value === i.v ? 'bg-ink text-white shadow-soft' : 'border border-line bg-white/70 text-ink-soft hover:bg-white'
            }`}
          >{i.label}</button>
        ))}
      </div>
    </fieldset>
  );
}

export function BudgetSimulator() {
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
      <p className="mb-6 rounded-2xl border border-warn/30 bg-warn-wash px-4 py-3 text-[14px] leading-relaxed text-warn">
        כל המספרים כאן הם אומדן בלבד ואינם מדויקים. הם נועדו לתת סדר גודל להתחלה, ומשתנים לפי הספקים, המקום והעונה.
        המחיר האמיתי נקבע רק מול הצעות מחיר.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
        <div className="card space-y-6">
          <div>
            <label className="label" htmlFor="bsim-invited">כמה הזמנות אתם שולחים</label>
            <input
              id="bsim-invited" type="number" inputMode="numeric" min={0} max={MAX_GUESTS}
              value={invitedText} onChange={(e) => setInvitedText(e.target.value)}
              className="field"
            />
          </div>

          <fieldset>
            <legend className="label">כמה מהם באמת מגיעים</legend>
            <div className="flex flex-wrap gap-2">
              {RATES.map((v) => (
                <button
                  key={v} type="button" onClick={() => setAttendance(v)} aria-pressed={attendance === v}
                  className={`inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px] transition sm:min-h-0 sm:py-2 ${
                    attendance === v ? 'bg-ink text-white shadow-soft' : 'border border-line bg-white/70 text-ink-soft hover:bg-white'
                  }`}
                >{Math.round(v * 100)}%</button>
              ))}
            </div>
            <p className="mt-1.5 text-[12.5px] text-ink-mute">
              הקייטרינג נספר על מי שמגיע בפועל, לא על מי שהוזמן.
            </p>
          </fieldset>

          <Chips items={TIERS} value={tier} onChange={setTier} label="סוג המקום" />

          <div>
            <label className="label" htmlFor="bsim-plate">מחיר למנה</label>
            <input
              id="bsim-plate" type="number" inputMode="numeric" min={0} max={2000}
              value={plateText}
              onChange={(e) => { setPlateText(e.target.value); setPlateTouched(true); }}
              className="field"
            />
            <p className="mt-1.5 text-[12.5px] text-ink-mute">
              יש לכם הצעת מחיר? הקלידו את המספר שקיבלתם והתחשיב יתעדכן לפיו.
            </p>
          </div>

          <Chips items={DAYS} value={day} onChange={setDay} label="יום בשבוע" />
          <Chips items={SEASONS} value={season} onChange={setSeason} label="עונה" />
          <Chips items={STYLES} value={style} onChange={setStyle} label="סגנון" />
          <Chips items={BARS} value={bar} onChange={setBar} label="אלכוהול" />
        </div>

        <div className="card flex flex-col">
          <p className="text-[13px] text-ink-mute">טווח תקציב משוער</p>
          {/* "עד" rather than a dash. A range written with a dash reads
              ambiguously in a right-to-left line, where the eye cannot tell
              which end it started from; the word cannot be read backwards. */}
          <p className="font-display text-display font-semibold text-ink">
            <span className="tabular-nums">{ilsRounded(r.low)}</span>
            <span className="mx-2 text-[0.6em] font-normal text-ink-mute">עד</span>
            <span className="tabular-nums">{ilsRounded(r.high)}</span>
          </p>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-ink-mute">
            <span>מגיעים בפועל: <b className="text-ink">{r.attending}</b></span>
            <span>שולחנות: <b className="text-ink">{r.tables}</b></span>
            <span>לאורח: <b className="tabular-nums text-ink"><Money value={r.perGuest} /></b></span>
          </div>

          <ul className="mt-6 space-y-3" aria-label="חלוקה לפי סעיפים">
            {r.lines.map((l) => {
              const pct = r.total ? (l.amount / r.total) * 100 : 0;
              return (
                <li key={l.key}>
                  <div className="flex items-baseline justify-between gap-3 text-[14.5px]">
                    <span className="text-ink-soft">
                      {l.label} <span className="text-[11.5px] text-ink-mute">{SCALE_LABEL[l.scale]}</span>
                    </span>
                    <span className="tabular-nums text-ink"><Money value={l.amount} /></span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-200">
                    <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-6 rounded-2xl bg-accent-wash px-4 py-3 text-[14px] text-ink-soft">
            כל עשרה אורחים נוספים: <b className="tabular-nums text-ink"><Money value={r.marginalTen} /></b>
          </p>

          <div className="mt-6 border-t border-line pt-6">
            <p className="text-[15px] text-ink-soft">{site.budget.closing}</p>
            <BookMeeting className="btn-primary mt-4 inline-flex items-center gap-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
