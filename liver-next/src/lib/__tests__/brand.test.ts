import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACCENTS, DEFAULT_ACCENT, accentByKey, accentVars } from '../../content/brand.ts';

/**
 * The shape a producer's accent has to arrive in.
 *
 * This is not pedantry about formatting. Tailwind can only fold an opacity
 * modifier into a custom property that holds bare channels, so the moment
 * `--accent-rgb` goes back to being a hex string, every `border-accent/40`
 * and `bg-accent/10` in the product stops emitting a declaration — silently,
 * with no wrong colour to notice and no build error. That is how thirty-three
 * of them came to be dropped in the first place.
 *
 * The whole-colour form has to survive alongside it, because a gradient stop
 * and an `accent-color` need a colour rather than three numbers.
 */

const CHANNELS = /^\d{1,3} \d{1,3} \d{1,3}$/;

test('every solid accent tone is emitted as bare channels', () => {
  for (const accent of ACCENTS) {
    const vars = accentVars(accent);
    for (const key of [
      '--accent-rgb', '--accent-bright-rgb', '--accent-line-rgb', '--accent-light-rgb',
    ]) {
      assert.match(
        vars[key], CHANNELS,
        `${accent.key} ${key} must be "R G B" for an opacity modifier to resolve`,
      );
    }
  }
});

test('the whole colour is derived from the same channels, so the two cannot drift', () => {
  for (const accent of ACCENTS) {
    const vars = accentVars(accent);
    for (const [whole, channels] of [
      ['--accent', '--accent-rgb'],
      ['--accent-bright', '--accent-bright-rgb'],
      ['--accent-line', '--accent-line-rgb'],
      ['--accent-light', '--accent-light-rgb'],
    ]) {
      assert.equal(vars[whole], `rgb(${vars[channels]})`, `${accent.key} ${whole}`);
    }
  }
});

test('the channels are the preset\'s own hex, converted rather than retyped', () => {
  /* Asserted as arithmetic on whatever the preset holds, not against a
     literal. The first version pinned gold to #846941 and failed the day the
     palette moved to a cooler ground and every tone was re-solved against it,
     which is a test reporting a deliberate change as a defect. What is worth
     holding here is that the conversion is real. */
  for (const accent of ACCENTS) {
    const vars = accentVars(accent);
    for (const [role, key] of [
      ['base', '--accent-rgb'], ['bright', '--accent-bright-rgb'],
      ['line', '--accent-line-rgb'], ['light', '--accent-light-rgb'],
    ] as const) {
      const n = parseInt(accent[role].slice(1), 16);
      const expected = `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
      assert.equal(vars[key], expected, `${accent.key}.${role}`);
    }
  }
});

test('the wash stays a whole colour, because it carries its own alpha', () => {
  for (const accent of ACCENTS) {
    const wash = accentVars(accent)['--accent-wash'];
    assert.doesNotMatch(wash, CHANNELS, `${accent.key} wash must not be channels`);
    assert.match(wash, /^rgba\(/, `${accent.key} wash`);
  }
});

test('an unknown key falls back to gold rather than to nothing', () => {
  assert.equal(accentByKey('no-such-accent'), DEFAULT_ACCENT);
  assert.equal(accentByKey(null), DEFAULT_ACCENT);
  assert.equal(accentByKey(undefined), DEFAULT_ACCENT);
  assert.equal(accentByKey('teal').key, 'teal');
});

test('every preset is complete, so a producer cannot pick a half-defined brand', () => {
  const seen = new Set<string>();
  for (const accent of ACCENTS) {
    assert.ok(!seen.has(accent.key), `duplicate accent key ${accent.key}`);
    seen.add(accent.key);
    for (const role of ['base', 'bright', 'line', 'light'] as const) {
      assert.match(accent[role], /^#[0-9A-Fa-f]{6}$/, `${accent.key}.${role}`);
    }
    assert.match(accent.wash, /^rgba\(/, `${accent.key}.wash`);
    assert.ok(accent.label.length > 0, `${accent.key} has no label`);
  }
});
