/**
 * An event file, before its section arrives.
 *
 * Switching tabs changes the search params, which is a new page segment to
 * the router, so this is what shows between one tab and the next. It keeps
 * the file's chrome where it stands - the action row, the title, the strip
 * of tabs - and only the section below them breathes, so a tab switch reads
 * as the section changing rather than the whole screen leaving.
 */
export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="skeleton h-5 w-24" />
        <div className="flex flex-wrap gap-2">
          <div className="skeleton h-10 w-28" />
          <div className="skeleton h-10 w-28" />
          <div className="skeleton h-10 w-24" />
          <div className="skeleton h-10 w-20" />
        </div>
      </div>
      <div className="mb-8">
        <div className="skeleton h-9 w-64 max-w-full" />
      </div>
      <div className="mb-6 flex gap-1.5 overflow-hidden border-b border-line pb-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skeleton h-[38px] w-[74px] shrink-0" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}>
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-3 h-10 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-8 space-y-2">
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
      </div>
    </div>
  );
}
