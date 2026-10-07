/**
 * The numbers, before they arrive.
 *
 * Six reads of up to four thousand rows each, so this is the slowest screen
 * in the console and the one most worth standing in for. Panels of figures
 * down the page, and a chart among them, at the heights they really are.
 */
export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="mb-8">
        <div className="skeleton h-9 w-44 max-w-full" />
        <div className="skeleton mt-3 h-4 w-96 max-w-full" />
      </div>

      <div className="space-y-5">
        {/* Three figures across, which is what the health and cash panels are. */}
        {Array.from({ length: 2 }, (_, p) => (
          <div key={p} className="card">
            <div className="skeleton h-5 w-36" />
            <div className="mt-6 grid gap-8 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i}>
                  <div className="skeleton h-3 w-20" />
                  <div className="skeleton mt-3 h-10 w-28" />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* The chart. */}
        <div className="card">
          <div className="skeleton h-5 w-32" />
          <div className="skeleton mt-6 h-[220px] w-full rounded-card-sm" />
        </div>

        <div className="card">
          <div className="skeleton h-5 w-28" />
          <div className="mt-5 space-y-2.5">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton h-[44px] w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
