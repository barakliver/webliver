import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byRelevance, matchesWords, splitQuery, type JumpEvent } from '../jump.ts';

/**
 * The two decisions the quick search makes before it draws anything.
 *
 * Both of them were wrong on real data and right on a demo, which is the
 * reason they are checked here: an ordering only misbehaves once there are
 * finished events in the table, and the section split only misbehaves once
 * somebody is called something that is also the name of a tab.
 */

const SECTIONS = [
  { tab: 'overview', label: 'סקירה' },
  { tab: 'tasks', label: 'משימות' },
  { tab: 'money', label: 'כסף' },
  { tab: 'docs', label: 'מסמכים' },
  { tab: 'guests', label: 'אורחים' },
] as const;

/* A Tuesday, so nothing in the fixtures lands on a boundary by accident. */
const NOW = new Date('2026-09-08T10:00:00Z').getTime();

const events: JumpEvent[] = [
  { id: 'past-old', name: 'שירה ואורי', date: '2025-04-11' },
  { id: 'past-recent', name: 'הילה ויונתן', date: '2026-08-30' },
  { id: 'soon', name: 'נועה ואיתי', date: '2026-09-19' },
  { id: 'later', name: 'תמר ואסף', date: '2026-11-02' },
  { id: 'undated', name: 'כנס לקוחות', date: null },
];

test('the palette opens on what is coming, not on what is finished', () => {
  const order = byRelevance(events, NOW).map((e) => e.id);
  assert.deepEqual(order, ['soon', 'later', 'undated', 'past-recent', 'past-old']);
});

test('an event today is still upcoming', () => {
  const today: JumpEvent[] = [{ id: 'today', name: 'היום', date: '2026-09-08' }, ...events];
  assert.equal(byRelevance(today, NOW)[0].id, 'today');
});

test('the finished ones run backwards, last week before last year', () => {
  const past = byRelevance(events, NOW).filter((e) => e.id.startsWith('past'));
  assert.deepEqual(past.map((e) => e.id), ['past-recent', 'past-old']);
});

test('ordering does not disturb the list it was given', () => {
  const before = events.map((e) => e.id);
  byRelevance(events, NOW);
  assert.deepEqual(events.map((e) => e.id), before);
});

test('words match in any order and on part of a name', () => {
  assert.equal(matchesWords(['נועה', 'אית'], 'נועה ואיתי'), true);
  assert.equal(matchesWords(['איתי', 'נועה'], 'נועה ואיתי'), true);
  assert.equal(matchesWords(['נועה', 'דנה'], 'נועה ואיתי'), false);
});

test('a name and a section split into a name and a section', () => {
  const { nameWords, section } = splitQuery('נועה כסף', events, SECTIONS);
  assert.deepEqual(nameWords, ['נועה']);
  assert.equal(section, 'money');
});

test('the section may be typed first', () => {
  const { nameWords, section } = splitQuery('כסף נועה', events, SECTIONS);
  assert.deepEqual(nameWords, ['נועה']);
  assert.equal(section, 'money');
});

test('a bare section word is a section with nobody named', () => {
  const { nameWords, section } = splitQuery('משימות', events, SECTIONS);
  assert.deepEqual(nameWords, []);
  assert.equal(section, 'tasks');
});

test('a couple whose name is also a tab keeps their name', () => {
  /* The failure this exists for: the search finds nobody and looks broken,
     because the words went to the documents tab instead of to them. */
  const withNamesake: JumpEvent[] = [...events, { id: 'ns', name: 'מסמכים בע"מ', date: '2026-10-01' }];
  const { nameWords, section } = splitQuery('מסמכים', withNamesake, SECTIONS);
  assert.deepEqual(nameWords, ['מסמכים']);
  assert.equal(section, null);
});

test('one letter is never a section', () => {
  const { nameWords, section } = splitQuery('כ', events, SECTIONS);
  assert.equal(section, null);
  assert.deepEqual(nameWords, ['כ']);
});

test('only the first section word counts, the rest stay a name', () => {
  const { nameWords, section } = splitQuery('כסף אורחים', events, SECTIONS);
  assert.equal(section, 'money');
  assert.deepEqual(nameWords, ['אורחים']);
});

test('an empty box asks for nothing', () => {
  const { words, nameWords, section } = splitQuery('   ', events, SECTIONS);
  assert.deepEqual(words, []);
  assert.deepEqual(nameWords, []);
  assert.equal(section, null);
});
