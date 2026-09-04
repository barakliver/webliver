/**
 * Every screen's first two lines, and the controls that belong beside them.
 *
 * `actions` and `report` are here rather than hand-placed on each page for a
 * reason that showed up the moment the report button was scattered: three
 * pages had grown three slightly different header rows, and a fourth would
 * have grown a fourth. One shape means a producer's eye learns the corner
 * once — and it means the report button reaches every screen by being added
 * in one place rather than nineteen.
 */
export function PageHead({ title, sub, actions, report }: {
  title: string;
  sub?: string;
  /** Buttons that belong to this screen, at the end of the title line. */
  actions?: React.ReactNode;
  /** The 16px report icon, named by this screen. */
  report?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1">
        <h1 className="inline-flex items-center gap-2 font-display text-title font-bold text-editorial">
          {title}
        </h1>
        {sub && <p className="mt-2 text-[15.5px] text-ink-soft">{sub}</p>}
      </div>
      {(actions || report) && (
        <div className="flex shrink-0 items-center gap-2 pt-1">
          {actions}
          {report}
        </div>
      )}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="card text-center text-[15px] text-ink-mute">{text}</div>
  );
}
