import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questionsFor, templateDraft, factLines, type DraftCopy, type EventFactsForDraft } from '../assist.ts';
import type { QuoteVendor } from '../quotes.ts';

const v = (o: Partial<QuoteVendor> = {}): QuoteVendor => ({
  id: 'a', name: 'סטודיו לביא', category: 'photo', status: 'shortlist', chosen: false,
  quote_amount: null, quote_hours: null, quote_scope: '', quote_includes: '', quote_extras: '', quote_terms: '',
  ...o,
});

const copy: DraftCopy = {
  greeting: 'שלום {name},',
  about: 'אנחנו מתכננים את {event}',
  onDate: 'בתאריך {date}',
  guests: 'כ-{n} אורחים',
  inRegion: 'באזור {region}',
  haveQuote: 'קיבלנו את ההצעה שלכם',
  askIntro: 'כמה שאלות כדי שנוכל להשוות:',
  questions: {
    amount: 'כמה זה עולה, כולל מע״מ?',
    hours: 'כמה שעות כלולות?',
    scope: 'מה בדיוק כלול בשירות?',
    includes: 'מה נכלל במחיר?',
    extras: 'מה בתוספת תשלום?',
    terms: 'מה תנאי התשלום?',
  },
  closing: 'תודה, {sign}',
};

const facts: EventFactsForDraft = {
  eventName: 'החתונה של נועה ואיתי', eventDate: '2026-12-05', guests: 180, region: 'השרון', signAs: 'ברק ליור הפקות',
};

test('a question is asked only about a blank', () => {
  assert.deepEqual(questionsFor(v()), ['amount', 'hours', 'scope', 'includes', 'extras', 'terms']);
  assert.deepEqual(questionsFor(v({ quote_amount: 9000, quote_terms: '50%' })), ['hours', 'scope', 'includes', 'extras']);
  assert.deepEqual(questionsFor(v({ quote_amount: 9000, quote_hours: 6, quote_scope: 'x', quote_includes: 'y', quote_extras: 'z', quote_terms: 'w' })), []);
});

test('the draft carries the facts, the questions as a list, and a name to reply to', () => {
  const d = templateDraft(v({ quote_amount: 9000 }), facts, copy, '5.12.26');
  assert.ok(d.startsWith('שלום סטודיו לביא,'));
  assert.ok(d.includes('החתונה של נועה ואיתי, בתאריך 5.12.26, כ-180 אורחים, באזור השרון.'));
  assert.ok(d.includes('קיבלנו את ההצעה שלכם.'), 'an amount was given, so there is a quote to refer to');
  assert.ok(!d.includes('כמה זה עולה'), 'the amount is known and is not asked');
  assert.ok(d.includes('• כמה שעות כלולות?'));
  assert.ok(d.endsWith('תודה, ברק ליור הפקות'));
});

test('a supplier who has told us nothing is not thanked for a quote', () => {
  const d = templateDraft(v(), facts, copy, null);
  assert.ok(!d.includes('קיבלנו את ההצעה'));
  assert.ok(!d.includes('בתאריך'), 'no date, no date line');
  assert.equal((d.match(/^• /gm) ?? []).length, 6);
});

test('a supplier who has told us everything gets no questions', () => {
  const full = v({ quote_amount: 9000, quote_hours: 6, quote_scope: 'סטילס', quote_includes: 'אלבום', quote_extras: 'רחפן', quote_terms: '50%' });
  const d = templateDraft(full, facts, copy, '5.12.26');
  assert.ok(!d.includes(copy.askIntro));
  assert.ok(!d.includes('• '));
});

test('the facts column shows what is known and nothing else', () => {
  const lines = factLines(v({ quote_amount: 9000, quote_terms: '50% מקדמה' }), { ...facts, region: '' }, copy, '5.12.26');
  assert.ok(lines.includes('כ-180 אורחים'));
  assert.ok(!lines.some((l) => l.includes('באזור')), 'no region, no region line');
  assert.ok(lines.some((l) => l.endsWith(': 9000')));
  assert.ok(lines.includes('50% מקדמה'));
  assert.ok(!lines.some((l) => l.includes('שעות')), 'hours unknown, not listed as a fact');
});
