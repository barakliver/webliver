'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { apply, stored } from '@/lib/theme';

/**
 * Keeps the palette in step with where the person actually is.
 *
 * The line of script in the head decides once, for the document that was
 * served. Everything after that is client-side navigation, which never
 * reloads a document — so somebody working in the dark app who follows a
 * link to the public site would arrive with the app's palette still on, and
 * the site's hero would draw its own headline in near-black over a
 * photograph.
 *
 * Nothing is rendered. It exists to run one line on every route change.
 */
export function ThemeScope() {
  const path = usePathname();
  useEffect(() => { apply(stored()); }, [path]);
  return null;
}
