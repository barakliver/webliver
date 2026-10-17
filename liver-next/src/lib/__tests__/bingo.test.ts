import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBoard, linesOf, markOf, sizeFor, type BingoTask } from '../bingo.ts';
import { VENDOR_CATEGORIES } from '../../content/eventFile.ts';

const task = (id: string, over: Partial<BingoTask> = {}): BingoTask => ({
  id, title: id, done: false, category: null, ...over,
});

const many = (n: number, over: (i: number) => Partial<BingoTask> = () => ({})): BingoTask[] =>
  [...Array(n).keys()].map((i) => task(`t${String(i).padStart(2, '0')}`, over(i)));

test('a board is only ever a full square', () => {
  /* Blanks would sit on lines, and a line that can never complete makes a
     board unwinnable while looking exactly like a board. */
  assert.equal(sizeFor(0), 0);
  assert.equal(sizeFor(8), 0);
  assert.equal(sizeFor(9), 3);
  assert.equal(sizeFor(15), 3);
  assert.equal(sizeFor(16), 4);
  assert.equal(sizeFor(400), 4);

  for (const n of [9, 12, 16, 40]) {
    const board = buildBoard('c', many(n))!;
    assert.equal(board.squares.length, board.size * board.size);
    assert.ok(board.squares.every(Boolean), 'no hole in the grid');
  }
});

test('too few tasks is no board rather than a short one', () => {
  assert.equal(buildBoard('c', many(8)), null);
  assert.equal(buildBoard('c', []), null);
});

test('every row, every column and both diagonals', () => {
  assert.equal(linesOf(3).length, 8);
  assert.equal(linesOf(4).length, 10);
  for (const size of [3, 4]) {
    for (const line of linesOf(size)) {
      assert.equal(line.length, size);
      assert.equal(new Set(line).size, size, 'a line never names a square twice');
      assert.ok(line.every((i) => i >= 0 && i < size * size));
    }
  }
});

/* The rule that is obviously right and quietly wrong. Selecting the squares
   on anything that a tick changes means winning a line rebuilds the board
   under the finger that won it. */
test('ticking a square never moves the board', () => {
  const before = buildBoard('wedding-1', many(30))!;
  const after = buildBoard(
    'wedding-1',
    many(30, (i) => ({ done: i % 3 === 0 })),
  )!;
  assert.deepEqual(after.squares.map((s) => s.id), before.squares.map((s) => s.id));
});

/* The reason each task carries its own hash instead of the array being
   shuffled from one seed: a shuffle re-runs whole, so a seventeenth task
   would move the sixteen already on the board. */
test('adding a task leaves the others in the order they were in', () => {
  const grown = buildBoard('wedding-1', many(40))!.squares.map((s) => s.id);
  const before = buildBoard('wedding-1', [...many(40), task('t99', { category: 'venue' })])!
    .squares.map((s) => s.id);
  const kept = before.filter((id) => grown.includes(id));
  assert.deepEqual(kept, grown.filter((id) => kept.includes(id)));
});

test('the suppliers fill the board before the errands do', () => {
  const tasks = [
    ...many(20),
    ...['venue', 'catering', 'dj'].map((c, i) => task(`z${i}`, { category: c })),
  ];
  const ids = buildBoard('c', tasks)!.squares.map((s) => s.id);
  for (const id of ['z0', 'z1', 'z2']) assert.ok(ids.includes(id), `${id} is on the board`);
});

test('two weddings do not get the same layout', () => {
  const a = buildBoard('wedding-a', many(20))!.squares.map((s) => s.id);
  const b = buildBoard('wedding-b', many(20))!.squares.map((s) => s.id);
  assert.notDeepEqual(a, b);
});

test('the same wedding gets the same layout however the rows arrived', () => {
  const rows = many(20);
  const a = buildBoard('w', rows)!.squares.map((s) => s.id);
  const b = buildBoard('w', [...rows].reverse())!.squares.map((s) => s.id);
  assert.deepEqual(a, b);
});

test('a line is won only when every square on it is ticked', () => {
  const rows = many(9);
  const open = buildBoard('w', rows)!;
  assert.equal(open.won.length, 0);
  assert.equal(open.winning.size, 0);
  assert.equal(open.ticked, 0);

  /* Tick exactly the top row of whatever layout this wedding got. */
  const top = new Set(open.squares.slice(0, 3).map((s) => s.id));
  const one = buildBoard('w', rows.map((t) => ({ ...t, done: top.has(t.id) })))!;
  assert.equal(one.ticked, 3);
  assert.equal(one.won.length, 1);
  assert.deepEqual(one.won[0], [0, 1, 2]);
  assert.deepEqual([...one.winning].sort(), [0, 1, 2]);
});

