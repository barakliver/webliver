/**
 * What the supplier's link opens.
 *
 * A photographer standing in a hall, or a stylist the morning of. Read on a
 * phone, once, quickly, by somebody who has never seen this product and will
 * never see it again — so there is nothing to learn here: no navigation, no
 * account, no tabs. Names under faces, references in a grid, and the name of
 * the production at the bottom so they know who to call.
 *
 * A server component with no state. The scope decided which of the two
 * sections has anything in it, in the database, before this file was reached:
 * a link for the photographer arrives here with an empty list of looks and no
 * way to ask for more.
 */

export type PrepFace = { name: string; relation: string; note: string; url: string | null };
export type PrepLook = { category: 'hair' | 'makeup' | 'outfit' | 'other'; note: string; url: string | null };

export type PrepViewCopy = {
  faces: string;
  looks: string;
  categories: { hair: string; makeup: string; outfit: string; other: string };
  by: string;
  /** Shown when a scope means one of the sections is empty on purpose. */
  onlyFaces: string;
  onlyLooks: string;
};

const ORDER = ['hair', 'makeup', 'outfit', 'other'] as const;

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
    <main id="main" className="shell max-w-3xl py-10">
      <header className="border-b border-line pb-5">
        <h1 className="font-display text-[28px] font-semibold text-ink">{eventName}</h1>
        <p className="mt-1.5 text-[15px] text-ink-soft">
          {dateLabel}
          {venue ? ` · ${venue}` : ''}
        </p>
      </header>

      {faces.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-[20px] font-semibold text-ink">{c.faces}</h2>
          <ul className="mt-4 grid list-none gap-4 p-0 sm:grid-cols-2">
            {faces.map((f, i) => (
              <li key={i} className="flex items-start gap-3">
                {/* A placeholder rather than nothing. A name with no picture
                    is still an instruction, and without this its row starts
                    at a different edge from every other one — which on a list
                    somebody scans in a hall is how a person gets skipped. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {f.url
                  ? <img src={f.url} alt={f.name} className="size-20 shrink-0 rounded-xl2 object-cover" />
                  : <span aria-hidden className="size-20 shrink-0 rounded-xl2 border border-line bg-surface-200" />}
                <div className="min-w-0">
                  <p className="text-[16px] font-medium text-ink">{f.name}</p>
                  {f.relation && <p className="text-[14px] text-ink-soft">{f.relation}</p>}
                  {/* The instruction, at the same size as the name. It is the
                      only part of this that is an instruction. */}
                  {f.note && <p className="mt-1 text-[14px] leading-snug text-ink">{f.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {looks.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-[20px] font-semibold text-ink">{c.looks}</h2>
          {ORDER.filter((cat) => looks.some((l) => l.category === cat)).map((cat) => (
            <div key={cat} className="mt-5">
              <h3 className="eyebrow">{c.categories[cat]}</h3>
              <ul className="mt-2 grid list-none gap-2 p-0 grid-cols-2 sm:grid-cols-3">
                {looks.filter((l) => l.category === cat).map((l, i) => (
                  <li key={i} className="overflow-hidden rounded-xl2 border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {l.url && <img src={l.url} alt={l.note || c.categories[cat]} className="aspect-square w-full object-cover" />}
                    {l.note && <p className="px-2 py-1.5 text-[13px] leading-snug text-ink-soft">{l.note}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Said rather than left blank. A photographer whose link shows no
          references should know that is the link working as intended, not a
          page that failed to load. */}
      {faces.length > 0 && looks.length === 0 && (
        <p className="mt-8 text-[13.5px] text-ink-mute">{c.onlyFaces}</p>
      )}
      {looks.length > 0 && faces.length === 0 && (
        <p className="mt-8 text-[13.5px] text-ink-mute">{c.onlyLooks}</p>
      )}

      {producer && (
        <footer className="mt-10 border-t border-line pt-4 text-[13.5px] text-ink-mute">
          {c.by} {producer}
        </footer>
      )}
    </main>
  );
}
