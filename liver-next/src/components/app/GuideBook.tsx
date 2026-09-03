'use client';

import { useMemo, useState } from 'react';
import { CircleHelp, Search, X } from 'lucide-react';
import type { GuideBook as Book, GuideUi } from '@/content/guide';

/**
 * One operating book, readable and searchable.
 *
 * The same reading the playbook gets: search is over the whole book, because
 * the question somebody arrives with is "guest" or "code", not "which chapter
 * would that be in". Content arrives as props rather than by import, because
 * this component renders the couple's book in either language and a client
 * component that imports copy ships both.
 *
 * The first-steps strip borrows the marketing page's numbered path on
 * purpose: the serif numeral in gold is this design's way of saying "do these
 * in order", and a person who followed it on the public site should recognise
 * the instruction when they meet it again inside.
 */
export function GuideBookView({ book, c }: { book: Book; c: GuideUi }) {
  const [query, setQuery] = useState('');

  const q = query.trim();
  const hits = useMemo(() => {
    if (q.length < 2) return null;
    const words = q.split(/\s+/);
    const index = book.chapters.flatMap((ch) =>
      ch.entries.map((entry, i) => ({
        key: `${ch.id}-${i}`,
        chapterTitle: ch.title,
        entry,
        haystack: [entry.q, ...entry.steps, entry.note ?? ''].join(' '),
      }))
    );
    return index.filter((e) => words.every((w) => e.haystack.includes(w)));
  }, [q, book]);

  return (
    <div>
      {/* ── the first steps, in order ──────────────────────────────────── */}
      <section aria-label={book.start.title} className="border-y border-line bg-surface-100 px-5 py-7 sm:px-7">
        <p className="eyebrow">{book.start.title}</p>
        <p className="mt-1 text-[13.5px] text-ink-mute">{book.start.sub}</p>
        <ol className="mt-5 grid list-none gap-x-8 gap-y-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {book.start.steps.map((step, i) => (
            <li key={step.title} className="flex items-baseline gap-3.5">
              <span aria-hidden className="font-display text-[34px] font-semibold leading-none text-accent-bright">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-ink">{step.title}</span>
                <span className="mt-1 block text-[13.5px] leading-relaxed text-ink-soft">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── search ─────────────────────────────────────────────────────── */}
      <div className="relative mt-8">
        <Search
          size={17} strokeWidth={1.5} aria-hidden
          className="pointer-events-none absolute top-1/2 start-4 -translate-y-1/2 text-ink-mute"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={c.searchPh}
          aria-label={c.search}
          className="field w-full ps-11 pe-11"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={c.clear}
            className="absolute top-1/2 end-2 grid size-10 -translate-y-1/2 place-items-center rounded-xl2 text-ink-mute transition hover:bg-surface-200 hover:text-ink"
          >
            <X size={15} strokeWidth={1.5} aria-hidden />
          </button>
        )}
      </div>

      {hits ? (
        <div className="mt-6">
          <p className="text-[13px] text-ink-mute">
            {hits.length === 1 ? c.resultsOne : c.results.replace('{n}', String(hits.length))}
          </p>
          {hits.length === 0 ? (
            <p className="mt-6 max-w-prose text-[15px] text-ink-mute">{c.noResults}</p>
          ) : (
            <ul className="mt-4 list-none space-y-3 p-0">
              {hits.map((h) => (
                <li key={h.key} className="rounded-xl2 border border-line px-4 py-3.5">
                  <p className="text-[12px] text-accent">{h.chapterTitle}</p>
                  <Entry entry={h.entry} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-9 space-y-11">
          {book.chapters.map((chapter) => (
            <section key={chapter.id} id={chapter.id}>
              <header className="border-b-2 border-ink pb-3">
                <h3 className="inline-flex items-center gap-2 font-display text-[21px] font-semibold text-ink">
                  <CircleHelp size={18} aria-hidden strokeWidth={1.5} />
                  {chapter.title}
                </h3>
                <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-soft">{chapter.sub}</p>
              </header>
              <ul className="mt-6 list-none space-y-3 p-0">
                {chapter.entries.map((entry, i) => (
                  <li key={i} className="rounded-xl2 border border-line px-4 py-4 sm:px-5">
                    <Entry entry={entry} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Entry({ entry }: { entry: Book['chapters'][number]['entries'][number] }) {
  return (
    <div className="min-w-0">
      <p className="text-[15.5px] font-medium text-ink">{entry.q}</p>
      <ol className="mt-2.5 list-none space-y-1.5 p-0">
        {entry.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span aria-hidden className="mt-0.5 w-4 shrink-0 text-[12.5px] tabular-nums text-ink-mute" dir="ltr">
              {i + 1}
            </span>
            <span className="text-[14.5px] leading-relaxed text-ink-soft">{s}</span>
          </li>
        ))}
      </ol>
      {entry.note && (
        <p className="mt-2.5 border-s-2 border-accent-line ps-3 text-[13px] leading-relaxed text-ink-mute">
          {entry.note}
        </p>
      )}
    </div>
  );
}
