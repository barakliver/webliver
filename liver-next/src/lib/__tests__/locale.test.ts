import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLocale, dirOf, LOCALES, DEFAULT_LOCALE } from '../locale.ts';
import { site } from '../../content/site.ts';
import { siteEn } from '../../content/site.en.ts';
import { mergeCopy } from '../siteCopy.ts';

/** Every leaf of the copy object, as dotted paths, so two languages can be
 *  compared as shapes rather than by reading them side by side. */
function paths(node: unknown, prefix = ''): string[] {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return [prefix];
  return Object.entries(node as Record<string, unknown>)
    .flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k));
}

test('the two languages are the same shape, field for field', () => {
  /* The type already enforces this at compile time. The test exists for the
     failure the type cannot see: a field that is present in both and empty in
     one, which renders as a heading that is simply missing. */
  assert.deepEqual(paths(site).sort(), paths(siteEn).sort());
});

test('no sentence is left blank in either language', () => {
  const blanks = (copy: unknown, lang: string) => {
    const bad: string[] = [];
    const walk = (node: unknown, at: string) => {
      if (typeof node === 'string') { if (!node.trim()) bad.push(`${lang}: ${at}`); return; }
      if (Array.isArray(node)) {
        if (node.length === 0) bad.push(`${lang}: ${at} is an empty list`);
        node.forEach((v, i) => walk(v, `${at}[${i}]`));
        return;
      }
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) walk(v, at ? `${at}.${k}` : k);
      }
    };
    walk(copy, '');
    return bad;
  };
  assert.deepEqual([...blanks(site, 'he'), ...blanks(siteEn, 'en')], []);
});

test('the English copy is actually in English', () => {
  /* Catches the half-finished translation: a block copied across and never
     rewritten reads perfectly in review and ships Hebrew on an English page. */
  const hebrew = /[֐-׿]/;
  const found: string[] = [];
  const walk = (node: unknown, at: string) => {
    if (typeof node === 'string') { if (hebrew.test(node)) found.push(`${at}: ${node}`); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, at ? `${at}.${k}` : k);
    }
  };
  walk(siteEn, '');
  assert.deepEqual(found, []);
});

test('an unknown language becomes the one the site started in', () => {
  /* A cookie is a value a browser sends. A page in a language nobody wrote is
     worse than Hebrew. */
  assert.equal(readLocale('fr'), DEFAULT_LOCALE);
  assert.equal(readLocale(''), DEFAULT_LOCALE);
  assert.equal(readLocale(undefined), DEFAULT_LOCALE);
  assert.equal(readLocale(null), DEFAULT_LOCALE);
  assert.equal(readLocale('he'), 'he');
  assert.equal(readLocale('en'), 'en');
});

test('direction follows the language rather than being set anywhere else', () => {
  assert.equal(dirOf('he'), 'rtl');
  assert.equal(dirOf('en'), 'ltr');
  for (const l of LOCALES) assert.ok(['rtl', 'ltr'].includes(dirOf(l)));
});

test('a Hebrew edit never reaches the English page', () => {
  /* The editor writes one sentence per key, in Hebrew. Applying those rows to
     the English page would put Hebrew in the middle of it, which is worse than
     English that is one edit behind. */
  const edit = [{ key: 'hero.headline', value: 'כותרת חדשה' }];
  assert.equal(mergeCopy(edit, 'he').hero.headline, 'כותרת חדשה');
  assert.equal(mergeCopy(edit, 'en').hero.headline, siteEn.hero.headline);
});
