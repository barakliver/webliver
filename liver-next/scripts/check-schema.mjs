/**
 * Does the schema apply — and does it apply twice, over real rows, without
 * touching them?
 *
 *     node scripts/check-schema.mjs
 *
 * Every other checker in here reads files. This one starts a PostgreSQL, runs
 * the actual SQL against it, and asks the database what happened, because the
 * three failures it exists to catch were all invisible to reading.
 *
 *   1. setup.sql could not be run twice. `create or replace function` cannot
 *      change a return type, and two functions change theirs between 0031 and
 *      0046. On an empty database that is fine; against a database that is
 *      already current it fails outright. Nobody found that by reading the
 *      file, and it stopped the first automatic release.
 *
 *   2. A live database was silently several migrations behind — 0036 had never
 *      been applied — and the symptom was a row level security refusal on
 *      opening an event, weeks later, with nothing naming the missing
 *      migration.
 *
 *   3. sync.sql, the answer to (2), must be provably incapable of changing a
 *      row. "I read it and it looks safe" is not a property; running it over a
 *      wedding and comparing every value before and after is.
 *
 * The database is a throwaway cluster in a temp directory, with just enough
 * Supabase stubbed in (scripts/supabase-stub.sql) for the real SQL to run.
 *
 * Where PostgreSQL is not installed this reports that and stops, rather than
 * passing quietly — a check that skips itself while printing nothing is how a
 * suite ends up green and blind.
 */
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sqlDir = join(root, 'supabase');

/* Ubuntu keeps the server binaries out of PATH, one directory per version. */
function findBin() {
  if (existsSync('/usr/lib/postgresql')) {
    const versions = readdirSync('/usr/lib/postgresql').sort((a, b) => Number(b) - Number(a));
    for (const v of versions) {
      const bin = `/usr/lib/postgresql/${v}/bin`;
      if (existsSync(join(bin, 'initdb'))) return bin;
    }
  }
  try { return dirname(execSync('command -v initdb', { encoding: 'utf8' }).trim()); } catch { return null; }
}

const BIN = findBin();
if (!BIN) {
  console.log('\n  PostgreSQL is not installed here, so the schema was not tested.\n');
  console.log('    apt-get install -y postgresql\n');
  console.log('  Every other check ran. This one cannot, and is not passing.\n');
  process.exit(0);
}

/* initdb refuses to run as root, which is what the container here is. */
const AS = (() => {
  try { execSync('id -u postgres', { stdio: 'ignore' }); return 'postgres'; } catch { /* fall through */ }
  try { execSync('id -u pgtest', { stdio: 'ignore' }); return 'pgtest'; } catch { /* fall through */ }
  try { execSync('useradd -M -s /bin/false pgtest', { stdio: 'ignore' }); return 'pgtest'; } catch { return null; }
})();

const dir = mkdtempSync(join('/var/tmp', 'schema-'));
let started = false;
let failures = 0;

