import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTime } from '../timeField.ts';

test('the shapes people type all become HH:MM', () => {
  assert.equal(normalizeTime('19:30'), '19:30');
  assert.equal(normalizeTime('7:30'), '07:30');
  assert.equal(normalizeTime('1930'), '19:30');
  assert.equal(normalizeTime('730'), '07:30');
  assert.equal(normalizeTime('19.30'), '19:30');
  assert.equal(normalizeTime('19:30:00'), '19:30');
  assert.equal(normalizeTime('  01:05 '), '01:05');
});

test('what is not a time is null, not a guess', () => {
  assert.equal(normalizeTime(''), null);
  assert.equal(normalizeTime('25:00'), null);
  assert.equal(normalizeTime('19:60'), null);
  assert.equal(normalizeTime('abc'), null);
  assert.equal(normalizeTime('19'), null);
});
