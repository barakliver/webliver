import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { noticeCopy, ticketCopy, appCopy } from '../../content/site.ts';
import { filesEn } from '../../content/app.en.ts';
import { MEDIA_TAGS } from '../fileTypes.ts';

/**
 * Four lists that live in two places each: a word in the copy and a value in
 * the database. When they drift, the screen shows a raw key or the database
 * refuses a row, and neither failure names the file it came from.
 */

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'supabase', 'migrations');
const sql = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(dir, f), 'utf8'))
  .join('\n');

/** Every value the notice_kind enum has ever been given. */
function noticeKinds(): string[] {
  const out = new Set<string>();
  const created = /create type notice_kind as enum \(([^)]+)\)/i.exec(sql);
  if (created) for (const m of created[1].matchAll(/'([a-z_]+)'/g)) out.add(m[1]);
  for (const m of sql.matchAll(/alter type notice_kind add value if not exists '([a-z_]+)'/gi)) out.add(m[1]);
  return [...out];
}

/** The values a check constraint allows, by constraint name. */
function allowed(constraint: string): string[] {
  const m = new RegExp(`constraint ${constraint}\\s+check \\([a-z_]+ in \\(([^)]+)\\)\\)`, 'i').exec(sql);
  assert.ok(m, `constraint ${constraint} is in the migrations`);
  return [...m![1].matchAll(/'([a-z_]*)'/g)].map((x) => x[1]);
}

test('every kind of notification has a word in the bell', () => {
  const kinds = noticeKinds();
  assert.ok(kinds.length >= 8, 'the enum was read');
  for (const k of kinds) {
    assert.ok(k in noticeCopy.kinds, `noticeCopy.kinds is missing '${k}'`);
  }
});

test('the media tags agree between the code, the database and both languages', () => {
  const db = allowed('client_files_tag_known').filter(Boolean).sort();
  assert.deepEqual([...MEDIA_TAGS].sort(), db);
  assert.deepEqual(Object.keys(appCopy.files.media.tags).sort(), db);
  assert.deepEqual(Object.keys(filesEn.media.tags).sort(), db);
});

test('the ticket categories the form offers are the ones the table accepts', () => {
  const db = allowed('support_tickets_category').sort();
  assert.deepEqual(Object.keys(ticketCopy.categories).sort(), db);
});

test('the copilot never speaks in the platform owner\'s name', async () => {
  /* The system prompt is server-only; its source is checked as text. */
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'ai', 'copilot.ts'), 'utf8');
  assert.ok(!/ברק|Liver|לבר /.test(src), 'no personal or platform name in the copilot prompt');
  assert.ok(/חתום על טיוטות בשם הזה/.test(src), 'drafts are signed with the producer\'s own brand');
});
