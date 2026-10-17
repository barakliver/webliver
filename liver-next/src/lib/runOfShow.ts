/**
 * The run of show, built from the wedding-day answers.
 *
 * Deterministic and pure: the same answers always give the same lines,
 * which is what lets a producer press "build" twice without fear and lets
 * a test hold the generator to three weddings. Four anchors come from the
 * answers (the reception, the chuppah, the party, the end) and everything
 * else is derived backwards and forwards from them by the offsets the
 * brief names. A missing anchor is derived from the one before it; a
 * missing reception time means no sheet at all, and the caller says so.
 *
 * Three rules are the ones worth reading. A surprise is a secret line:
 * `is_secret` is true, `secret_from` names who must not know, and the
 * couple's audience is never put on it. Every entrance to the chuppah is
 * its own line carrying its own song, because "song for entrance 4" is
 * what the DJ reads at 19:42. And nothing here reads the clock: the
 * evening's times are the couple's, not the server's.
 */
import { WEDDING_DAY_QUESTIONS } from '../content/weddingDay.ts';
import type { Answer } from './intake.ts';

export type Track = 'shared' | 'partner_a' | 'partner_b';
export type Audience = 'couple' | 'photo' | 'vendors' | 'crew';

export type ShowLine = {
  track: Track;
  at_time: string;
  title: string;
  note: string;
  owner: string;
  audience: Audience[];
  duration_min: number | null;
  key_moment: boolean;
  is_secret: boolean;
  secret_from: string[];
  song_title: string;
  song_artist: string;
  song_cue: string;
  people: { name: string; role?: string; phone?: string }[];
  location: string;
  needs: string[];
  /** questionnaire:<key> for every line here. */
  source: string;
};

/* ── time arithmetic on the clock face ──────────────────────────────────── */

export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function fromMinutes(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export const addMinutes = (hhmm: string, n: number): string => fromMinutes((toMinutes(hhmm) ?? 0) + n);

/* ── reading the answers ────────────────────────────────────────────────── */

type Row = Record<string, string>;

function one(answers: readonly Answer[], key: string): unknown {
  const rows = answers.filter((a) => a.question_key === key);
  return rows.sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))[0]?.value;
}
const text = (answers: readonly Answer[], key: string): string => {
  const v = one(answers, key);
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
};
const time = (answers: readonly Answer[], key: string): string | null => {
  const t = text(answers, key);
  return toMinutes(t) === null ? null : fromMinutes(toMinutes(t) as number);
};
const table = (answers: readonly Answer[], key: string): Row[] => {
  const v = one(answers, key);
  return Array.isArray(v) ? v.filter((r): r is Row => Boolean(r) && typeof r === 'object').map((r) => Object.fromEntries(Object.entries(r).map(([k, x]) => [k, String(x ?? '').trim()]))) : [];
};
const list = (answers: readonly Answer[], key: string): string[] => {
  const v = one(answers, key);
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
};

/* ── the generator ──────────────────────────────────────────────────────── */

const ALL: Audience[] = ['couple', 'photo', 'vendors', 'crew'];
const NO_COUPLE: Audience[] = ['photo', 'vendors', 'crew'];

export type Anchors = { reception: string; chuppah: string; party: string; end: string | null };

export function anchorsOf(answers: readonly Answer[]): Anchors | null {
  const reception = time(answers, 'wd_b7_reception');
  if (!reception) return null;
  const chuppah = time(answers, 'wd_c13_time') ?? addMinutes(reception, 70);
  const yichud = text(answers, 'wd_c21_yichud') === 'yes';
  const party = addMinutes(chuppah, 45 + (yichud ? 20 : 0));
  const end = time(answers, 'wd_e33_contract_end');
  return { reception, chuppah, party, end };
}

