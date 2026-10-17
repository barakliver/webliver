import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_TABS, EVENT_TAB_GROUPS } from '../eventTabs.ts';

test('every section of the file is in exactly one group of the rail', () => {
  const placed = EVENT_TAB_GROUPS.flatMap((g) => [...g.tabs]);
  assert.equal(placed.length, EVENT_TABS.length);
  assert.deepEqual([...placed].sort(), [...EVENT_TABS].sort());
});

test('the file opens on the overview, first in the first group', () => {
  assert.equal(EVENT_TAB_GROUPS[0].tabs[0], 'overview');
});
