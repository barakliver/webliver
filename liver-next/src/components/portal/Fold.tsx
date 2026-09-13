import { ChevronDown } from 'lucide-react';

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
 */
export function Fold({
  id, title, sub, open = false, children,
}: {
  id: string;
  title: string;
  /** One line saying what is inside, so the row can be read rather than tried. */
  sub: string;
  /** Open on arrival. Nothing passes this yet; the couple's screen is quiet. */
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details id={id} open={open} className="group scroll-mt-28">
      <summary
        className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-4
                   rounded-card border border-line-soft bg-card px-5 py-4 transition-colors
                   hover:border-accent/40 [&::-webkit-details-marker]:hidden"
      >
        <span className="min-w-0">
          <span className="block font-display text-[17px] font-semibold text-ink">{title}</span>
          <span className="mt-0.5 block text-[13.5px] leading-relaxed text-ink-soft">{sub}</span>
        </span>
        {/* Down when closed, up when open. The rotation is the only thing on
            this row that moves, and it points the same way in both
            directions of text. */}
        <ChevronDown
          size={20} strokeWidth={1.5} aria-hidden
          className="shrink-0 text-ink-mute transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="mt-6 space-y-10">{children}</div>
    </details>
  );
}
