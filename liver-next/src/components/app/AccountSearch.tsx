'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { fill } from '@/lib/copyText';
import { useCopy } from '@/components/app/CopyProvider';

/**
 * Finding one account among many.
 *
 * Fifteen today and it is already a scroll; the number only goes one way, and
 * the console's whole job is to act on one account at a time. Typing three
 * letters of a name or an address should be the whole of it.
 *
 * It reads the page rather than being handed a list, the same way the couple's
 * quick-jump does. Every row marks itself with `data-account` carrying its own
 * name and address, so the filter cannot drift out of step with what is on the
 * screen and a row added next year is searchable the day it is written. Two
 * lists that can disagree eventually do.
 *
 * Hidden with the `hidden` attribute rather than a class, so a row that is
 * filtered out is out of the accessibility tree as well as off the screen —
 * a screen reader reading twelve accounts nobody can see is the same bug as
 * showing them.
 */
export function AccountSearch({ scope }: {
  /** The id of the element holding the rows. */
  scope: string;
}) {
  const c = useCopy().admin;
  const [q, setQ] = useState('');
  const [shown, setShown] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const root = document.getElementById(scope);
    if (!root) return;
    const rows = [...root.querySelectorAll<HTMLElement>('[data-account]')];
    setTotal(rows.length);

    const needle = q.trim().toLowerCase();
    if (!needle) {
      for (const r of rows) r.hidden = false;
      setShown(null);
      return;
    }
    let hits = 0;
    for (const r of rows) {
      const hay = (r.dataset.account ?? '').toLowerCase();
      /* Every word has to appear, in any order: "ברק gmail" finds the row
         that "ברק gmail" as one string would not. */
      const on = needle.split(/\s+/).every((w) => hay.includes(w));
      r.hidden = !on;
      if (on) hits++;
    }
    setShown(hits);
  }, [q, scope]);

  return (
    <div className="mb-4">
      <div className="relative">
        <Search
          size={16} strokeWidth={1.5} aria-hidden
          className="pointer-events-none absolute top-1/2 start-4 -translate-y-1/2 text-ink-mute"
        />
        <input
          ref={box}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={c.search}
          aria-label={c.search}
          /* The browser draws its own clear cross inside a search input,
             which put two of them side by side — one the page's and one
             Chrome's, doing the same thing at different sizes. */
          className="field ps-11 pe-11 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(''); box.current?.focus(); }}
            aria-label={c.searchClear}
            className="absolute top-1/2 end-2 grid size-9 -translate-y-1/2 place-items-center rounded-xl2 text-ink-mute transition-colors hover:bg-surface-200 hover:text-ink"
          >
            <X size={16} strokeWidth={1.5} aria-hidden />
          </button>
        )}
      </div>
      {/* Only while something is typed, and it says the count both ways so
          "nothing found" is never mistaken for "nothing here". */}
      {shown !== null && (
        <p aria-live="polite" className="mt-2 text-[13px] text-ink-mute">
          {shown === 0 ? c.searchNone : fill(c.searchCount, { n: shown, total })}
        </p>
      )}
    </div>
  );
}
