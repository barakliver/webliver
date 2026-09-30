import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quantize, assignRoles, paletteFrom, toHex, fromHex, lightness } from '../palette.ts';
import { readBrand, splitNames, inkOn, contrast, readableAccent, defaultBrand, variantFor, menuLines, fontHref } from '../../content/brandKit.ts';

/* A board: mostly ivory paper, a lot of deep green, some dusty pink, a
   little gold, a few near-black pixels. Repeated so each colour has a share. */
function board(): number[] {
  const px: number[] = [];
  const put = (rgb: number[], n: number) => { for (let i = 0; i < n; i++) px.push(...rgb); };
  put([250, 246, 239], 400);
  put([47, 74, 62], 300);
  put([214, 170, 160], 150);
  put([176, 141, 87], 60);
  put([25, 22, 20], 40);
  return px;
}

test('quantize finds the five colours that are actually there, most present first', () => {
  const found = quantize(board(), 5);
  assert.equal(found.length, 5);
  assert.ok(found[0].share > found[4].share);
  const near = (c: number[], t: number[]) => Math.abs(c[0] - t[0]) < 12 && Math.abs(c[1] - t[1]) < 12 && Math.abs(c[2] - t[2]) < 12;
  assert.ok(found.some((f) => near(f.color, [250, 246, 239])), 'the paper');
  assert.ok(found.some((f) => near(f.color, [47, 74, 62])), 'the green');
});

test('roles: paper is the lightest, ink the darkest, the accent the most saturated', () => {
  const pal = paletteFrom(board());
  const by = Object.fromEntries(pal.map((s) => [s.role, s.hex]));
  assert.ok(lightness(fromHex(by.light)) > lightness(fromHex(by.dark)));
  assert.ok(lightness(fromHex(by.light)) >= 0.8, `paper is light: ${by.light}`);
  assert.ok(lightness(fromHex(by.dark)) <= 0.25, `ink is dark: ${by.dark}`);
  assert.equal(by.accent, '#B08D57', 'the gold is the accent');
  assert.equal(by.primary, '#2F4A3E', 'the green owns the most of what is left');
});

test('a board with two colours still yields five roles', () => {
  const px: number[] = [];
  for (let i = 0; i < 50; i++) px.push(255, 255, 255);
  for (let i = 0; i < 50; i++) px.push(10, 10, 10);
  const pal = assignRoles(quantize(px, 5));
  assert.equal(pal.length, 5);
  assert.ok(pal.every((s) => /^#[0-9A-F]{6}$/.test(s.hex)));
});

test('an empty sample yields the neutral pair and nothing thrown', () => {
  const pal = assignRoles(quantize([], 5));
  assert.equal(pal.length, 5);
});

test('hex round trips', () => {
  assert.equal(toHex(fromHex('#2F4A3E')), '#2F4A3E');
});

test('readBrand fills a missing role from the default and drops bad values', () => {
  const b = readBrand({
    palette: [{ role: 'primary', hex: '#123456', name: 'x' }, { role: 'accent', hex: 'red' }],
    fonts: 'nope', words: ['a', '', 'b', 'c', 'd'], picks: { invite: 'bold', nope: 'safe', menu: 'loud' },
    lean: 'bold', texts: { menu: 'a\n\nb' },
  })!;
  assert.equal(b.palette.length, 5);
  assert.equal(b.palette.find((s) => s.role === 'primary')!.hex, '#123456');
  assert.equal(b.palette.find((s) => s.role === 'accent')!.hex, '#B08D57', 'a bad hex falls back');
  assert.equal(b.fonts, 'frank-heebo');
  assert.deepEqual(b.words, ['a', 'b', 'c']);
  assert.deepEqual(b.picks, { invite: 'bold' });
  assert.equal(variantFor(b, 'invite'), 'bold');
  assert.equal(variantFor(b, 'rsvp'), 'bold', 'no pick falls back to the lean');
  assert.deepEqual(menuLines(b), ['a', 'b']);
  assert.equal(readBrand(null), null);
  assert.equal(readBrand('x'), null);
});

test('names split on the joining vav and on "and", or stay whole', () => {
  assert.deepEqual(splitNames('נועה ואיתי'), ['נועה', 'איתי']);
  assert.deepEqual(splitNames('Dana and Yossi'), ['Dana', 'Yossi']);
  assert.deepEqual(splitNames('משפחת לוי'), ['משפחת לוי']);
});

test('ink is whichever neutral actually reads on the ground', () => {
  const b = defaultBrand();
  assert.equal(inkOn(b, '#2F4A3E'), '#FAF6EF');
  assert.equal(inkOn(b, '#FAF6EF'), '#1F1B17');

  /* The middle, which is where an accent lives and where the old luminance
     cut-off got it backwards. Ivory on the default gold is 2.86; charcoal on
     it is over 5. The RSVP pill was drawn the first way. */
  assert.equal(inkOn(b, '#B08D57'), '#1F1B17');
  assert.ok(contrast(inkOn(b, '#B08D57'), '#B08D57') >= 4.5);
});

test('the font stylesheet names both faces of the pairing', () => {
  const href = fontHref('bellefair-rubik');
  assert.ok(href.includes('family=Bellefair'));
  assert.ok(href.includes('family=Rubik'));
  assert.ok(href.startsWith('https://fonts.googleapis.com/css2?'));
});

test('a wedding accent carries words only when it can be read', () => {
  const b = defaultBrand();
  const ivory = '#FAF6EF';

  /* The default gold against the default ivory. Under the bar for a
     sentence, and under it on every other paper too: 3.09 on pure white,
     2.80 on the platform's own blue. A light gold cannot be rescued by
     changing the ground, which is the whole reason this helper exists. */
  assert.ok(contrast('#B08D57', ivory) < 4.5);
  assert.ok(contrast('#B08D57', '#FFFFFF') < 4.5);

  /* So small text gets the ink instead, and the ink is far clear of the
     bar. */
  assert.equal(readableAccent(b, ivory), '#1F1B17');
  assert.ok(contrast(readableAccent(b, ivory), ivory) >= 4.5);

  /* A headline may keep it where a caption may not: the bar for large text
     is 3, and this gold clears it on white. */
  assert.equal(readableAccent(b, '#FFFFFF', true), '#B08D57');

  /* And an accent that is readable is never taken away. A couple who chose
     something dark keeps it, which is the point: nobody's palette is
     overruled, only the places it could not carry a sentence. */
  const dark = defaultBrand();
  dark.palette = dark.palette.map((s) => (s.role === 'accent' ? { ...s, hex: '#5A4320' } : s));
  assert.equal(readableAccent(dark, ivory), '#5A4320');
});
