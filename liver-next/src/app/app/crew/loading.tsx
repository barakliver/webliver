/**
 * The crew, before it arrives.
 *
 * Seven queries behind this screen, and the season board at the bottom is the
 * widest thing in the console. The shape is: the directory, then a board of
 * three role columns across every open evening.
 */
export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="mb-8">
        <div className="skeleton h-9 w-40 max-w-full" />
        <div className="skeleton mt-3 h-4 w-80 max-w-full" />
      </div>

      {/* The people. */}
      <div className="card">
        <div className="skeleton h-5 w-32" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-[88px] w-full rounded-card-sm" />
          ))}
        </div>
      </div>

      {/* The season board: a row per evening, three columns of roles. */}
      <div className="card mt-6">
        <div className="skeleton h-5 w-40" />
        <div className="mt-5 space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-2">
              <div className="skeleton h-[72px] rounded-card-sm" />
              <div className="skeleton h-[72px] rounded-card-sm" />
              <div className="skeleton h-[72px] rounded-card-sm" />
              <div className="skeleton h-[72px] rounded-card-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
