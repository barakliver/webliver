import Link from 'next/link';

/**
 * The one dark stretch on the page.
 *
 * A single band of #0E0C0A between two runs of ivory, which is the whole
 * reason it works: it is the only place the page inverts, so it reads as a
 * held breath rather than as a section. Gold becomes a text colour here, at
 * 6.32:1 against the ground, which is the one context in this palette where it
 * carries words safely.
 *
 * The glow behind it is a radial gold at low opacity on a slow loop. It is
 * decorative, it never sits under text, and it is the first thing a reader
 * with reduced motion stops seeing move.
 */
export function DarkBand({
  kicker, title, body, cta, href,
}: {
  kicker?: string; title: string; body?: string; cta: string; href: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-dark py-24 sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 animate-shimmer rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(176,141,87,.22) 0%, rgba(176,141,87,.06) 45%, transparent 70%)',
        }}
      />

      <div className="shell text-center">
        {kicker && (
          <p className="text-[11.5px] font-medium tracking-[.14em] text-accent-light">{kicker}</p>
        )}
        <h2 className="mx-auto mt-4 max-w-[20ch] font-display text-display font-light text-surface">
          {title}
        </h2>
        {body && (
          <p className="measure mx-auto mt-5 text-[16.5px] leading-relaxed text-surface/75">{body}</p>
        )}
        <div className="mt-9">
          <Link
            href={href}
            className="btn bg-surface text-ink transition-colors duration-300 hover:bg-surface-200"
          >
            {cta}
          </Link>
        </div>
      </div>
    </section>
  );
}
