import { hebrewOf, type HebrewDate } from './hebrewDate.ts';

/**
 * What day it is, beyond the number.
 *
 * A wedding diary in Israel is read against two calendars at once, and a
 * producer with a couple on the phone needs both in the same cell: the
 * Hebrew one, because Sukkot decides whether a Tuesday is a working day for
 * every supplier in the country, and the civil one, because the couple's
 * cousins fly in around Christmas and the hall's bar staff are off on
 * Independence Day. This turns a Gregorian date into the holidays that fall
 * on it, by name, so the month grid can show them the way Google's does.
 *
 * Two families, switched separately on the screen. The Jewish and Israeli
 * days come from the Hebrew date behind the Gregorian one — the same ICU
 * arithmetic hebrewDate.ts uses for rulings, so a day can never be Pesach
 * here and not there. The Christian days are the Western church's: the fixed
 * ones by date, the movable ones counted from Easter by the Gregorian
 * computus. Orthodox Easter is deliberately not here; it is a different
 * calendar and a different question, and a couple who needs it will say so.
 *
 * Nothing here rules on anything. hebrewDate.ts says whether a wedding can
 * stand on an evening; this says what the day is called. The two are kept
 * apart so that the grid can show Christmas without implying it is closed.
 *
 * Pure, and tested against a year's known dates.
 */

export type HolidayFamily = 'jewish' | 'christian';

/** How the day is drawn. A festival closes the country; a memorial day is
 *  solemn and shops still open; a minor day is a name in the corner. */
export type HolidayTone = 'festival' | 'memorial' | 'minor';

export type Holiday = {
  date: string;
  key: HolidayKey;
  family: HolidayFamily;
  tone: HolidayTone;
  /** The first day of a run that lasts several: Sukkot, Hanukkah, Pesach.
   *  The grid labels the first cell and lets the rest carry the tint. */
  first: boolean;
};

export type HolidayKey =
  /* The Jewish year, as kept in Israel. */
  | 'roshHashana' | 'gedalia' | 'yomKippur' | 'sukkot' | 'cholHamoedSukkot' | 'hoshanaRabba'
  | 'shminiAtzeret' | 'hanukkah' | 'tevet10' | 'tuBishvat' | 'esther' | 'purim' | 'shushanPurim'
  | 'pesach' | 'cholHamoedPesach' | 'pesach7' | 'yomHashoah' | 'yomHazikaron' | 'yomHaatzmaut'
  | 'lagBaomer' | 'yomYerushalayim' | 'shavuot' | 'tamuz17' | 'tishaBav' | 'tuBav'
  /* The Western church. */
  | 'epiphany' | 'ashWednesday' | 'palmSunday' | 'goodFriday' | 'easter' | 'easterMonday'
  | 'ascension' | 'pentecost' | 'christmasEve' | 'christmas' | 'newYear';

