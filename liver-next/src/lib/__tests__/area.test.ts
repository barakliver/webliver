import test from 'node:test';
import assert from 'node:assert/strict';
import { areaOf } from '../area.ts';

test('a screen is the area its first segment under /app names', () => {
  assert.equal(areaOf('/app/leads'), 'leads');
  assert.equal(areaOf('/app/leads/abc'), 'leads');
  assert.equal(areaOf('/app/calendar?day=2026-10-17'), 'calendar');
  assert.equal(areaOf('/app/insights'), 'insights');
});

test('screens that are one thing to the person share one area', () => {
  assert.equal(areaOf('/app/crew'), areaOf('/app/shifts/123'));
  assert.equal(areaOf('/app/brand'), areaOf('/app/store'));
});

test('a path nobody owns still gets a colour, and the home and events share one', () => {
  assert.equal(areaOf('/app'), 'events');
  assert.equal(areaOf('/app/something-new'), 'events');
  assert.equal(areaOf('/'), 'events');
});
