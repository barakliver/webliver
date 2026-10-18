import { TONE, toneAt } from '@/lib/tone';
import { ZoomPhoto } from '@/components/ZoomPhoto';

/**
 * What the supplier's link opens.
 *
 * A photographer standing in a hall, or a stylist the morning of. Read on a
 * phone, once, quickly, by somebody who has never seen this product and will
 * never see it again — so there is nothing to learn here: no navigation, no
 * account, no tabs. Names under faces, references in a grid, and the name of
 * the production at the bottom so they know who to call.
 *
 * Server-rendered, with one client island for the pictures that open large.
 * The scope decided which of the two sections has anything in it, in the
 * database, before this file was reached: a link for the photographer arrives
 * here with an empty list of looks and no way to ask for more.
 */

export type PrepFace = { name: string; relation: string; note: string; url: string | null };
export type PrepLook = { category: 'hair' | 'makeup' | 'outfit' | 'other'; note: string; url: string | null };

export type PrepViewCopy = {
  faces: string;
  looks: string;
  categories: { hair: string; makeup: string; outfit: string; other: string };
  by: string;
  enlarge: string;
  close: string;
  /** Shown when a scope means one of the sections is empty on purpose. */
  onlyFaces: string;
  onlyLooks: string;
};

const ORDER = ['hair', 'makeup', 'outfit', 'other'] as const;

/* The first picture of a category leads. Written out for Tailwind to read. */
const mosaic = (i: number, n: number) => (n >= 3 && i === 0 ? 'col-span-2 row-span-2' : '');

export function PrepView({ c, eventName, dateLabel, venue, producer, faces, looks }: {
  c: PrepViewCopy;
  eventName: string;
  dateLabel: string;
  venue: string;
  producer: string;
  faces: PrepFace[];
  looks: PrepLook[];
}) {
  return (
    <main id="main" className="shell max-w-3xl pb-10 pt-6">
      <header className="band-dark overflow-hidden rounded-panel px-6 py-7 sm:px-8 sm:py-9">
        <h1 className="animate-rise font-display text-display font-light leading-[1.12]">{eventName}</h1>
        <p className="animate-rise mt-3 text-lead text-accent-light" style={{ animationDelay: '.12s' }}>
          {dateLabel}
          {venue ? ` · ${venue}` : ''}
        </p>
      </header>

      {/* Two ways down the page, and the counts say what is in each before
          anybody presses. It is one link when there is one section, so the
          page never points at a place that is not there. */}
      {faces.length > 0 && looks.length > 0 && (
        <nav aria-label={eventName} className="sticky top-0 z-10 -mx-5 mt-4 flex gap-2 bg-surface/90 px-5 py-2.5 backdrop-blur sm:mx-0 sm:rounded-control">
          <a href="#faces" className={`rounded-full px-4 py-2 text-body ${TONE.rubine.fill}`}>{c.faces} · {faces.length}</a>
          <a href="#looks" className={`rounded-full px-4 py-2 text-body ${TONE.boho.fill}`}>{c.looks} · {looks.length}</a>
        </nav>
      )}

      {faces.length > 0 && (
        <section id="faces" className="reveal mt-8 scroll-mt-16">
          <h2 className="head-section">{c.faces}</h2>
          <ul className="mt-4 grid list-none grid-cols-2 gap-x-3 gap-y-6 p-0 sm:grid-cols-3">
            {faces.map((f, i) => {
              const tone = TONE[toneAt(i)];
              const portrait = 'aspect-square rounded-full object-cover';
              return (
                <li key={i} className="animate-rise text-center" style={{ animationDelay: `${Math.min(i, 8) * 0.06}s` }}>
                  {/* A person with no picture still gets a face-shaped place,
                      in their own tone with their first letter on it: a name
                      without one is still an instruction, and a row that
                      starts at a different edge is how somebody gets skipped. */}
                  {f.url ? (
                    <ZoomPhoto src={f.url} alt={f.name} caption={f.note || f.relation} label={`${c.enlarge}: ${f.name}`} close={c.close}
                      className="mx-auto block w-[88%] rounded-full transition-transform duration-touch hover:scale-[1.03]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt="" className={`w-full ${portrait}`} decoding="async" />
                    </ZoomPhoto>
                  ) : (
                    <span aria-hidden className={`mx-auto grid w-[88%] place-items-center font-display text-[44px] font-light ${portrait} ${tone.fill}`}>
                      {Array.from(f.name.trim())[0] ?? ''}
                    </span>
                  )}
                  <p className="mt-2.5 text-head font-medium text-ink">{f.name}</p>
                  {f.relation && (
                    <p className={`mx-auto mt-1 inline-block rounded-full px-2.5 py-0.5 text-meta ${tone.wash}`}>{f.relation}</p>
                  )}
                  {/* The instruction, at the same size as the name. It is the
                      only part of this that is an instruction. */}
                  {f.note && <p className="mt-1.5 text-body leading-snug text-ink">{f.note}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {looks.length > 0 && (
        <section id="looks" className="reveal mt-10 scroll-mt-16">
          <h2 className="head-section">{c.looks}</h2>
          {ORDER.filter((cat) => looks.some((l) => l.category === cat)).map((cat, ci) => {
            const set = looks.filter((l) => l.category === cat);
            return (
              <div key={cat} className="mt-6">
                <h3 className="eyebrow flex items-center gap-2">
                  <span aria-hidden className={`size-2.5 rounded-full ${TONE[toneAt(ci + 1)].dot}`} />
                  {c.categories[cat]}
                </h3>
                <ul className="mt-2 grid list-none auto-rows-[112px] grid-cols-2 gap-2 p-0 sm:auto-rows-[140px] sm:grid-cols-3">
                  {set.map((l, i) => (
                    <li key={i} className={`relative overflow-hidden rounded-card-sm border border-line ${mosaic(i, set.length)}`}>
                      {l.url && (
                        <ZoomPhoto src={l.url} alt={l.note || c.categories[cat]} caption={l.note} label={`${c.enlarge}: ${l.note || c.categories[cat]}`} close={c.close}
                          className="block size-full">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={l.url} alt="" className="size-full object-cover transition-transform duration-slow hover:scale-105" decoding="async" />
                        </ZoomPhoto>
                      )}
                      {l.note && (
                        <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-surface/90 px-2 py-1 text-meta leading-snug text-ink">{l.note}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {/* Said rather than left blank. A photographer whose link shows no
          references should know that is the link working as intended, not a
          page that failed to load. */}
      {faces.length > 0 && looks.length === 0 && (
        <p className="mt-8 text-body text-ink-mute">{c.onlyFaces}</p>
      )}
      {looks.length > 0 && faces.length === 0 && (
        <p className="mt-8 text-body text-ink-mute">{c.onlyLooks}</p>
      )}

      {producer && (
        <footer className="mt-10 border-t border-line pt-4 text-body text-ink-mute">
          {c.by} {producer}
        </footer>
      )}
    </main>
  );
}
