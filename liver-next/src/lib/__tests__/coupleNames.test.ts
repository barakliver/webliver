import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coupleNames } from '../coupleNames.ts';

test('two Hebrew names joined by the attached conjunction', () => {
  assert.deepEqual(coupleNames('נועה ואיתי'), ['נועה', 'איתי']);
  assert.deepEqual(coupleNames('  שיר   ודניאל '), ['שיר', 'דניאל']);
});

test('full names on both sides are kept whole', () => {
  assert.deepEqual(coupleNames('נועה כהן ואיתי לוי'), ['נועה כהן', 'איתי לוי']);
});

test('a conjunction written as its own word, in either language', () => {
  assert.deepEqual(coupleNames('Noa & Itay'), ['Noa', 'Itay']);
  assert.deepEqual(coupleNames('Noa and Itay'), ['Noa', 'Itay']);
  assert.deepEqual(coupleNames('נועה + איתי'), ['נועה', 'איתי']);
  assert.deepEqual(coupleNames('נועה ו איתי'), ['נועה', 'איתי']);
});

test('a name that starts with vav is not split when it comes first', () => {
  assert.deepEqual(coupleNames('ורד ואורי'), ['ורד', 'אורי']);
});

test('anything that is not clearly two names gives none', () => {
  assert.deepEqual(coupleNames('משפחת לוי'), []);
  assert.deepEqual(coupleNames('ערב חברה'), []);
  assert.deepEqual(coupleNames(''), []);
  assert.deepEqual(coupleNames('נועה'), []);
});
