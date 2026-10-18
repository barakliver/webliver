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
/* The four tones of the palette card, in its order, for whatever comes in a
   set: the first steps, and the chapters. Written out in full because
   Tailwind reads class names as text. `soft` is the on-colour at 90%. */
const TONES = [
  { box: 'bg-tone-camel text-tone-camel-on',       soft: 'text-tone-camel-on/90',    dot: 'bg-tone-camel' },
  { box: 'bg-tone-boho text-tone-boho-on',         soft: 'text-tone-boho-on/90',     dot: 'bg-tone-boho' },
  { box: 'bg-tone-rubine text-tone-rubine-on',     soft: 'text-tone-rubine-on/90',   dot: 'bg-tone-rubine' },
  { box: 'bg-tone-tamarind text-tone-tamarind-on', soft: 'text-tone-tamarind-on/90', dot: 'bg-tone-tamarind' },
] as const;

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
        <p className="mt-1 text-body text-ink-mute">{book.start.sub}</p>
        {/* Each step is a swatch with its number on it: the card the palette
            came from is blocks of colour with something written on each, and a
            row of numerals in one colour read as one instruction. */}
        <ol className="mt-5 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {book.start.steps.map((step, i) => {
            const t = TONES[i % TONES.length];
            return (
              <li key={step.title} className={`rounded-card p-5 ${t.box}`}>
                <span aria-hidden className="block font-display text-[34px] font-light leading-none">{i + 1}</span>
                <span className="mt-3 block text-lead font-medium">{step.title}</span>
                <span className={`mt-1 block text-body leading-relaxed ${t.soft}`}>{step.body}</span>
              </li>
            );
          })}
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
          <p className="text-body text-ink-mute">
            {hits.length === 1 ? c.resultsOne : c.results.replace('{n}', String(hits.length))}
          </p>
          {hits.length === 0 ? (
            <p className="mt-6 max-w-prose text-lead text-ink-mute">{c.noResults}</p>
          ) : (
            <ul className="mt-4 list-none space-y-3 p-0">
              {hits.map((h) => (
                <li key={h.key} className="rounded-xl2 border border-line px-4 py-3.5">
                  <p className="text-meta text-accent">{h.chapterTitle}</p>
                  <Entry entry={h.entry} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-9 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
          {/* The chapters, beside the page from a laptop up, each with its own
              colour: a book of twelve chapters is found by where you are in it,
              and a rail that only says the words is a list nobody scans. Plain
              anchors - the ids were already on the chapters. */}
          {book.chapters.length > 1 && (
            <nav aria-label={book.title} className="no-print sticky top-24 hidden self-start lg:block">
              <ul className="list-none space-y-0.5 p-0">
                {book.chapters.map((chapter, k) => (
                  <li key={chapter.id}>
                    <a
                      href={`#${chapter.id}`}
                      className="flex min-h-[36px] items-center gap-2.5 rounded-control px-3 text-body text-ink-soft transition hover:bg-surface-200 hover:text-ink"
                    >
                      <span aria-hidden className={`size-2 shrink-0 rounded-full ${TONES[k % TONES.length].dot}`} />
                      <span className="truncate">{chapter.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <div className="space-y-11">
            {book.chapters.map((chapter, k) => {
              const t = TONES[k % TONES.length];
              return (
                <section key={chapter.id} id={chapter.id} className="scroll-mt-28">
                  <header className="border-b border-line pb-3">
                    <h3 className="inline-flex items-center gap-3 head-section">
                      <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-[10px] ${t.box}`}>
                        <CircleHelp size={17} strokeWidth={1.6} />
                      </span>
                      {chapter.title}
                    </h3>
                    <p className="mt-1.5 max-w-2xl text-body leading-relaxed text-ink-soft">{chapter.sub}</p>
                  </header>
                  <ul className="mt-6 list-none space-y-3 p-0">
                    {chapter.entries.map((entry, i) => (
                      <li key={i} className="rounded-xl2 border border-line px-4 py-4 sm:px-5">
                        <Entry entry={entry} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Entry({ entry }: { entry: Book['chapters'][number]['entries'][number] }) {
  return (
    <div className="min-w-0">
      <p className="text-lead font-medium text-ink">{entry.q}</p>
      <ol className="mt-2.5 list-none space-y-1.5 p-0">
        {entry.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span aria-hidden className="mt-0.5 w-4 shrink-0 text-meta tabular-nums text-ink-mute" dir="ltr">
              {i + 1}
            </span>
            <span className="text-body leading-relaxed text-ink-soft">{s}</span>
          </li>
        ))}
      </ol>
      {entry.note && (
        <p className="mt-2.5 border-s-2 border-accent-line ps-3 text-body leading-relaxed text-ink-mute">
          {entry.note}
        </p>
      )}
    </div>
  );
}
