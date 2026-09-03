/**
 * The Hebrew date behind a Gregorian one, and what it means for a wedding.
 *
 * A producer evaluating a date asks one question before any other: can a
 * wedding be held then at all. Half the year carries an answer that is not
 * obvious from a Gregorian calendar — the Three Weeks, the Omer, the festivals
 * and the eve of each — and getting it wrong costs a booked hall.
 *
 * No dependency. The conversion is ICU's own Hebrew calendar, which every
 * Node and every browser this product supports already carries, and which
 * handles the leap year's two Adars correctly. A package would be a package to
 * keep updated for arithmetic that has not changed in a millennium.
 *
 * **Two things this file is careful to be honest about.**
 *
 * A Hebrew day begins at sunset, and a wedding is an evening event. So the
 * day that matters for a Tuesday-evening wedding is the Hebrew day that
 * *begins* on Tuesday evening, which is the Hebrew date of Wednesday. Every
 * classification here is of the evening, because that is when the chupah
 * stands; `hebrewOf` gives the daytime date for anything that needs it.
 *
 * And customs differ. What is written here is mainstream Ashkenazi practice
 * in Israel, which is what most of this producer's couples keep. Where a
 * widely-kept custom disagrees the day is marked as one to check rather than
 * as forbidden, and the screen says out loud that this is planning guidance
 * and not a ruling. Nothing here decides anything; it stops a producer
 * offering a date that was never available.
 */

export type HebrewDate = {
  /** 5786, and so on. */
  year: number;
  /** The month as ICU names it: Tishri, Heshvan, Kislev, Tevet, Shevat,
   *  Adar, Adar I, Adar II, Nisan, Iyar, Sivan, Tamuz, Av, Elul. */
  month: string;
  day: number;
};

export type Verdict = 'clear' | 'check' | 'blocked';

export type DayRuling = {
  /** The Gregorian day, as YYYY-MM-DD. */
  date: string;
  /** The Hebrew day the evening of that date begins. */
  hebrew: HebrewDate;
  verdict: Verdict;
  /** Why, in keys the copy turns into Hebrew sentences. Empty when clear. */
  reasons: ReasonKey[];
};

export type ReasonKey =
  | 'shabbat' | 'erevShabbat'
  | 'roshHashana' | 'yomKippur' | 'sukkot' | 'cholHamoed' | 'shminiAtzeret'
  | 'pesach' | 'shavuot' | 'erevChag'
  | 'threeWeeks' | 'nineDays' | 'tishaBav'
  | 'omer' | 'omerSephardi' | 'lagBaomer'
  | 'fast' | 'purim' | 'roshChodesh';

/* ICU gives the month by name, which is stable and readable, rather than by a
   number whose meaning shifts in a leap year. In a plain year the single Adar
   comes back as "Adar"; in a leap year as "Adar I" and "Adar II". Every rule
   below that names Adar means the one Purim falls in, which is the second. */
