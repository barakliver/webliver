/** Body copy arrives as discrete lines. Rendering each as its own paragraph
 *  keeps the intended cadence instead of collapsing it into a block.
 *
 *  The first line is the lede and is set as one: a step up in size, the ink at
 *  full strength, and a touch more room under it. The copy was rewritten to
 *  open every passage with the sentence that carries its feeling, and a lede
 *  drawn like every other line buries exactly the sentence the block exists
 *  for. One editorial device, applied uniformly, rather than a different
 *  flourish per section.
 *
 *  `lede={false}` keeps the flat setting for places where the lines are a list
 *  rather than a passage. */
export function Prose({ lines, className = '', lede = true, ledeClassName = 'text-ink' }: {
  lines: readonly string[]; className?: string; lede?: boolean;
  /** The lede's ink. The hero sets its passage on a photograph and needs the
   *  first line light, not dark; everywhere else the default holds. */
  ledeClassName?: string;
}) {
  return (
    <div className={`measure space-y-2.5 text-head text-ink-soft sm:text-head ${className}`}>
      {lines.map((line, i) => (
        <p
          key={i}
          className={lede && i === 0
            ? `pb-1.5 text-subhead leading-relaxed sm:text-panel ${ledeClassName}`
            : undefined}
        >
          {line}
        </p>
      ))}
    </div>
  );
}
