import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, toGoogleEvent, fromGoogleEvent, plan, interpret, addMinutes, type SyncItem, type Link } from '../gsync.ts';

const wedding: SyncItem = { kind: 'event', id: 'c1', title: 'נועה ואיתי', date: '2026-12-05', time: '', durationMin: 0, detail: 'אחוזת הכפר', href: '/app/clients/c1' };
const meeting: SyncItem = { kind: 'entry', id: 'e1', title: 'פגישה עם הפרחים', date: '2026-10-02', time: '10:00', durationMin: 90, detail: 'נועה ואיתי', href: '' };

test('an all-day item becomes an all-day event ending the day after, as Google counts', () => {
  const ev = toGoogleEvent(wedding, 'Asia/Jerusalem', 'https://x.test');
  assert.deepEqual(ev.start, { date: '2026-12-05' });
  assert.deepEqual(ev.end, { date: '2026-12-06' });
  assert.equal(ev.summary, '💍 נועה ואיתי');
  assert.ok(String(ev.description).includes('https://x.test/app/clients/c1'));
});

test('a timed entry carries the zone by name and its length', () => {
  const ev = toGoogleEvent(meeting, 'Asia/Jerusalem', 'https://x.test');
  assert.deepEqual(ev.start, { dateTime: '2026-10-02T10:00:00', timeZone: 'Asia/Jerusalem' });
  assert.deepEqual(ev.end, { dateTime: '2026-10-02T11:30:00', timeZone: 'Asia/Jerusalem' });
  assert.equal(ev.summary, 'פגישה עם הפרחים');
});

test('a meeting that crosses midnight ends on the next day', () => {
  assert.deepEqual(addMinutes('2026-10-02', '23:30', 60), ['2026-10-03', '00:30']);
});

test('the prefix comes off on the way back, and the link we wrote is not a note', () => {
  const r = fromGoogleEvent({ id: 'g1', summary: '☐ לסגור צלם', start: { date: '2026-08-15' }, end: { date: '2026-08-16' }, description: 'נועה ואיתי\nhttps://x.test/app/clients/c1' });
  assert.equal(r.title, 'לסגור צלם');
  assert.equal(r.date, '2026-08-15');
  assert.equal(r.time, '');
  assert.equal(r.note, 'נועה ואיתי');
  assert.equal(r.cancelled, false);
});

test('a timed event read back keeps its wall clock and its length', () => {
  const r = fromGoogleEvent({ id: 'g2', summary: 'ביקור באולם', start: { dateTime: '2026-10-02T10:00:00+03:00' }, end: { dateTime: '2026-10-02T11:30:00+03:00' } });
  assert.equal(r.date, '2026-10-02');
  assert.equal(r.time, '10:00');
  assert.equal(r.durationMin, 90);
});

test('the push plan creates what has no twin, updates what changed, removes what is gone', () => {
  const links: Link[] = [
    { kind: 'event', item_id: 'c1', google_event_id: 'g1', fingerprint: fingerprint(wedding) },
    { kind: 'task', item_id: 't9', google_event_id: 'g9', fingerprint: 'old' },
  ];
  const moved = { ...wedding, date: '2026-12-12' };
  const p = plan([moved, meeting], links);
  assert.deepEqual(p.create.map((i) => i.id), ['e1']);
  assert.deepEqual(p.update.map((u) => u.eventId), ['g1']);
  assert.deepEqual(p.remove.map((l) => l.google_event_id), ['g9']);
});

test('an unchanged item is not written again', () => {
  const links: Link[] = [{ kind: 'event', item_id: 'c1', google_event_id: 'g1', fingerprint: fingerprint(wedding) }];
  const p = plan([wedding], links);
  assert.equal(p.create.length + p.update.length + p.remove.length, 0);
});

test('a stranger on our calendar becomes an entry; a cancelled stranger is nothing', () => {
  const none = () => null;
  const a = interpret({ id: 'g5', summary: 'ארוחה עם ספק', start: { date: '2026-09-20' }, end: { date: '2026-09-21' } }, none, () => null);
  assert.equal(a.action, 'entry-upsert');
  const b = interpret({ id: 'g6', status: 'cancelled' }, none, () => null);
  assert.equal(b.action, 'ignore');
});

test('a wedding moved on the phone moves here; cancelled on the phone only lets go', () => {
  const link: Link = { kind: 'event', item_id: 'c1', google_event_id: 'g1', fingerprint: '' };
  const linkOf = (id: string) => (id === 'g1' ? link : null);
  const moved = interpret({ id: 'g1', summary: '💍 נועה ואיתי', start: { date: '2026-12-12' }, end: { date: '2026-12-13' } }, linkOf, () => '2026-12-05');
  assert.deepEqual(moved, { action: 'move', kind: 'event', itemId: 'c1', date: '2026-12-12', eventId: 'g1' });
  const same = interpret({ id: 'g1', summary: 'renamed', start: { date: '2026-12-05' }, end: { date: '2026-12-06' } }, linkOf, () => '2026-12-05');
  assert.equal(same.action, 'ignore');
  const gone = interpret({ id: 'g1', status: 'cancelled' }, linkOf, () => '2026-12-05');
  assert.equal(gone.action, 'unlink');
});

test('an entry edited on the phone is written back whole, and deleted there is deleted here', () => {
  const link: Link = { kind: 'entry', item_id: 'e1', google_event_id: 'g2', fingerprint: '' };
  const linkOf = () => link;
  const up = interpret({ id: 'g2', summary: 'פגישה עם הפרחים', start: { dateTime: '2026-10-03T11:00:00+03:00' }, end: { dateTime: '2026-10-03T12:00:00+03:00' }, description: 'להביא דוגמאות' }, linkOf, () => '2026-10-02');
  assert.equal(up.action, 'entry-upsert');
  if (up.action === 'entry-upsert') {
    assert.equal(up.entryId, 'e1');
    assert.equal(up.date, '2026-10-03');
    assert.equal(up.time, '11:00');
    assert.equal(up.note, 'להביא דוגמאות');
  }
  const del = interpret({ id: 'g2', status: 'cancelled' }, linkOf, () => '2026-10-02');
  assert.deepEqual(del, { action: 'entry-delete', entryId: 'e1', eventId: 'g2' });
});
