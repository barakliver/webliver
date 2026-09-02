/**
 * The couple's area, before it arrives.
 *
 * The one thing they open the app to see is the countdown, so the skeleton
 * is mostly that: a large numeral's worth of space, then the four summary
 * rows, then the first two panels. The eye lands where the number will be.
 */
export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="mb-8">
        <div className="skeleton h-9 w-40" />
        <div className="skeleton mt-3 h-4 w-64 max-w-full" />
      </div>
      <div className="skeleton h-3 w-48 max-w-full" />
      <div className="skeleton mt-4 h-12 w-72 max-w-full" />
      <div className="skeleton mt-8 h-[88px] w-44" />
      <div className="skeleton mt-3 h-3 w-20" />
      <div className="mt-10 space-y-0 border-t border-line">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center justify-between border-b border-line py-4">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-5 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-10 space-y-10">
        <div className="skeleton h-56 w-full" />
        <div className="skeleton h-40 w-full" />
      </div>
    </div>
  );
}
