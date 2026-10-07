'use client';

import { createElement, type ReactNode } from 'react';
import * as React from 'react';

/**
 * React's `<ViewTransition>`, which this project can use and cannot import.
 *
 * The App Router runs on the React that Next bundles, and that copy exports
 * `ViewTransition`. The `react` in package.json is 19.2.8 stable, which does
 * not — so `import { ViewTransition } from 'react'` type-checks as an error
 * while working perfectly at runtime, because Next aliases `react` to its own
 * copy for everything under `app/`.
 *
 * Rather than scatter a cast at every call site, the cast lives here once.
 * When React ships it in a stable release this file becomes a re-export and
 * then nothing at all, and the places that use it do not change.
 *
 * If it is genuinely absent the children are rendered bare. A navigation that
 * does not animate is the correct degradation — it is how this looks in a
 * browser without the View Transitions API anyway — and it is much better
 * than a screen that throws because a motion wrapper went missing.
 */
type Props = {
  children: ReactNode;
  /** Pairs an element with its other half across a navigation. */
  name?: string;
  /** The class the exit animation is written against. */
  exit?: string;
  /** The class the enter animation is written against. */
  enter?: string;
  /** `"none"` keeps this pair still during unrelated transitions. Without it
   *  every named transition on the page animates whenever any one of them
   *  runs, which reads as the whole screen twitching. */
  default?: string;
  share?: string;
};

const Impl = (React as unknown as { ViewTransition?: React.ComponentType<Props> }).ViewTransition;

export function ViewTransition(props: Props) {
  if (!Impl) return <>{props.children}</>;
  return createElement(Impl, props);
}
