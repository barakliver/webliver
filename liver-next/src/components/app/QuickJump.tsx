'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, CornerDownLeft, HeartHandshake, Search, X } from 'lucide-react';
import { jumpCopy as c } from '@/content/site';
import type { NavItem } from './AppNav';
import { cn } from '@/lib/utils';

export type JumpEvent = { id: string; name: string; date: string | null };

type Hit =
  | { kind: 'screen'; label: string; href: string }
  | { kind: 'event'; label: string; href: string; date: string | null };

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' });

/** Words in any order, each a prefix of something in the name. "נועה אית"
 *  finds "נועה ואיתי"; so does "איתי נועה". */
const matches = (query: string, text: string) => {
  const hay = text.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
};

/**
 * Anywhere in two keystrokes.
 *
 * A producer with thirty events opens the same four of them all week, and
 * the route to each was: events, scroll, find, tap. This is the search box
 * every desk app has, opened with ⌘K or the button in the top bar, and it
 * lists the screens first and the events after, filtered as you type. Enter
 * goes; Escape closes; the arrows move. Nothing here writes anything.
 *
 * The events arrive from the layout, already scoped by row level security to
 * the producer's own. On a phone the same box opens from the header and takes
 * the whole screen, since a dropdown under a thumb is not a dropdown.
 */
export function QuickJump({ screens, events, compact }: {
  screens: NavItem[]; events: JumpEvent[]; compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim();
    const screenHits: Hit[] = screens
      .filter((s) => !q || matches(q, s.label))
      .map((s) => ({ kind: 'screen', label: s.label, href: s.href }));
    const eventHits: Hit[] = events
      .filter((e) => !q || matches(q, e.name))
      .slice(0, q ? 12 : 6)
      .map((e) => ({ kind: 'event', label: e.name, href: `/app/clients/${e.id}`, date: e.date }));
    /* With a query, events first: that is what people type for. Without one,
       the screens, which is what the menu is. */
    return q ? [...eventHits, ...screenHits] : [...screenHits, ...eventHits];
  }, [query, screens, events]);

  const go = useCallback((h: Hit | undefined) => {
    if (!h) return;
    setOpen(false);
    setQuery('');
    router.push(h.href);
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    const id = requestAnimationFrame(() => input.current?.focus());
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(id); document.body.style.overflow = overflow; };
  }, [open]);

  useEffect(() => { setIndex(0); }, [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, hits.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); go(hits[index]); }
  };

  return (
    <>
      {compact ? (
        <button
          type="button" onClick={() => setOpen(true)} aria-label={c.open} title={c.open}
          className="grid min-h-[40px] min-w-[40px] place-items-center rounded-xl2 text-ink-soft transition-colors hover:bg-surface-200 hover:text-ink"
        >
          <Search size={18} strokeWidth={1.5} aria-hidden />
        </button>
      ) : (
        /* Drawn as a field rather than a button, because that is what it is
           about to become. The shortcut sits inside it where the eye looks
           for one. */
        <button
          type="button" onClick={() => setOpen(true)} aria-label={c.open}
          className="me-2 inline-flex h-9 w-56 items-center gap-2 rounded-xl2 border border-line bg-card/70 px-3 text-[13px] text-ink-mute transition-colors hover:border-line-strong hover:text-ink"
        >
          <Search size={15} strokeWidth={1.5} aria-hidden />
          <span className="flex-1 text-start">{c.placeholder}</span>
          <kbd className="rounded-md border border-line px-1.5 py-0.5 font-sans text-[11px] tabular-nums text-ink-mute" dir="ltr">
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center sm:pt-[12vh]">
          <button
            type="button" aria-label={c.close} tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-ink/30 backdrop-blur-[2px]"
          />
          <div
            role="dialog" aria-modal="true" aria-label={c.title}
            className="relative flex h-full w-full flex-col overflow-hidden bg-card shadow-pop sm:h-auto sm:max-h-[70vh] sm:w-[34rem] sm:rounded-card-sm sm:border sm:border-line"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Search size={17} strokeWidth={1.5} aria-hidden className="shrink-0 text-ink-mute" />
              <input
                ref={input} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown}
                placeholder={c.placeholder} aria-label={c.title}
                role="combobox" aria-expanded aria-controls="jump-list" aria-activedescendant={hits[index] ? `jump-${index}` : undefined}
                autoComplete="off" spellCheck={false}
                className="min-h-[40px] flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-mute"
              />
              <button
                type="button" onClick={() => setOpen(false)} aria-label={c.close}
                className="grid size-9 place-items-center rounded-xl2 text-ink-mute transition hover:bg-surface-200 hover:text-ink"
              >
                <X size={17} strokeWidth={1.5} aria-hidden />
              </button>
            </div>

            <ul id="jump-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto py-2">
              {hits.length === 0 && (
                <li className="px-5 py-8 text-center text-[14px] text-ink-mute">{c.none}</li>
              )}
              {hits.map((h, i) => {
                const on = i === index;
                const first = i === 0 || hits[i - 1].kind !== h.kind;
                return (
                  <li key={`${h.kind}-${h.href}`} role="presentation">
                    {first && (
                      <p className="px-5 pb-1 pt-3 text-[11px] tracking-[.14em] text-ink-mute">
                        {h.kind === 'event' ? c.events : c.screens}
                      </p>
                    )}
                    <button
                      id={`jump-${i}`} role="option" aria-selected={on} type="button"
                      onMouseEnter={() => setIndex(i)} onClick={() => go(h)}
                      className={cn(
                        'flex min-h-[44px] w-full items-center gap-3 px-5 text-start text-[14.5px] transition-colors',
                        on ? 'bg-accent-wash text-ink' : 'text-ink-soft',
                      )}
                    >
                      {h.kind === 'event'
                        ? <HeartHandshake size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-accent" />
                        : <CalendarDays size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-ink-mute opacity-0" />}
                      <span className="min-w-0 flex-1 truncate">{h.label}</span>
                      {h.kind === 'event' && h.date && (
                        <span className="shrink-0 text-[12.5px] tabular-nums text-ink-mute">{dateFmt.format(new Date(h.date))}</span>
                      )}
                      {on && <CornerDownLeft size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-ink-mute" />}
                    </button>
                  </li>
                );
              })}
            </ul>

            <p className="hidden border-t border-line px-5 py-2 text-[11.5px] text-ink-mute sm:block">{c.hint}</p>
          </div>
        </div>
      )}
    </>
  );
}
