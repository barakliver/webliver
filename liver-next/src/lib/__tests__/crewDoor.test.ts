import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * The crew member's door, read as text.
 *
 * A lint rather than a proof — `npm run schema` is where the database is
 * actually stood up — but it guards the one regression that would be silent
 * and expensive: somebody adding a column to one of these two functions
 * because a screen wanted it, and handing every crew member the fee the
 * person next to them is on.
 *
 * The two functions in 0091 are the only way a `staff` account reads anything
 * in this platform. Not one row level security policy was widened for them,
 * which is why this file can be a list of words rather than an audit.
 */
const sql = readFileSync(
  new URL('../../../supabase/migrations/0091_a_crew_member_can_read_their_own_evening.sql', import.meta.url),
  'utf8',
);

/**
 * Just the bodies of the two functions a crew member can execute, with the
 * prose taken out.
 *
 * The comments beside them are allowed to say "no fee" and to explain why the
 * other crew member's fee is not there; it is the SQL that must not mention
 * it. Scanning the comments too would make the file fail for saying the right
 * thing, which is the kind of check somebody deletes.
 */
function door(): string {
  const from = sql.indexOf('create or replace function public.crew_my_events');
  assert.ok(from > 0, 'crew_my_events is gone');
  return sql
    .slice(from)
    .replace(/^[ \t]*--.*$/gm, '')          // whole-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')          // block comments
    .replace(/comment on [\s\S]*?;/gi, '');  // the documentation strings
}

test('nothing a crew member reads carries money', () => {
  const body = door();
  for (const word of ['fee', 'rate', 'budget', 'agreed', 'deposit', 'balance', 'price']) {
    assert.equal(
      new RegExp(`\\b${word}\\b`, 'i').test(body), false,
      `the crew's own functions mention "${word}"`,
    );
  }
});

/* The couple's own details are the producer's to hand out, not the platform's
   to publish to whoever is working the bar. */
test('nothing a crew member reads carries the couple’s contact details or the brief', () => {
  const body = door();
  for (const word of ['contact_email', 'contact_phone', 'brief', 'guest_token']) {
    assert.equal(
      new RegExp(`\\b${word}\\b`, 'i').test(body), false,
      `the crew's own functions mention "${word}"`,
    );
  }
});

/* Both functions test the caller against the crew row before returning
   anything. Losing that line turns either of them into a way of reading every
   event on the platform. */
test('both doors check that the caller is actually on the evening', () => {
  const body = door();
  const checks = body.match(/m\.profile_id = auth\.uid\(\)/g) ?? [];
  assert.equal(checks.length, 2, 'one of the two functions stopped checking the caller');
});

test('the detail function is reached by the event it is asked about, and nothing else', () => {
  const body = door();
  assert.ok(/crew_my_event\(p_client uuid\)/.test(body));
  /* Answers null rather than raising: "you are not on this event" and "no such
     event" have to be the same answer, or the difference between them is a way
     of finding out which events exist. */
  assert.ok(/if not found then\s*\n\s*return null;/.test(body));
});

test('neither door is executable by somebody who is not signed in', () => {
  assert.ok(/revoke all on function public\.crew_my_events\(\) from public;/.test(sql));
  assert.ok(/revoke all on function public\.crew_my_event\(uuid\) from public;/.test(sql));
  assert.equal(/grant execute on function public\.crew_my_event.*\banon\b/.test(sql), false);
});

/* The note the crew reads is its own column. Pointing this at `brief` would
   publish nine months of the producer's private notes the first time somebody
   was assigned, and it would look like a one-word change in review. */
test('the crew read a field written to them, not the producer’s own brief', () => {
  assert.ok(/add column if not exists crew_note text not null default ''/.test(sql));
  assert.ok(/'crewNote', c\.crew_note/.test(sql));
});
