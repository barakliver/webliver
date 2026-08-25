import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeLines, focus, relative, callSheet, dueSoon, isToday, type Line, type Caller } from '../dayof.ts';

const at = (h: number, m = 0) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
/* A local clock, because the screen reads the phone's clock and not UTC. */
const clock = (h: number, m = 0) => new Date(2026, 7, 23, h, m, 0);

const evening: Line[] = [
  { id: 'a', at_time: at(17), title: 'הגעת צוות', duration_min: 60 },
  { id: 'b', at_time: at(18), title: 'קבלת פנים', duration_min: 90 },
  { id: 'c', at_time: at(19, 30), title: 'חופה', duration_min: 30 },
  { id: 'd', at_time: at(20), title: 'ריקודים', duration_min: 240 },
  { id: 'e', at_time: at(1), title: 'פירוק' },
];

const byId = (placed: ReturnType<typeof placeLines>) =>
  Object.fromEntries(placed.map((p) => [p.line.id, p.state]));

test('the schedule is read in event order, so the pack-down is last', () => {
  const placed = placeLines(evening, clock(19), true);
  assert.deepEqual(placed.map((p) => p.line.id), ['a', 'b', 'c', 'd', 'e']);
});

test('one line is happening and the rest know where they stand', () => {
  const s = byId(placeLines(evening, clock(19, 45), true));
  assert.equal(s.a, 'late');   /* ended 18:00, never ticked */
  assert.equal(s.b, 'late');   /* ended 19:30 */
  assert.equal(s.c, 'now');    /* 19:30 to 20:00 */
  assert.equal(s.d, 'soon');   /* starts in 15 minutes */
  assert.equal(s.e, 'later');
});

test('a ticked line is finished whatever the clock says', () => {
  const ticked = evening.map((l) => (l.id === 'a' ? { ...l, done_at: '2026-08-23T14:05:00Z' } : l));
  const s = byId(placeLines(ticked, clock(19, 45), true));
  assert.equal(s.a, 'done');
});

test('opening the screen three weeks early does not report the whole wedding as overdue', () => {
  /* The failure this guards against is a producer opening the evening view on
     a Tuesday and seeing forty red lines. */
  const s = byId(placeLines(evening, clock(11), false));
  assert.deepEqual(Object.values(s), ['later', 'later', 'later', 'later', 'later']);
  assert.deepEqual(placeLines(evening, clock(11), false).map((p) => p.inMinutes), [null, null, null, null, null]);
});

test('a tick survives the screen being opened on the wrong day', () => {
  const ticked = evening.map((l) => (l.id === 'b' ? { ...l, done_at: '2026-08-23T15:00:00Z' } : l));
  assert.equal(byId(placeLines(ticked, clock(11), false)).b, 'done');
});

test('after midnight the small hours are still tonight', () => {
  /* 00:30 on a schedule that also runs in the evening is later than 23:00,
     and the clock has to agree or the last hour of every wedding inverts. */
  const s = byId(placeLines(evening, clock(1, 10), true));
  assert.equal(s.d, 'late');   /* 20:00 + 4h ended at midnight */
  assert.equal(s.e, 'now');    /* the pack-down, with no end of its own */
});

test('the last line of the night has no end and never goes late', () => {
  const s = byId(placeLines(evening, clock(4), true));
  assert.equal(s.e, 'now');
});

test('a morning event is not dragged past midnight by the rule for evenings', () => {
  const morning: Line[] = [
    { id: 'x', at_time: at(5), title: 'הכנות', duration_min: 60 },
    { id: 'y', at_time: at(8), title: 'טקס', duration_min: 60 },
  ];
  const s = byId(placeLines(morning, clock(5, 30), true));
  assert.equal(s.x, 'now');
  assert.equal(s.y, 'later');
});

test('now and next are what the evening is run from, and both may be missing', () => {
  const mid = focus(placeLines(evening, clock(19, 45), true));
  assert.equal(mid.now?.line.id, 'c');
  assert.equal(mid.next?.line.id, 'd');

  const before = focus(placeLines(evening, clock(9), true));
  assert.equal(before.now, null);
  assert.equal(before.next?.line.id, 'a');

  /* Once the last line has an end and that end has passed, there is nothing
     to point at. Given a length, the pack-down finishes at 02:00 and 03:00 is
     after the evening rather than fourteen hours before it. */
  const finished = evening.map((l) => (l.id === 'e' ? { ...l, duration_min: 60 } : l));
  const after = focus(placeLines(finished, clock(3), true));
  assert.equal(after.now, null);
  assert.equal(after.next, null);
});

test('a line with no stated length borrows the gap to the next one', () => {
  const loose: Line[] = [
    { id: 'a', at_time: at(18), title: 'א' },
    { id: 'b', at_time: at(19), title: 'ב', duration_min: 30 },
  ];
  assert.equal(byId(placeLines(loose, clock(18, 30), true)).a, 'now');
  assert.equal(byId(placeLines(loose, clock(19, 5), true)).a, 'late');
});

test('time is said the way somebody says it out loud', () => {
  assert.equal(relative(0), 'עכשיו');
  assert.equal(relative(20), 'בעוד 20 דק׳');
  assert.equal(relative(90), 'בעוד שעה');
  assert.equal(relative(150), 'בעוד 2 שעות');
  assert.equal(relative(-45), 'לפני 45 דק׳');
});

