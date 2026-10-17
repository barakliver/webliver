import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateRunOfShow, anchorsOf, forAudience, shiftAfter, addMinutes, toMinutes } from '../runOfShow.ts';
import { WEDDING_DAY_QUESTIONS } from '../../content/weddingDay.ts';
import type { Answer } from '../intake.ts';

/**
 * Three weddings through the generator, and the one promise the printed
 * versions make: a secret never reaches the couple.
 */
const by = 'aaaa';
const ans = (question_key: string, value: unknown): Answer => ({ question_key, answered_by: by, value, visibility: 'couple' });

const secular: Answer[] = [
  ans('wd_a3_prep_photos', 'both'), ans('wd_a4_first_look', 'yes'), ans('wd_a5_transport', 'car'),
  ans('wd_b7_reception', '19:00'), ans('wd_b8_at_reception', 'yes'), ans('wd_b10_host', [{ name: 'רועי', phone: '0501234567' }]),
  ans('wd_c14_officiant', [{ name: 'דנה', phone: '', arrives: '19:45', needs: 'מיקרופון' }]),
  ans('wd_c15_entrances', [{ who: 'סבתא רחל', with: 'אבא', song: 'Can\'t Help Falling in Love', artist: 'Elvis', cue: '0:40' }, { who: 'איתי', with: 'ההורים', song: 'Here Comes the Sun', artist: 'The Beatles' }, { who: 'נועה', with: 'אבא', song: 'A Thousand Years', artist: 'Christina Perri', cue: '0:20' }]),
  ans('wd_c21_yichud', 'no'),
  ans('wd_d23_entry', 'together'), ans('wd_d23_song', 'שיר הכניסה'),
  ans('wd_d24_slow', 'yes'), ans('wd_d24_song', 'Perfect'), ans('wd_d24_when', 'entry'),
  ans('wd_d26_courses', [{ course: 'ראשונה', time: '21:15' }, { course: 'עיקרית', time: '22:00' }]),
  ans('wd_d27_speeches', [{ who: 'אבא של נועה', minutes: '4', when: 'אחרי ראשונה' }]),
  ans('wd_d28_surprises', [{ what: 'סרטון מהחברים', knows: 'נועה', secret_from: 'איתי', needs: 'מסך, מיקרופון', when: '22:30' }]),
  ans('wd_d30_must', ['Dancing Queen']), ans('wd_d30_no', ['Macarena']),
  ans('wd_e33_contract_end', '01:00'), ans('wd_e34_after', 'yes'), ans('wd_e34_detail', [{ where: 'בבית של רועי', from: '01:30', food: 'פיצה', vendor_at: '01:15' }]),
  ans('wd_f38_contacts', [{ name: 'רועי', role: 'מקבל ספקים', phone: '0501234567', when: 'מהצהריים' }]),
];

test('a secular wedding builds a full evening from the reception anchor', () => {
  const lines = generateRunOfShow(secular);
  assert.ok(lines.length >= 25, `only ${lines.length} lines`);
  const a = anchorsOf(secular)!;
  assert.equal(a.chuppah, '20:10');
  assert.equal(a.party, '20:55');
  const titles = lines.map((l) => l.title);
  assert.ok(titles.includes('צילום התארגנות'));
  assert.ok(titles.includes('מפגש ראשון'));
  assert.ok(titles.some((t) => t.startsWith('כניסה: סבתא רחל')));
  /* The officiant arrives at the time the answer said, not the default. */
  assert.equal(lines.find((l) => l.title === 'הגעת דנה')?.at_time, '19:45');
  /* Each entrance carries its own song. */
  const noa = lines.find((l) => l.title.startsWith('כניסה: נועה'))!;
  assert.equal(noa.song_title, 'A Thousand Years');
  assert.equal(noa.song_cue, '0:20');
  /* The lines are in the evening's order, with 01:00 after 23:00. */
  const order = lines.map((l) => (toMinutes(l.at_time) as number) + ((toMinutes(l.at_time) as number) < 300 ? 1440 : 0));
  assert.deepEqual(order, [...order].sort((x, y) => x - y));
});

test('a religious wedding after Shabbat gets its yichud and a later party', () => {
  const religious: Answer[] = [
    ans('wd_b7_reception', '20:30'), ans('wd_c13_time', '21:30'), ans('wd_c21_yichud', 'yes'), ans('wd_c21_detail', 'אח של החתן בדלת, עשרים דקות'),
    ans('wd_c22_shabbat', 'צאת שבת 20:05'), ans('wd_a3_prep_photos', 'none'), ans('wd_d23_entry', 'separate'), ans('wd_d23_song', 'x'),
  ];
  const a = anchorsOf(religious)!;
  assert.equal(a.chuppah, '21:30');
  assert.equal(a.party, '22:35');
  const lines = generateRunOfShow(religious);
  assert.ok(lines.some((l) => l.title === 'ייחוד' && l.duration_min === 20));
  assert.equal(lines.find((l) => l.title === 'האורחים מתיישבים לחופה')?.note, 'צאת שבת 20:05');
  assert.ok(lines.some((l) => l.title === 'הגעת הצלם לאולם'));
  assert.ok(!lines.some((l) => l.title === 'צילום התארגנות'));
});

test('abroad with nothing but a reception time still builds, and nothing without one', () => {
  assert.equal(generateRunOfShow([ans('wd_a1_where', 'מלון')]).length, 0);
  const lines = generateRunOfShow([ans('wd_b7_reception', '17:00')]);
  assert.ok(lines.length >= 8);
  assert.ok(lines.some((l) => l.title === 'חופה' && l.at_time === '18:10'));
});

test("the couple's version never holds a secret, and the DJ's holds the songs", () => {
  const lines = generateRunOfShow(secular);
  const secrets = lines.filter((l) => l.is_secret);
  assert.ok(secrets.length >= 1);
  assert.ok(secrets.every((l) => !l.audience.includes('couple')));
  assert.deepEqual(secrets[0].secret_from, ['איתי']);
  const couple = forAudience(lines, 'couple', false);
  assert.ok(couple.every((l) => !l.is_secret));
  assert.ok(couple.every((l) => !l.title.startsWith('הפתעה')));
  const dj = forAudience(lines, 'vendors', false);
  assert.ok(dj.some((l) => l.song_title === 'A Thousand Years'));
  assert.ok(dj.every((l) => !l.is_secret), 'a supplier is not the producer');
  const full = forAudience(lines, null, true);
  assert.ok(full.some((l) => l.is_secret));
});

test('moving the chuppah moves everything after it and nothing before', () => {
  const lines = generateRunOfShow(secular);
  const moved = shiftAfter(lines, '20:10', 15);
  assert.equal(moved.find((l) => l.title === 'חופה')?.at_time, '20:25');
  assert.equal(moved.find((l) => l.title === 'כניסה לריקודים')?.at_time, '21:10');
  assert.equal(moved.find((l) => l.title === 'קבלת פנים')?.at_time, '19:00');
  assert.equal(addMinutes('23:50', 20), '00:10');
});

test('every key the generator reads is a question the content asks', () => {
  const src = readFileSync('src/lib/runOfShow.ts', 'utf8');
  const read = [...src.matchAll(/'(wd_[a-z0-9_]+)'/g)].map((m) => m[1]);
  const keys = new Set(WEDDING_DAY_QUESTIONS.map((q) => q.key));
  for (const k of read) assert.ok(keys.has(k), `the generator reads ${k}, which no question has`);
  assert.equal(WEDDING_DAY_QUESTIONS.length, new Set(WEDDING_DAY_QUESTIONS.map((q) => q.key)).size);
});
