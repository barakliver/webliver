import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookSections } from '../bookSections.ts';

const base = {
  moments: 7, vendors: { total: 6, booked: 6 }, guests: { invited: 420, pending: 0 },
  crew: 4, payments: { total: 3, unpaid: 0 }, tasks: { total: 12, open: 0 },
};
const state = (o: Parameters<typeof bookSections>[0], key: string) => bookSections(o).find((s) => s.key === key)?.state;

test('everything there reads full', () => {
  assert.ok(bookSections(base).every((s) => s.state === 'full'));
});

test('a section with nothing in it is empty, not left off', () => {
  const r = bookSections({ ...base, moments: 0, crew: 0 });
  assert.equal(r.length, 6);
  assert.equal(state({ ...base, moments: 0 }, 'order'), 'empty');
  assert.equal(state({ ...base, crew: 0 }, 'crew'), 'empty');
});

test('an unsigned supplier, an unanswered invitation and an unpaid instalment make a section partial', () => {
  assert.equal(state({ ...base, vendors: { total: 6, booked: 4 } }, 'suppliers'), 'partial');
  assert.equal(state({ ...base, guests: { invited: 420, pending: 30 } }, 'guests'), 'partial');
  assert.equal(state({ ...base, payments: { total: 3, unpaid: 1 } }, 'money'), 'partial');
});

test('tasks are full when nothing is open, partial when something is, empty when there are none', () => {
  assert.equal(state({ ...base, tasks: { total: 12, open: 0 } }, 'open'), 'full');
  assert.equal(state({ ...base, tasks: { total: 12, open: 3 } }, 'open'), 'partial');
  assert.equal(state({ ...base, tasks: { total: 0, open: 0 } }, 'open'), 'empty');
});

test('the counts carried are the ones to draw', () => {
  const r = bookSections({ ...base, tasks: { total: 12, open: 3 } });
  assert.equal(r.find((s) => s.key === 'open')?.n, 3);
  assert.equal(r.find((s) => s.key === 'guests')?.n, 420);
});
