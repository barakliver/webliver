import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dealDeck, seedFrom, progressOf } from '../game.ts';
import { CARDS, type Card } from '../../content/cards.ts';

/* The bug this file exists for. A rule card talks about the card beside it —
   "הקלף הבא", "הקלף הקודם" — so a deal that puts two of them together, or
   puts one at an end, hands the couple an instruction pointing at nothing.
   A straight shuffle does that in about one game in twelve, which is often
   enough to be somebody's first impression. Every seed, not one. */
test('a rule card is never first, never last, and never beside another', () => {
  for (let i = 0; i < 400; i++) {
    const deck = dealDeck(`token-${i}`);
    assert.equal(deck.length, CARDS.length, 'every card is dealt');
    assert.notEqual(deck[0].kind, 'rule', `seed ${i}: rule card dealt first`);
    assert.notEqual(deck[deck.length - 1].kind, 'rule', `seed ${i}: rule card dealt last`);
    for (let j = 1; j < deck.length; j++) {
      assert.ok(
        !(deck[j].kind === 'rule' && deck[j - 1].kind === 'rule'),
        `seed ${i}: two rule cards at ${j - 1} and ${j}`,
      );
    }
  }
});

test('every card is dealt exactly once', () => {
  const deck = dealDeck('abc123');
  const ids = deck.map((c) => c.id).sort((a, b) => a - b);
  assert.deepEqual(ids, CARDS.map((c) => c.id).sort((a, b) => a - b));
});

/* Both partners read the same token, so both get the same deck. This is what
   makes "answer the next card as your partner" mean anything at all. */
test('one token always deals the same order', () => {
  const a = dealDeck('9f2c').map((c) => c.id);
  const b = dealDeck('9f2c').map((c) => c.id);
  assert.deepEqual(a, b);
});

test('two weddings do not share an order', () => {
  const a = dealDeck('9f2c').map((c) => c.id);
  const b = dealDeck('9f2d').map((c) => c.id);
  assert.notDeepEqual(a, b);
});

/* The placement rule has to hold on a deck barely big enough to hold it,
   which is the shape the 74-card deck can never show us. */
test('a deck with only just enough room still places the rules legally', () => {
  const tiny: Card[] = [
    { id: 1, kind: 'question', q: 'a' },
    { id: 2, kind: 'question', q: 'b' },
    { id: 3, kind: 'question', q: 'c' },
    { id: 4, kind: 'question', q: 'd' },
    { id: 5, kind: 'rule', title: 'r1', body: '' },
    { id: 6, kind: 'rule', title: 'r2', body: '' },
  ];
  for (let i = 0; i < 200; i++) {
    const deck = dealDeck(`t${i}`, tiny);
    assert.equal(deck.length, 6);
    assert.notEqual(deck[0].kind, 'rule');
    assert.notEqual(deck[5].kind, 'rule');
    for (let j = 1; j < deck.length; j++) {
      assert.ok(!(deck[j].kind === 'rule' && deck[j - 1].kind === 'rule'));
    }
  }
});

/* A deck that cannot hold the rule apart still returns every card rather than
   looping forever looking for a position that does not exist. */
test('a deck too small to place a rule still deals every card', () => {
  const two: Card[] = [
    { id: 1, kind: 'question', q: 'a' },
    { id: 2, kind: 'rule', title: 'r', body: '' },
  ];
  const deck = dealDeck('x', two);
  assert.deepEqual(deck.map((c) => c.id).sort(), [1, 2]);
});

test('the same token always hashes to the same seed', () => {
  assert.equal(seedFrom('hello'), seedFrom('hello'));
  assert.notEqual(seedFrom('hello'), seedFrom('hellp'));
});

test('progress never runs past the end', () => {
  assert.equal(progressOf(0, 74), 0);
  assert.equal(progressOf(74, 74), 100);
  assert.equal(progressOf(99, 74), 100);
  assert.equal(progressOf(3, 0), 0);
});
