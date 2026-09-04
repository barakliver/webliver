'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, CornerDownLeft, HeartHandshake, History, Layers, Search, X } from 'lucide-react';
import { appCopy, jumpCopy as c } from '@/content/site';
import { byRelevance as rank, matchesWords, splitQuery, type JumpEvent } from '@/lib/jump';
import { EVENT_TABS } from './EventTabs';
import type { NavItem } from './AppNav';
import { cn } from '@/lib/utils';

export type { JumpEvent };

type Hit = {
  kind: 'recent' | 'section' | 'event' | 'screen';
  label: string;
  href: string;
  /** The date on an event, the section name on a section. */
  note?: string;
  /** Present on anything that opens an event, so the recents can learn. */
  id?: string;
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' });
const tabLabel = appCopy.clientPage.tabs;
const SECTIONS = EVENT_TABS.map((tab) => ({ tab, label: tabLabel[tab] }));

/* The four events somebody opens all week, remembered in this browser only.
   Not a column on the account: which events a producer had open on their
   laptop this morning is not a fact worth storing about them, and a list that
   syncs between devices would be wrong on both. A private window forgets, and
   the palette works exactly the same without it. */
const RECENT_KEY = 'liver.jump.recent';
const RECENT_MAX = 6;

const readRecent = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string').slice(0, RECENT_MAX)
      : [];
  } catch { return []; }
};

const noteRecent = (id: string) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((v) => v !== id)].slice(0, RECENT_MAX)));
  } catch { /* storage refused: the palette forgets, nothing else changes. */ }
};

/**
 * Anywhere in two keystrokes.
 *
 * A producer with thirty events opens the same four of them all week, and the
 * route to each was: events, scroll, find, tap. This is the search box every
 * desk app has, opened with ⌘K or the button in the top bar. Enter goes;
 * Escape closes; the arrows move. Nothing here writes anything to the event.
 *
 * Three things decide what it offers, in this order.
 *
 * The empty box shows the events that were opened recently, then the menu,
 * then what is coming up. It used to show the first six rows the layout sent,
 * which arrive oldest first — so the palette opened on last spring's weddings,
 * which is the one set of events nobody is looking for.
 *
 * A query is read as a name and, if one of the words is the name of a section,
 * a section: "נועה כסף" opens that event's money tab rather than its cover.
 * Thirteen sections across thirty events is four hundred rows, which is why
 * the section has to be asked for rather than listed. Inside an open event a
 * bare section word means that event, since that is the only one it could mean.
 *
 * A word is read as a section only when it names no event, so a couple whose
 * name happens to be a section keeps their name.
 */
export function QuickJump({ screens, events, compact }: {
  screens: NavItem[]; events: JumpEvent[]; compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  /** The event on screen, if the producer is standing in one. */
  const openId = useMemo(() => /^\/app\/clients\/([0-9a-f-]{36})/i.exec(pathname ?? '')?.[1] ?? null, [pathname]);

  const byRelevance = useMemo(() => rank(events), [events]);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const hits = useMemo<Hit[]>(() => {
    const { words, nameWords, section } = splitQuery(query, events, SECTIONS);

    const asEvent = (e: JumpEvent, kind: 'event' | 'recent'): Hit => ({
      kind, id: e.id, label: e.name, href: `/app/clients/${e.id}`,
      note: e.date ? dateFmt.format(new Date(e.date)) : undefined,
    });

    if (words.length === 0) {
      const recent = recentIds.map((id) => byId.get(id)).filter((e): e is JumpEvent => Boolean(e));
      const seen = new Set(recent.map((e) => e.id));
      return [
        ...recent.map((e) => asEvent(e, 'recent')),
        ...screens.map<Hit>((s) => ({ kind: 'screen', label: s.label, href: s.href })),
        ...byRelevance.filter((e) => !seen.has(e.id)).slice(0, 6).map((e) => asEvent(e, 'event')),
      ];
    }

    const named = nameWords.length > 0 ? byRelevance.filter((e) => matchesWords(nameWords, e.name)) : [];

    const sectionHits: Hit[] = [];
    if (section) {
      /* With a name, the events it found. Without one, the event on screen if
         there is one, otherwise the events already at hand — so a bare "כסף"
         is still a shortcut and not a dead end. */
      const here = openId ? byId.get(openId) : undefined;
      const targets = nameWords.length > 0
        ? named
        : here ? [here] : [...recentIds.map((id) => byId.get(id)).filter((e): e is JumpEvent => Boolean(e)), ...byRelevance].slice(0, 5);
      const seen = new Set<string>();
      for (const e of targets.slice(0, 8)) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        sectionHits.push({
          kind: 'section', id: e.id, label: e.name, note: tabLabel[section],
          href: `/app/clients/${e.id}?tab=${section}`,
        });
      }
    }

    const eventHits = named.slice(0, section ? 4 : 12).map((e) => asEvent(e, 'event'));
    const screenHits = screens
      .filter((s) => matchesWords(words, s.label))
      .map<Hit>((s) => ({ kind: 'screen', label: s.label, href: s.href }));

    /* What was typed for comes first. */
    return [...sectionHits, ...eventHits, ...screenHits];
  }, [query, screens, events, byRelevance, byId, recentIds, openId]);

  const go = useCallback((h: Hit | undefined) => {
    if (!h) return;
    if (h.id) noteRecent(h.id);
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
    /* Read on open rather than on mount: another tab may have moved on. */
    setRecentIds(readRecent());
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

  const heading: Record<Hit['kind'], string> = {
    recent: c.recent, section: c.sections, event: c.events, screen: c.screens,
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
          <span className="flex-1 truncate text-start">{c.placeholder}</span>
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
                      /* The section is named once, on the group, rather than
                         on every row: there is only ever one of them, so a
                         chip per line is the same word four times. */
                      <p className="flex items-center gap-2 px-5 pb-1 pt-3 text-[11px] tracking-[.14em] text-ink-mute">
                        <span>{heading[h.kind]}</span>
                        {h.kind === 'section' && h.note && (
                          <span className="rounded-lg bg-surface-200 px-2 py-0.5 text-[11.5px] tracking-normal text-ink-soft">{h.note}</span>
                        )}
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
                      {h.kind === 'recent' && <History size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-ink-mute" />}
                      {h.kind === 'section' && <Layers size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-accent" />}
                      {h.kind === 'event' && <HeartHandshake size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-accent" />}
                      {h.kind === 'screen' && <CalendarDays size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-ink-mute opacity-0" />}

                      <span className="min-w-0 flex-1 truncate">{h.label}</span>

                      {h.note && h.kind !== 'section' && (
                        <span className="shrink-0 text-[12.5px] tabular-nums text-ink-mute">{h.note}</span>
                      )}
                      {on && <CornerDownLeft size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-ink-mute" />}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="hidden border-t border-line px-5 py-2 text-[11.5px] text-ink-mute sm:block">
              <p>{c.hint}</p>
              <p className="mt-0.5">{c.hintTwo}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
