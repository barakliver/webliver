import { Check, Heart } from 'lucide-react';
import { monthYear, shortMonth } from '@/lib/appDates';
import { count, fill } from '@/lib/copyText';
import type { AppUi } from '@/content/appUi';
import type { MonthCell, Standing, Timeline } from '@/lib/standing';

/**
 * The year, month by month.
 *
 * Every figure on the couple's screen was about now: what is open, what is
 * owed, who has replied. There was no view of the year at all, so a couple
 * could not tell a crowded fortnight from a crowded wedding, and had no sense
 * of having got anywhere. A couple who can see that August is closed and
 * September holds two things stops being afraid of September.
 *
 * A picture rather than a list, and that is the whole argument for its place
 * on a screen whose case is that a couple should arrive to four things. Twelve
 * months is one line of marks; the same information as rows is the checklist
 * again, which is already behind a fold below. It carries no row the screen
 * does not already have and asks the database nothing.
 *
 * A month with nothing in it is still drawn. The gap is the information: the
 * thing a couple is looking for is the empty September, and a strip that drew
 * only the months with work in them would be a strip whose spacing lies.
 *
 * Nothing in it is pressable. A timeline is for reading, and the one button
 * on this part of the screen belongs to the card above that names what to do.
 * Twelve targets 23px wide would also be twelve targets nobody can hit.
 *
 * The two states that are not a strip, too far out and nothing dated yet,
 * are drawn as a sentence rather than as an empty one, the same move the
 * bingo makes under nine tasks. The only thing not drawn at all is a wedding
 * that has happened: there is no year left to show, which is a missing
 * object rather than a panel hiding on its own data.
 */
export function MonthsLeft({ t, s, ui }: { t: Timeline; s: Standing; ui: AppUi }) {
  const c = ui.portal.months;
  if (t.kind === 'past') return null;

  /* Built once for the whole strip rather than once per month. Twelve of
     these is twelve `Intl.DateTimeFormat` constructions, which is the one
     thing `appDates` asks callers not to do per row. */
  const short = shortMonth(ui.locale);
  const full = monthYear(ui.locale);

  return (
    <section aria-labelledby="months-title" className="card mt-8">
      <h2 id="months-title" className="head-panel">{c.title}</h2>

      {t.kind === 'far' && (
        <p className="mt-2 max-w-prose2 text-body leading-relaxed text-ink-soft">
          {t.months === null ? c.farNoDate : fill(c.far, { n: t.months })}
        </p>
      )}

      {t.kind === 'bare' && (
        <p className="mt-2 max-w-prose2 text-body leading-relaxed text-ink-soft">{c.bare}</p>
      )}

      {t.kind === 'strip' && (
        <>
          <p className="mt-1 max-w-prose2 text-body leading-relaxed text-ink-soft">{c.sub}</p>

          {/* `list-none` and a role, because a row of twelve boxes is a list
              in the markup and is not read as one: Safari drops list
              semantics the moment the bullets are styled off. */}
          <ul role="list" className="mt-5 flex list-none items-end gap-0.5 sm:gap-1.5">
            {t.cells.map((cell) => (
              <Cell key={cell.key} cell={cell} ui={ui} short={short} full={full} />
            ))}
          </ul>

          {/* The figure counts their whole schedule and the strip starts at
              this month, which is deliberate rather than a disagreement: most
              of what a couple has closed was due in a month the strip does
              not draw, and this line is how that work is on the screen at all
              without the year growing backwards to hold it. */}
          <p className="mt-4 text-meta text-ink-mute">
            {fill(c.progress, { n: s.closed, of: s.of })}
            {t.undated > 0 && <>{' · '}{count(c.undated, t.undated)}</>}
          </p>
        </>
      )}
    </section>
  );
}

/**
 * One month.
 *
 * Late things are folded onto the current month by `lib/standing` rather than
 * drawn where they fell, so one figure is "open in this month" and the edge
 * says whether any of it is overdue. Two numerals in a 23px box would be
 * neither.
 *
 * The visual half is hidden from a screen reader and a sentence is given
 * instead. A box with "2" in it is a picture, and the sentence names the
 * month in full, says what is open and what is closed, and marks the two
 * months worth marking.
 */
function Cell({ cell, ui, short, full }: {
  cell: MonthCell; ui: AppUi;
  short: { format: (d: Date | number) => string };
  full: Intl.DateTimeFormat;
}) {
  const c = ui.portal.months;
  const at = new Date(`${cell.on}T12:00:00Z`);
  const open = cell.late + (cell.due - cell.closed);
  const nothing = cell.due === 0 && cell.late === 0;
  const allClosed = cell.due > 0 && open === 0;

  const said: string[] = [`${full.format(at)}.`];
  if (nothing) said.push(c.cellEmpty);
  else {
    if (cell.late > 0) said.push(fill(c.cellLate, { n: cell.late }));
    if (cell.due > 0) {
      said.push(cell.closed === cell.due
        ? c.cellClear
        : fill(c.cell, { n: cell.due - cell.closed, c: cell.closed }));
    }
  }
  if (cell.wedding) said.push(`${c.wedding}.`);
  if (cell.thisMonth) said.push(`${c.now}.`);

  const box = cell.wedding
    ? 'border-accent/30 bg-accent-wash'
    : cell.late > 0
      ? 'border-bad/35 bg-bad-wash'
      : cell.thisMonth
        ? 'border-ink/20 bg-surface-100'
        : 'border-line-soft bg-surface-100';

  return (
    /* Capped, because `flex-1` with two cells makes a 150px box with a
       numeral in the middle, which reads as a progress bar rather than as a
       month. A wedding this month is one cell and should look like one. */
    <li className="min-w-0 max-w-[40px] flex-1 basis-0">
      <span className="sr-only">{said.join(' ')}</span>
      <div aria-hidden>
        {/* A capsule rather than one of the three radii, and deliberately.
            Those three say panel, surface and control, and this is none of
            them: it is a mark on a chart, which should not be able to be
            mistaken for something to press. It is also the only shape that
            survives the width changing. Twelve months across a phone is 23px
            a cell and three months is 40px, and a 12px corner reads as a
            rounded box at one of those and as a stadium at the other, so the
            same strip would be two different objects depending on how far
            away the wedding is. */}
        <div className={`grid h-9 place-items-center rounded-full border ${box}`}>
          {nothing ? (
            /* The destination month with nothing left in it is the one empty
               cell worth drawing as something. Everywhere else a blank month
               is a hairline, which is the point of the strip; here it is the
               wedding, and a couple whose last month is clear should be able
               to see that at the end of the line. */
            cell.wedding
              ? <Heart size={13} strokeWidth={0} className="fill-accent" />
              : <span className="block h-px w-2.5 rounded-full bg-ink-mute/45" />
          ) : allClosed ? (
            <Check size={14} strokeWidth={2} className="text-ok" />
          ) : (
            <span className={`text-meta font-semibold tabular-nums ${cell.late > 0 ? 'text-bad' : 'text-ink'}`}>
              {open}
            </span>
          )}
        </div>
        <p className={`mt-1 truncate text-center text-micro ${
          cell.wedding ? 'font-semibold text-accent'
            : cell.thisMonth ? 'font-medium text-ink' : 'text-ink-mute'}`}
        >
          {short.format(at)}
        </p>
      </div>
    </li>
  );
}
