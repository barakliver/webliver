'use client';

import { PartyPopper } from 'lucide-react';
import { buildBoard, MIN_SQUARES } from '@/lib/bingo';
import { useCopy } from '@/components/app/CopyProvider';
import { useTaskPress } from '@/components/app/TaskPress';
import { Ltr } from '@/components/Ltr';
import type { Task } from '@/components/app/TaskList';

/**
 * The wedding bingo.
 *
 * The couple's own critical tasks in a square, pressed to tick, won by a row,
 * a column or a diagonal. The rules that decide which tasks and in which
 * order are in `lib/bingo.ts`, pure and tested; everything here is the
 * drawing of them.
 *
 * Every square is a real task and pressing one is the real tick, through the
 * same `useTaskPress` the checklist uses — which means a supplier square opens
 * the same form asking who was hired, and filling it in still writes the
 * supplier and the budget line. Ticking the photographer here and ticking it
 * in the list are the same act, recorded once.
 *
 * The board never hides itself. Below nine tasks there is no grid that is not
 * a broken grid, so it says that in a sentence and points at the list, rather
 * than removing the row and leaving a couple to wonder which switch they are
 * missing. That mistake has been made twice on this screen.
 */
export function WeddingBingo({ clientId, tasks }: { clientId: string; tasks: Task[] }) {
  const c = useCopy().portal.bingo;
  const board = buildBoard(clientId, tasks);

  if (!board) {
    return (
      <section className="card" aria-labelledby="bingo-title">
        <Title id="bingo-title" text={c.title} />
        <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>
        <p className="mt-5 text-[14px] leading-relaxed text-ink-mute">
          {c.tooFew.replace('{n}', String(MIN_SQUARES - tasks.length))}
        </p>
        <a href="#tasks" className="btn-quiet mt-4 inline-flex px-3 py-1.5 text-[13px]">{c.toTasks}</a>
      </section>
    );
  }

  const lines = board.won.length;

  return (
    <section className="card" aria-labelledby="bingo-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Title id="bingo-title" text={c.title} />
        <p className="text-[13px] tabular-nums text-ink-mute">
          <Ltr>{board.ticked} / {board.total}</Ltr>
        </p>
      </div>
      <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>

      {/* The shout, above the board rather than under it: on a phone the
          bottom of a four by four grid is below the fold, and a celebration
          somebody has to scroll to find is not one. */}
      {lines > 0 && (
        <p
          role="status"
          className="mt-5 inline-flex items-center gap-2 rounded-xl2 bg-ok-wash px-3 py-2 text-[14px] font-semibold text-ok"
        >
          <PartyPopper size={16} aria-hidden strokeWidth={1.75} />
          {board.ticked === board.total
            ? c.full
            : lines === 1 ? c.bingo : c.bingoMany.replace('{n}', String(lines))}
        </p>
      )}

      {/* An explicit column count rather than a class per size: Tailwind
          scans source text for class names it can see, and `grid-cols-${n}`
          is a string it cannot, so the board would have come out as one
          column in production and four in development. */}
      {/* Capped, and centred once it is capped. The cells are squares, so on a
          wide screen four columns of a full-width card come out 380px each
          with a two-word title floating in the middle of them — a board that
          gets less readable the more room it is given. A phone is inside the
          cap and stays full width, which is the case that matters. */}
      <div
        className="mx-auto mt-5 grid w-full max-w-[26rem] gap-1.5"
        style={{ gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))` }}
      >
        {board.squares.map((task, at) => (
          <Square key={task.id} task={task} clientId={clientId} onLine={board.winning.has(at)} />
        ))}
      </div>

      <p className="mt-4 text-[12.5px] leading-relaxed text-ink-mute">{c.note}</p>
    </section>
  );
}

function Title({ id, text }: { id: string; text: string }) {
  return (
    <h2 id={id} className="font-display text-[18px] font-semibold text-ink">{text}</h2>
  );
}

/**
 * One cell.
 *
 * A square rather than a row, so the board reads as a board: `aspect-square`
 * and the title clamped, with the full title on the button's accessible name
 * so nothing is lost to the clamp for somebody listening rather than looking.
 */
function Square({ task, clientId, onLine }: {
  task: Task; clientId: string; onLine: boolean;
}) {
  const c = useCopy().portal.bingo;
  const { done, ticking, press, captureForm } = useTaskPress(task, clientId);

  return (
    <>
      <button
        type="button"
        onClick={press}
        disabled={ticking}
        aria-pressed={done}
        aria-label={`${task.title}${done ? ` · ${c.marked}` : ''}`}
        className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl2 border p-2 text-center transition ${
          done
            ? onLine
              ? 'border-ok bg-ok text-surface'
              : 'border-ok/30 bg-ok-wash text-ok'
            : 'border-line bg-card text-ink hover:border-ink'
        }`}
      >
        <span
          aria-hidden
          className={`text-[15px] leading-none ${done ? '' : 'text-transparent'}`}
        >
          ✓
        </span>
        <span className="line-clamp-3 text-[11.5px] leading-tight">{task.title}</span>
      </button>
      {captureForm}
    </>
  );
}