const PARTS = new Intl.DateTimeFormat('en-u-ca-hebrew', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (isoDate: string, n: number) => {
  const d = utc(isoDate);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

/** The Hebrew date of the daytime of a Gregorian date. */
export function hebrewOf(isoDate: string): HebrewDate {
  const parts = Object.fromEntries(
    PARTS.formatToParts(utc(isoDate)).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    /* The year can arrive as "5786" or, in some ICU builds, with an era
       suffix. Digits only. */
    year: Number((parts.year ?? '').replace(/\D+/g, '')) || 0,
    month: (parts.month ?? '').trim(),
    day: Number(parts.day) || 0,
  };
}

/** The Hebrew date that begins on the evening of a Gregorian date, which is
 *  the one a wedding held that evening falls under. */
export const hebrewEveningOf = (isoDate: string): HebrewDate => hebrewOf(plusDays(isoDate, 1));

/** Adar in a plain year and Adar II in a leap year: the month Purim keeps. */
const isPurimAdar = (month: string) => month === 'Adar' || month === 'Adar II';

/** The day of the Omer, 1 to 49, or 0 outside it. Counted from 16 Nisan. */
export function omerDay(h: HebrewDate): number {
  if (h.month === 'Nisan' && h.day >= 16) return h.day - 15;
  if (h.month === 'Iyar') return h.day + 15;
  if (h.month === 'Sivan' && h.day <= 5) return h.day + 44;
  return 0;
}

/* Each rule answers for the Hebrew day a wedding would stand on. The order
   matters only in that the worst verdict wins, which `rule` below settles. */
function reasonsFor(h: HebrewDate, weekday: number): ReasonKey[] {
  const out: ReasonKey[] = [];
  const { month, day } = h;

  /* The week. `weekday` is of the Gregorian evening: Friday evening is
     Shabbat coming in, Saturday evening is Shabbat going out and is one of
     the most-used wedding slots in the country. */
  if (weekday === 5) out.push('shabbat');
  if (weekday === 4) out.push('erevShabbat');

  /* The festivals, as kept in Israel: one day of yom tov, and Shemini
     Atzeret and Simchat Torah on the same day. */
  if (month === 'Tishri') {
    if (day === 1 || day === 2) out.push('roshHashana');
    else if (day === 10) out.push('yomKippur');
    else if (day === 15) out.push('sukkot');
    else if (day >= 16 && day <= 21) out.push('cholHamoed');
    else if (day === 22) out.push('shminiAtzeret');
    else if (day === 3) out.push('fast');           // צום גדליה
    else if (day === 9 || day === 14) out.push('erevChag');
  }
  if (month === 'Nisan') {
    if (day === 15) out.push('pesach');
    else if (day >= 16 && day <= 20) out.push('cholHamoed');
    else if (day === 21) out.push('pesach');        // שביעי של פסח
    else if (day === 14) out.push('erevChag');
  }
  if (month === 'Sivan') {
    if (day === 6) out.push('shavuot');
    else if (day === 5) out.push('erevChag');
  }
  if (month === 'Tevet' && day === 10) out.push('fast');
  if (isPurimAdar(month)) {
    if (day === 13) out.push('fast');               // תענית אסתר
    else if (day === 14 || day === 15) out.push('purim');
  }

  /* The Three Weeks: 17 Tammuz to 9 Av. The Nine Days from Rosh Chodesh Av
     are stricter still, and the ninth is the fast itself. */
  if (month === 'Tamuz' && day >= 17) out.push('threeWeeks');
  if (month === 'Av') {
    if (day < 9) out.push('nineDays');
    else if (day === 9) out.push('tishaBav');
    else if (day <= 15) out.push('threeWeeks');     // until Tu B'Av by some
  }

  /* The Omer. Ashkenazi practice keeps the mourning from the second day of
     Pesach until Lag BaOmer and marries from Lag BaOmer on; the widespread
     Sephardi practice keeps it to 34 Iyar. So the days between are a date to
     check with the couple rather than one to refuse. */
  const omer = omerDay(h);
  if (omer > 0) {
    if (month === 'Iyar' && day === 18) out.push('lagBaomer');
    else if (omer < 33) out.push('omer');
    else if (month === 'Iyar' && day <= 34) out.push('omerSephardi');
  }

  return out;
}

/* What each reason does to a date. `blocked` is where mainstream practice
   holds no wedding at all; `check` is where a real custom disagrees, or where
   the day is usable but not freely. */
const WEIGHT: Record<ReasonKey, Verdict> = {
  shabbat: 'blocked', erevShabbat: 'check',
  roshHashana: 'blocked', yomKippur: 'blocked', sukkot: 'blocked',
  cholHamoed: 'blocked', shminiAtzeret: 'blocked', pesach: 'blocked',
  shavuot: 'blocked', erevChag: 'check',
  threeWeeks: 'blocked', nineDays: 'blocked', tishaBav: 'blocked',
  omer: 'blocked', omerSephardi: 'check', lagBaomer: 'clear',
  fast: 'blocked', purim: 'check', roshChodesh: 'clear',
};

const RANK: Record<Verdict, number> = { clear: 0, check: 1, blocked: 2 };

/** One date, ruled on for an evening wedding. */
export function rule(isoDate: string): DayRuling {
  const hebrew = hebrewEveningOf(isoDate);
  const weekday = utc(isoDate).getUTCDay();
  const reasons = reasonsFor(hebrew, weekday);

  let verdict: Verdict = 'clear';
  for (const r of reasons) {
    if (RANK[WEIGHT[r]] > RANK[verdict]) verdict = WEIGHT[r];
  }
  /* Lag BaOmer is the one reason that clears rather than restricts, and it
     is worth showing: it is among the busiest wedding nights of the year. */
  return { date: isoDate, hebrew, verdict, reasons };
}

/** A run of days, ruled on together. `from` inclusive, `days` long. */
export function ruleRange(from: string, days: number): DayRuling[] {
  const out: DayRuling[] = [];
  for (let i = 0; i < days; i += 1) out.push(rule(plusDays(from, i)));
  return out;
}

/** The Hebrew date as it is said, for a screen: "י״ז בתמוז תשפ״ו" is more
 *  than a producer needs, so this is the plain form ICU gives in Hebrew. */
const HE = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
  day: 'numeric', month: 'long', timeZone: 'UTC',
});
export const hebrewLabel = (isoDate: string): string => HE.format(utc(isoDate));
