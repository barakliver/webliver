'use client';

import { useTheme } from '@/lib/useTheme';
import { useCopy } from '@/components/app/CopyProvider';
import type { Theme } from '@/lib/theme';

/**
 * Light, dark, or follow the device, as three buttons on the profile screen.
 *
 * The same choice the header's one-press switch and the accessibility menu
 * offer, and it goes through the same `useTheme`, so pressing it here moves
 * the other two. It is on this screen because a profile is where somebody
 * goes to say how the product should be for them, and a switch in the corner
 * of a header is not where anybody looks for that.
 */
export function DisplayChoice() {
  const c = useCopy().profile.display;
  const { theme, set } = useTheme();
  const options: { value: Theme; label: string }[] = [
    { value: 'auto', label: c.auto },
    { value: 'light', label: c.light },
    { value: 'dark', label: c.dark },
  ];
  return (
    <section className="card">
      <h2 className="head-panel">{c.title}</h2>
      <p className="mt-1 text-body text-ink-soft">{c.sub}</p>
      <div role="radiogroup" aria-label={c.title} className="mt-4 inline-flex gap-1 rounded-button bg-surface-200 p-1">
        {options.map((o) => {
          const on = theme === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => set(o.value)}
              className={`min-h-[40px] rounded-button px-5 text-body transition ${
                on ? 'bg-accent text-surface-100' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
