'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RegionOption = { value: string; label: string };

/**
 * Where the event is, in one tap or a few words.
 *
 * Six regions as chips, because that is the granularity the first call is
 * decided at: a producer in the north does not take a Thursday in Eilat. A
 * text field under them for the couple who already booked the hall, since a
 * named venue is better than a region and should not be forced into one.
 *
 * One value leaves the form. Typed text wins over a chip, and the chip stays
 * lit only while nothing is typed, so the two never disagree about what was
 * chosen. The value stored is the chip's canonical label, whichever language
 * the visitor read it in.
 */
export function RegionPicker({
  name, regions, label, freeLabel, freePh, required, defaultValue = '', invalid, id = 'region',
}: {
  name: string;
  regions: readonly RegionOption[];
  label: string;
  freeLabel: string;
  freePh: string;
  required?: boolean;
  defaultValue?: string;
  invalid?: boolean;
  id?: string;
}) {
  const preset = regions.find((r) => r.value === defaultValue)?.value ?? '';
  const [chip, setChip] = useState(preset);
  const [text, setText] = useState(preset ? '' : defaultValue);
  const value = text.trim() || chip;

  return (
    <fieldset aria-invalid={invalid || undefined}>
      <legend className="label">
        {label}
        {required && <span aria-hidden className="ms-1 text-accent">*</span>}
      </legend>
      <input type="hidden" name={name} value={value} />

      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {regions.map((r) => {
          const on = !text.trim() && chip === r.value;
          return (
            <button
              key={r.value} type="button"
              onClick={() => setChip(on ? '' : r.value)}
              aria-pressed={on}
              className={cn(
                'inline-flex min-h-[40px] items-center rounded-xl2 border px-3.5 text-[13.5px] transition-colors',
                on
                  ? 'border-ink bg-ink text-surface'
                  : 'border-line bg-card text-ink-soft hover:border-line-strong hover:text-ink',
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <div className="relative mt-3">
        <MapPin size={15} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute top-1/2 start-3.5 -translate-y-1/2 text-ink-mute" />
        <input
          id={id} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={freePh} aria-label={freeLabel} maxLength={120} autoComplete="off"
          className={cn('field ps-10', invalid && 'border-bad')}
        />
      </div>
    </fieldset>
  );
}