const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plus = (isoDate: string, n: number) => {
  const d = utc(isoDate);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

/** Adar in a plain year and Adar II in a leap one: the month Purim keeps. */
const purimAdar = (m: string) => m === 'Adar' || m === 'Adar II';

/**
 * The weekday of a Hebrew date in the same month as the given day, worked
 * out from the day we already have rather than converted again: the Hebrew
 * and Gregorian day both step by one, so the difference is the offset.
 * Sunday is 0.
 */
const weekdayOfHebrewDay = (h: HebrewDate, weekday: number, day: number): number =>
  (((weekday - (h.day - day)) % 7) + 7) % 7;

/* The three days the state moves so they do not collide with Shabbat. The
   rules are the Knesset's, not a custom: Independence Day on a Friday or
   Saturday is brought forward to Thursday; on a Monday it is pushed to
   Tuesday so the memorial day before it does not fall on Saturday night.
   Memorial Day is always the day before it. Holocaust Remembrance Day on a
   Friday is brought forward to Thursday, on a Sunday pushed to Monday. */
function observedIyar5(h: HebrewDate, weekday: number): number {
  const wd5 = weekdayOfHebrewDay(h, weekday, 5);
  if (wd5 === 5) return 4;   // Friday -> Thursday 4 Iyar
  if (wd5 === 6) return 3;   // Saturday -> Thursday 3 Iyar
  if (wd5 === 1) return 6;   // Monday -> Tuesday 6 Iyar
  return 5;
}
function observedNisan27(h: HebrewDate, weekday: number): number {
  const wd27 = weekdayOfHebrewDay(h, weekday, 27);
  if (wd27 === 5) return 26;  // Friday -> Thursday
  if (wd27 === 0) return 28;  // Sunday -> Monday
  return 27;
}

/** The Jewish and Israeli days on one Gregorian date, by its daytime Hebrew
 *  date. Daytime on purpose: the grid labels the day people take off, and
 *  the eve is the cell before. */
function jewish(date: string, h: HebrewDate, weekday: number): Holiday[] {
  const out: Holiday[] = [];
  const add = (key: HolidayKey, tone: HolidayTone, first = true) =>
    out.push({ date, key, family: 'jewish', tone, first });
  const { month, day } = h;

  if (month === 'Tishri') {
    if (day === 1) add('roshHashana', 'festival');
    else if (day === 2) add('roshHashana', 'festival', false);
    else if (day === 3) add('gedalia', 'minor');
    else if (day === 10) add('yomKippur', 'festival');
    else if (day === 15) add('sukkot', 'festival');
    else if (day >= 16 && day <= 20) add('cholHamoedSukkot', 'minor', day === 16);
    else if (day === 21) add('hoshanaRabba', 'minor');
    else if (day === 22) add('shminiAtzeret', 'festival');
  }
  /* Hanukkah runs eight days from 25 Kislev into Tevet, and Kislev is 29 or
     30 days long: the last day is 2 or 3 Tevet. Counted rather than listed. */
  if (month === 'Kislev' && day >= 25) add('hanukkah', 'minor', day === 25);
  if (month === 'Tevet') {
    const kislevDays = kislevLength(date, h);
    const hanukkahEnd = kislevDays === 30 ? 2 : 3;
    if (day <= hanukkahEnd) add('hanukkah', 'minor', false);
    else if (day === 10) add('tevet10', 'minor');
  }
  if (month === 'Shevat' && day === 15) add('tuBishvat', 'minor');
  if (purimAdar(month)) {
    if (day === 13 && weekday !== 6) add('esther', 'minor');
    else if (day === 14) add('purim', 'minor');
    else if (day === 15) add('shushanPurim', 'minor');
  }
  if (month === 'Nisan') {
    if (day === 15) add('pesach', 'festival');
    else if (day >= 16 && day <= 20) add('cholHamoedPesach', 'minor', day === 16);
    else if (day === 21) add('pesach7', 'festival');
    else if (day === observedNisan27(h, weekday) && day >= 26 && day <= 28) add('yomHashoah', 'memorial');
  }
  if (month === 'Iyar') {
    const atzmaut = observedIyar5(h, weekday);
    if (day === atzmaut - 1) add('yomHazikaron', 'memorial');
    else if (day === atzmaut) add('yomHaatzmaut', 'festival');
    else if (day === 18) add('lagBaomer', 'minor');
    else if (day === 28) add('yomYerushalayim', 'minor');
  }
  if (month === 'Sivan' && day === 6) add('shavuot', 'festival');
  if (month === 'Tamuz' && day === 17) add('tamuz17', 'minor');
  if (month === 'Av') {
    if (day === 9) add('tishaBav', 'memorial');
    else if (day === 15) add('tuBav', 'minor');
  }
  return out;
}

/** Whether the Kislev that this Tevet follows had 30 days. Asked of the
 *  calendar itself: step back to the last of Kislev and read its number. */
function kislevLength(date: string, h: HebrewDate): number {
  const lastOfKislev = hebrewOf(plus(date, -h.day));
  return lastOfKislev.month === 'Kislev' ? lastOfKislev.day : 29;
}

/** Easter Sunday for a Gregorian year: the anonymous Gregorian algorithm,
 *  which is the one every almanac uses. */
export function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const hh = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - hh - k) % 7;
  const m = Math.floor((a + 11 * hh + 22 * l) / 451);
  const month = Math.floor((hh + l - 7 * m + 114) / 31);
  const day = ((hh + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function christian(date: string): Holiday[] {
  const out: Holiday[] = [];
  const add = (key: HolidayKey, tone: HolidayTone) =>
    out.push({ date, key, family: 'christian', tone, first: true });
  const md = date.slice(5);
  if (md === '01-01') add('newYear', 'festival');
  if (md === '01-06') add('epiphany', 'minor');
  if (md === '12-24') add('christmasEve', 'minor');
  if (md === '12-25') add('christmas', 'festival');

  const e = easter(Number(date.slice(0, 4)));
  const off = Math.round((utc(date).getTime() - utc(e).getTime()) / 86_400_000);
  if (off === -46) add('ashWednesday', 'minor');
  else if (off === -7) add('palmSunday', 'minor');
  else if (off === -2) add('goodFriday', 'festival');
  else if (off === 0) add('easter', 'festival');
  else if (off === 1) add('easterMonday', 'minor');
  else if (off === 39) add('ascension', 'minor');
  else if (off === 49) add('pentecost', 'festival');
  return out;
}

/** Everything that falls on one date, both families. The screen filters by
 *  family; this always answers in full so the two switches cannot drift. */
export function holidaysOn(date: string): Holiday[] {
  const h = hebrewOf(date);
  const weekday = utc(date).getUTCDay();
  return [...jewish(date, h, weekday), ...christian(date)];
}

/** A run of days. `from` inclusive, `days` long. */
export function holidaysRange(from: string, days: number): Holiday[] {
  const out: Holiday[] = [];
  for (let i = 0; i < days; i += 1) out.push(...holidaysOn(plus(from, i)));
  return out;
}
