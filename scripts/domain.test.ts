import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALCOHOL_DEFAULTS,
  estimateAlcohol,
  normalizeAges,
  type AlcoholInput,
} from '../lib/domain/alcohol.ts';
import {
  buildIcs,
  escapeIcsText,
  filterTimeline,
  foldIcsLine,
  splitCountdown,
  countdownMs,
  toMinutes,
  type TimelineEntry,
} from '../lib/domain/timeline.ts';
import { parseCsv, parseGuestCsv } from '../lib/domain/guests.ts';

// ---------------------------------------------------------------------------
// Alcohol estimator
// ---------------------------------------------------------------------------

const base: AlcoholInput = { ...ALCOHOL_DEFAULTS, guests: 200 };

test('age distribution normalizes to fractions summing to 1', () => {
  const n = normalizeAges({ under25: 50, age25to40: 50, age40to60: 0, over60: 0 });
  assert.equal(n.under25 + n.age25to40 + n.age40to60 + n.over60, 1);
  assert.equal(n.under25, 0.5);
});

test('an empty age distribution falls back to a typical spread', () => {
  const n = normalizeAges({ under25: 0, age25to40: 0, age40to60: 0, over60: 0 });
  assert.equal(n.under25 + n.age25to40 + n.age40to60 + n.over60, 1);
});

test('consumption scales with guest count', () => {
  const small = estimateAlcohol({ ...base, guests: 100 });
  const large = estimateAlcohol({ ...base, guests: 400 });
  assert.ok(large.totalLiters > small.totalLiters * 3.5);
});

test('a longer event needs more alcohol', () => {
  const short = estimateAlcohol({ ...base, hours: 4 });
  const long = estimateAlcohol({ ...base, hours: 9 });
  assert.ok(long.totalLiters > short.totalLiters);
});

test('summer raises consumption and ice over winter', () => {
  const summer = estimateAlcohol({ ...base, season: 'summer' });
  const winter = estimateAlcohol({ ...base, season: 'winter' });
  assert.ok(summer.totalLiters > winter.totalLiters);
  assert.ok(summer.iceKg > winter.iceKg);
});

test('a young crowd drinks more than an older one', () => {
  const young = estimateAlcohol({
    ...base,
    ageDistribution: { under25: 100, age25to40: 0, age40to60: 0, over60: 0 },
  });
  const older = estimateAlcohol({
    ...base,
    ageDistribution: { under25: 0, age25to40: 0, age40to60: 0, over60: 100 },
  });
  assert.ok(young.totalLiters > older.totalLiters);
});

test('age shifts the mix: young to beer/vodka, older to wine/whiskey', () => {
  const young = estimateAlcohol({
    ...base,
    ageDistribution: { under25: 100, age25to40: 0, age40to60: 0, over60: 0 },
  });
  const older = estimateAlcohol({
    ...base,
    ageDistribution: { under25: 0, age25to40: 0, age40to60: 0, over60: 100 },
  });
  const share = (e: typeof young, key: string) => {
    const line = e.lines.find((l) => l.key === key);
    return line ? line.liters / e.purchaseLiters : 0;
  };
  assert.ok(share(young, 'vodka') > share(older, 'vodka'));
  assert.ok(share(older, 'wine') > share(young, 'wine'));
  assert.ok(share(older, 'whiskey') > share(young, 'whiskey'));
});

test('a dance-floor event drinks more than a seated dinner', () => {
  const seated = estimateAlcohol({ ...base, style: 'seated' });
  const dancing = estimateAlcohol({ ...base, style: 'dancing' });
  assert.ok(dancing.totalLiters > seated.totalLiters);
});

test('a full open bar leaves nothing to buy', () => {
  const e = estimateAlcohol({ ...base, venueSupply: 'open' });
  assert.equal(e.purchaseLiters, 0);
  assert.equal(e.lines.length, 0);
  assert.equal(e.totalCost, 0);
});

