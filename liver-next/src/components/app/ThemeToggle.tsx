'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/useTheme';

/**
 * Light or dark, one press, in the header.
 *
 * The three-way control in the accessibility menu came first and it is the
 * complete one: follow the device, light, dark. This is the other half of
 * the same setting, and it exists because of where the first one lives. A
 * person working at eleven at night does not open an accessibility menu to
 * turn the lights down; they look along the top of the screen for the thing
 * that does it, the way they look for the language switch two icons over.
 *
 * It is a flip, not a cycle. Three states behind one button means pressing
 * it twice does not return you to where you were, and "follow the device"
 * has no icon anybody reads. So this sets an explicit light or dark, taken
 * from what is actually on the screen rather than from what was chosen —
 * press it while following a dark phone and you get light, which is what
 * pressing it was for. The way back to following the device stays one menu
 * away, and both controls move together.
 */
export function ThemeToggle({ label }: { label: { toLight: string; toDark: string } }) {
  const { dark, set } = useTheme();
  return (
    <button
      type="button"
      onClick={() => set(dark ? 'light' : 'dark')}
      aria-label={dark ? label.toLight : label.toDark}
      title={dark ? label.toLight : label.toDark}
      className="grid h-10 w-10 place-items-center rounded-full text-ink-soft
                 transition-colors hover:bg-surface-200 hover:text-ink
                 focus-visible:outline focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {dark
        ? <Sun size={19} strokeWidth={1.5} aria-hidden />
        : <Moon size={19} strokeWidth={1.5} aria-hidden />}
    </button>
  );
}
