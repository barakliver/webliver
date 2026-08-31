'use client';

import { createContext, useContext } from 'react';
import { APP_UI_HE, type AppUi } from '@/content/appUi';

/**
 * The wording for the couple's screens, delivered once instead of threaded.
 *
 * The public site passes copy down as props, which is right there: a handful of
 * components, one level deep. The portal is thirteen components across three
 * levels, and threading a prop through all of them would be a large diff
 * through the tool he uses every day, for a language most of his couples will
 * never select.
 *
 * So the value travels as context, and the default is Hebrew. That is the part
 * that matters: a screen with no provider above it renders exactly what it
 * rendered before this file existed. The producer's console has no provider and
 * cannot acquire one by accident, and if I have wired the portal wrong the
 * failure mode is Hebrew rather than a blank panel.
 *
 * Read with `useCopy()`, which returns the whole set; each component pulls the
 * one block it needs.
 */
const Ctx = createContext<AppUi>(APP_UI_HE);

export function CopyProvider({ value, children }: { value: AppUi; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCopy(): AppUi {
  return useContext(Ctx);
}
