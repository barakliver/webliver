import { test } from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { joinProblems, phoneDigits, joinUrl, contactsCsv, mayBeWritten, unsubscribeUrl, TERMS_VERSION, type ContactRow } from '../campaign.ts';

const ok = { name: 'דנה לוי', phone: '050-123 4567', email: 'dana@example.com', terms: true };

test('a complete form has no problems and each missing thing is named once, in the order asked', () => {
  assert.deepEqual(joinProblems(ok), []);
  assert.deepEqual(joinProblems({ name: '', phone: '', email: '', terms: false }), ['name', 'phone', 'email', 'terms']);
  assert.deepEqual(joinProblems({ ...ok, terms: false }), ['terms']);
});

test('a phone is judged by its digits and not by how it was typed', () => {
  assert.equal(phoneDigits('+972 (50) 123-4567'), '972501234567');
  assert.deepEqual(joinProblems({ ...ok, phone: '050-123' }), ['phone']);
  assert.deepEqual(joinProblems({ ...ok, phone: '+972 50 123 4567' }), []);
});

test('an address needs an at sign and a dot after it', () => {
  for (const bad of ['dana', 'dana@', 'dana@example', '@example.com', 'da na@example.com']) {
    assert.deepEqual(joinProblems({ ...ok, email: bad }), ['email'], bad);
  }
});

test('the link is on the app host and a trailing slash does not double', () => {
  assert.equal(joinUrl('https://app.beforeidoevent.com/', 'abc'), 'https://app.beforeidoevent.com/join/abc');
});

const row = (over: Partial<ContactRow> = {}): ContactRow => ({
  name: 'דנה', phone: '0501234567', email: 'dana@example.com', campaign: 'כנס', terms_version: TERMS_VERSION,
  terms_accepted_at: '2026-11-10T09:00:00Z', broadcast_consent: true, broadcast_consent_at: '2026-11-10T09:00:00Z',
  broadcast_revoked_at: null, created_at: '2026-11-10T09:00:00Z', note: '', ...over,
});

test('the CSV opens in Excel: byte order mark, quoted commas, and no formulas', () => {
  const csv = contactsCsv([row({ name: 'כהן, דנה', note: '=HYPERLINK("http://x")' }), row({ name: '+cmd', email: '@a.com' })]);
  assert.ok(csv.startsWith('﻿'));
  assert.ok(csv.includes('"כהן, דנה"'));
  assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`));
  assert.ok(csv.includes(",'+cmd,") || csv.includes("\r\n'+cmd,"));
  assert.ok(csv.includes("'@a.com"));
  assert.equal(csv.trim().split('\r\n').length, 3);
});

test('only people who agreed and have not left may be written to', () => {
  const rows = [
    row(), row({ email: 'b@example.com', broadcast_consent: false }),
    row({ email: 'c@example.com', broadcast_revoked_at: '2026-11-11T00:00:00Z' }),
    row({ email: 'no-at-sign' }),
  ];
  assert.deepEqual(mayBeWritten(rows).map((r) => r.email), ['dana@example.com']);
});

test('the leaving link is on the business host', () => {
  assert.equal(unsubscribeUrl('https://beforeidoevent.com/', 'tok'), 'https://beforeidoevent.com/unsubscribe/tok');
});

test('the QR a stand prints decodes back to the address it was made from', async () => {
  const url = joinUrl('https://app.beforeidoevent.com', 'c'.repeat(48));
  const png = PNG.sync.read(await QRCode.toBuffer(url, { type: 'png', margin: 2, width: 480 }));
  const got = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.equal(got?.data, url);
});

import { broadcastEmail } from '../notify/templates.ts';

test('a mailing names its reason and carries the way out, and escapes what was typed', () => {
  const html = broadcastEmail({
    subject: 'חדש <b>במערכת</b>', body: 'שלום\nעולם\n\n<script>x</script>',
    why: 'קיבלת את זה כי אישרת בכנס.', leaveUrl: 'https://beforeidoevent.com/unsubscribe/tok', leaveLabel: 'להסרה', brand: { name: 'ברק ליור' },
  });
  assert.ok(html.includes('https://beforeidoevent.com/unsubscribe/tok'));
  assert.ok(html.includes('קיבלת את זה כי אישרת בכנס.'));
  assert.ok(!html.includes('<script>') && !html.includes('<b>במערכת'));
  assert.ok(html.includes('שלום<br>עולם'));
  assert.equal((html.match(/<p style="margin:0 0 14px/g) ?? []).length, 2);
});