const crew: Caller[] = [
  { id: 'c1', name: 'דנה', role: 'הפקה', phone: '0501111111', call_time: at(16), kind: 'crew' },
  { id: 'c2', name: 'אורי', role: 'סטיילינג', phone: '', call_time: null, kind: 'crew' },
];
const vendors: Caller[] = [
  { id: 'v1', name: 'תאורה', role: 'תאורה', phone: '0502222222', call_time: at(15, 30), kind: 'vendor' },
  { id: 'v2', name: 'צלם', role: 'צילום', phone: '0503333333', call_time: at(17), kind: 'vendor' },
];

test('crew and suppliers are one list, because the question is one question', () => {
  const sheet = callSheet(crew, vendors);
  assert.deepEqual(sheet.map((c) => c.id), ['v1', 'c1', 'v2', 'c2']);
});

test('nobody said is not the same as first thing in the morning', () => {
  const sheet = callSheet(crew, vendors);
  assert.equal(sheet[sheet.length - 1].id, 'c2');
});

test('who should be walking in right now', () => {
  const sheet = callSheet(crew, vendors);
  /* The window is the point: at 15:45 the sound engineer due at 16:00 is the
     answer, and the photographer due at 17:00 is not yet anybody's problem. */
  assert.deepEqual(dueSoon(sheet, clock(15, 45), true).map((c) => c.id), ['c1']);
  assert.deepEqual(dueSoon(sheet, clock(15, 45), true, 120).map((c) => c.id), ['c1', 'v2']);
  /* and on any other day, nobody is due */
  assert.deepEqual(dueSoon(sheet, clock(15, 45), false), []);
});

test('a call time that has passed is not still due', () => {
  const sheet = callSheet(crew, vendors);
  assert.deepEqual(dueSoon(sheet, clock(16, 30), true).map((c) => c.id), ['v2']);
});

test('tonight is tonight, and a missing or broken date is not', () => {
  const now = new Date(2026, 7, 23, 19, 0, 0);
  assert.equal(isToday('2026-08-23', now), true);
  assert.equal(isToday('2026-08-24', now), false);
  assert.equal(isToday(null, now), false);
  assert.equal(isToday('rubbish', now), false);
});

/* ── the evening's own alarms ─────────────────────────────────────────────── */

import { pendingAlert, missing, headcount } from '../dayof.ts';

const marked: Line[] = [
  { id: 'a', at_time: at(18), title: 'קבלת פנים', duration_min: 90 },
  { id: 'b', at_time: at(19, 30), title: 'חופה', duration_min: 30, key_moment: true },
  { id: 'c', at_time: at(20, 30), title: 'ריקוד ראשון', duration_min: 10, key_moment: true },
];

test('only a marked moment gets a countdown', () => {
  /* Forty lines with an alert before each is an alert before none. */
  assert.equal(pendingAlert(placeLines(marked, clock(17, 55), true)), null);
  assert.equal(pendingAlert(placeLines(marked, clock(19, 25), true))?.line.id, 'b');
});

test('the window is ten minutes, not whenever', () => {
  assert.equal(pendingAlert(placeLines(marked, clock(19, 19), true)), null);
  assert.equal(pendingAlert(placeLines(marked, clock(19, 20), true))?.line.id, 'b');
});

test('two moments at once is one banner, the nearer one', () => {
  const tight: Line[] = [
    { id: 'x', at_time: at(20), title: 'א', duration_min: 5, key_moment: true },
    { id: 'y', at_time: at(20, 5), title: 'ב', duration_min: 5, key_moment: true },
  ];
  assert.equal(pendingAlert(placeLines(tight, clock(19, 58), true))?.line.id, 'x');
});

test('a moment already ticked is not counted down to', () => {
  const done = marked.map((l) => (l.id === 'b' ? { ...l, done_at: '2026-08-23T16:20:00Z' } : l));
  assert.equal(pendingAlert(placeLines(done, clock(19, 25), true)), null);
});

test('nothing alerts on a day that is not the day', () => {
  assert.equal(pendingAlert(placeLines(marked, clock(19, 25), false)), null);
});

const withArrivals: Caller[] = [
  { id: 'v1', name: 'תאורה', role: '', phone: '', call_time: at(15, 30), kind: 'vendor', arrived_at: '2026-08-23T12:31:00Z' },
  { id: 'c1', name: 'דנה', role: '', phone: '', call_time: at(16), kind: 'crew', arrived_at: null },
  { id: 'v2', name: 'צלם', role: '', phone: '', call_time: at(17), kind: 'vendor', arrived_at: null },
  { id: 'c2', name: 'אורי', role: '', phone: '', call_time: null, kind: 'crew', arrived_at: null },
];

test('missing means due and not here, not merely absent', () => {
  const late = missing(withArrivals, clock(16, 30), true);
  assert.deepEqual(late.map((c) => c.id), ['c1']);
  /* The photographer due at 17:00 is not late at 16:30, and the person with
     no call time was never told a time to be late for. */
});

test('somebody with no call time is never late', () => {
  assert.deepEqual(missing(withArrivals, clock(23), true).map((c) => c.id), ['c1', 'v2']);
});

test('nobody is late on a day that is not the day', () => {
  assert.deepEqual(missing(withArrivals, clock(23), false), []);
});

test('the headcount is here, of, and late', () => {
  assert.deepEqual(headcount(withArrivals, clock(16, 30), true), { here: 1, of: 4, late: 1 });
});