test('venue supply never exceeds total consumption', () => {
  const e = estimateAlcohol({
    ...base,
    guests: 20,
    venueSupply: 'bottles',
    tables: 50,
    bottlesPerTable: 10,
  });
  assert.ok(e.suppliedLiters <= e.totalLiters);
  assert.ok(e.purchaseLiters >= 0);
});

test('partial supply covers wine and beer, leaving spirits to buy', () => {
  const e = estimateAlcohol({ ...base, venueSupply: 'partial' });
  assert.ok(e.purchaseLiters > 0);
  assert.ok(e.suppliedLiters > 0);
});

test('bottles are whole numbers and cost matches unit price', () => {
  const e = estimateAlcohol(base);
  for (const line of e.lines) {
    assert.ok(Number.isInteger(line.bottles), `${line.key} bottles must be whole`);
    assert.ok(line.bottles > 0);
    assert.equal(line.cost, line.bottles * line.unitPrice);
    // A bottle must hold at least the litres assigned to it, after rounding up.
    assert.ok(line.bottles * line.bottleSizeL >= line.liters - 0.05);
  }
  assert.equal(
    e.totalCost,
    Math.round(e.lines.reduce((s, l) => s + l.cost, 0)),
  );
});

test('beer is sold in 0.33L bottles and wine in 0.75L', () => {
  const e = estimateAlcohol(base);
  assert.equal(e.lines.find((l) => l.key === 'beer')?.bottleSizeL, 0.33);
  assert.equal(e.lines.find((l) => l.key === 'wine')?.bottleSizeL, 0.75);
});

test('zero guests produces an empty, non-throwing estimate', () => {
  const e = estimateAlcohol({ ...base, guests: 0 });
  assert.equal(e.totalLiters, 0);
  assert.equal(e.lines.length, 0);
  assert.equal(e.iceKg, 0);
});

test('nobody drinking produces no alcohol but still soft drinks', () => {
  const e = estimateAlcohol({ ...base, drinkersPct: 0 });
  assert.equal(e.totalLiters, 0);
  assert.ok(e.softDrinkLiters > 0);
});

test('price overrides flow through to cost', () => {
  const cheap = estimateAlcohol({ ...base, prices: { vodka: 1 } });
  const dear = estimateAlcohol({ ...base, prices: { vodka: 1000 } });
  assert.ok(dear.totalCost > cheap.totalCost);
});

// ---------------------------------------------------------------------------
// Timeline & ICS
// ---------------------------------------------------------------------------

const timeline: TimelineEntry[] = [
  { time: '21:00', title: 'חופה', audiences: ['all'] },
  { time: '09:45', title: 'איפור ושיער', audiences: ['couple'] },
  { time: '12:00', title: 'הקמת סאונד', audiences: ['crew'] },
  { time: '15:30', title: 'צילומי חוץ', audiences: ['photo', 'couple'] },
  { time: '23:30', title: 'פירוק ציוד', audiences: ['crew'] },
];

test('timeline sorts chronologically', () => {
  const rows = filterTimeline(timeline, 'all');
  assert.deepEqual(rows.map((r) => r.time), ['09:45', '12:00', '15:30', '21:00', '23:30']);
});

test('role filter returns only that audience plus shared entries', () => {
  const crew = filterTimeline(timeline, 'crew').map((r) => r.title);
  assert.ok(crew.includes('הקמת סאונד'));
  assert.ok(crew.includes('פירוק ציוד'));
  assert.ok(!crew.includes('איפור ושיער'));

  const couple = filterTimeline(timeline, 'couple').map((r) => r.title);
  assert.ok(couple.includes('איפור ושיער'));
  assert.ok(couple.includes('צילומי חוץ'));
  assert.ok(couple.includes('חופה'), 'an "all" entry belongs to every audience');
});

test('untagged entries fall back to keyword matching', () => {
  const rows = filterTimeline([{ time: '13:00', title: 'צלם מגיע' }], 'photo');
  assert.equal(rows.length, 1);
});

test('unparseable times sort last instead of throwing', () => {
  assert.equal(toMinutes('19:30'), 1170);
  assert.equal(toMinutes('99:99'), Number.MAX_SAFE_INTEGER);
  assert.equal(toMinutes(''), Number.MAX_SAFE_INTEGER);
});