export function generateRunOfShow(answers: readonly Answer[]): ShowLine[] {
  const a = anchorsOf(answers);
  if (!a) return [];
  const out: ShowLine[] = [];
  const line = (at: string, title: string, over: Partial<ShowLine> & { source: string }): void => {
    out.push({
      track: 'shared', at_time: at, title, note: '', owner: '', audience: ALL, duration_min: null, key_moment: false,
      is_secret: false, secret_from: [], song_title: '', song_artist: '', song_cue: '', people: [], location: '', needs: [],
      ...over,
    });
  };

  /* The morning. */
  const prepPhotos = text(answers, 'wd_a3_prep_photos');
  const prepAt = addMinutes(a.reception, -150);
  if (prepPhotos && prepPhotos !== 'none') {
    const faces = table(answers, 'wd_a6_prep_people').map((r) => ({ name: r.name, role: r.who }));
    line(addMinutes(prepAt, -15), 'הגעת הצלם להתארגנות', { audience: ['photo', 'crew'], source: 'questionnaire:wd_a3_prep_photos', owner: 'צלם' });
    line(prepAt, 'צילום התארגנות', {
      duration_min: 60, audience: ['couple', 'photo', 'crew'], source: 'questionnaire:wd_a3_prep_photos',
      note: text(answers, 'wd_a1_where'), people: faces, track: prepPhotos === 'one' ? 'partner_a' : 'shared',
    });
  } else {
    line(addMinutes(a.reception, -45), 'הגעת הצלם לאולם', { audience: ['photo', 'crew'], source: 'questionnaire:wd_a3_prep_photos', owner: 'צלם' });
  }
  if (text(answers, 'wd_a2_makeup')) {
    line(addMinutes(a.reception, -210), 'איפור ושיער', { track: 'partner_a', duration_min: 120, audience: ['couple', 'photo'], note: text(answers, 'wd_a2_makeup'), source: 'questionnaire:wd_a2_makeup' });
  }
  if (text(answers, 'wd_a4_first_look') === 'yes' || text(answers, 'wd_a4_first_look') === 'surprise') {
    line(addMinutes(a.reception, -90), 'מפגש ראשון', { duration_min: 20, audience: ['couple', 'photo', 'crew'], key_moment: true, source: 'questionnaire:wd_a4_first_look' });
  }
  line(time(answers, 'wd_a5_leave') ?? addMinutes(a.reception, -60), 'יציאה לאולם', {
    audience: ['couple', 'crew'], note: text(answers, 'wd_a5_transport') === 'producer' ? 'הסעה של ההפקה' : text(answers, 'wd_a5_transport') === 'car' ? 'רכב מיוחד' : '', source: 'questionnaire:wd_a5_transport',
  });

  /* The reception. */
  line(addMinutes(a.reception, -90), 'הגעת די-ג׳יי וסאונד', { audience: ['vendors', 'crew'], owner: 'די-ג׳יי', source: 'questionnaire:wd_b9_music' });
  const hosts = table(answers, 'wd_b10_host').map((r) => ({ name: r.name, phone: r.phone, role: 'מקבל ספקים' }));
  if (hosts.length) line(addMinutes(a.reception, -60), 'מקבל הספקים באולם', { audience: ['vendors', 'crew'], people: hosts, source: 'questionnaire:wd_b10_host' });
  line(a.reception, 'קבלת פנים', {
    duration_min: Math.max(30, (toMinutes(a.chuppah) as number) - (toMinutes(a.reception) as number)),
    note: [text(answers, 'wd_b9_style'), text(answers, 'wd_b12_time_for')].filter(Boolean).join(' · '),
    key_moment: true, source: 'questionnaire:wd_b7_reception',
  });
  const real = time(answers, 'wd_b7_real');
  if (real && real !== a.reception) line(real, 'האורחים מגיעים באמת', { audience: ['vendors', 'crew'], source: 'questionnaire:wd_b7_real' });
  if (text(answers, 'wd_b8_at_reception') === 'yes') {
    line(time(answers, 'wd_b8_from') ?? a.reception, 'הזוג בקבלת הפנים', { audience: ['couple', 'photo', 'crew'], source: 'questionnaire:wd_b8_at_reception' });
  }
  if (text(answers, 'wd_b11_holders')) line(addMinutes(a.chuppah, -40), 'טבעות, כתובה ומעטפות: מי מחזיק מה', { audience: ['couple', 'crew'], note: text(answers, 'wd_b11_holders'), source: 'questionnaire:wd_b11_holders' });

  /* The chuppah. */
  const officiant = table(answers, 'wd_c14_officiant')[0];
  if (officiant?.name) {
    line(toMinutes(officiant.arrives ?? '') !== null ? fromMinutes(toMinutes(officiant.arrives) as number) : addMinutes(a.chuppah, -30), `הגעת ${officiant.name}`, {
      audience: ['vendors', 'crew'], people: [{ name: officiant.name, phone: officiant.phone, role: 'עורך הטקס' }],
      needs: officiant.needs ? [officiant.needs] : [], source: 'questionnaire:wd_c14_officiant',
    });
  }
  const shabbat = text(answers, 'wd_c22_shabbat');
  line(addMinutes(a.chuppah, -15), 'האורחים מתיישבים לחופה', { audience: ['crew', 'vendors'], note: shabbat, source: 'questionnaire:wd_c13_time' });
  line(a.chuppah, 'חופה', { duration_min: 45, key_moment: true, note: text(answers, 'wd_c16_poles') ? `עמודים: ${text(answers, 'wd_c16_poles')}` : '', source: 'questionnaire:wd_c13_time' });
  const entrances = table(answers, 'wd_c15_entrances');
  entrances.forEach((e, k) => {
    if (!e.who) return;
    line(addMinutes(a.chuppah, k * 2), `כניסה: ${e.who}${e.with ? ` עם ${e.with}` : ''}`, {
      audience: ['couple', 'photo', 'vendors', 'crew'], song_title: e.song ?? '', song_artist: e.artist ?? '', song_cue: e.cue ?? '',
      note: e.note ?? '', people: [{ name: e.who, role: 'כניסה' }], source: 'questionnaire:wd_c15_entrances',
    });
  });
  const after = entrances.length * 2 + 5;
  const ketubah = table(answers, 'wd_c18_ketubah')[0];
  if (ketubah?.reader || ketubah?.witness1) {
    line(addMinutes(a.chuppah, after), 'קריאת הכתובה', {
      audience: ['couple', 'crew'], people: [ketubah.reader, ketubah.witness1, ketubah.witness2].filter(Boolean).map((n, i) => ({ name: n, role: i === 0 ? 'קורא' : 'עד' })),
      source: 'questionnaire:wd_c18_ketubah',
    });
  }
  table(answers, 'wd_c17_blessings').forEach((b, k) => {
    if (!b.who) return;
    line(addMinutes(a.chuppah, after + 5 + k), `ברכה ${k + 1}: ${b.who}`, { audience: ['couple', 'crew'], note: b.note ?? '', people: [{ name: b.who, role: 'ברכה' }], source: 'questionnaire:wd_c17_blessings' });
  });
  table(answers, 'wd_c20_moments').forEach((m, k) => {
    if (!m.what) return;
    line(addMinutes(a.chuppah, after + 15 + k * 3), m.what, { audience: ['couple', 'photo', 'crew'], people: m.who ? [{ name: m.who }] : [], source: 'questionnaire:wd_c20_moments' });
  });
  line(addMinutes(a.chuppah, 40), 'שבירת הכוס', {
    key_moment: true, song_title: text(answers, 'wd_c19_glass_song') || 'שמחה גדולה הלילה', audience: ['couple', 'photo', 'vendors', 'crew'], source: 'questionnaire:wd_c19_glass_song',
  });
  if (text(answers, 'wd_c21_yichud') === 'yes') {
    line(addMinutes(a.chuppah, 45), 'ייחוד', { duration_min: 20, audience: ['couple', 'crew'], note: text(answers, 'wd_c21_detail'), source: 'questionnaire:wd_c21_yichud' });
  }

  /* The party. */
  const entry = text(answers, 'wd_d23_entry');
  line(a.party, 'כניסה לריקודים', {
    key_moment: true, song_title: text(answers, 'wd_d23_song'), note: entry === 'parents' ? 'עם ההורים' : entry === 'separate' ? 'בנפרד' : '',
    source: 'questionnaire:wd_d23_entry',
  });
  const slow = text(answers, 'wd_d24_slow');
  const courses = table(answers, 'wd_d26_courses');
  const firstCourse = courses.find((c) => toMinutes(c.time ?? '') !== null)?.time ?? addMinutes(a.party, 25);
  if (slow === 'yes' || slow === 'surprise') {
    const when = text(answers, 'wd_d24_when');
    line(when === 'after_first' ? addMinutes(fromMinutes(toMinutes(firstCourse) as number), 30) : addMinutes(a.party, 5), 'ריקוד ראשון', {
      song_title: text(answers, 'wd_d24_song'), key_moment: true, is_secret: slow === 'surprise',
      audience: slow === 'surprise' ? NO_COUPLE : ALL, source: 'questionnaire:wd_d24_slow',
    });
  }
  const parents = text(answers, 'wd_d25_parents');
  if (parents && parents !== 'no') {
    line(addMinutes(a.party, 10), 'ריקוד עם ההורים', { song_title: text(answers, 'wd_d25_songs'), source: 'questionnaire:wd_d25_parents' });
  }
  if (courses.length) {
    courses.forEach((c) => {
      if (!c.course) return;
      line(toMinutes(c.time ?? '') !== null ? fromMinutes(toMinutes(c.time) as number) : firstCourse, `הגשה: ${c.course}`, { audience: ['vendors', 'crew'], owner: 'אולם', source: 'questionnaire:wd_d26_courses' });
    });
  } else {
    line(addMinutes(a.party, 25), 'הגשה: מנה ראשונה', { audience: ['vendors', 'crew'], owner: 'אולם', source: 'questionnaire:wd_d26_courses' });
    line(addMinutes(a.party, 70), 'הגשה: עיקרית', { audience: ['vendors', 'crew'], owner: 'אולם', source: 'questionnaire:wd_d26_courses' });
  }
  table(answers, 'wd_d27_speeches').forEach((s, k) => {
    if (!s.who) return;
    const minutes = Number(s.minutes) || 5;
    line(addMinutes(fromMinutes(toMinutes(firstCourse) as number), 15 + k * (minutes + 2)), `ברכה: ${s.who}`, {
      duration_min: minutes, note: s.when ?? '', needs: ['מיקרופון'], people: [{ name: s.who, role: 'ברכה' }], source: 'questionnaire:wd_d27_speeches',
    });
  });
  table(answers, 'wd_d28_surprises').forEach((s, k) => {
    if (!s.what) return;
    const from = (s.secret_from ?? '').split(/[,،]/).map((x) => x.trim()).filter(Boolean);
    line(toMinutes(s.when ?? '') !== null ? fromMinutes(toMinutes(s.when) as number) : addMinutes(a.party, 90 + k * 15), `הפתעה: ${s.what}`, {
      is_secret: true, secret_from: from, audience: NO_COUPLE, key_moment: true,
      note: s.knows ? `יודעים: ${s.knows}` : '', needs: (s.needs ?? '').split(/[,،]/).map((x) => x.trim()).filter(Boolean),
      source: 'questionnaire:wd_d28_surprises',
    });
  });
  if (text(answers, 'wd_d29_bouquet') === 'yes') {
    line(time(answers, 'wd_d29_time') ?? addMinutes(a.party, 120), 'זריקת הזר', { audience: ['couple', 'photo', 'vendors', 'crew'], source: 'questionnaire:wd_d29_bouquet' });
  }
  table(answers, 'wd_d32_effects').forEach((e) => {
    if (!e.what) return;
    line(toMinutes(e.when ?? '') !== null ? fromMinutes(toMinutes(e.when) as number) : addMinutes(a.party, 60), e.what, { audience: ['vendors', 'crew', 'photo'], owner: e.who ?? '', source: 'questionnaire:wd_d32_effects' });
  });
  const must = list(answers, 'wd_d30_must');
  const no = list(answers, 'wd_d30_no');
  if (must.length || no.length || text(answers, 'wd_d31_sets')) {
    line(addMinutes(a.party, 1), 'לדי-ג׳יי: שירים ומה לא', {
      audience: ['vendors', 'crew'], owner: 'די-ג׳יי',
      note: [must.length ? `חייבים: ${must.join(', ')}` : '', no.length ? `אסור: ${no.join(', ')}` : '', text(answers, 'wd_d31_sets')].filter(Boolean).join(' · '),
      source: 'questionnaire:wd_d30_must',
    });
  }

  /* The end. */
  const end = a.end ?? time(answers, 'wd_e33_wanted_end');
  if (end) {
    if (text(answers, 'wd_e36_last_song')) line(addMinutes(end, -5), 'השיר האחרון', { song_title: text(answers, 'wd_e36_last_song'), source: 'questionnaire:wd_e36_last_song' });
    line(end, 'סיום לפי החוזה', { audience: ['vendors', 'crew'], owner: 'אולם', source: 'questionnaire:wd_e33_contract_end' });
    if (text(answers, 'wd_e35_collect')) line(addMinutes(end, 5), 'איסוף: מתנות, חפצים, בגדים', { audience: ['couple', 'crew'], note: text(answers, 'wd_e35_collect'), source: 'questionnaire:wd_e35_collect' });
  }
  if (text(answers, 'wd_e34_after') === 'yes') {
    const d = table(answers, 'wd_e34_detail')[0] ?? {};
    const at = toMinutes(d.from ?? '') !== null ? fromMinutes(toMinutes(d.from) as number) : end ? addMinutes(end, 30) : addMinutes(a.party, 240);
    if (toMinutes(d.vendor_at ?? '') !== null) line(fromMinutes(toMinutes(d.vendor_at) as number), `הגעת ספק האוכל לאפטר${d.food ? `: ${d.food}` : ''}`, { audience: ['vendors', 'crew'], source: 'questionnaire:wd_e34_detail' });
    line(at, `אפטר פארטי${d.where ? `: ${d.where}` : ''}`, { audience: ['couple', 'crew', 'vendors'], note: d.food ?? '', source: 'questionnaire:wd_e34_after' });
  }

  /* The day's people, as one line at the top the producer reads first. */
  const contacts = table(answers, 'wd_f38_contacts').filter((r) => r.name);
  if (contacts.length) {
    line(addMinutes(a.reception, -240), 'אנשי הקשר של היום', {
      audience: ['crew'], people: contacts.map((r) => ({ name: r.name, role: r.role, phone: r.phone })),
      note: [text(answers, 'wd_f39_dont_call'), text(answers, 'wd_f40_anything')].filter(Boolean).join(' · '), source: 'questionnaire:wd_f38_contacts',
    });
  }

  return out.sort((x, y) => ((toMinutes(x.at_time) ?? 0) + ((toMinutes(x.at_time) ?? 0) < 300 ? 1440 : 0)) - ((toMinutes(y.at_time) ?? 0) + ((toMinutes(y.at_time) ?? 0) < 300 ? 1440 : 0)));
}

