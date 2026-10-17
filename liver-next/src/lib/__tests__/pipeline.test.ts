import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byStage, filterLeads, isUnanswered, pipelineStats, sourcesOf, ago, PIPELINE, type BoardLead } from '../pipeline.ts';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * 3_600_000).toISOString();

const lead = (p: Partial<BoardLead> & { id: string }): BoardLead => ({
  full_name: p.id, phone: '', email: '', event_date: null, guest_count: null,
  source: 'site', status: 'new', created_at: at(1), ...p,
});

test('unanswered is a new card past two hours with no first response', () => {
  assert.equal(isUnanswered(lead({ id: 'a', created_at: at(1) }), NOW), false);
  assert.equal(isUnanswered(lead({ id: 'b', created_at: at(3) }), NOW), true);
  assert.equal(isUnanswered(lead({ id: 'c', created_at: at(3), first_response_at: at(2) }), NOW), false);
  assert.equal(isUnanswered(lead({ id: 'd', created_at: at(30), status: 'contacted' }), NOW), false);
});

test('every card lands in one column and an unknown status lands in new', () => {
  const cols = byStage([
    lead({ id: 'a', status: 'new' }), lead({ id: 'b', status: 'nurture' }),
    lead({ id: 'c', status: 'something_old' }), lead({ id: 'd', status: 'proposal_sent' }),
  ]);
  assert.deepEqual(Object.keys(cols), [...PIPELINE]);
  assert.deepEqual(cols.new.map((l) => l.id), ['a', 'c']);
  assert.deepEqual(cols.nurture.map((l) => l.id), ['b']);
  assert.deepEqual(cols.proposal_sent.map((l) => l.id), ['d']);
});

test('inside a column the newest is first', () => {
  const cols = byStage([lead({ id: 'old', created_at: at(50) }), lead({ id: 'fresh', created_at: at(1) })]);
  assert.deepEqual(cols.new.map((l) => l.id), ['fresh', 'old']);
});

test('filters stack', () => {
  const rows = [
    lead({ id: 'a', source: 'whatsapp', score: 90, created_at: at(5) }),
    lead({ id: 'b', source: 'whatsapp', score: 30, created_at: at(5) }),
    lead({ id: 'c', source: 'site', score: 90, created_at: at(1) }),
  ];
  assert.deepEqual(filterLeads(rows, { source: 'whatsapp' }, NOW).map((l) => l.id), ['a', 'b']);
  assert.deepEqual(filterLeads(rows, { minScore: 80 }, NOW).map((l) => l.id), ['a', 'c']);
  assert.deepEqual(filterLeads(rows, { unanswered: true, minScore: 80 }, NOW).map((l) => l.id), ['a']);
});

test('the three figures: this week, to a meeting, and the median wait', () => {
  const rows = [
    lead({ id: '1', created_at: at(2), first_response_at: at(1) }),
    lead({ id: '2', created_at: at(30), status: 'meeting', first_response_at: at(28) }),
    lead({ id: '3', created_at: at(24 * 3), status: 'won', first_response_at: at(24 * 3 - 10) }),
    lead({ id: '4', created_at: at(24 * 10), status: 'lost' }),
    lead({ id: '5', created_at: at(24 * 12), status: 'lost', score: 0 }),
    lead({ id: '6', created_at: at(24 * 100), status: 'won' }),
    lead({ id: '7', created_at: at(24 * 20), status: 'contacted', first_response_at: at(24 * 20 - 2) }),
  ];
  const s = pipelineStats(rows, NOW);
  assert.equal(s.newThisWeek, 3);
  /* Six in ninety days, one of them spam and not counted: two of five. */
  assert.equal(s.toMeeting, 40);
  /* Waits of 1, 2, 2 and 10 hours: the median is 2. */
  assert.equal(s.responseHours, 2);
  assert.equal(s.unanswered, 0);
});

test('under five cards there is no percentage and under three answers no median', () => {
  const s = pipelineStats([lead({ id: 'a', status: 'won' }), lead({ id: 'b' })], NOW);
  assert.equal(s.toMeeting, null);
  assert.equal(s.responseHours, null);
});

test('sources come back most common first, and ago picks the unit', () => {
  assert.deepEqual(sourcesOf([lead({ id: 'a', source: 'site' }), lead({ id: 'b', source: 'whatsapp' }), lead({ id: 'c', source: 'whatsapp' })]), ['whatsapp', 'site']);
  assert.deepEqual(ago(at(0.5), NOW), { unit: 'minutes', n: 30 });
  assert.deepEqual(ago(at(5), NOW), { unit: 'hours', n: 5 });
  assert.deepEqual(ago(at(72), NOW), { unit: 'days', n: 3 });
});
