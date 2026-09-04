/**
 * Will the sign-in code reach an inbox, or a spam folder?
 *
 *     node scripts/check-mail.mjs
 *     node scripts/check-mail.mjs --domain example.com --selector resend
 *
 * This is the one failure in the product that no amount of correct code can
 * fix and no test can catch, because it happens after the message leaves the
 * building. A person asks for a code, the code is sent, the send succeeds, and
 * the message lands in spam — so the screen says "we sent it" and the truth is
 * that nobody will ever see it. Every report of this arrives as "sign-in is
 * broken", which sends somebody to read code that is working.
 *
 * Three records decide it, and all three live at the registrar rather than in
 * this repository:
 *
 *   SPF     names the servers allowed to send as this domain.
 *   DKIM    is the key their signature is checked against.
 *   DMARC   tells a receiver what to do when the first two do not line up.
 *
 * The dangerous combination is a strict DMARC with nothing to satisfy it: the
 * domain has instructed the world to quarantine anything it cannot verify, and
 * then published no way to verify anything. That is not a weak setup, it is
 * worse than having no records at all, and it is invisible from inside.
 *
 * Read only. It asks public DNS and prints what it finds.
 */
import { promises as dns } from 'node:dns';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const domain = arg('domain', 'liverproductions.com');
/* The name the provider signs under. Resend publishes `resend._domainkey`,
   Postmark uses a per-server selector, Google uses `google`. Checked as a
   list, because the answer to "which provider" is a setting somewhere else. */
const selectors = arg('selector', 'resend,postmark,google,default,s1,k1,mail').split(',');

const findings = [];
const note = (level, title, detail) => findings.push({ level, title, detail });

async function txt(name) {
  try {
    const rows = await dns.resolveTxt(name);
    return rows.map((r) => r.join(''));
  } catch (e) {
    if (e.code === 'ENODATA' || e.code === 'ENOTFOUND') return [];
    throw e;
  }
}

console.log(`\nchecking mail for ${domain}\n`);

// ── SPF ─────────────────────────────────────────────────────────────────────
const root = await txt(domain);
const spf = root.filter((r) => /^v=spf1\b/i.test(r));

if (spf.length === 0) {
  note('fail', 'no SPF record',
    'Nothing tells a receiver which servers may send as this domain. Add a TXT '
    + `record on ${domain} of the form "v=spf1 include:<your provider> ~all". `
    + 'Resend is include:amazonses.com; Postmark is include:spf.mtasv.net.');
} else if (spf.length > 1) {
  note('fail', 'more than one SPF record',
    'A domain may publish exactly one. Receivers treat two as a permanent error '
    + 'and fail every message. Merge them into a single record with several '
    + `include: terms. Found ${spf.length}.`);
} else {
  const record = spf[0];
  const soft = /~all\s*$/.test(record);
  const hard = /-all\s*$/.test(record);
  const open = /\+all\s*$/.test(record);
  note('ok', 'SPF is published', record);
  if (open) {
    note('fail', 'SPF ends in +all',
      'That authorises the entire internet to send as this domain, which is the '
      + 'same as having no record while looking like having one. Use ~all.');
  } else if (!soft && !hard) {
    note('warn', 'SPF has no closing rule',
      'Without a trailing ~all or -all a receiver has no instruction for servers '
      + 'the record does not list.');
  }
  if (!/include:|ip4:|ip6:|a\b|mx\b/i.test(record)) {
    note('warn', 'SPF authorises nobody',
      'The record exists but lists no servers, so every message fails it.');
  }
}

// ── DKIM ────────────────────────────────────────────────────────────────────
const found = [];
for (const selector of selectors) {
  const rows = await txt(`${selector}._domainkey.${domain}`);
  if (rows.some((r) => /p=|v=DKIM1/i.test(r))) found.push(selector);
}

