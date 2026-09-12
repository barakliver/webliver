'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  THEME_EVENT, apply, setTheme as write, showingDark, stored, type Theme,
} from '@/lib/theme';

/**
 * The palette, for the two controls that offer it.
 *
 * `theme` is what was chosen, which may be "follow the device". `dark` is
 * what is on the screen because of that choice, which is a different
 * question and the one an icon has to answer: a moon or a sun is drawn from
 * what the page looks like now, never from what was picked.
 *
 * Both start at their server values and correct themselves on mount. That is
 * deliberate rather than a compromise: the server cannot know what is in this
 * browser's storage, and a component that renders nothing until it does would
 * pop a control into the header a beat after everything else.
 */
export function useTheme(): { theme: Theme; dark: boolean; set: (t: Theme) => void } {
  const [theme, setLocal] = useState<Theme>('auto');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setLocal(stored());
    setDark(showingDark());
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<Theme>).detail;
      if (next) setLocal(next);
      setDark(showingDark());
    };
    window.addEventListener(THEME_EVENT, onChange);
    return () => window.removeEventListener(THEME_EVENT, onChange);
  }, []);

  /* While the choice is to follow the device, the device gets to change its
     mind: somebody whose phone turns dark at sunset should watch this turn
     with it rather than on their next reload. */
  useEffect(() => {
    if (theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystem = () => { apply('auto'); setDark(showingDark()); };
    mq.addEventListener('change', onSystem);
    return () => mq.removeEventListener('change', onSystem);
  }, [theme]);

  const set = useCallback((t: Theme) => write(t), []);
  return { theme, dark, set };
}
