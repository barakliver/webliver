'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Search, X } from 'lucide-react';
import { SOP, SOP_INDEX, sopCopy as c } from '@/content/sop';

/**
 * The playbook, readable and searchable.
 *
 * Search is over the whole book rather than within a chapter, because the
 * question somebody arrives with is "generator" or "toilets", not "which
 * chapter would that be in". A hit keeps its chapter and section on screen, so
 * finding one line also shows where the rest of that subject lives.
 *
 * Filtering, not highlighting. A page that dims what does not match still
 * makes somebody scroll past all of it.
 */
export function SopBook() {
  const [query, setQuery] = useState('');

  const q = query.trim();
  const hits = useMemo(() => {
    if (q.length < 2) return null;
    /* Every word must appear somewhere in the item, in any order. "גנרטור
       גיבוי" should find the line about a backup generator even though the
       line says "להזמין גנרטור גיבוי, תמיד". */
    const words = q.split(/\s+/);
    return SOP_INDEX.filter((entry) => words.every((w) => entry.haystack.includes(w)));
  }, [q]);

  return (
    <div>
      <div className="no-print relative">
        <Search
          size={17}
          strokeWidth={1.5}
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-mute"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={c.searchPh}
          aria-label={c.search}
          className="field w-full pr-11 pl-11"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={c.clear}
            className="absolute top-1/2 left-3 -translate-y-1/2 rounded-xl2 p-1.5 text-ink-mute transition hover:bg-surface-200 hover:text-ink"
          >
            <X size={15} strokeWidth={1.5} aria-hidden />
          </button>
        )}
      </div>

      {hits ? (
        <div className="mt-6">
          <p className="text-[13px] text-ink-mute">{c.results(hits.length)}</p>
          {hits.length === 0 ? (
            <p className="mt-6 text-[15px] text-ink-mute">{c.noResults}</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {hits.map((h) => (
                <li key={h.key} className="rounded-xl2 border border-line px-4 py-3.5">
                  <p className="text-[12px] text-accent">{h.chapterTitle} · {h.sectionTitle}</p>
                  <p className="mt-1 text-[15px] text-ink">{h.item.text}</p>
                  {h.item.why && <p className="mt-1 text-[13.5px] text-ink-soft">{h.item.why}</p>}
                  {h.item.when && <p className="mt-1 text-[12.5px] text-ink-mute">{c.when}: {h.item.when}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-12">
          {SOP.map((chapter) => (
            <section key={chapter.id} id={chapter.id} className="sop-chapter">
              <header className="border-b-2 border-ink pb-3">
                <h2 className="inline-flex items-center gap-2 font-display text-[24px] font-semibold text-ink">
                  <BookOpen size={20} aria-hidden strokeWidth={1.5} className="no-print" />
                  {chapter.title}
                </h2>
                <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-soft">{chapter.sub}</p>
              </header>

              <div className="mt-7 space-y-8">
                {chapter.sections.map((section) => (
                  <article key={section.id} className="sop-section">
                    <h3 className="font-display text-[18px] font-semibold text-ink">{section.title}</h3>
                    <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-mute">{section.sub}</p>

                    <ul className="mt-4 space-y-2.5">
                      {section.items.map((item, i) => (
                        <li key={i} className="sop-item flex gap-3.5 rounded-xl2 border border-line px-4 py-3.5">
                          {/* A rule of thumb reads as a rule when it is
                              numbered. These are ordered by how a day runs, so
                              the number carries something true. */}
                          <span className="mt-0.5 w-5 shrink-0 text-[12.5px] tabular-nums text-ink-mute" dir="ltr">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[15px] leading-relaxed text-ink">{item.text}</p>
                            {item.why && (
                              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{item.why}</p>
                            )}
                            {item.when && (
                              <p className="mt-1 text-[12.5px] text-accent">{c.when}: {item.when}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
