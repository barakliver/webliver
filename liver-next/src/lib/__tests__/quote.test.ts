import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, safeUrl, bankLines, quoteStage, isPayable, esc, quoteUrl } from '../quote.ts';
import { priceQuoteEmail } from '../notify/templates.ts';

test('an amount is a number above zero, written the way people write one', () => {
  assert.equal(parseAmount('48000'), 48000);
  assert.equal(parseAmount('48,000'), 48000);
  assert.equal(parseAmount('48k'), 48000);
  assert.equal(parseAmount('48 אלף'), 48000);
  assert.equal(parseAmount('12,500.50'), 12500.5);
});

test('nothing, zero and words are refused rather than read as a price', () => {
  for (const bad of ['', '   ', '0', '0k', 'הרבה', '12x', '-5', '100000000', '1e9']) {
    assert.equal(parseAmount(bad), null, JSON.stringify(bad));
  }
});

test('a payment address is a web address and nothing else', () => {
  assert.equal(safeUrl('https://pay.example.com/p/abc?x=1'), 'https://pay.example.com/p/abc?x=1');
  assert.equal(safeUrl('  http://example.com  '), 'http://example.com/');
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://x.com', 'pay.example.com', 'https://a b.com', '', null, undefined]) {
    assert.equal(safeUrl(bad as string), null, String(bad));
  }
});

test('a bank block is the lines somebody wrote', () => {
  assert.deepEqual(bankLines('בנק הפועלים\r\n\r\n  סניף 600 \n חשבון 123456'), ['בנק הפועלים', 'סניף 600', 'חשבון 123456']);
  assert.deepEqual(bankLines(''), []);
  assert.deepEqual(bankLines(null), []);
});

const base = { status: 'sent', choice: null, viewed_at: null, valid_until: null };

test('a stage is a ladder read from the top, and withdrawn is the top', () => {
  const today = '2026-10-25';
  assert.equal(quoteStage(base, today), 'sent');
  assert.equal(quoteStage({ ...base, viewed_at: 'x' }, today), 'opened');
  assert.equal(quoteStage({ ...base, viewed_at: 'x', choice: 'link' }, today), 'chose_link');
  assert.equal(quoteStage({ ...base, choice: 'bank' }, today), 'chose_bank');
  assert.equal(quoteStage({ ...base, status: 'withdrawn', choice: 'bank' }, today), 'withdrawn');
});

test('a paid quote is paid whatever its date says, and the last day still counts', () => {
  const today = '2026-10-25';
  assert.equal(quoteStage({ ...base, status: 'paid', valid_until: '2026-01-01' }, today), 'paid');
  assert.equal(quoteStage({ ...base, valid_until: '2026-10-25' }, today), 'sent');
  assert.equal(quoteStage({ ...base, valid_until: '2026-10-24', choice: 'bank' }, today), 'expired');
  assert.equal(isPayable({ status: 'sent', valid_until: '2026-10-25' }, today), true);
  assert.equal(isPayable({ status: 'sent', valid_until: '2026-10-24' }, today), false);
  assert.equal(isPayable({ status: 'paid', valid_until: null }, today), false);
  assert.equal(isPayable({ status: 'withdrawn', valid_until: null }, today), false);
});

test('the link is on the business host and a trailing slash does not double', () => {
  assert.equal(quoteUrl('https://beforeidoevent.com/', 'abc'), 'https://beforeidoevent.com/q/abc');
  assert.equal(quoteUrl('https://beforeidoevent.com', 'abc'), 'https://beforeidoevent.com/q/abc');
});

test('the letter escapes what people typed and never carries the way to pay', () => {
  const html = priceQuoteEmail({
    name: '<b>נועה</b>', title: 'הצעה "מיוחדת"', amount: 48000, validUntil: '2026-12-01',
    note: '<script>alert(1)</script>', url: 'https://beforeidoevent.com/q/tok',
    brand: { name: 'ברק ליור' },
  });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<b>נועה'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('https://beforeidoevent.com/q/tok'));
  assert.ok(html.includes('48,000'));
  assert.ok(!/חשבון|IBAN|pay\./.test(html));
  assert.equal(esc('a&b<c>"'), 'a&amp;b&lt;c&gt;&quot;');
});
