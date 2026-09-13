'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { List, X } from 'lucide-react';
import { unfold } from '@/lib/reveal';

export type JumpCopy = {
  /** On the pill, before anything has scrolled into view. */
  open: string;
  title: string;
  sub: string;
  close: string;
  groups: Record<string, string>;
};

type Section = { id: string; label: string; group: string };

/**
 * Where am I, and how do I get to the other thing.
 *
 * The couple's screen is long by design: everything about their wedding is
 * on it, and the instruction was to take nothing away. What made it feel
 * heavy was not the length, it was that finding anything meant either
 * scrolling past all of it or reading a strip of seventeen chips at the very
 * top — which is off the screen the moment you start, so in practice it was
 * scroll past all of it.
 *
 * So the way around lives at the bottom, in the thumb's own corner, and it
 * travels with them. The pill says which section they are in. One tap opens
 * the list, grouped, with that section marked.
 *
 * It reads the page rather than taking a list as a prop. Every panel marks
 * itself with `data-jump`, so a module the producer has closed is not in the
 * document and therefore not in this list, and a panel added next year
 * appears here the day it is written without anybody remembering a second
 * list to update. Two lists that can disagree eventually do.
 *
 * A section inside a folded group is unfolded before the scroll rather than
 * after: a jump that lands on a closed summary looks like a jump that
 * missed.
 */
export function PortalJump({ c }: { c: JumpCopy }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const found = [...document.querySelectorAll<HTMLElement>('[data-jump]')].map((el) => ({
      id: el.id,
      label: el.dataset.jump ?? '',
      group: el.dataset.jumpGroup ?? 'event',
    })).filter((s) => s.id && s.label);
    setSections(found);
    if (found.length === 0) return;

    /* Whichever marked section is nearest the top of the viewport wins, so
       the pill names the thing being read rather than the last one to cross
       an arbitrary line. */
    const seen = new Map<string, number>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) seen.set(e.target.id, e.boundingClientRect.top);
        else seen.delete(e.target.id);
      }
      let best: string | null = null;
      let bestTop = Infinity;
      for (const [id, top] of seen) {
        const d = Math.abs(top);
        if (d < bestTop) { bestTop = d; best = id; }
      }
      setCurrent(best);
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });

    for (const s of found) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); opener.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const go = useCallback((id: string) => {
    const el = document.getElementById(id);
    setOpen(false);
    if (!el) return;
    /* Unfold whatever it is inside first. Scrolling to a heading that is
       still closed reads as the link being broken. */
    unfold(el);
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      /* Focus follows the jump, or a keyboard user is left where they were
         while the page moves without them. */
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    });
  }, []);

  if (sections.length < 2) return null;

  const label = sections.find((s) => s.id === current)?.label ?? c.open;
  const order = [...new Set(sections.map((s) => s.group))];

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="pointer-events-auto flex min-h-[48px] max-w-[58vw] items-center gap-2 rounded-full
                   border border-line-strong bg-card px-4 text-[14px] font-medium text-ink shadow-fab
                   transition-colors hover:border-accent"
      >
        <List size={17} strokeWidth={1.5} aria-hidden className="shrink-0 text-accent" />
        <span className="truncate">{label}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={c.title}
          className="fixed inset-0 z-[75] flex items-end justify-center bg-scrim/40 sm:items-center sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="max-h-[80svh] w-full overflow-y-auto rounded-t-sheet border border-line-strong bg-card p-6 shadow-pop sm:max-w-[26rem] sm:rounded-sheet">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-[20px] font-semibold text-ink">{c.title}</h2>
                <p className="mt-1 text-[13.5px] text-ink-soft">{c.sub}</p>
              </div>
              <button
                type="button" onClick={() => { setOpen(false); opener.current?.focus(); }}
                aria-label={c.close}
                className="-me-1 -mt-1 shrink-0 p-2 text-ink-mute transition-colors hover:text-ink"
              >
                <X size={20} strokeWidth={1.5} aria-hidden />
              </button>
            </div>

            {order.map((g) => (
              <div key={g} className="mt-5">
                <p className="text-[12px] tracking-[.12em] text-ink-mute">{c.groups[g] ?? c.groups.event}</p>
                <ul className="mt-1.5 list-none p-0">
                  {sections.filter((s) => s.group === g).map((s) => {
                    const on = s.id === current;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => go(s.id)}
                          aria-current={on ? 'true' : undefined}
                          className={`flex min-h-[48px] w-full items-center justify-between gap-3 border-b border-line px-1 text-start text-[15px] transition-colors ${
                            on ? 'font-semibold text-accent' : 'text-ink hover:text-accent'
                          }`}
                        >
                          {s.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
