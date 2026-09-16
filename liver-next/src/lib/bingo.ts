/**
 * The wedding bingo.
 *
 * A board of the couple's own tasks, laid out in a square, ticked by pressing
 * a cell, and won by filling a row, a column or a diagonal. It is a game, and
 * it is also the plainest view of a checklist anybody has drawn: sixteen
 * decisions in one glance, with the ones that are done filled in.
 *
 * **The squares are real tasks and the tick is the real tick.** That is the
 * whole design and everything else follows from it. A bingo with a list of
 * its own would be a second checklist that drifts from the first by the end
 * of the first week, and then a couple has two answers to "did we book the
 * photographer" and no way to know which one is the wedding. So there is no
 * bingo table, no bingo row, nothing stored: the board is computed from the
 * tasks that are already on the screen, and pressing a cell goes through
 * `toggleTask` exactly as pressing the circle in the list does.
 *
 * Pure, and tested, because three of the rules below are the kind that are
 * obviously right and quietly wrong.
 */

/* Relative and with the extension, because this file is read by `node --test`
   as well as by the bundler, and node resolves neither the `@/` alias nor an
   extensionless path. Every lib with a test next to it imports this way. */
import { seedFrom } from './hash.ts';

export type BingoTask = {
  id: string;
  title: string;
  done: boolean;
  /** A supplier category, when the task ends with somebody hired. */
  category?: string | null;
};

/* Generic over the row it was handed, so the screen gets its own task objects
   back rather than a narrowed copy it has to look up again by id. */
export type Board<T extends BingoTask = BingoTask> = {
  /** 3 or 4. The grid is `size × size`. */
  size: number;
  /** The tasks in grid order, reading the way the page reads. */
  squares: T[];
  /** Every line on the board, as indices into `squares`. */
  lines: number[][];
  /** The lines whose every square is ticked. */
  won: number[][];
  /** Every index that is on a won line, for drawing. */
  winning: Set<number>;
  ticked: number;
  total: number;
};

/**
 * How big a board this many tasks can fill.
 *
 * Only ever a full board. A bingo card with three blank cells in the corner
 * is not a smaller game, it is a broken one: the blanks sit on lines, and a
 * line that can never be completed makes the board unwinnable while looking
 * exactly like a board.
 *
 * Five by five is the size a bingo card traditionally is and is deliberately
 * not here. Twenty-five Hebrew task titles across a 360px phone is 64px a
 * cell, which fits about one word — and the one device this is opened on is
 * a phone. Four is the largest square whose cells can hold a sentence.
 */
export const sizeFor = (count: number): number => (count >= 16 ? 4 : count >= 9 ? 3 : 0);

/** The fewest tasks that make a board at all, named because two screens ask. */
export const MIN_SQUARES = 9;

/**
 * Every row, every column, and the two diagonals.
 *
 * Right to left changes nothing here. The page draws index 0 in the top
 * corner a Hebrew reader starts from, so the diagonals swap which one is
 * which on screen, and both are still diagonals.
 */
export function linesOf(size: number): number[][] {
  const span = [...Array(size).keys()];
  return [
    ...span.map((r) => span.map((c) => r * size + c)),
    ...span.map((c) => span.map((r) => r * size + c)),
    span.map((i) => i * size + i),
    span.map((i) => i * size + (size - 1 - i)),
  ];
}

/**
 * Which tasks are the critical ones.
 *
 * Two bands and no more: a task carrying a supplier category ends with
 * somebody hired and somebody paid, and everything else is an errand. The
 * hall, the caterer, the photographer and the dress are the decisions a
 * wedding is actually made of, so they fill the board before anything else
 * does.
 *
 * What is deliberately not in here is a due date, and it was in the first
 * draft. Dated-means-committed is true, and it also means the board rebuilds
 * itself the evening somebody types a date into a task — squares move, a line
 * that was one away is no longer a line, and nothing on the screen explains
 * why. A rule that reshuffles the board as a side effect of ordinary work is
 * the wrong rule however well it ranks.
 */
const band = (t: BingoTask): number => (t.category ? 0 : 1);

/* Ordering is by id inside a band and by hash across the board, so both are
   total and neither depends on the order the rows arrived in. Two runs of the
   same query in a different order must not produce two different boards. */
const byId = (a: BingoTask, b: BingoTask): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * One wedding's board.
 *
 * Returns null rather than a short board when there are not enough tasks for
 * the smallest square. The screen draws something either way — a panel that
 * removes itself when the data is thin is the mistake this product has made
 * twice — but what it draws then is a sentence, not a grid with holes in it.
 */
export function buildBoard<T extends BingoTask>(clientId: string, tasks: readonly T[]): Board<T> | null {
  const size = sizeFor(tasks.length);
  if (!size) return null;

  /* Chosen without ever reading `done`. This matters more than it looks:
     selecting on whether a task is finished would rebuild the board every
     time somebody ticked a square, which is a game where winning a line
     deletes the line. The board moves when tasks are added, removed or
     categorised, and at no other time. */
  const squares = [...tasks]
    .sort((a, b) => band(a) - band(b) || byId(a, b))
    .slice(0, size * size)
    /* Laid out by a hash of the wedding and the task rather than by shuffling
       the array: a shuffle is seeded once and re-runs whole, so adding a
       seventeenth task would move all sixteen. Each task's place is its own
       and it keeps it. */
    .sort((a, b) => seedFrom(clientId + a.id) - seedFrom(clientId + b.id) || byId(a, b));

  const lines = linesOf(size);
  const won = lines.filter((line) => line.every((i) => squares[i].done));
  return {
    size,
    squares,
    lines,
    won,
    winning: new Set(won.flat()),
    ticked: squares.filter((s) => s.done).length,
    total: size * size,
  };
}