/* ── the versions ────────────────────────────────────────────────────────── */

export type Printable = { audience: string[]; is_secret?: boolean | null; secret_from?: string[] | null };

/**
 * The lines one audience may read. An empty audience is everyone; a
 * secret line is the producer's only, whatever audience it carries,
 * unless the reader is the producer. This is the one function every
 * printed version goes through, which is what the test holds.
 */
export function forAudience<T extends Printable>(lines: readonly T[], audience: string | null, producer: boolean): T[] {
  return lines.filter((l) => {
    if (l.is_secret && !producer) return false;
    if (!audience) return true;
    return l.audience.length === 0 || l.audience.includes(audience);
  });
}

/** Every line at or after `from`, moved by `minutes`. The cascade a
 *  changed chuppah time asks for. Lines before it are not touched. */
export function shiftAfter<T extends { at_time: string }>(lines: readonly T[], from: string, minutes: number): T[] {
  const f = toMinutes(from);
  if (f === null || !minutes) return [...lines];
  return lines.map((l) => {
    const t = toMinutes(l.at_time);
    if (t === null || t < f) return l;
    return { ...l, at_time: addMinutes(l.at_time, minutes) };
  });
}

/** The questionnaire keys the generator reads, for the test that holds
 *  this file to the content. */
export const READ_KEYS = [...new Set(
  WEDDING_DAY_QUESTIONS.map((q) => q.key).filter((k) => true),
)];
