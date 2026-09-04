import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, labelOn, safeColor } from '../../content/palette.ts';

/**
 * A tag's whole job is being recognised at a glance, so a label somebody has
 * to lean in to read is the one failure that makes the feature pointless.
 */

const channel = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex: string) => {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

test('every swatch on the shortlist can carry a readable label', () => {
  for (const s of PALETTE) {
    const r = ratio(labelOn(s.hex), s.hex);
    assert.ok(r >= 4.5, `${s.label} (${s.hex}) reads ${r.toFixed(2)}:1`);
  }
});

test('the orange is the one that needs dark ink', () => {
  /* The chip the audit caught. Nine of the ten take the light label and this
     one does not, which is why the answer is measured rather than assumed. */
  assert.equal(labelOn('#C2762B'), '#171512');
  assert.equal(labelOn('#2F6F5E'), '#F7F4EE');
  assert.equal(labelOn('#475569'), '#F7F4EE');
});

test('a colour off the list still gets a readable label', () => {
  /* Nothing stops a future swatch being pale. The rule measures rather than
     remembering, so it is right about a colour nobody has chosen yet. */
  for (const hex of ['#FFFFFF', '#FFF9C4', '#000000', '#7F7F7F']) {
    const r = ratio(labelOn(hex), hex);
    assert.ok(r >= 4.5, `${hex} reads ${r.toFixed(2)}:1`);
  }
});

test('a mangled colour becomes the neutral rather than a refusal', () => {
  assert.equal(safeColor('not a colour'), '#475569');
  assert.equal(safeColor('#2f6f5e'), '#2F6F5E');
});
