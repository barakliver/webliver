import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capTurns, withAnswer, type Turn } from '../chat.ts';

const user = (content: string): Turn => ({ role: 'user', content });
const bot = (content: string): Turn => ({ role: 'assistant', content });

test('a short conversation is left alone', () => {
  const turns = [user('שלום'), bot('היי')];
  assert.deepEqual(capTurns(turns, 20), turns);
});

test('a long conversation keeps the end, not the beginning', () => {
  /* The recent turns are the ones the next answer depends on. Keeping the
     first twenty of a forty turn conversation would send the assistant a
     conversation that stopped halfway through. */
  const turns = Array.from({ length: 30 }, (_, i) => user(`שאלה ${i}`));
  const kept = capTurns(turns, 5);
  assert.equal(kept.length, 5);
  assert.equal(kept[0].content, 'שאלה 25');
  assert.equal(kept[4].content, 'שאלה 29');
});

test('capping does not mutate what it was given', () => {
  const turns = [user('א'), user('ב'), user('ג')];
  capTurns(turns, 1);
  assert.equal(turns.length, 3);
});

test('the first words open a bubble', () => {
  const turns = [user('כמה אישרו?')];
  const next = withAnswer(turns, 'מאה');
  assert.equal(next.length, 2);
  assert.deepEqual(next[1], bot('מאה'));
});

test('every later piece replaces that bubble rather than adding one', () => {
  /* The failure this exists to prevent: an answer arriving in eight pieces
     becoming eight bubbles, each one a word longer than the last. */
  let turns: Turn[] = [user('כמה אישרו?')];
  for (const sofar of ['מאה', 'מאה וארבעים', 'מאה וארבעים ושניים']) {
    turns = withAnswer(turns, sofar);
  }
  assert.equal(turns.length, 2);
  assert.equal(turns[1].content, 'מאה וארבעים ושניים');
});

test('an answer after an answer is still one bubble, and the user is untouched', () => {
  const turns = withAnswer(withAnswer([user('א'), bot('ב')], 'ג'), 'ד');
  assert.deepEqual(turns, [user('א'), bot('ד')]);
});

test('an answer to nothing still says something', () => {
  /* A route can answer before anything was asked — a greeting, or a refusal
     written by the server. It should not throw on an empty conversation. */
  assert.deepEqual(withAnswer([], 'שלום'), [bot('שלום')]);
});

test('appending does not mutate what it was given', () => {
  const turns = [user('א')];
  withAnswer(turns, 'ב');
  assert.equal(turns.length, 1);
});
