import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coupleFacts, companionSystem, type CoupleFactsInput } from '../companion.ts';

/**
 * The couple's assistant must not become a way around the producer's own
 * decisions about their client.
 *
 * A producer who hides the budget from a couple has decided something about
 * that relationship. The panel disappears from the portal, and if the
 * assistant will still answer "how much have we paid" then the panel was
 * never really hidden — it just moved somewhere less obvious. That is the
 * failure these exist to prevent, and it is worth testing rather than
 * trusting, because it is invisible from the screen: the couple sees no
 * budget panel and everything looks correct.
 */

const base: CoupleFactsInput = {
  coupleName: 'נועה ואיתי',
  eventDate: '2026-12-05',
  venue: 'אחוזת הכפר',
  daysToEvent: 90,
  gates: { budget: true, guests: true, runsheet: true },
  openTasks: [
    { title: 'לבחור שיר לכניסה לחופה', due_on: '2026-11-01', owner: 'client' },
    { title: 'לסגור יתרות לספקים', due_on: '2026-11-25', owner: 'producer' },
  ],
  payments: [
    { title: 'מקדמה', amount: 15000, due_on: '2026-06-01', paid: true },
    { title: 'תשלום שני', amount: 40000, due_on: '2026-10-04', paid: false },
    { title: 'יתרה', amount: 55000, due_on: '2026-11-28', paid: false },
  ],
  budgetTotal: 227300,
  guests: { invited: 180, coming: 142, pending: 17 },
  schedule: [{ at_time: '19:30:00', title: 'קבלת פנים' }, { at_time: '21:00:00', title: 'חופה' }],
};

const on = (over: Partial<CoupleFactsInput>): CoupleFactsInput => ({ ...base, ...over });

test('a hidden budget puts no money in front of the assistant at all', () => {
  /* The whole point. Not "refuses to answer" — the numbers never reach it, so
     there is nothing to be talked out of. */
  const text = coupleFacts(on({ gates: { budget: false, guests: true, runsheet: true } }));
  for (const secret of ['15000', '40000', '55000', '227300', 'מקדמה', 'יתרה', 'תשלומים']) {
    assert.ok(!text.includes(secret), `"${secret}" reached the prompt with the budget hidden`);
  }
});

test('a hidden guest list keeps its counts out too', () => {
  const text = coupleFacts(on({ gates: { budget: true, guests: false, runsheet: true } }));
  assert.ok(!text.includes('180'));
  assert.ok(!text.includes('אישרו הגעה'));
});

test('a hidden running order keeps the evening out', () => {
  const text = coupleFacts(on({ gates: { budget: true, guests: true, runsheet: false } }));
  assert.ok(!text.includes('קבלת פנים'));
  assert.ok(!text.includes('סדר הערב'));
});

test('nothing is said about a section being hidden', () => {
  /* "The budget is hidden from you" is itself an answer about the budget, and
     it starts the conversation the producer chose not to have. */
  const text = coupleFacts(on({ gates: { budget: false, guests: false, runsheet: false } }));
  for (const tell of ['מוסתר', 'הוסתר', 'אין לך גישה', 'לא מורשה']) {
    assert.ok(!text.includes(tell), `the prompt announces the gate: ${tell}`);
  }
});

test('everything open is there when nothing is gated', () => {
  const text = coupleFacts(base);
  assert.ok(text.includes('142'), 'the replies');
  assert.ok(text.includes('חופה'), 'the evening');
  assert.ok(text.includes('40000'), 'the next payment');
});

test('the couple is told what is theirs, not what the producer owes', () => {
  /* "What is left for us" means for us. A producer's own task list appearing
     in a couple's answer is both wrong and slightly alarming. */
  const text = coupleFacts(base);
  assert.ok(text.includes('לבחור שיר לכניסה לחופה'));
  assert.ok(!text.includes('לסגור יתרות לספקים'));
});

test('an event with nothing on it still says something true', () => {
  const text = coupleFacts(on({
    openTasks: [], payments: [], budgetTotal: null, schedule: [],
    guests: { invited: 0, coming: 0, pending: 0 },
  }));
  assert.ok(text.includes('נועה ואיתי'));
  assert.ok(text.includes('אין כרגע משימות פתוחות'));
});

test('a date in the past is described as past rather than as a countdown', () => {
  assert.ok(coupleFacts(on({ daysToEvent: -3 })).includes('לפני 3 ימים'));
  assert.ok(coupleFacts(on({ daysToEvent: 0 })).includes('האירוע היום'));
});

test('amounts that arrive as strings still add up', () => {
  /* Numeric columns come back as strings, and string concatenation instead of
     addition produces a plausible number rather than an error. */
  const text = coupleFacts(on({
    payments: [
      { title: 'מקדמה', amount: '10000', due_on: null, paid: true },
      { title: 'יתרה', amount: '20000', due_on: null, paid: true },
    ],
  }));
  assert.ok(text.includes('30000'), text);
});

/* ── whose voice it is ───────────────────────────────────────────────────── */

test('the instructions carry the producer name and never the platform', () => {
  const s = companionSystem('ברק ליור', 'כתבו לנו כאן ונחזור אליכם');
  assert.ok(s.includes('ברק ליור'));
  for (const forbidden of ['EventOS', 'liver', 'פלטפורמה שלנו', 'Claude', 'Anthropic']) {
    assert.ok(!s.includes(forbidden), `the prompt names ${forbidden}`);
  }
});

test('the instructions forbid inventing and forbid promising', () => {
  const s = companionSystem('ברק ליור', 'כתבו לנו');
  assert.ok(s.includes('אל תמציא'));
  assert.ok(s.includes('אל תבטיח'));
  /* It must not offer to do the thing later instead of answering now. */
  assert.ok(s.includes('אין מילות המתנה'));
});

test('a producer with no brand name of their own still gets a voice', () => {
  /* The fallback is the caller's problem, but the prompt must not end up
     addressing the couple on behalf of an empty string. */
  const s = companionSystem('ההפקה', 'כתבו לנו');
  assert.ok(s.includes('ההפקה'));
  assert.ok(!s.includes('בשם  '), 'a hole where the name should be');
});
