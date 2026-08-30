import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readAnswer, writeSummary, completeness, cleanAnswers, readModelSummary, joinSummary,
} from '../meeting.ts';
import { meetingTemplate } from '../../../content/meetings.ts';

const production = meetingTemplate('production')!;

/**
 * The summary is a record somebody is paid against and a couple remembers
 * differently, so the two things worth testing are that it never invents and
 * that it never loses. Everything below is one of those two.
 */

test('a summary with no model is still a real summary', () => {
  const out = writeSummary(production, { guests_final: 240, chuppah_at: '19:30' });
  assert.match(out, /מספר אורחים מעודכן: 240/);
  assert.match(out, /שעת חופה: 19:30/);
});

test('a section nobody answered is left out rather than printed empty', () => {
  const out = writeSummary(production, { guests_final: 240 });
  assert.match(out, /המסגרת/);
  assert.doesNotMatch(out, /רגישויות/);
  assert.doesNotMatch(out, /כסף/);
});

test('nothing answered means nothing written, not a page of headings', () => {
  assert.equal(writeSummary(production, {}), '');
});

test('yes and no are read as words, not as English booleans', () => {
  assert.equal(readAnswer(true), 'כן');
  assert.equal(readAnswer(false), 'לא');
  assert.equal(readAnswer(null), '');
  assert.equal(readAnswer(undefined), '');
});

test('an answer under a key the template does not define never lands', () => {
  const out = cleanAnswers('production', {
    guests_final: 240,
    '"; drop table meeting_logs; --': 'x',
    unknown_field: 'x',
  });
  assert.deepEqual(Object.keys(out), ['guests_final']);
});

test('a number nobody could have meant is dropped rather than stored', () => {
  assert.deepEqual(cleanAnswers('production', { guests_final: 9_000_000 }), {});
  assert.deepEqual(cleanAnswers('production', { guests_final: -5 }), {});
  assert.deepEqual(cleanAnswers('production', { guests_final: '240' }), { guests_final: 240 });
});

test('a choice outside the list is refused', () => {
  assert.deepEqual(cleanAnswers('tasting', { kosher: 'מהדרין' }), { kosher: 'מהדרין' });
  assert.deepEqual(cleanAnswers('tasting', { kosher: 'משהו אחר' }), {});
});

test('a long answer is capped rather than refused', () => {
  const out = cleanAnswers('production', { speeches: 'א'.repeat(9000) });
  assert.equal(String(out.speeches).length, 4000);
});

test('an unknown meeting kind yields nothing at all', () => {
  assert.deepEqual(cleanAnswers('not-a-meeting', { guests_final: 240 }), {});
});

test('how much was answered is counted, not guessed', () => {
  const { filled, total } = completeness(production, { guests_final: 240, chuppah_at: '19:30' });
  assert.equal(filled, 2);
  assert.ok(total > 10, String(total));
});

test('a model that said almost nothing is not treated as a summary', () => {
  assert.equal(readModelSummary('אין מידע'), '');
  assert.equal(readModelSummary(''), '');
  assert.equal(readModelSummary(null), '');
  assert.equal(readModelSummary(42), '');
});

test('the record survives even when the prose does not', () => {
  const record = writeSummary(production, { guests_final: 240 });
  assert.equal(joinSummary('', record), record);
  assert.match(joinSummary('פסקה שנכתבה על ידי מודל.', record), /240/);
});
