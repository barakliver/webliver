import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  crewNeeds, crewState, expectedGuests, candidatesFor, BIG_EVENING, isSlot,
} from '../crewNeeds.ts';

const need = (guests: number | null, slot: string) =>
  crewNeeds(guests).needs.find((n) => n.slot === slot)!.need;

/* The rule itself, at the two sides of the line and exactly on it. 350 is
   "up to 350", so it is still one assistant. Off by one here is a person
   short on the night. */
test('up to 350 guests is a manager and one assistant', () => {
  assert.equal(need(120, 'manager'), 1);
  assert.equal(need(120, 'assistant'), 1);
  assert.equal(need(350, 'assistant'), 1);
});

test('above 350 the assistant becomes two, and never a second manager', () => {
  assert.equal(need(351, 'assistant'), 2);
  assert.equal(need(800, 'assistant'), 2);
  assert.equal(need(800, 'manager'), 1);
  assert.equal(BIG_EVENING, 350);
});

test('social is offered at every size and required at none', () => {
  for (const g of [80, 350, 351, 900, null]) {
    const s = crewNeeds(g).needs.find((n) => n.slot === 'social')!;
    assert.equal(s.need, 0);
    assert.equal(s.optional, true);
  }
});

/* A wedding with no number on it yet still needs the two people every
   wedding needs. Saying "unknown" where the answer is "at least these" makes
   the producer do the arithmetic the rule exists to do for him. */
test('an evening with no guest count still asks for the pair, and says it is unsure', () => {
  const r = crewNeeds(null);
  assert.equal(r.certain, false);
  assert.equal(need(null, 'manager'), 1);
  assert.equal(need(null, 'assistant'), 1);
  assert.equal(crewNeeds(400).certain, true);
});

/* The estimate and the list disagree all year. Staff against the larger of
   them: one assistant too many costs a fee, one too few costs the evening. */
test('the number staffed against is the larger of the estimate and the list', () => {
  assert.equal(expectedGuests({ estimate: 300, invited: 340 }), 340);
  assert.equal(expectedGuests({ estimate: 400, invited: 120 }), 400);
  assert.equal(expectedGuests({ estimate: 250, invited: null }), 250);
  assert.equal(expectedGuests({ estimate: null, invited: 380 }), 380);
});

test('no number anywhere is no number, not zero', () => {
  assert.equal(expectedGuests({}), null);
  assert.equal(expectedGuests({ estimate: null, invited: null }), null);
  assert.equal(expectedGuests({ estimate: 0, invited: 0 }), null);
  assert.equal(expectedGuests({ estimate: Number.NaN, invited: undefined }), null);
});

test('the state of one evening is the rule minus who is on it', () => {
  const s = crewState(200, [{ slot: 'manager' }, { slot: 'social' }]);
  const by = (k: string) => s.slots.find((x) => x.slot === k)!;
  assert.equal(by('manager').short, 0);
  assert.equal(by('assistant').short, 1);
  assert.equal(by('social').short, 0);
  assert.equal(s.short, 1);
});

test('a big evening with one assistant is one short, not none', () => {
  const s = crewState(500, [{ slot: 'manager' }, { slot: 'assistant' }]);
  assert.equal(s.short, 1);
});

/* Three assistants on a small evening is a decision somebody made, and the
   screen has no business calling it a fault or counting it as credit
   against another role. */
test('more people than the rule asks for is never a negative shortfall', () => {
  const s = crewState(200, [
    { slot: 'assistant' }, { slot: 'assistant' }, { slot: 'assistant' },
  ]);
  assert.equal(s.slots.find((x) => x.slot === 'assistant')!.short, 0);
  assert.equal(s.short, 1); // still no manager
});

test('somebody on the evening with no role does not fill one', () => {
  const s = crewState(200, [{ slot: null }, { slot: undefined }, { slot: 'driver' }]);
  assert.equal(s.short, 2);
});

/* The list is who usually does what. Two days out, "usually" stops being the
   question, so nobody is hidden — they are only sorted. */
test('people who do the job come first, and nobody is left off the list', () => {
  const people = [
    { name: 'דנה', roles: [] as string[] },
    { name: 'טל', roles: ['manager', 'social'] },
    { name: 'אבי', roles: ['manager'] },
  ];
  const out = candidatesFor(people, 'manager');
  assert.deepEqual(out.map((p) => p.name), ['אבי', 'טל', 'דנה']);
  assert.equal(out.length, 3);
});

test('a person with no roles at all is sorted, not dropped', () => {
  const out = candidatesFor([{ name: 'דנה' }], 'social');
  assert.deepEqual(out.map((p) => p.name), ['דנה']);
});

test('the three roles are the three the rule counts', () => {
  assert.equal(isSlot('manager'), true);
  assert.equal(isSlot('assistant'), true);
  assert.equal(isSlot('social'), true);
  assert.equal(isSlot('photographer'), false);
  assert.equal(isSlot(null), false);
});
