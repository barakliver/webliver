/**
 * The enquiries, before they arrive.
 *
 * A form at the top, because the first thing done on this screen is writing
 * down the call that just ended, and then the pile grouped by how old it is.
 */
export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="mb-8">
        <div className="skeleton h-9 w-36 max-w-full" />
        <div className="skeleton mt-3 h-4 w-80 max-w-full" />
      </div>

      <div className="card">
        <div className="skeleton h-5 w-28" />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="skeleton h-[42px] w-full rounded-control" />
          <div className="skeleton h-[42px] w-full rounded-control" />
          <div className="skeleton h-[42px] w-full rounded-control" />
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {Array.from({ length: 2 }, (_, g) => (
          <div key={g}>
            <div className="skeleton mb-3 h-4 w-24" />
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="skeleton h-[104px] w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
