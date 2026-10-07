/**
 * The supplier directory, before it arrives.
 *
 * A grid of cards rather than a list, which is the whole difference from the
 * generic skeleton: a directory is scanned, not read down.
 */
export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="mb-8">
        <div className="skeleton h-9 w-40 max-w-full" />
        <div className="skeleton mt-3 h-4 w-80 max-w-full" />
      </div>

      <div className="card mb-6">
        <div className="skeleton h-5 w-32" />
        <div className="skeleton mt-4 h-[42px] w-full rounded-control" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="skeleton h-[132px] w-full" />
        ))}
      </div>
    </div>
  );
}
