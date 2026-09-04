/**
 * The public site, before it arrives.
 *
 * The console has had one of these for a while and the site a stranger sees
 * had none, which is the wrong way round: a producer waiting on their own
 * screens knows the product works, and a visitor waiting on a blank page is
 * deciding whether it does. Both pages behind this address read from the
 * database — the copy is editable and the shop is real — so there is a wait
 * to fill on a slow connection.
 *
 * Shaped like what is coming rather than a spinner: a full-bleed opening, a
 * line of type over it, and the two buttons under that. A silhouette that
 * matches means the real page settles into it instead of pushing it aside,
 * which is the difference between a page loading and a page jumping.
 *
 * `aria-busy` rather than a live region. There is nothing to announce yet,
 * and a screen reader saying "loading" on every navigation is noise.
 */
export default function Loading() {
  return (
    <div aria-busy="true">
      {/* The photograph. Sized to the hero rather than to the viewport, so
          the fold lands where it will land. */}
      <div className="skeleton h-[62vh] min-h-[420px] w-full rounded-none" />

      <div className="shell py-14">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton mt-5 h-10 w-full max-w-xl" />
        <div className="skeleton mt-3 h-10 w-full max-w-md" />
        <div className="skeleton mt-6 h-4 w-full max-w-lg" />
        <div className="skeleton mt-2 h-4 w-full max-w-sm" />

        <div className="mt-9 flex flex-wrap gap-3">
          <div className="skeleton h-11 w-36" />
          <div className="skeleton h-11 w-28" />
        </div>
      </div>
    </div>
  );
}
