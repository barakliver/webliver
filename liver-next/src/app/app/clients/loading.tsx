/**
 * The events, before they arrive.
 *
 * Read by season: a year is a row that opens, and only the nearest one is
 * open. So the silhouette is a couple of headings with cards under the first
 * and nothing under the rest, which is what the real screen looks like.
 */
export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="mb-8">
        <div className="skeleton h-9 w-36 max-w-full" />
        <div className="skeleton mt-3 h-4 w-80 max-w-full" />
      </div>

      <div className="mb-6 skeleton h-[46px] w-56 rounded-control" />
      <div className="mb-8 skeleton h-[120px] w-full" />

      <div className="space-y-6">
        <div>
          <div className="skeleton mb-3 h-6 w-28" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton h-[148px] w-full" />
            ))}
          </div>
        </div>
        {/* The seasons further out are closed rows, not cards. */}
        <div className="skeleton h-[56px] w-full" />
        <div className="skeleton h-[56px] w-full" />
      </div>
    </div>
  );
}
