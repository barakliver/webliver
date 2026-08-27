import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileAllowed, guessMime, humanSize, MAX_FILE_BYTES } from '../fileTypes.ts';

/**
 * The shared folder takes whatever a couple has to hand, which is the point of
 * it — and that is exactly why the list of what it takes is worth a test. A
 * folder that accepts something a browser will happily execute is a folder
 * that eventually serves it back to somebody.
 */

test('it takes the things a couple actually sends', () => {
  for (const m of [
    'image/jpeg', 'image/heic', 'application/pdf', 'text/csv', 'video/quicktime',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]) assert.equal(fileAllowed(m), true, m);
});

test('it refuses anything that could be run rather than read', () => {
  for (const m of [
    'application/x-msdownload', 'application/x-sh', 'text/html',
    'application/javascript', 'application/x-httpd-php', '',
  ]) assert.equal(fileAllowed(m), false, m);
});

test('it reads a type off the extension when the browser gives none', () => {
  assert.equal(guessMime('רשימת אורחים.csv'), 'text/csv');
  assert.equal(guessMime('IMG_0421.HEIC'), 'image/heic');
  assert.equal(guessMime('תוכנית האולם.pdf'), 'application/pdf');
});

test('an extension it does not know gives nothing away, and nothing is refused', () => {
  assert.equal(guessMime('setup.exe'), '');
  assert.equal(guessMime('noextension'), '');
  assert.equal(fileAllowed(guessMime('setup.exe')), false);
});

test('the ceiling here is the same number the database checks', () => {
  assert.equal(MAX_FILE_BYTES, 52428800);
});

test('sizes are written the way people say them', () => {
  assert.equal(humanSize(512), '512 B');
  assert.equal(humanSize(2048), '2 KB');
  assert.equal(humanSize(3.5 * 1024 * 1024), '3.5 MB');
});

test('a size it was not given says nothing rather than 0.0 MB', () => {
  assert.equal(humanSize(0), '');
  assert.equal(humanSize(Number.NaN), '');
  assert.equal(humanSize(-1), '');
});
