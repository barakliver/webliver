#!/usr/bin/env node
/**
 * Every screen behind the sign-in says who may open it.
 *
 * Authorisation in this product is enforced per page: each route calls one of
 * the guards in lib/auth.ts, and each guard redirects the roles that have no
 * business there. Checked one by one, that is correct today — a couple typing
 * /app/clients into the address bar is sent to their own portal by
 * requireLiveProducer, and /app/admin is requireRoot.
 *
 * What it does not have is a second line. A guard is a line of code somebody
 * has to remember to write, there is nothing above it that would catch its
 * absence, and a page with no guard does not look wrong — it looks like a
 * page. The failure mode is not a bug report, it is a couple who happens to
 * open a link and sees another event's file.
 *
 * So the absence is made loud here instead. A new route under /app that names
 * no guard fails the suite on the commit that adds it, which is the only
 * moment the omission is cheap.
 *
 * Deliberately not solved in the proxy. Blocking by role there would mean
 * reading the role on every request, which is a database round trip in front
 * of every page and every image on a machine with a gigabyte of memory, and
 * it would buy nothing that this does not: the per-page guards already hold,
 * and what was missing was the guarantee that they keep holding. A build-time
 * proof is worth more than a runtime tax that can also be forgotten.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const GUARDS = ['requireRoot', 'requireLiveProducer', 'requireAccount'];

/* Routes a signed-in person of any role may open, with what each one is.
   Everything else under /app has to be producer-only or root-only.

   Listed by hand rather than inferred. Which screens a couple is allowed to
   see is a decision about the product, and a rule that derives it from the
   folder layout would silently approve the next screen somebody puts in the
   wrong folder. */
const SHARED = {
  'app/page.tsx': 'the root, which reads the role and sends each one onward',
  'app/portal/page.tsx': "the couple's own area",
  'app/me/page.tsx': 'a person’s own profile',
  'app/pending/page.tsx': 'the holding screen for a producer awaiting approval',
  'app/guide/page.tsx': 'the operating book, which both sides are pointed at',
  'app/clients/[id]/runsheet/page.tsx': 'the run sheet, shared with the couple on the day',
  'app/sop/page.tsx': 'a redirect onto a guarded screen, holding no data of its own',
};

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('page.tsx')) out.push(p);
  }
  return out;
};

const pages = walk('src/app/app');
const problems = [];
let producerOnly = 0;

for (const file of pages) {
  const route = file.replace('src/app/', '');
  const body = readFileSync(file, 'utf8');
  const guard = GUARDS.find((g) => new RegExp(`\\b${g}\\s*\\(`).test(body));

  if (!guard) {
    /* A redirect-only page holds nothing to protect, and the screen it points
       at does its own checking. Recognised rather than exempted by name, so
       the exemption cannot outlive the redirect. */
    const isRedirectOnly = /\bredirect\s*\(/.test(body) && !/\bfrom\s+'@\/lib\/supabase/.test(body);
    if (isRedirectOnly && route in SHARED) continue;

    problems.push(`${route}\n    names no guard at all, so any signed-in person opens it`);
    continue;
  }

  if (guard === 'requireAccount' && !(route in SHARED)) {
    problems.push(
      `${route}\n    only checks that somebody is signed in, which includes every couple.\n` +
      `    Use requireLiveProducer, or add it to SHARED in this file with a reason.`,
    );
    continue;
  }

  if (guard !== 'requireAccount') producerOnly += 1;
}

/* The guards themselves have to keep doing what their names say. A rename or
   a refactor that dropped the client redirect out of requireLiveProducer
   would leave every page above still calling it and still passing this. */
const auth = readFileSync('src/lib/auth.ts', 'utf8');
if (!/requireLiveProducer[\s\S]{0,400}role === 'client'[\s\S]{0,120}redirect\('\/app\/portal'\)/.test(auth)) {
  problems.push("src/lib/auth.ts\n    requireLiveProducer no longer sends a couple to their own portal");
}
if (!/requireRoot[\s\S]{0,300}role !== 'super_admin'[\s\S]{0,80}redirect/.test(auth)) {
  problems.push("src/lib/auth.ts\n    requireRoot no longer turns away anybody who is not the root admin");
}

if (problems.length) {
  console.error('\nscreens that do not say who may open them:\n');
  for (const p of problems) console.error('  ' + p + '\n');
  process.exit(1);
}

console.log(
  `\nevery screen says who may open it  (${producerOnly} producer-only, ` +
  `${Object.keys(SHARED).length} shared on purpose, ${pages.length} read)\n`,
);
