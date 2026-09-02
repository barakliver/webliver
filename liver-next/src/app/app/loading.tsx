/**
 * The console's screens, before they arrive.
 *
 * Every signed-in route reads the database, so without this a tap on the
 * navigation showed nothing until the server answered. Now the shell swaps
 * instantly to the shape of a screen - a title, a lede, a list and a column
 * of cards, which is the silhouette most of the console shares - and the
 * real one fills in over it. Routes with a stronger shape of their own
 * carry their own loading.tsx.
 */
export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="mb-8">
        <div className="skeleton h-9 w-56 max-w-full" />
        <div className="skeleton mt-3 h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:gap-8">
        <div className="space-y-2.5">
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-[68px] w-full" />
          <div className="skeleton h-[68px] w-full" />
          <div className="skeleton h-[68px] w-full" />
          <div className="skeleton h-[68px] w-full" />
        </div>
        <div className="space-y-5">
          <div className="skeleton h-40 w-full" />
          <div className="skeleton h-52 w-full" />
        </div>
      </div>
    </div>
  );
}