test('ICS escaping follows RFC 5545', () => {
  assert.equal(escapeIcsText('a,b;c\\d'), 'a\\,b\\;c\\\\d');
  assert.equal(escapeIcsText('line1\nline2'), 'line1\\nline2');
});

test('ICS lines fold at 75 octets with a leading space on continuations', () => {
  const folded = foldIcsLine('X'.repeat(200));
  const parts = folded.split('\r\n');
  assert.ok(parts.length > 1);
  assert.ok(Buffer.byteLength(parts[0]!) <= 75);
  for (const part of parts.slice(1)) {
    assert.equal(part[0], ' ');
    assert.ok(Buffer.byteLength(part) <= 75);
  }
});

test('folding is byte-aware for Hebrew (multi-byte) text', () => {
  const folded = foldIcsLine('דנה ויוסי '.repeat(20));
  for (const part of folded.split('\r\n')) {
    assert.ok(Buffer.byteLength(part) <= 75, 'no folded line may exceed 75 octets');
  }
});

test('buildIcs emits a valid single-event calendar with CRLF endings', () => {
  const ics = buildIcs({
    feed: {
      display_name: 'דנה ויוסי',
      event_date: '2026-11-05',
      event_start: '2026-11-05T19:00:00+02:00',
      event_end: '2026-11-06T02:00:00+02:00',
      venue_name: 'Garden Hall',
      venue_address: 'Tel Aviv',
      timezone: 'Asia/Jerusalem',
    },
    uid: 'test@liver',
    now: new Date('2026-08-22T00:00:00Z'),
  });

  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'));
  assert.ok(ics.includes('UID:test@liver'));
  assert.ok(ics.includes('DTSTART:20261105T170000Z'), 'local +02:00 converts to UTC');
  assert.ok(ics.includes('DTEND:20261106T000000Z'));
  assert.ok(ics.includes('DTSTAMP:20260822T000000Z'));
  assert.ok(ics.includes('BEGIN:VALARM'));
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 1);
  // Every line must be CRLF-terminated per RFC 5545.
  assert.ok(!/[^\r]\n/.test(ics));
});

test('buildIcs falls back to a 19:00 local start when only a date is known', () => {
  const ics = buildIcs({
    feed: {
      display_name: 'Event',
      event_date: '2026-11-05',
      event_start: null,
      event_end: null,
      venue_name: null,
      venue_address: null,
      timezone: 'Asia/Jerusalem',
    },
    uid: 'u',
    now: new Date('2026-08-22T00:00:00Z'),
  });
  assert.ok(ics.includes('DTSTART:20261105T170000Z'));
});

test('buildIcs omits the event entirely when there is no date', () => {
  const ics = buildIcs({
    feed: {
      display_name: 'Undated',
      event_date: null,
      event_start: null,
      event_end: null,
      venue_name: null,
      venue_address: null,
      timezone: 'Asia/Jerusalem',
    },
    uid: 'u',
  });
  assert.ok(!ics.includes('BEGIN:VEVENT'));
  assert.ok(ics.includes('END:VCALENDAR'));
});

test('countdown never goes negative and splits correctly', () => {
  const now = new Date('2026-08-22T00:00:00Z');
  assert.equal(countdownMs(new Date('2026-08-21T00:00:00Z'), now), 0);
  const ms = countdownMs(new Date('2026-08-24T03:04:05Z'), now);
  assert.deepEqual(splitCountdown(ms), { days: 2, hours: 3, minutes: 4, seconds: 5 });
});

// ---------------------------------------------------------------------------
// Guest CSV import
// ---------------------------------------------------------------------------

test('CSV parser handles quotes, escaped quotes and CRLF', () => {
  const rows = parseCsv('a,"b,c",d\r\n"he said ""hi""",2,3\r\n');
  assert.deepEqual(rows[0], ['a', 'b,c', 'd']);
  assert.deepEqual(rows[1], ['he said "hi"', '2', '3']);
});

