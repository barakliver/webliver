/**
 * The month, before it arrives.
 *
 * The generic console skeleton is a list beside a column of cards, which is
 * the silhouette most screens share and is nothing like this one. A month is
 * a grid of six rows by seven, and standing a list where a grid is about to
 * land is worse than standing nothing: the screen rearranges itself under the
 * eye at exactly the moment somebody started reading it.
 */
export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="mb-8">
        <div className="skeleton h-9 w-48 max-w-full" />
        <div className="skeleton mt-3 h-4 w-96 max-w-full" />
      </div>

      <div className="card">
        {/* The month's name and the two arrows beside it. */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <div className="skeleton size-11 rounded-control" />
            <div className="skeleton h-7 w-32" />
            <div className="skeleton size-11 rounded-control" />
          </div>
          <div className="skeleton h-10 w-20 rounded-control" />
        </div>

        {/* Seven days across, six weeks down, at the real cell height so the
            grid does not change size when the dates land in it. */}
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={`h${i}`} className="skeleton mb-1 h-3 w-full" />
          ))}
          {Array.from({ length: 42 }, (_, i) => (
            <div key={i} className="skeleton h-[64px] w-full rounded-card-sm sm:h-[96px]" />
          ))}
        </div>
      </div>

      {/* The three closed rows under it, which are rows whether or not the
          month has arrived. */}
      <div className="mt-7 space-y-px overflow-hidden rounded-card">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="skeleton h-[64px] w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}
