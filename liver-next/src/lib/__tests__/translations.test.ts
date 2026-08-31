import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appUiFor } from '../../content/appUi.ts';
import {
  authFor, privacyFor, termsFor, a11yFor, installFor, storeFor, rsvpFor,
  budgetSimFor, conciergeFor, eventKindsFor,
} from '../../content/ui.ts';

/**
 * The two languages hold the same shape, and neither carries a function.
 *
 * The types already enforce the shape: every English block is its Hebrew
 * counterpart put through `Wide<>`, so a key added to one is a compile error
 * until it exists in the other. This checks the same thing at run time for one
 * reason: a compile error is only seen by whoever runs the build, and the way
 * this breaks in practice is somebody adding a key in a hurry and reaching for
 * `as never` to make the red squiggle go away.
 *
 * The function check is the one that has already cost a bug. Every block below
 * is handed to a client component, and React cannot serialise a function across
 * that boundary: the sign-in screen returned a 500 the first time this was
 * wired, because two strings in the auth block were built by functions. Any new
 * one would fail exactly the same way, and only on the screen that renders it.
 */

/** Every path through an object, as dotted strings, so two shapes can be
 *  compared as sorted lists rather than by recursive equality. */
function paths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => paths(v, `${prefix}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().flatMap((k) =>
      paths((value as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

function functionsIn(value: unknown, prefix = ''): string[] {
  if (typeof value === 'function') return [prefix];
  if (Array.isArray(value)) return value.flatMap((v, i) => functionsIn(v, `${prefix}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => functionsIn(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

const PUBLIC_BLOCKS = {
  auth: authFor, privacy: privacyFor, terms: termsFor, a11y: a11yFor,
  install: installFor, store: storeFor, rsvp: rsvpFor,
  budgetSim: budgetSimFor, concierge: conciergeFor, eventKinds: eventKindsFor,
} as const;

test('every public block has the same shape in both languages', () => {
  for (const [name, resolve] of Object.entries(PUBLIC_BLOCKS)) {
    assert.deepEqual(
      paths(resolve('en')), paths(resolve('he')),
      `${name} differs between he and en`,
    );
  }
});

test('the couple’s area has the same shape in both languages', () => {
  const he = appUiFor('he');
  const en = appUiFor('en');
  /* `locale` is the one key that is meant to differ. */
  assert.equal(he.locale, 'he');
  assert.equal(en.locale, 'en');
  assert.deepEqual(paths({ ...en, locale: '' }), paths({ ...he, locale: '' }));
});

test('nothing handed to a client component is a function', () => {
  for (const [name, resolve] of Object.entries(PUBLIC_BLOCKS)) {
    for (const locale of ['he', 'en'] as const) {
      assert.deepEqual(
        functionsIn(resolve(locale)), [],
        `${name} (${locale}) carries a function, which cannot cross the client boundary`,
      );
    }
  }
  for (const locale of ['he', 'en'] as const) {
    assert.deepEqual(functionsIn(appUiFor(locale)), [], `the couple's area (${locale}) carries a function`);
  }
});

test('a sentence with a hole in it has the same holes in both languages', () => {
  const holes = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort();

  const compare = (a: unknown, b: unknown, where: string): void => {
    if (typeof a === 'string' && typeof b === 'string') {
      assert.deepEqual(holes(a), holes(b), `${where}: placeholders differ`);
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      a.forEach((v, i) => compare(v, b[i], `${where}[${i}]`));
      return;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      for (const k of Object.keys(a)) {
        compare((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${where}.${k}`);
      }
    }
  };

  for (const [name, resolve] of Object.entries(PUBLIC_BLOCKS)) {
    compare(resolve('he'), resolve('en'), name);
  }
  compare(appUiFor('he'), appUiFor('en'), 'appUi');
});