const say = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(52)}  ${detail}`);
};

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const asUser = (cmd) => (AS && process.getuid?.() === 0
  ? sh(`su ${AS} -s /bin/bash -c ${JSON.stringify(`PATH=${BIN}:$PATH ${cmd}`)}`)
  : sh(`PATH=${BIN}:$PATH ${cmd}`));

const psql = (db, args) => sh(`${BIN}/psql -h ${dir} -U postgres -d ${db} -q -v ON_ERROR_STOP=1 ${args} 2>&1`);
const ask = (db, q) => sh(`${BIN}/psql -h ${dir} -U postgres -d ${db} -tAq -c ${JSON.stringify(q)}`).trim();
const fresh = (db) => {
  sh(`${BIN}/psql -h ${dir} -U postgres -d postgres -q -c "drop database if exists ${db}" -c "create database ${db}"`);
  psql(db, `-f ${join(root, 'scripts', 'supabase-stub.sql')}`);
};
const apply = (db, file) => {
  try { psql(db, `-f ${join(sqlDir, file)}`); return null; }
  catch (e) { return (e.stdout ?? e.message ?? '').split('\n').find((l) => /ERROR/.test(l)) ?? 'failed'; }
};

try {
  if (process.getuid?.() === 0) sh(`chown -R ${AS} ${dir}`);
  asUser(`initdb -D ${dir}/data -U postgres --auth=trust`);
  asUser(`pg_ctl -D ${dir}/data -o "-k ${dir} -h ''" -l ${dir}/log start`);
  started = true;
  execFileSync('sleep', ['2']);

  console.log('\nchecking the schema against a real PostgreSQL\n');

  // ── 1. setup.sql builds a database, and survives being run again ──────────
  fresh('one');
  say(!apply('one', 'setup.sql'), 'setup.sql builds a database from nothing');
  const second = apply('one', 'setup.sql');
  say(!second, 'and it can be run a second time', second ?? '');
  const third = apply('one', 'setup.sql');
  say(!third, 'and a third', third ?? '');

  // ── 2. sync.sql describes the same database ───────────────────────────────
  fresh('two');
  const syncErr = apply('two', 'sync.sql');
  say(!syncErr, 'sync.sql builds the same database', syncErr ?? '');

  /* One line on purpose. A newline inside a -c argument survives Node, the
     shell and psql differently enough that the first version of this died in
     the quoting rather than in the database. */
  const shape = (db) => ask(db, [
    "select string_agg(x, chr(10) order by x) from (",
    "select 't '||table_name||'.'||column_name||' '||data_type as x from information_schema.columns where table_schema='public'",
    "union all select 'p '||c.relname||'.'||pol.polname||' '||coalesce(pg_get_expr(pol.polqual,pol.polrelid),'-')||' | '||coalesce(pg_get_expr(pol.polwithcheck,pol.polrelid),'-') from pg_policy pol join pg_class c on c.oid=pol.polrelid",
    "union all select 'f '||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'",
    ") s",
  ].join(' '));
  const same = shape('one') === shape('two');
  say(same, 'and it is the same schema, object for object',
    same ? '' : 'sync.sql and setup.sql disagree');

  // ── 3. sync.sql cannot change a row ───────────────────────────────────────
  /* The whole point of the file. A wedding with money and a schedule on it,
     and every value compared before and after — including guest_token, which
     a careless trigger would mint again and quietly break every link already
     sent to a couple's guests. */
  const uid = '11111111-1111-1111-1111-111111111111';
  psql('one', `-c "insert into auth.users (id, email) values ('${uid}','barakliver@gmail.com') on conflict do nothing"`);
  const pid = ask('one', 'select id from public.producers order by created_at limit 1');
  say(!!pid, 'a producer exists to hang an event off', pid ? '' : 'no producer was created');

  if (pid) {
    psql('one', `-c "insert into public.clients (producer_id, display_name, kind, event_date, venue, guest_estimate) values ('${pid}','נועה ואיתי','wedding','2026-12-05','אחוזת הכפר',180)"`);
    const cid = ask('one', 'select id from public.clients limit 1');
    psql('one', `-c "insert into public.payments (client_id, title, amount, due_on, paid) values ('${cid}','מקדמה',15000,'2026-06-01',true)"`);
    psql('one', `-c "insert into public.day_schedule (client_id, at_time, title) values ('${cid}','19:30','קבלת פנים')"`);
    /* A lead too. Not decoration: one of the removed statements is a `delete
       from public.leads`, and a fixture with no leads in it let that mutation
       through the test — deleting nothing changes nothing. Every table a
       removed statement touches needs at least one row here, or the assertion
       about it is untested. */
    psql('one', `-c "insert into public.leads (full_name, phone, kind, producer_id) values ('רוני ועומר','0501234567','wedding','${pid}')"`);

    /* One line, for the same quoting reason as `shape` above.
     *
     * Values, not only counts. The first version of this compared row counts
     * and the contents of clients and payments, and a mutation test walked
     * straight through it: `update public.producers set brand_name = 'PWNED'`
     * put back into sync.sql changed a producer's name and every assertion
     * still passed, because nothing here was looking at producers. A test that
     * cannot fail is not evidence of anything.
     *
     * So every table the removed data statements touch is compared by value:
     * profiles by role, producers by name and status, and the event with its
     * money and its guest token. */
    const rows = () => ask('one', [
      "select (select count(*) from public.clients)||'/'||(select count(*) from public.payments)||'/'||",
      "(select count(*) from public.day_schedule)||'/'||(select count(*) from public.profiles)||'/'||",
      "(select count(*) from public.producers)||' | roles='||",
      "(select coalesce(string_agg(coalesce(email,'-')||':'||role::text, ',' order by id::text),'-') from public.profiles)||' | producers='||",
      "(select coalesce(string_agg(coalesce(nullif(brand_name,''),'0')||':'||status::text||':'||coalesce(contact_email,'-'), ',' order by id::text),'-') from public.producers)||' | events='||",
      "(select coalesce(string_agg(display_name||'|'||coalesce(event_date::text,'-')||'|'||coalesce(venue,'-')||'|'||coalesce(guest_estimate::text,'-')||'|'||coalesce(guest_token,'-'), ';' order by display_name),'-') from public.clients)||' | leads='||",
      "(select coalesce(string_agg(coalesce(full_name,'-')||':'||coalesce(producer_id::text,'-'), ',' order by id::text),'-') from public.leads)||' | paid='||",
      "(select coalesce(sum(amount)::text,'0') from public.payments where paid)",
    ].join(' '));

    const before = rows();
    const overErr = apply('one', 'sync.sql');
    say(!overErr, 'sync.sql runs over a database with a wedding in it', overErr ?? '');
    apply('one', 'sync.sql');
    const after = rows();
    say(before === after, 'and every row is exactly as it was, twice over',
      before === after ? '' : `\n        before ${before}\n        after  ${after}`);

    // ── 4. a share link opens exactly what it says and nothing else ──────────
    /* The one function in this schema that hands somebody else's family
       photographs to a caller with no account. Its whole security is that the
       token is an argument rather than a condition inside a policy, and that
       is a claim about behaviour: it can only be checked by presenting tokens
       to a real database and reading what comes back.
       Six of these are the cases that would be a breach if they were wrong —
       a scoped link that returns the other half, a revoked or expired link
       that still opens, one event's token reaching another event's rows. */
    psql('one', `-c "insert into public.event_vips (client_id, name, relation, note) values ('${cid}','סבתא מרים','סבתא של הכלה','בכניסה לחופה')"`);
    psql('one', `-c "insert into public.event_looks (client_id, category, note, image_url) values ('${cid}','hair','אסוף נמוך','${cid}/a.jpg')"`);

    /* A second wedding, so 'nothing leaks' is a claim about two events that
       exist rather than about an empty table. */
    psql('one', `-c "insert into public.clients (producer_id, display_name, kind) values ('${pid}','רוני ועומר','wedding')"`);
    const other = ask('one', `select id from public.clients where display_name='רוני ועומר'`);
    psql('one', `-c "insert into public.event_vips (client_id, name) values ('${other}','דוד אריק')"`);

    /* The token is minted by the trigger, so it is read back rather than
       chosen here — which is the point: a credential this script could pick
       is a credential a request body could pick. */
    const mint = (scope) => {
      psql('one', `-c "insert into public.event_prep_shares (client_id, token, scope, label) values ('${cid}','chosen-by-the-caller','${scope}','${scope}')"`);
      return ask('one', `select token from public.event_prep_shares where label='${scope}'`);
    };
    const faces = mint('faces');
    const looks = mint('looks');
    const all = mint('all');

    say(/^[a-f0-9]{32}$/.test(all), 'the database mints the token, not the caller',
      /^[a-f0-9]{32}$/.test(all) ? '' : `got ${all || '(nothing)'}`);

    /* Frozen on update. A share row is writable by everybody who can read the
       event, so an update that could set the token would let one of them hand
       out a link of their own choosing. */
    psql('one', `-c "update public.event_prep_shares set token='chosen-by-the-caller', label='all' where token='${all}'"`);
    const stillAll = ask('one', `select token from public.event_prep_shares where label='all'`);
    say(stillAll === all, 'and freezes it: an update cannot choose one',
      stillAll === all ? '' : `token became ${stillAll || '(nothing)'}`);

    /* jsonb_array_length rather than the contents: what is being asserted is
       which half of the sheet a scope opens, and a count of 0 against 1 says
       that without depending on how a name is spelled. */
    const sheet = (token) => ask('one', [
      "select coalesce((select jsonb_array_length(faces)||'/'||jsonb_array_length(looks)",
      `from public.prep_sheet('${token}')), 'no row')`,
    ].join(' '));

    const cases = [
      ['a link for the photographer opens the faces and not the looks', faces, '1/0'],
      ['a link for the stylist opens the looks and not the faces', looks, '0/1'],
      ['a link for both opens both', all, '1/1'],
      ['a token nobody minted opens nothing', '00000000000000000000000000000000', 'no row'],
      ['a token that is not a token opens nothing', 'not-a-token', 'no row'],
    ];
    for (const [label, token, want] of cases) {
      const got = sheet(token);
      say(got === want, label, got === want ? '' : `expected ${want}, got ${got}`);
    }

    /* One event's link must not reach another event's roster. The second
       wedding has a face on it and no share of its own, so anything other
       than one face and no looks here means the scope carried but the event
       did not. */
    const leak = sheet(all);
    say(leak === '1/1', 'and it stops at its own event', leak === '1/1' ? '' : `got ${leak}`);

    psql('one', `-c "update public.event_prep_shares set revoked_at = now() where label='faces'"`);
    const revoked = sheet(faces);
    say(revoked === 'no row', 'a revoked link stops opening',
      revoked === 'no row' ? '' : `got ${revoked}`);

    psql('one', `-c "update public.event_prep_shares set expires_at = now() - interval '1 day' where label='looks'"`);
    const expired = sheet(looks);
    say(expired === 'no row', 'and so does an expired one',
      expired === 'no row' ? '' : `got ${expired}`);
  }
} catch (e) {
  failures++;
  console.log(`\n  the test database itself failed: ${(e.stdout || e.message || e).toString().split('\n')[0]}\n`);
} finally {
  if (started) { try { asUser(`pg_ctl -D ${dir}/data stop -m immediate`); } catch { /* going away anyway */ } }
  rmSync(dir, { recursive: true, force: true });
}

console.log(failures === 0
  ? '\nthe schema applies, re-applies, and leaves a wedding alone\n'
  : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