test('a full board wins every line at once', () => {
  const board = buildBoard('w', many(16, () => ({ done: true })))!;
  assert.equal(board.ticked, 16);
  assert.equal(board.total, 16);
  assert.equal(board.won.length, 10);
  assert.equal(board.winning.size, 16);
});

/* ── the mark on a square ──────────────────────────────────────────────── */

test('a supplier category answers before the words do', () => {
  /* The category is written when somebody is hired, so it is the fact and
     the title is the guess. A task categorised `venue` and titled "לסגור
     צלם" is a hall, however it was named. */
  assert.equal(markOf({ category: 'venue', title: 'לסגור צלם' }), 'venue');
  assert.equal(markOf({ category: 'dj', title: '' }), 'music');
});

test('and half the board has no category at all', () => {
  /* A category is only ever on a task that ends with somebody hired, so the
     rings, the ketubah and the hair carry none. Those are the squares the
     words are here for. */
  assert.equal(markOf({ title: 'טבעות לטקס' }), 'rings');
  assert.equal(markOf({ title: 'כתובה' }), 'ketubah');
  assert.equal(markOf({ title: 'שיער' }), 'hair');
  assert.equal(markOf({ title: 'איפור' }), 'makeup');
  assert.equal(markOf({ title: 'שמלה + הינומה' }), 'dress');
  assert.equal(markOf({ title: 'לכתוב את רשימת האורחים הראשונה' }), 'guests');
  assert.equal(markOf({ title: 'בר אלכוהול / קוקטיילים' }), 'bar');
});

test('the narrower word wins, because one pattern otherwise eats the other', () => {
  /* "צלם וידאו" is a videographer and contains the word for a photographer;
     "חליפה" is the suit and sits beside the dress. Both are on the board in
     the screenshot that prompted this, and both read as the wrong thing if
     the order is wrong. */
  assert.equal(markOf({ title: 'צלם וידאו' }), 'video');
  assert.equal(markOf({ title: 'צלם סטילס' }), 'photo');
  assert.equal(markOf({ title: 'שמלה + הינומה' }), 'dress');
  assert.equal(markOf({ title: 'חליפה + בגדים להחלפה' }), 'suit');
});

test('a square is never blank', () => {
  /* A cell with no mark among fifteen marked ones reads as one that failed
     to load, not as one about something unusual. */
  assert.equal(markOf({ title: 'לדבר עם דודה' }), 'task');
  assert.equal(markOf({}), 'task');
  assert.equal(markOf({ category: '', title: '' }), 'task');
  /* A category this file does not know is not a silent fall-through either:
     every value in content/production.ts is mapped, and anything else is a
     task like any other. */
  assert.equal(markOf({ category: 'rental', title: '' }), 'task');
});

test('an English or mixed title still lands', () => {
  assert.equal(markOf({ title: 'DJ' }), 'music');
  assert.equal(markOf({ title: 'Save the date' }), 'invite');
});

test('a word glued to a preposition is the same word', () => {
  /* Hebrew puts the preposition on the front, so the list has to read
     "לצלם" and "הצלם" as the photographer it would read "צלם" as. */
  for (const t of ['צלם', 'הצלם', 'לצלם', 'לסגור צלם']) {
    assert.equal(markOf({ title: t }), 'photo', t);
  }
});

test('and a word that merely contains another is not that other', () => {
  /* Both of these were live for one run of the tests. "לדבר" carries the
     letters of the bar and "ילדים" carries the letters of the lighting, and
     a plain substring search called them both. */
  assert.equal(markOf({ title: 'לדבר עם דודה' }), 'task');
  assert.equal(markOf({ title: 'רשימת ילדים' }), 'guests');
  assert.equal(markOf({ title: 'מורכב מדי' }), 'task');
  assert.equal(markOf({ title: 'לקנות מתנה לאמא' }), 'gift');
});

test('every category a task can carry has a mark', () => {
  /* The map was first written from the supplier directory's vocabulary,
     which is a different list that shares two words with this one. Every
     real task would have fallen through to the title words and most would
     have landed anyway, which is exactly how that kind of mistake survives
     a look at the screen. This walks the list tasks are actually tagged
     from. */
  for (const category of VENDOR_CATEGORIES) {
    assert.notEqual(markOf({ category, title: '' }), 'task', category);
  }
});

test('a geresh or a maqaf does not change the word', () => {
  for (const t of ['דיג׳יי', "דיג'יי", 'די־ג׳יי', 'סגירת דיג׳יי']) {
    assert.equal(markOf({ title: t }), 'music', t);
  }
});
