import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { reveal, unfold } from '../reveal.ts';

/* The couple's screen folds into drawers, and the button on the one card the
   whole screen is built around — "מה עכשיו" — is an ordinary link to
   `#payments`, which now lives inside one of them. A browser that will not
   open a drawer to reach a fragment scrolls nowhere, and the button looks
   dead. This is the piece that stops that, so it is worth a test that does
   not need a browser to run.

   The stand-in is the whole DOM this code touches: a tag name, an open flag
   and a parent. */
type Fake = { tagName?: string; open?: boolean; parentElement: Fake | null };

const el = (tagName: string, parent: Fake | null = null): Fake =>
  ({ tagName, open: tagName === 'DETAILS' ? false : undefined, parentElement: parent });

const withDocument = (byId: Record<string, Fake>) => {
  (globalThis as { document?: unknown }).document = {
    getElementById: (id: string) => byId[id] ?? null,
  };
};

afterEach(() => { delete (globalThis as { document?: unknown }).document; });

test('a section inside two folded drawers is opened from the outside in', () => {
  const outer = el('DETAILS');
  const inner = el('DETAILS', outer);
  const panel = el('DIV', inner);

  unfold(panel);

  assert.equal(outer.open, true);
  assert.equal(inner.open, true);
});

test('reveal finds the section by its fragment and hands it back', () => {
  const drawer = el('DETAILS');
  const payments = el('DIV', drawer);
  withDocument({ payments });

  assert.equal(reveal('#payments'), payments as unknown as HTMLElement);
  assert.equal(drawer.open, true);
});

/* Both shapes a fragment arrives in. The address bar hands back what was
   typed; a link on the page hands back what was written. */
test('the # is optional and an encoded fragment is decoded', () => {
  const guests = el('DIV');
  withDocument({ guests, 'a b': el('DIV') });

  assert.equal(reveal('guests'), guests as unknown as HTMLElement);
  assert.notEqual(reveal('%61%20b'), null);
});

/* Three ways to be asked for nothing. Every one of them used to be a
   possible throw on the way to a scroll. */
test('nothing to open is nothing to do, and never an exception', () => {
  withDocument({});
  assert.equal(reveal(''), null);
  assert.equal(reveal('#'), null);
  assert.equal(reveal('#gone'), null);
  /* A fragment that is not valid percent-encoding is used as written rather
     than thrown over. */
  assert.equal(reveal('#100%'), null);
  assert.doesNotThrow(() => unfold(null));
});
