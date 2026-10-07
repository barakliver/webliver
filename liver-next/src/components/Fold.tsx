import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Ltr } from '@/components/Ltr';

/**
 * A drawer on the couple's screen.
 *
 * Their instruction was two things at once: lose nothing, and make it calm.
 * Those only look contradictory. Everything about a wedding is on this
 * screen — twenty panels of it — and a couple opening the app in the evening
 * wants to know one thing, not twenty. So the whole of it stays and almost
 * none of it is drawn: what is open at rest is the countdown, the one thing
 * to do next, four figures and their own tasks. The rest is five quiet rows,
 * each of which says what is behind it.
 *
 * A native `<details>`, deliberately. It works before the JavaScript arrives,
 * it is a real disclosure to a screen reader without a line of aria, and the
 * keyboard already knows it. What it costs is that a link into a closed one
 * needs help — `lib/reveal` is that help, and both ways into a section go
 * through it.
 *
 * The panels inside keep their own headings and their own cards. This row is
 * not a second title for them: it is the name of the drawer, and the sentence
 * under it is there so nobody has to open a drawer to find out what is in it.
 *
 * Two things arrived with the reference he sent — a wedding app whose whole
 * quality is that it reads as organised rather than as full.
 *
 * The first is the mark. Every row now carries a small tinted square with the
 * section's own icon in it. It is the only colour on a closed screen and it
 * is doing work rather than decorating: six rows of the same weight are six
 * things to read, and six rows each led by a different shape are a list
 * somebody finds their place in without reading any of it.
 *
 * The second is `count`. A closed drawer that says how much is inside it is
 * a drawer nobody has to open to check, which is the whole of why the screen
 * is allowed to be closed at rest.
 */
export function Fold({
  id, title, sub, icon: Icon, count, open = false, grouped = false, children,
}: {
  id: string;
  title: string;
  /** One line saying what is inside, so the row can be read rather than tried. */
  sub: string;
  /** The section's own mark. Absent on the rows that are not a section. */
  icon?: LucideIcon;
  /** How much is behind the row. Undefined means there is nothing honest to
   *  count — which is different from nought, and is drawn as nothing rather
   *  than as a zero somebody has to interpret. */
  count?: number;
  /** Open on arrival. Nothing passes this yet; the couple's screen is quiet. */
  open?: boolean;
  /** Inside a `FoldGroup`, so the container carries the edge and this row
   *  carries none of its own. Explicit rather than inherited: a drawer that
   *  works out its own chrome from its surroundings is a drawer that draws
   *  differently depending on where it was imported. */
  grouped?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      open={open}
      className={`group scroll-mt-28 ${
        grouped
          /* The tray's inset is padding on the row rather than a margin on
             the tray: a margin on the last child collapses straight out
             through a box with no padding of its own, which took the white
             off the bottom of the list and squared its corner. */
          ? 'bg-card open:pb-3'
          : 'overflow-hidden rounded-card border border-line-soft bg-card transition-colors hover:border-accent/40'
      }`}
    >
      <summary
        className={`flex min-h-[68px] cursor-pointer list-none items-center gap-3.5 px-4 py-3.5
                    transition-colors [&::-webkit-details-marker]:hidden`}
      >
        {Icon && (
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-accent-wash text-accent"
          >
            <Icon size={18} strokeWidth={1.6} />
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block font-display text-head font-semibold leading-tight text-ink">{title}</span>
          <span className="mt-0.5 block truncate text-body leading-relaxed text-ink-soft">{sub}</span>
        </span>

        {count !== undefined && count > 0 && (
          <span className="shrink-0 text-body tabular-nums text-ink-mute">
            <Ltr>{count}</Ltr>
          </span>
        )}

        {/* Down when closed, up when open. The rotation is the only thing on
            this row that moves, and it points the same way in both
            directions of text. */}
        <ChevronDown
          size={19} strokeWidth={1.5} aria-hidden
          className="shrink-0 text-ink-mute transition-transform duration-touch group-open:rotate-180"
        />
      </summary>
      {/* Open, the drawer is a tray sunk into the list rather than a column
          of panels hanging below it. On the page's own ground, because the
          panels inside are white cards and a white card on a white list has
          no edge anybody can see; inset and rounded, because content that
          runs to the edge of the row above it reads as having escaped the
          box rather than as being inside it. */}
      <div
        className={
          grouped
            ? 'mx-2.5 space-y-10 rounded-card bg-surface p-3 sm:mx-3 sm:p-4'
            : 'mt-6 space-y-10'
        }
      >
        {children}
      </div>
    </details>
  );
}

/**
 * The drawers, as one object.
 *
 * They were six cards with air between them, which is six things on a screen
 * whose entire argument is that a couple should arrive to four. Inside one
 * surface, separated by the 1px of ground that `space-y-px` leaves between
 * them, they are one list with six lines in it — the same move the four
 * figures above them already made, and the reason the reference screen he
 * sent reads as organised rather than as full.
 *
 * The separator is a gap rather than a border on purpose: a gap cannot double
 * at a boundary, cannot be inherited by the open drawer's content, and is
 * exactly as wide as a hairline without anybody having to say which side of
 * which row owns it.
 */
export function FoldGroup({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-px overflow-hidden rounded-card ${className}`}>{children}</div>
  );
}
