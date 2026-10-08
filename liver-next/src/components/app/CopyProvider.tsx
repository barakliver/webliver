'use client';

import { createContext, useContext } from 'react';
import type { AppUi } from '@/content/appUi';

/**
 * The wording for the couple's screens, delivered once instead of threaded.
 *
 * The public site passes copy down as props, which is right there: a handful
 * of components, one level deep. The portal is thirteen components across
 * three levels, and threading a prop through all of them would be a large
 * diff through the tool he uses every day, for a language most of his couples
 * will never select.
 *
 * **The default used to be the whole Hebrew copy tree, and that cost 35KB
 * gzipped on every route in the product.** The reasoning for it was good: a
 * screen with no provider above it rendered Hebrew rather than a blank panel,
 * so a mis-wiring failed softly. What it did not account for is that a
 * default is an import, `APP_UI_HE` reaches `content/site.ts`, and that file
 * is a quarter of a megabyte of wording for every screen there is. One
 * reference to it from a client module keeps the whole object alive through
 * tree-shaking, and this was the only one.
 *
 * It was in the bundle of pages that have no app on them at all. The guests'
 * page went from 73KB to 38KB the moment this line changed, and the card game
 * from 78 to 43: a grandparent opening a wedding invitation on a phone was
 * downloading the producer's crew board labels. `GameTable` already knew, and
 * writes twenty lines of `Sheet`'s behaviour out by hand rather than import
 * it, because Sheet reads one label from here.
 *
 * So it throws instead, and the soft failure is replaced by a check rather
 * than given up: `npm run copy` walks what every page imports and fails if
 * anything that reads the wording sits under no provider. That is a proof
 * where the default was a hope, and `npm run weigh` holds the bytes it bought.
 *
 * Read with `useCopy()`, which returns the whole set; each component pulls the
 * one block it needs.
 */
const Ctx = createContext<AppUi | null>(null);

export function CopyProvider({ value, children }: { value: AppUi; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCopy(): AppUi {
  const ui = useContext(Ctx);
  /* Loud rather than blank. `scripts/check-copy.mjs` is what makes this safe
     to throw, and a component that reaches here has escaped it. */
  if (!ui) throw new Error('useCopy() was called with no <CopyProvider> above it.');
  return ui;
}