if (found.length === 0) {
  note('fail', 'no DKIM key found',
    `None of the usual selectors (${selectors.join(', ')}) is published. Your `
    + 'provider gives you the exact record when you add the domain to it. '
    + 'Without DKIM a forwarded message loses SPF and fails everything.');
} else {
  note('ok', 'DKIM is published', `selector: ${found.join(', ')}`);
}

// ── DMARC ───────────────────────────────────────────────────────────────────
const dmarc = (await txt(`_dmarc.${domain}`)).filter((r) => /^v=DMARC1\b/i.test(r));

if (dmarc.length === 0) {
  note('warn', 'no DMARC record',
    'Receivers decide for themselves what to do with unverified mail. Worth '
    + 'adding once SPF and DKIM pass, starting at p=none.');
} else {
  const record = dmarc[0];
  const policy = /\bp=(\w+)/i.exec(record)?.[1]?.toLowerCase() ?? 'none';
  note('ok', 'DMARC is published', record);

  /* DMARC passes on either one, so the honest reading depends on how many of
     the two are actually usable. Reporting a strict policy as fatal whenever
     SPF is missing would be a wrong diagnosis, and a wrong diagnosis sends
     somebody to the registrar to fix something that was already working. */
  const spfOk = spf.length === 1 && !/\+all/.test(spf[0]) && /include:|ip4:|ip6:|a\b|mx\b/i.test(spf[0]);
  const strict = policy === 'quarantine' || policy === 'reject';
  const verb = policy === 'reject' ? 'refuse' : 'send to spam';

  if (strict && !spfOk && found.length === 0) {
    note('fail', `DMARC says ${policy} and neither SPF nor DKIM is usable`,
      `This domain has told the world to ${verb} anything it cannot verify, and `
      + 'then published no way to verify anything. Every message is being treated '
      + 'exactly as instructed. Fix this before looking at any code.');
  } else if (strict && !spfOk) {
    note('warn', `DMARC says ${policy}, and DKIM is carrying it alone`,
      'DMARC passes on SPF or DKIM, and DKIM is published, so directly delivered '
      + 'mail signed by that provider should still arrive. What has no second leg '
      + 'to stand on is everything else: a forwarded message usually loses the '
      + 'signature, and any sender other than that one provider fails outright. '
      + 'Adding SPF is the cheap half of the fix.');
  }
}

/* The question DNS cannot answer, and the one that decides this in practice.
   Every record above can be perfect and the codes still land in spam, because
   the codes are not sent by this application: Supabase sends them, and unless
   its SMTP settings point at the provider whose key is published above, they
   leave from a shared server on somebody else's domain, with somebody else's
   reputation and somebody else's hourly cap. */
note('warn', 'one thing this cannot see from here',
  'The sign-in codes are sent by Supabase, not by this app. Check '
  + 'Authentication → Emails → SMTP Settings in the Supabase project: if it is '
  + 'empty, the records above are not being used at all, because the mail is not '
  + 'leaving from this domain. That single setting is the difference between '
  + 'these records mattering and these records being decoration.');

// ── report ──────────────────────────────────────────────────────────────────
const order = { fail: 0, warn: 1, ok: 2 };
findings.sort((a, b) => order[a.level] - order[b.level]);

const mark = { ok: 'ok  ', warn: 'warn', fail: 'FAIL' };
for (const f of findings) {
  console.log(`  ${mark[f.level]}  ${f.title}`);
  for (const line of String(f.detail).match(/.{1,74}(\s|$)/g) ?? []) {
    console.log(`        ${line.trim()}`);
  }
  console.log('');
}

const failed = findings.filter((f) => f.level === 'fail').length;
console.log(failed === 0
  ? 'nothing here would send a sign-in code to spam\n'
  : `${failed} thing${failed === 1 ? '' : 's'} here will send sign-in codes to spam\n`);

/* Zero either way. This reports on records nobody can change from a build
   machine, so failing a deploy on it would block a release on a registrar. */
process.exit(0);
