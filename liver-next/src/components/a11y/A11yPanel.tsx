'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Accessibility, Minus, Monitor, Moon, Plus, RotateCcw, Sun, X } from 'lucide-react';
import type { A11yCopy } from '@/content/ui';
import {
  CLASSES, DEFAULTS, MAX_FONT_STEP, STORAGE_KEY,
  clampStep, read, scaleOf, type A11ySettings,
} from '@/lib/a11y';
import { isPlatform } from '@/lib/theme';
import { useTheme } from '@/lib/useTheme';

/**
 * The accessibility menu, on every screen.
 *
 * Required here rather than nice to have: an Israeli site is expected to
 * carry one under ת"י 5568, and to say so in a statement somebody can reach.
 * The previous site had both and the rebuild shipped with neither.
 *
 * Two things are different from the old one, and both are on purpose. The
 * settings persist, because holding them in a plain object meant every
 * reload undid them. And the text size uses `zoom`, because the old
 * root-font-size approach moves nothing on a type scale made of pixels.
 */
/* The wording is a prop. This is a client component and the language lives in
   a cookie the layout has already read, so importing the copy here would ship
   both languages to every visitor and still render whichever one was compiled
   in. */
export function A11yPanel({ copy: c }: { copy: A11yCopy }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<A11ySettings>(DEFAULTS);
  /* Nothing is applied until the stored value has been read, so the first
     paint cannot flash the default palette at somebody who chose otherwise. */
  const [ready, setReady] = useState(false);

  /* Light or dark. Kept beside these rather than inside them because it is
     not an accessibility setting: somebody choosing a dark screen at two in
     the morning is expressing a preference, not working around a barrier,
     and the reset button below leaves it alone for that reason.

     This is the three-way form of the same control the header carries as a
     single switch. Neither of them holds the state — `useTheme` does, and
     both listen to it — so a press in the header moves the selection here
     while this panel is open, and the other way round. */
  const { theme, set: setTheme } = useTheme();
  /* The palette is the platform's, not the public site's, so the control is
     shown where it does something. A switch that is present and inert is a
     worse answer than an absent one: somebody presses it, nothing moves, and
     now they do not trust the rest of the menu either. */
  const onPlatform = isPlatform(usePathname() ?? '');

  useEffect(() => {
    try { setS(read(window.localStorage.getItem(STORAGE_KEY))); } catch { /* private window */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    for (const [key, cls] of Object.entries(CLASSES)) {
      root.classList.toggle(cls, s[key as keyof typeof CLASSES]);
    }
    root.style.setProperty('--a11y-zoom', String(scaleOf(s.font) / 100));
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* private window */ }
  }, [s, ready]);

  /* Escape closes, and focus goes back to the button that opened it. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const set = useCallback(<K extends keyof A11ySettings>(key: K, value: A11ySettings[K]) => {
    setS((prev) => ({ ...prev, [key]: value }));
  }, []);

  const scale = scaleOf(s.font);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={c.open}
        aria-expanded={open}
        title={c.open}
        /* Clear of the bottom edge, and clear of the rail.
           Below lg that is the phone's tab bar on an app screen and the
           contact dock on the site. At lg the rail is 15.5rem of fixed column
           on the start side, and sitting inside it put this circle directly
           on top of the notification bell: the badge was there, unreadable,
           under another control. Offset past the rail rather than reserving
           room inside it, so the button cannot land on whatever the rail's
           foot happens to hold. */
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] start-4 z-[60]
                   lg:bottom-[calc(env(safe-area-inset-bottom)+1.25rem)]
                   lg:start-[calc(15.5rem+1rem)]
                   grid h-12 w-12 place-items-center rounded-full border border-line-control
                   bg-surface-100 text-ink shadow-fab transition-colors
                   hover:border-accent hover:text-accent
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-accent"
      >
        <Accessibility size={22} strokeWidth={1.5} aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={c.title}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-scrim/40 p-0 sm:items-center sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="max-h-[86svh] w-full overflow-y-auto rounded-t-sheet border border-line-strong bg-card p-6 shadow-pop sm:max-w-[28rem] sm:rounded-sheet">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-display text-[22px] font-semibold text-ink">{c.title}</h2>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{c.sub}</p>
              </div>
              <button
                type="button" onClick={() => setOpen(false)} aria-label={c.close}
                className="-me-1 -mt-1 shrink-0 p-2 text-ink-mute transition-colors hover:text-ink"
              >
                <X size={20} strokeWidth={1.5} aria-hidden />
              </button>
            </div>

            <hr className="rule-gold my-5" />

            {/* First, because it is the one people came for. */}
            {onPlatform && (
            <div className="border-b border-line pb-4">
              <span id="a11y-theme" className="text-[14.5px] text-ink">{c.theme}</span>
              <div role="radiogroup" aria-labelledby="a11y-theme" className="mt-2.5 grid grid-cols-3 gap-2">
                <Pick on={theme === 'auto'} onClick={() => setTheme('auto')}
                  icon={<Monitor size={16} strokeWidth={1.5} aria-hidden />} label={c.themeAuto} />
                <Pick on={theme === 'light'} onClick={() => setTheme('light')}
                  icon={<Sun size={16} strokeWidth={1.5} aria-hidden />} label={c.themeLight} />
                <Pick on={theme === 'dark'} onClick={() => setTheme('dark')}
                  icon={<Moon size={16} strokeWidth={1.5} aria-hidden />} label={c.themeDark} />
              </div>
            </div>
            )}

            {/* Text size */}
            <div className="flex items-center justify-between gap-4 border-b border-line py-3">
              <span id="a11y-font" className="text-[14.5px] text-ink">{c.font}</span>
              <div className="flex items-center gap-2">
                <Step
                  label={c.smaller} icon={<Minus size={16} strokeWidth={1.5} aria-hidden />}
                  onClick={() => set('font', clampStep(s.font - 1))} disabled={s.font === 0}
                />
                <span aria-live="polite" className="min-w-[3.5rem] text-center font-display text-[16px] tabular-nums text-ink">
                  <span dir="ltr" style={{ unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}>{scale}%</span>
                </span>
                <Step
                  label={c.bigger} icon={<Plus size={16} strokeWidth={1.5} aria-hidden />}
                  onClick={() => set('font', clampStep(s.font + 1))} disabled={s.font === MAX_FONT_STEP}
                />
              </div>
            </div>

            <Switch label={c.contrast} on={s.contrast} onChange={(v) => set('contrast', v)} onWord={c.on} offWord={c.off} />
            <Switch label={c.links} on={s.links} onChange={(v) => set('links', v)} onWord={c.on} offWord={c.off} />
            <Switch label={c.readable} on={s.readable} onChange={(v) => set('readable', v)} onWord={c.on} offWord={c.off} />
            <Switch label={c.motion} on={s.motion} onChange={(v) => set('motion', v)} onWord={c.on} offWord={c.off} />
            <Switch label={c.cursor} on={s.cursor} onChange={(v) => set('cursor', v)} onWord={c.on} offWord={c.off} />

            <button
              type="button"
              onClick={() => setS({ ...DEFAULTS })}
              className="btn-ghost mt-5 w-full justify-center gap-2"
            >
              <RotateCcw size={15} strokeWidth={1.5} aria-hidden />
              {c.reset}
            </button>

            <hr className="rule-gold my-5" />

            <h3 className="text-[14.5px] font-medium text-ink">{c.statement}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">{c.statementBody}</p>
            <Link
              href="/accessibility"
              onClick={() => setOpen(false)}
              className="mt-3 inline-block text-[13.5px] text-accent underline underline-offset-4"
            >
              {c.statementMore}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

/** One of three, announced as a radio so a screen reader says "2 of 3" and
 *  says which is selected. The chosen one is not only the accent: it carries
 *  a filled ground and a heavier border, because a colour alone is not a
 *  state. */
function Pick({ on, onClick, icon, label }: {
  on: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      type="button" role="radio" aria-checked={on} onClick={onClick}
      className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-control border px-2 py-2 text-[12.5px] transition-colors ${
        on
          ? 'border-accent bg-accent-wash font-medium text-ink'
          : 'border-line-strong text-ink-soft hover:border-accent/50 hover:text-ink'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Step({ label, icon, onClick, disabled }: {
  label: string; icon: React.ReactNode; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={label}
      className="grid h-9 w-9 place-items-center border border-line-control text-ink
                 transition-colors hover:border-accent hover:text-accent
                 disabled:opacity-40 disabled:hover:border-line-control disabled:hover:text-ink"
    >
      {icon}
    </button>
  );
}

/** A real switch, so a screen reader announces it as one and says which way
 *  it is set. The word is in the label rather than only in the colour. */
function Switch({ label, on, onChange, onWord, offWord }: {
  label: string; on: boolean; onChange: (v: boolean) => void;
  onWord: string; offWord: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3">
      <span className="text-[14.5px] text-ink">{label}</span>
      {/* The knob is placed with `justify-*` rather than moved with a
          transform. Under `dir="rtl"` a translateX runs the other way, so the
          transform version put every switch's knob on the same side and all
          six read as if they were on. `start` and `end` follow the direction
          on their own, which is the whole point of them. */}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`inline-flex h-7 w-[3.25rem] shrink-0 items-center border p-0.5 transition-colors ${
          on ? 'justify-end border-accent bg-accent' : 'justify-start border-line-control bg-transparent'
        }`}
      >
        <span
          aria-hidden
          className={`h-5 w-5 transition-colors ${on ? 'bg-surface' : 'bg-ink-mute'}`}
        />
        <span className="sr-only">{on ? onWord : offWord}</span>
      </button>
    </div>
  );
}
