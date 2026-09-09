import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCopy } from '../siteCopy.ts';
import { site } from '../../content/site.ts';
import { EDITABLE_KEYS, defaultAt } from '../../content/editable.ts';

test('no overrides is the site exactly as it ships', () => {
  assert.equal(mergeCopy([]), site);
});

test('a sentence is replaced and nothing else moves', () => {
  const out = mergeCopy([{ key: 'hero.headline', value: 'ערב אחד, זיכרון לכל החיים' }]);
  assert.equal(out.hero.headline, 'ערב אחד, זיכרון לכל החיים');
  assert.deepEqual(out.hero.body, site.hero.body);
  assert.equal(out.about.title, site.about.title);
});

test('the shape of the default decides the shape of the override', () => {
  /* A list stays a list and a sentence stays a sentence whatever is in the
     text column, so no edit can hand a component the wrong kind of thing. */
  const out = mergeCopy([{ key: 'about.body', value: 'שורה\nשורה שנייה\n\n  שלישית  ' }]);
  assert.deepEqual(out.about.body, ['שורה', 'שורה שנייה', 'שלישית']);
  assert.equal(typeof out.hero.headline, 'string');
});

test('the shipped copy is never mutated by an override', () => {
  /* The module object is imported once per process and shared by every
     request; writing into it would leak one edit into every later visitor. */
  const before = site.hero.headline;
  mergeCopy([{ key: 'hero.headline', value: 'משהו אחר' }]);
  assert.equal(site.hero.headline, before);
});

test('a key nobody offers is ignored rather than merged', () => {
  const out = mergeCopy([
    { key: 'hero.nonsense', value: 'x' },
    { key: 'totally.made.up', value: 'x' },
    { key: 'brand', value: 'לא ניתן לעריכה' },
  ]);
  assert.equal(out.brand, site.brand);
  assert.equal((out.hero as unknown as Record<string, unknown>).nonsense, undefined);
});

test('every editable key points at something that actually exists', () => {
  /* A field that saves and changes nothing is worse than a field that is not
     there: the person editing finds out weeks later. */
  for (const key of EDITABLE_KEYS.keys()) {
    const value = defaultAt(key);
    assert.notEqual(value, '', `${key} has no shipped default, so it renders nothing`);

    const merged = mergeCopy([{ key, value: 'בדיקה' }]);
    const parts = key.split('.');
    const got = parts.reduce<unknown>(
      (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
      merged
    );
    const applied = Array.isArray(got) ? got.join('\n') : got;
    assert.equal(applied, 'בדיקה', `${key} did not take an override`);
  }
});

test('an empty list override does not leave an empty section', () => {
  /* Blank means "put it back" everywhere else in this feature; a value of only
     whitespace reaching the merge should not produce a section with no lines. */
  const out = mergeCopy([{ key: 'philosophy.body', value: '\n  \n' }]);
  assert.deepEqual(out.philosophy.body, []);
});
