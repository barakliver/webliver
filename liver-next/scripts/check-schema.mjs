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
/* The real module, not a copy of its arithmetic. Section 5 compares what the
   database computes for a hall against what the screen computes for the same
   hall, and the only way that is a proof rather than a coincidence is if this
   is the same code the browser runs. Loaded with --experimental-strip-types,
   which is why `npm run schema` carries the flag. */
import { cost } from '../src/lib/venues.ts';

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

    // ── 3b. the migrations, applied the way the agent applies them ───────────
    /* Everything above tests the two generated files. The agent runs a third
       thing that neither of them is: after levelling with sync.sql, it applies
       each migration the release adds as its own file, for the one-time data
       sync.sql strips — a seeded row, a backfill.

       Nothing tested that path, and it is the one that runs against his
       database. 0061 seeds public.events with `select kind::text from
       clients`, where clients.kind is the event_class enum: 'wedding' or
       'corporate'. Only the wedding kinds were registered in event_types, so
       one corporate workspace made that insert fail its foreign key and took
       the migration down — on exactly the databases with the most in them,
       and invisibly to every check here, because the fixture above is a
       wedding and sync.sql does not carry that insert at all.

       The first attempt at this test ran the new migrations over database
       `one`, which setup.sql had already built in full — so 0064's own seed
       had put 'corporate' in event_types long before 0061 asked for it, and
       removing the fix changed nothing. A test that cannot fail is not a test.

       So the database is built the way his actually got here: every migration
       up to the last release, and then the ones this release adds, in order,
       exactly as the agent applies them. */

    const allMigs = readdirSync(join(sqlDir, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
    const NEW_FROM = '0061';
    const settled = allMigs.filter((f) => f < NEW_FROM);
    const arriving = allMigs.filter((f) => f >= NEW_FROM);

    fresh('three');
    const settledErr = settled.map((f) => [f, apply('three', join('migrations', f))]).find(([, e]) => e);
    say(!settledErr, `a database at the last release, ${settled.length} migrations deep`,
      settledErr ? `${settledErr[0]}: ${settledErr[1]}` : '');

    if (!settledErr) {
      /* A producer with two workspaces on the books: the wedding everything
         here is written around, and the corporate event that is equally real
         and that no check had ever put in front of a migration. */
      const uid3 = '22222222-2222-2222-2222-222222222222';
      psql('three', `-c "insert into auth.users (id, email) values ('${uid3}','upgrade@example.com') on conflict do nothing"`);
      const pid3 = ask('three', `select id from public.producers where owner_id='${uid3}'`);
      psql('three', [
        `insert into public.clients (producer_id, display_name, kind, event_date, venue) values ('${pid3}','דנה ויואב','wedding','2026-09-12','גן האירועים')`,
        `insert into public.clients (producer_id, display_name, kind, event_date, venue) values ('${pid3}','כנס סתיו','corporate','2026-11-20','מרכז הכנסים')`,
      ].map((s) => `-c "${s}"`).join(' '));
      /* Applied in two halves, with a row planted between them: 0062 gave the
         checklist a form that wrote suppliers to a table nothing reads, and
         0069 copies whatever it caught into the one the screens read. The
         copy can only be checked by having something to copy. */
      const before69 = arriving.filter((f) => f < '0069');
      const from69 = arriving.filter((f) => f >= '0069');
      let arrErr = before69.map((f) => [f, apply('three', join('migrations', f))]).find(([, e]) => e);
      const cid3 = ask('three', "select id from public.clients where display_name='דנה ויואב'");
      if (!arrErr) {
        const evt3 = ask('three', `select id from public.events where client_id='${cid3}' limit 1`);
        psql('three', [
          `insert into public.tasks (client_id, title, category) values ('${cid3}','לסגור DJ','dj')`,
          `insert into public.vendor_choices (event_id, category, name, contact_name, phone, cost, task_id)`
            + ` select '${evt3}','dj','DJ אורי','אורי','0522222222',9000,id from public.tasks where client_id='${cid3}' and title='לסגור DJ'`,
        ].map((s) => `-c "${s}"`).join(' '));
      }
      /* Counted after the planted row and before the half that touches
         tasks, so "nothing lost" is measured against what was really there. */
      const tasksBefore = ask('three', "select count(*)::text from public.tasks");
      if (!arrErr) {
        arrErr = from69.map((f) => [f, apply('three', join('migrations', f))]).find(([, e]) => e);
      }
      say(!arrErr, `and the ${arriving.length} this release adds go on over it`,
        arrErr ? `${arrErr[0]}: ${arrErr[1]}` : '');

      /* The DJ the form caught is now on the event file, under the event
         file's own category, and the task that caught him points at the row. */
      const copied = ask('three',
        `select (select count(*) from public.event_vendors where client_id='${cid3}' and name='DJ אורי' and category='music' and status='booked')::text`
        + ` || '/' || (select count(*) from public.tasks where client_id='${cid3}' and title='לסגור DJ' and event_vendor_id is not null)::text`);
      say(copied === '1/1', 'and the DJ the checklist caught is on the suppliers tab, once',
        copied === '1/1' ? '' : `got ${copied}`);

      /* 0070's switches: a couple that existed before the column sees
         everything (the column arrives empty), a door can be closed, and the
         column refuses anything that is not an object. */
      const doors = ask('three',
        `select shared_sections::text from public.clients where id='${cid3}'`);
      psql('three', `-c "update public.clients set shared_sections = jsonb_build_object('envelopes', false) where id='${cid3}'"`);
      const closed = ask('three',
        `select (shared_sections->>'envelopes') from public.clients where id='${cid3}'`);
      let refused = false;
      try {
        psql('three', `-c "update public.clients set shared_sections = '[1]'::jsonb where id='${cid3}'"`);
      } catch { refused = true; }
      say(doors === '{}' && closed === 'false' && refused,
        'the couple\'s screen starts fully open, a door closes, and the column is an object or nothing',
        `before:${doors} closed:${closed} refused:${refused}`);

      /* 0072: the plan arrives empty and the Sunday date empty, on a row
         that existed before either column did. */
      const money = ask('three',
        `select budget_plan::text || '|' || coalesce(budget_digest_on::text, 'never') from public.clients where id='${cid3}'`);
      say(money === '{}|never', 'an existing event has an empty budget plan and no Sunday letter yet', `got: ${money}`);

      /* 0075: a supplier booked before the status columns existed has
         nothing to say yet, and says so with nulls rather than noise. */
      const hq = ask('three',
        `select coalesce(waiting_on,'-') || '|' || coalesce(deposit::text,'-') || '|' || next_action from public.event_vendors where client_id='${cid3}' and name='DJ אורי'`);
      say(hq === '-|-|', 'a supplier from before 0075 has an empty status, not a wrong one', `got: ${hq}`);

      /* 0073: the enum grew, and the guest who said "kosher" still says it. */
      const diets = ask('three', "select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum where enumtypid = 'diet_pref'::regtype");
      say(/glatt/.test(diets) && /allergy/.test(diets) && /kosher/.test(diets), 'the caterer\'s new answers are on the enum beside the old ones', `got: ${diets}`);

      /* Each workspace got an event of its own kind — the corporate one being
         the row whose absence took 0061 down. */
      const kinds = ask('three',
        "select coalesce(string_agg(c.display_name||'='||coalesce(e.event_type,'(none)'), ', ' order by c.display_name),'-')"
        + ' from public.clients c left join public.events e on e.client_id = c.id');
      const wantKinds = 'דנה ויואב=wedding, כנס סתיו=corporate';
      say(kinds === wantKinds, 'and every workspace gets an event of its own kind',
        kinds === wantKinds ? '' : `got ${kinds}`);

      /* And the upgrade did not eat anything on the way past. phase is the
         column an earlier draft of 0061 dropped in a file about events. */
      const kept = ask('three',
        "select (select count(*) from public.tasks)::text || '/' ||"
        + " (select count(*) from information_schema.columns where table_name='tasks' and column_name='phase')::text");
      say(kept === `${tasksBefore}/1`, 'and no task, and no column of one, is lost on the way',
        kept === `${tasksBefore}/1` ? '' : `expected ${tasksBefore}/1, got ${kept}`);

      /* 0068 swaps the check on meeting_logs.kind for one with two more
         kinds. On an upgraded database — not a fresh one — the new kinds
         have to be accepted and the old ones still stored. */
      let introErr = '';
      try {
        psql('three',
          `-c "insert into public.meeting_logs (client_id, kind) values ('${cid3}','intro')"`
          + ` -c "insert into public.meeting_logs (client_id, kind) values ('${cid3}','production')"`);
      } catch (e) {
        introErr = (e.stdout ?? e.message ?? '').split('\n').find((l) => /ERROR/.test(l)) ?? 'failed';
      }
      const introCount = ask('three', `select count(*)::text from public.meeting_logs where client_id='${cid3}'`);
      say(!introErr && introCount === '2', 'and the first call is a meeting the upgraded database accepts',
        introErr || `stored ${introCount}`);
    }

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

    // ── 5. choosing a hall writes the budget, and gets the money right ───────
    /* `choose_venue` computes the total itself rather than taking one from the
       browser, because the figure becomes the financial baseline of somebody's
       wedding. That makes the database the second place this arithmetic is
       written — lib/venues.ts is the first — and two copies of a formula are
       two copies until something proves they agree.

       The first version of this test compared the database against a total
       worked out by hand in this comment, and passed while the two were 13,068
       shekels apart. Both halls in it happened to be stored the way the SQL
       assumed, so the one thing the SQL got wrong — a plate quoted before VAT,
       which the screen converts and the function did not — was the one case
       the test never built. A hand-computed expectation is a third copy of the
       formula, and it agreed with the wrong one.

       So the expectation now comes from `cost()` itself, on the inclusive
       basis the budget is always written on, and the first hall below is
       deliberately quoted before the tax. */
    const hallRow = {
      id: '', venueName: 'אחוזת הכפר', location: '',
      platePrice: 300, isVatIncluded: false,
      barCost: 80, barType: 'per_person',
      soundLightingCost: 15000, ancillaryFees: 9000,
      servicePercent: 10, serviceFlat: 0,
      contingencyPercent: 10, prosCons: [], quotePath: '',
      isSelected: false, contact: '', phone: '', touredOn: null, notes: '',
    };
    const cheapRow = {
      ...hallRow, venueName: 'בית הבאר', platePrice: 250, isVatIncluded: true,
      barCost: 0, barType: 'flat', soundLightingCost: 0, ancillaryFees: 0, servicePercent: 0,
    };

    const addVenue = (r) => {
      psql('one', `-c ${JSON.stringify(
        'insert into public.venue_comparisons (client_id, venue_name, plate_price, is_vat_included,'
        + ' bar_cost, bar_type, sound_lighting_cost, ancillary_fees, service_percent, service_flat) values'
        + ` ('${cid}','${r.venueName}',${r.platePrice},${r.isVatIncluded},${r.barCost},'${r.barType}',`
        + `${r.soundLightingCost},${r.ancillaryFees},${r.servicePercent},${r.serviceFlat})`)}`);
      return ask('one', `select id from public.venue_comparisons where venue_name='${r.venueName}'`);
    };
    /* What the couple was looking at when they pressed the button. */
    const onScreen = (r, g) => cost(r, g, true).total.toFixed(2);

    const hall = addVenue(hallRow);
    const cheaperHall = addVenue(cheapRow);

    /* With an identity. The first run of this test failed with "not yours",
       which is `choose_venue`'s own `can_read_client` guard firing against a
       superuser session that had never claimed to be anybody — the guard
       working, proved by accident. Every call below carries the root account's
       subject claim, the way a real request does. */
    const asRoot = (sql) => psql('one', `-c "set request.jwt.claim.sub = '${uid}'" -c "${sql}"`);
    asRoot(`select public.choose_venue('${hall}', 220)`);

    const line = ask('one', "select estimate::text from public.budget_items where category='אולם' and label='אחוזת הכפר'");
    const want = onScreen(hallRow, 220);
    say(line === want, 'the budget line is the number the card showed',
      line === want ? '' : `screen said ${want}, budget got ${line || '(no row)'}`);

    /* And it says which side of the tax it is on, because a figure this size
       with no basis written next to it is a figure somebody will re-derive
       wrongly in March. */
    const basis = ask('one', "select notes from public.budget_items where category='אולם' and label='אחוזת הכפר'");
    say(basis.includes('מע״מ'), 'and the line says which side of the tax it is on',
      basis.includes('מע״מ') ? '' : `note reads: ${basis || '(none)'}`);

    const onEvent = ask('one', `select venue||'/'||guest_estimate from public.clients where id='${cid}'`);
    say(onEvent === 'אחוזת הכפר/220', 'and puts the hall and the count on the event',
      onEvent === 'אחוזת הכפר/220' ? '' : `got ${onEvent}`);

    /* The invariant the partial unique index exists for. Choosing the second
       hall has to unmark the first in the same statement pair, and if it does
       not the index refuses the write rather than letting two live. */
    asRoot(`select public.choose_venue('${cheaperHall}', 220)`);
    const chosen = ask('one', "select coalesce(string_agg(venue_name, ','), '-') from public.venue_comparisons where is_selected");
    say(chosen === 'בית הבאר', 'and only ever one hall is the chosen one',
      chosen === 'בית הבאר' ? '' : `chosen: ${chosen}`);

    /* Re-choosing the same hall must not leave two budget lines for it. A
       producer who presses it twice is a producer who pressed it twice. */
    asRoot(`select public.choose_venue('${cheaperHall}', 220)`);
    const lines = ask('one', "select count(*)::text from public.budget_items where category='אולם' and label='בית הבאר'");
    say(lines === '1', 'and pressing it twice leaves one budget line, not two',
      lines === '1' ? '' : `got ${lines} lines`);

    /* Zero guests means "use what the event already knows", not "multiply by
       nothing". The screen sends 0 before a couple has typed a number. */
    psql('one', `-c "update public.clients set guest_estimate = 100 where id='${cid}'"`);
    asRoot(`select public.choose_venue('${hall}', 0)`);
    const fallback = ask('one', "select estimate::text from public.budget_items where category='אולם' and label='אחוזת הכפר'");
    const wantFallback = onScreen(hallRow, 100);
    say(fallback === wantFallback, 'no guest count falls back to the event, not to zero',
      fallback === wantFallback ? '' : `expected ${wantFallback}, got ${fallback || '(no row)'}`);

    // ── 5. one producer cannot read another's ─────────────────────────────
    /* check-rls.mjs reads every policy and confirms each table is fenced.
       What it cannot do is run a query. Everything above runs as the
       superuser, which Postgres exempts from row level security, and the one
       call that carries a claim carries the root account's — so no test in
       this file has ever asked the database the question the policies exist
       to answer: signed in as one producer, how many of another producer's
       rows come back?

       Asked here, as `authenticated`, which is the role a real request
       arrives as and which owns none of these tables — so the policies are
       the only thing between the query and the rows. Three accounts that are
       not the root: producer A with a wedding on the books, producer B with
       nothing to do with it, and a couple invited onto A's event. Every count
       is of A's rows specifically, because the root account owns the fixture
       above and would legitimately see its own. */
    const person = (n) => `00000000-0000-4000-8000-00000000000${n}`;
    const [uidA, uidB, uidC] = [person(1), person(2), person(3)];
    const mailA = 'producer-a@example.com', mailB = 'producer-b@example.com', mailC = 'couple@example.com';
    for (const [id, mail] of [[uidA, mailA], [uidB, mailB], [uidC, mailC]]) {
      psql('one', `-c "insert into auth.users (id, email) values ('${id}','${mail}') on conflict do nothing"`);
    }
    /* New producers arrive pending. Approved here so that a zero below can
       only ever mean the policy said no, never that the account was still in
       the queue. Approved by the root account, carrying its claim, because
       the guard on producers.status lets nobody else — the first run of this
       block was refused by that guard from a claimless superuser session,
       which is the guard doing its job. */
    psql('one',
      `-c "set request.jwt.claim.sub = '${uid}'"`
      + ` -c "set request.jwt.claims = '{\\"sub\\":\\"${uid}\\",\\"email\\":\\"barakliver@gmail.com\\"}'"`
      + ` -c "update public.producers set status='approved' where owner_id in ('${uidA}','${uidB}')"`);
    const pidA = ask('one', `select id from public.producers where owner_id='${uidA}'`);

    psql('one', `-c "insert into public.clients (producer_id, display_name, kind, event_date, venue) values ('${pidA}','מאיה ועידו','wedding','2026-10-15','גני הדר')"`);
    const cidA = ask('one', `select id from public.clients where producer_id='${pidA}'`);
    psql('one', [
      `insert into public.leads (full_name, producer_id) values ('לקוח של א','${pidA}')`,
      `insert into public.budget_items (client_id, label) values ('${cidA}','אולם')`,
      `insert into public.guests_rsvp (client_id, full_name) values ('${cidA}','סבתא רחל')`,
      `insert into public.venue_comparisons (client_id, venue_name) values ('${cidA}','גני הדר')`,
      `insert into public.tasks (client_id, title) values ('${cidA}','לסגור צלם')`,
      `insert into public.day_schedule (client_id, at_time, title) values ('${cidA}','19:00','קבלת פנים')`,
      `insert into public.tables_seating (client_id, name) values ('${cidA}','שולחן 1')`,
      `insert into public.messages (client_id, author_id, body) values ('${cidA}','${uidA}','שלום')`,
      `insert into public.contracts (client_id, title) values ('${cidA}','הסכם אולם')`,
      `insert into public.event_vendors (client_id, name, category) values ('${cidA}','להקת שדות','music')`,
      `insert into public.producer_ledger (producer_id, client_id, kind, amount, label) values ('${pidA}','${cidA}','income',100,'טיפ')`,
      `insert into public.diary_entries (producer_id, client_id, title, on_date, at_time) values ('${pidA}','${cidA}','פגישה עם הפרחים','2026-10-02','10:00')`,
      `insert into public.event_critique_logs (client_id, venue_name, pros, cons, takeaways) values ('${cidA}','אחוזת הכפר','{barFast}','{musicTooLoud}','להוריד את המוזיקה באוכל')`,
      /* The Google link, as the server writes it: a token that must never
         reach a session. */
      `insert into public.google_calendars (producer_id, email, refresh_token, calendar_id) values ('${pidA}','a@gmail.test','1//secret-token','cal_a')`,
      `insert into public.support_tickets (reporter_id, producer_id, body) values ('${uidA}','${pidA}','משהו לא עובד')`,
      /* The producer's own meeting form, and a meeting written from it. Built
         with jsonb_build_* rather than a literal, because the literal's
         double quotes would end the shell string this runs inside. */
      `insert into public.meeting_templates (producer_id, name, sections) values ('${pidA}','שיחה ראשונה',`
        + ` jsonb_build_array(jsonb_build_object('title','מי','fields',`
        + ` jsonb_build_array(jsonb_build_object('id','q1','label','שמות','kind','text')))))`,
      `insert into public.meeting_logs (client_id, kind, template_id)`
        + ` select '${cidA}','custom',id from public.meeting_templates where producer_id='${pidA}'`,
      /* The invitation. The trigger finds the couple's profile by address and
         turns it into a client account, the way a real invitation does. */
      `insert into public.client_authorized_emails (client_id, email) values ('${cidA}','${mailC}')`,
    ].map((s) => `-c "${s}"`).join(' '));

    /* One connection, so the claims and the role are still set when the
       query runs. `set role authenticated` is the whole test: from that line
       on, the session is a signed-in stranger with no special standing. */
    const asAccount = (id, mail, sql) => sh(
      `${BIN}/psql -h ${dir} -U postgres -d one -tAq -v ON_ERROR_STOP=1`
      + ` -c "set request.jwt.claim.sub = '${id}'"`
      + ` -c "set request.jwt.claim.role = 'authenticated'"`
      + ` -c "set request.jwt.claims = '{\\"sub\\":\\"${id}\\",\\"email\\":\\"${mail}\\",\\"role\\":\\"authenticated\\"}'"`
      + ` -c "set role authenticated"`
      + ` -c "${sql}" 2>&1`,
    ).trim();

    /* Every table a wedding is made of, each counted down to A's own rows. */
    const ofA = {
      leads:             `producer_id='${pidA}'`,
      clients:           `id='${cidA}'`,
      budget_items:      `client_id='${cidA}'`,
      guests_rsvp:       `client_id='${cidA}'`,
      venue_comparisons: `client_id='${cidA}'`,
      tasks:             `client_id='${cidA}'`,
      day_schedule:      `client_id='${cidA}'`,
      tables_seating:    `client_id='${cidA}'`,
      messages:          `client_id='${cidA}'`,
      contracts:         `client_id='${cidA}'`,
      event_vendors:     `client_id='${cidA}'`,
      producer_ledger:   `producer_id='${pidA}'`,
      diary_entries:     `producer_id='${pidA}'`,
      event_critique_logs: `client_id='${cidA}'`,
      support_tickets:   `reporter_id='${uidA}'`,
      meeting_templates: `producer_id='${pidA}'`,
      meeting_logs:      `client_id='${cidA}'`,
    };
    const seen = (id, mail) => Object.fromEntries(
      Object.entries(ofA).map(([t, w]) => [t, asAccount(id, mail, `select count(*) from public.${t} where ${w}`)]),
    );
    const leaked = (counts) => Object.entries(counts).filter(([, n]) => n !== '0').map(([t, n]) => `${t}:${n}`);
    const missing = (counts) => Object.entries(counts).filter(([, n]) => n !== '1').map(([t, n]) => `${t}:${n || '(error)'}`);

    /* The positive control first. If A cannot see A's own rows, a zero for B
       proves nothing — the query may simply be failing. */
    const asA = seen(uidA, mailA);
    say(missing(asA).length === 0, 'a producer reads every row of their own event',
      missing(asA).length === 0 ? '' : `short: ${missing(asA).join(', ')}`);

    const asB = seen(uidB, mailB);
    say(leaked(asB).length === 0, "and nothing of another producer's",
      leaked(asB).length === 0 ? '' : `LEAKED to producer B: ${leaked(asB).join(', ')}`);

    /* The couple sees their own event and none of the producer's pipeline:
       leads are the business's, not the wedding's. */
    const coupleClient = asAccount(uidC, mailC, `select count(*) from public.clients where id='${cidA}'`);
    const coupleLeads = asAccount(uidC, mailC, `select count(*) from public.leads where producer_id='${pidA}'`);
    const coupleGuests = asAccount(uidC, mailC, `select count(*) from public.guests_rsvp where client_id='${cidA}'`);
    /* 0071: the couple's calendar carries their open, shared, dated tasks
       with the reminder, and not a private one. The feed function is the
       one thing anonymous may call, so it is called with no claims at all. */
    /* Written as producer A. A hidden task inserted by anybody else is made
       visible by 0028's trigger, which is that trigger doing its job and
       would make this test pass for the wrong reason. */
    psql('one',
      `-c "set request.jwt.claim.sub = '${uidA}'"`
      + ` -c "set request.jwt.claims = '{\\"sub\\":\\"${uidA}\\",\\"email\\":\\"${mailA}\\"}'"`
      + [
        `insert into public.tasks (client_id, title, due_on, remind_days, visible_to_client) values ('${cidA}','לשלוח הזמנות','2026-08-15',7,true)`,
        `insert into public.tasks (client_id, title, due_on, remind_days, visible_to_client) values ('${cidA}','לסגור יתרות','2026-10-01',3,false)`,
        `insert into public.calendar_feeds (token, profile_id, client_id) values ('test-token-for-the-couple-0123456789','${uidC}','${cidA}')`,
      ].map((s) => ` -c "${s}"`).join(''));
    const feed = sh(
      `${BIN}/psql -h ${dir} -U postgres -d one -tAq -v ON_ERROR_STOP=1`
      + ` -c "set role anon"`
      + ` -c "select string_agg(title || ':' || coalesce(remind_days::text,'-'), ',' order by starts_on) from public.calendar_by_token('test-token-for-the-couple-0123456789') where kind='task'" 2>&1`,
    ).trim();
    say(feed === 'לשלוח הזמנות:7', 'the couple\'s calendar carries their shared deadlines with the reminder, and no private one',
      `got: ${feed}`);

    /* 0078: the circle. A couple posts anonymously, and the promise is
       kept in the database rather than on the screen: reading the table
       direct is refused outright, the reader emits no author for an
       anonymous post, and a producer from another tenant sees none of it.
       The producer's badge is stamped from the author's real role. */
    psql('one',
      `-c "set request.jwt.claim.sub = '${uidC}'"`
      + ` -c "set request.jwt.claims = '{\\"sub\\":\\"${uidC}\\",\\"email\\":\\"${mailC}\\",\\"role\\":\\"authenticated\\"}'"`
      + ` -c "set role authenticated"`
      + ` -c "insert into public.forum_posts (producer_id, author_id, client_id, is_anonymous, category, title, content) values ('${pidA}','${uidC}','${cidA}',true,'vendors','שאלה על צלם','מישהו עבד עם צלם מהצפון')"`);
    const postId = ask('one', `select id from public.forum_posts limit 1`);
    /* The producer answers, and the badge is not something they sent. */
    psql('one',
      `-c "set request.jwt.claim.sub = '${uidA}'"`
      + ` -c "set request.jwt.claims = '{\\"sub\\":\\"${uidA}\\",\\"email\\":\\"${mailA}\\",\\"role\\":\\"authenticated\\"}'"`
      + ` -c "set role authenticated"`
      + ` -c "insert into public.forum_comments (post_id, author_id, is_producer, content) values ('${postId}','${uidA}',false,'שני צלמים שאני עובד איתם')"`);
    const badge = ask('one', `select is_producer::text from public.forum_comments where post_id='${postId}'`);
    let rawRead = '';
    try { rawRead = asAccount(uidC, mailC, `select author_id from public.forum_posts`); }
    catch (e) { rawRead = (e.stdout || e.message || '').toString(); }
    const feedSelf = asAccount(uidC, mailC,
      `select coalesce(nullif(author_name,''),'-') || '|' || is_anonymous::text from public.forum_feed('${pidA}','',10)`);
    const feedStranger = asAccount(uidB, mailB, `select count(*) from public.forum_feed('${pidA}','',10)`);
    /* Either a refusal or nothing at all: both keep the author, and the
       assertion is that the id is not in the answer however it came. */
    const authorHidden = !rawRead.includes(uidC);
    say(badge === 'true' && authorHidden && feedSelf === '-|true' && feedStranger === '0',
      'an anonymous post keeps its author from the table and from the reader, and the producer badge is stamped not sent',
      `badge:${badge} raw:${authorHidden ? (rawRead ? 'refused' : 'empty') : 'LEAKED'} feed:${feedSelf} stranger:${feedStranger}`);

    /* 0077: the owner sees that Google is connected and whose account,
       through the view, and cannot read the token even from their own row;
       another producer sees no link at all. */
    const viewOwn = asAccount(uidA, mailA, `select email from public.my_google_calendar`);
    const viewOther = asAccount(uidB, mailB, `select count(*) from public.my_google_calendar`);
    let tokenRead = '';
    try { tokenRead = asAccount(uidA, mailA, `select refresh_token from public.google_calendars`); }
    catch (e) { tokenRead = (e.stdout || e.message || '').toString(); }
    say(viewOwn === 'a@gmail.test' && viewOther === '0' && /permission denied/.test(tokenRead) && !/secret-token/.test(tokenRead),
      'the Google link shows its address to its owner, hides its token from everyone, and nothing to a stranger',
      `own:${viewOwn} other:${viewOther} token:${/permission denied/.test(tokenRead) ? 'refused' : tokenRead}`);
    /* And the phone's subscription carries the entry. */
    psql('one', `-c "insert into public.calendar_feeds (token, profile_id) values ('test-token-for-the-producer-0123456789','${uidA}')"`);
    const ownFeed = sh(
      `${BIN}/psql -h ${dir} -U postgres -d one -tAq -v ON_ERROR_STOP=1`
      + ` -c "set role anon"`
      + ` -c "select string_agg(kind || ':' || title, ',' order by kind) from public.calendar_by_token('test-token-for-the-producer-0123456789') where kind in ('entry','event')" 2>&1`,
    ).trim();
    say(ownFeed === 'entry:פגישה עם הפרחים,event:מאיה ועידו', 'the producer\'s subscription carries their own entries beside the weddings', `got: ${ownFeed}`);

    /* 0076: the couple picks an option on their own wedding through the
       definer function, a stranger is refused by it, and the guests' page
       carries the brand. The row policy gives the couple no write on
       clients, so the function is the only door and this is the test that
       it opens for the right person only. */
    const pickOwn = asAccount(uidC, mailC, `select public.pick_brand_variant('${cidA}','invite','bold')`);
    const picked = ask('one', `select brand->'picks'->>'invite' from public.clients where id='${cidA}'`);
    let pickStranger = '';
    try { pickStranger = asAccount(uidB, mailB, `select public.pick_brand_variant('${cidA}','menu','safe')`); }
    catch (e) { pickStranger = (e.stdout || e.message || '').toString(); }
    const strangerPicked = ask('one', `select coalesce(brand->'picks'->>'menu','-') from public.clients where id='${cidA}'`);
    const siteCols = ask('one', `select pg_get_function_result('public.guest_site(text)'::regprocedure)`);
    say(picked === 'bold' && /not your workspace|permission denied/.test(pickStranger) && strangerPicked === '-' && /brand jsonb/.test(siteCols),
      'the couple picks a brand option on their wedding, a stranger cannot, and the guests\' page carries the brand',
      `own:${pickOwn || 'ok'} picked:${picked} stranger:${strangerPicked} cols:${siteCols}`);

    /* And their suppliers: the DJ they ticked off has to be a row they can
       read back, or the form that asked them lied. */
    const coupleVendors = asAccount(uidC, mailC, `select count(*) from public.event_vendors where client_id='${cidA}'`);
    say(coupleClient === '1' && coupleGuests === '1' && coupleVendors === '1' && coupleLeads === '0',
      'an invited couple reads their event, their suppliers, and no lead',
      `event:${coupleClient} guests:${coupleGuests} vendors:${coupleVendors} leads:${coupleLeads}`);

    /* The platform owner. Every tenant policy above was written without a
       root branch, and this is the line that keeps it that way: the root
       account, with its own claim and its own address, reading a producer's
       private rows and getting none — and the one table it is meant to read,
       the ticket a producer filed with it, coming back. */
    const asRootAcct = seen(uid, 'barakliver@gmail.com');
    const { support_tickets: rootTicket, ...rootTenant } = asRootAcct;
    say(leaked(rootTenant).length === 0, "the owner reads no producer's private rows",
      leaked(rootTenant).length === 0 ? '' : `visible to root: ${leaked(rootTenant).join(', ')}`);
    say(rootTicket === '1', 'and does read the ticket filed with them',
      rootTicket === '1' ? '' : `tickets visible to root: ${rootTicket || '(error)'}`);
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