test('Hebrew headers map to guest fields', () => {
  const { rows, skipped } = parseGuestCsv('שם,כמות,מנה\nדנה כהן,2,טבעוני\nיוסי לוי,1,כשר\n');
  assert.equal(skipped.length, 0);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.full_name, 'דנה כהן');
  assert.equal(rows[0]!.party_size, 2);
  assert.equal(rows[0]!.meal_preference, 'vegan');
  assert.equal(rows[1]!.meal_preference, 'kosher');
});

test('English headers map too, and a BOM is tolerated', () => {
  const { rows } = parseGuestCsv('﻿name,email,guests,meal\nDana,d@x.com,3,vegetarian\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.email, 'd@x.com');
  assert.equal(rows[0]!.party_size, 3);
  assert.equal(rows[0]!.meal_preference, 'vegetarian');
});

test('a headerless file treats the first column as the name', () => {
  const { rows } = parseGuestCsv('דנה כהן\nיוסי לוי\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.full_name, 'דנה כהן');
});

test('nameless rows are reported, not silently dropped', () => {
  const { rows, skipped } = parseGuestCsv('שם,כמות\nדנה,2\n,3\n');
  assert.equal(rows.length, 1);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0]!, /Row 3/);
});

test('a malformed email is cleared rather than losing the guest', () => {
  const { rows } = parseGuestCsv('name,email\nDana,not-an-email\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.email, '');
});

test('an unknown meal falls back to regular', () => {
  const { rows } = parseGuestCsv('name,meal\nDana,sushi\n');
  assert.equal(rows[0]!.meal_preference, 'regular');
});

test('side aliases resolve in both languages', () => {
  const { rows } = parseGuestCsv('name,side\nA,כלה\nB,groom\n');
  assert.equal(rows[0]!.side, 'partner_a');
  assert.equal(rows[1]!.side, 'partner_b');
});

test('blank lines are ignored', () => {
  const { rows } = parseGuestCsv('name\nDana\n\n\nYossi\n');
  assert.equal(rows.length, 2);
});

// ---------------------------------------------------------------------------
// Multi-tenant host routing (Phase 4)
// ---------------------------------------------------------------------------

import {
  isRootHost,
  normalizeHost,
  parseRootHosts,
  subdomainLabel,
} from '../lib/domain/hosts.ts';

const ROOTS = parseRootHosts('localhost,liver.app,www.liver.app');

test('host normalization strips port and case', () => {
  assert.equal(normalizeHost('Events.Keren-Weddings.COM:3000'), 'events.keren-weddings.com');
  assert.equal(normalizeHost('localhost:3000'), 'localhost');
  assert.equal(normalizeHost(null), '');
});

test('platform hosts are not tenants', () => {
  assert.ok(isRootHost('localhost', ROOTS));
  assert.ok(isRootHost('liver.app', ROOTS));
  assert.ok(isRootHost('www.liver.app', ROOTS));
  assert.ok(isRootHost('my-branch-abc.vercel.app', ROOTS), 'previews serve the platform');
  assert.ok(isRootHost('', ROOTS), 'a missing host must not resolve to a tenant');
});

test('producer domains and subdomains are tenants', () => {
  assert.equal(isRootHost('events.keren-weddings.com', ROOTS), false);
  assert.equal(isRootHost('keren.liver.app', ROOTS), false);
});

test('a lookalike host does not match the platform', () => {
  // Guards against a naive endsWith check treating this as the platform.
  assert.equal(isRootHost('notliver.app', ROOTS), false);
  assert.equal(isRootHost('liver.app.evil.com', ROOTS), false);
});

test('subdomain label feeds slug matching', () => {
  assert.equal(subdomainLabel('keren.liver.app'), 'keren');
  assert.equal(subdomainLabel('events.keren-weddings.com'), 'events');
});

test('root host list falls back to a safe default', () => {
  const fallback = parseRootHosts(undefined);
  assert.ok(fallback.has('localhost'));
  assert.ok(fallback.has('liver.app'));
});
