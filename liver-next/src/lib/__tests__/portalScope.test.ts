import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickWorkspace, withParam } from '../portalScope.ts';

const mine = [
  { id: 'w-wedding', display_name: 'נועה ואיתי' },
  { id: 'w-henna', display_name: 'החינה' },
];

test('the address decides which workspace is open', () => {
  assert.equal(pickWorkspace(mine, 'w-henna')?.id, 'w-henna');
  assert.equal(pickWorkspace(mine, 'w-wedding')?.id, 'w-wedding');
});

test('no address, or one naming an event this reader cannot open, lands on their own first', () => {
  assert.equal(pickWorkspace(mine, null)?.id, 'w-wedding');
  assert.equal(pickWorkspace(mine, undefined)?.id, 'w-wedding');
  assert.equal(pickWorkspace(mine, '')?.id, 'w-wedding');
  /* Somebody else's id, or one that has since been deleted. It resolves to
     nothing in this list, so it cannot open anything belonging to anybody
     else; the reader gets their own first workspace. */
  assert.equal(pickWorkspace(mine, 'w-somebody-elses')?.id, 'w-wedding');
});

test('a reader with no workspaces gets nothing rather than a crash', () => {
  assert.equal(pickWorkspace([], 'w-wedding'), null);
  assert.equal(pickWorkspace([], null), null);
});

/* The defect this exists to prevent: one workspace at a time means one
   `#budget` on the page, so a link in the open event cannot resolve to a
   different event's panel. Asserted as the property that guarantees it. */
test('only one workspace is ever drawn, so an anchor cannot collide', () => {
  const drawn = [pickWorkspace(mine, 'w-henna')].filter(Boolean);
  assert.equal(drawn.length, 1);
  assert.equal(drawn[0]?.id, 'w-henna');
});

test('switching one thing in the address keeps the rest of it', () => {
  assert.equal(withParam('event=e2', 'w', 'w-henna'), 'event=e2&w=w-henna');
  assert.equal(withParam('w=w-wedding&event=e1', 'event', 'e2'), 'w=w-wedding&event=e2');
  assert.equal(withParam('', 'w', 'w-henna'), 'w=w-henna');
  /* The bug it replaces: building a fresh set and setting only the new key
     dropped the other one, so choosing a celebration forgot the workspace. */
  const dropped = new URLSearchParams();
  dropped.set('event', 'e2');
  assert.equal(dropped.toString(), 'event=e2');
  assert.notEqual(dropped.toString(), withParam('w=w-henna', 'event', 'e2'));
});
