/** Body copy arrives as discrete lines. Rendering each as its own paragraph
 *  keeps the intended cadence instead of collapsing it into a block. */
export function Prose({ lines, className = '' }: { lines: readonly string[]; className?: string }) {
  return (
    <div className={`measure space-y-2.5 text-[16.5px] text-ink-soft sm:text-[17.5px] ${className}`}>
      {lines.map((line, i) => <p key={i}>{line}</p>)}
    </div>
  );
}
