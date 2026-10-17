import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INTAKE, INTAKE_QUESTIONS } from '../../content/intake.ts';
import { answerFor, completeness, openCount, nextChapter, gaps, answerText, type Answer } from '../intake.ts';

/**
 * The questionnaire's bookkeeping, and one check on the schema itself:
 * every key the database trigger reads exists in the content, so a
 * question renamed in one place cannot quietly vanish from the profile.
 */

const A = 'aaaa', B = 'bbbb';
const ans = (key: string, by: string, value: unknown, visibility: 'couple' | 'private' = 'couple'): Answer => ({ question_key: key, answered_by: by, value, visibility });

test('every key the trigger reads is a question the content asks', () => {
  const sql = readFileSync('supabase/migrations/0105_the_questionnaire_is_where_a_couple_is_known_from.sql', 'utf8');
  const read = [...sql.matchAll(/intake_(?:text|json|list)\(p_client, '([a-z0-9_]+)'\)/g)].map((m) => m[1]);
  const keys = new Set(INTAKE_QUESTIONS.map((q) => q.key));
  for (const k of read) assert.ok(keys.has(k), `the trigger reads ${k}, which no question has`);
  /* And the total the trigger divides by is the number of questions. */
  const total = /total int := (\d+)/.exec(sql);
  assert.equal(Number(total?.[1]), INTAKE_QUESTIONS.length);
});

test('keys are unique and the private chapter is the one that says so', () => {
  const keys = INTAKE_QUESTIONS.map((q) => q.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(INTAKE.filter((c) => c.private).map((c) => c.key), ['e']);
});

test('a viewer reads their own answer first, then a shared one, never the partner\'s private one', () => {
  const rows = [ans('e29_stress', A, 'הנאומים', 'private'), ans('a3_how_met', B, 'בטיול'), ans('a3_how_met', A, 'בעבודה')];
  assert.equal(answerFor(rows, 'a3_how_met', A)?.value, 'בעבודה');
  assert.equal(answerFor(rows, 'a3_how_met', B)?.value, 'בטיול');
  assert.equal(answerFor(rows, 'e29_stress', B), null);
});

test('completeness is answered over all, to two places, and blank is not answered', () => {
  const rows = [ans('a1_names', A, 'נועה ואיתי'), ans('a1_nickname', A, '   '), ans('b9_guests', B, 250), ans('d22_must_play', A, ['', ''])];
  assert.equal(completeness(rows), Math.round((2 / INTAKE_QUESTIONS.length) * 100) / 100);
  assert.equal(openCount(rows), INTAKE_QUESTIONS.length - 2);
  assert.equal(nextChapter(rows)?.key, 'a');
  assert.equal(completeness([], INTAKE[0]), 0);
});

test('a gap is two partners answering one shared question differently', () => {
  const rows = [
    ans('b11_style', A, ['boho']), ans('b11_style', B, ['classic']),
    ans('b13_religious', A, 'secular'), ans('b13_religious', B, 'secular'),
    ans('e29_stress', A, 'x', 'private'), ans('e29_stress', B, 'y', 'private'),
  ];
  assert.deepEqual(gaps(rows).map((g) => g.key), ['b11_style']);
});

test('an answer reads as one line in the asker\'s words', () => {
  const q = INTAKE_QUESTIONS.find((x) => x.key === 'b13_religious')!;
  assert.equal(answerText(q, 'traditional'), 'מסורתיים');
  assert.equal(answerText(q, 'traditional', 'en'), 'Traditional');
  const people = INTAKE_QUESTIONS.find((x) => x.key === 'c20_key_people')!;
  assert.equal(answerText(people, [{ name: 'סבתא רחל', relation: 'סבתא', role: 'חופה' }]), 'סבתא רחל, סבתא, חופה');
  const scale = INTAKE_QUESTIONS.find((x) => x.key === 'd23_genres')!;
  assert.equal(answerText(scale, { israeli: 5, rock: 0 }), 'ישראלי 5');
});
