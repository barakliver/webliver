'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { game } from '@/content/game';
import { altOf, imageOf, type Card } from '@/content/cards';
import { progressOf } from '@/lib/game';
import { Ltr } from '@/components/Ltr';

type Side = 'a' | 'b';
type Screen = 'door' | 'rules' | 'play';

export type GameTableProps = {
  token: string;
  /** The two names when the file's display name splits, one name when it does
   *  not. Split on the server by `splitNames`, which the brand kit already
   *  owns — the doors are not the place for a second copy of that rule. */
  names: readonly string[];
  producer: string;
  /** Dealt on the server. The deal is deterministic from the token, so doing
   *  it here as well would only invite the two passes to disagree. */
  deck: readonly Card[];
};

/**
 * The table.
 *
 * Everything the couple sees after the link opens, and deliberately the whole
 * screen: no header, no menu, no way back into the platform except the one
 * word in the corner. He asked for that in as many words — "ברגע שהם נכנסים
 * למשחק הם רק במשחק" — and it is also the only way the card reads as a card
 * rather than as a picture inside a web page.
 *
 * Where they got to is kept in this browser and nowhere else. That is not
 * laziness about a table: the two of them are meant to be sitting in the same
 * room, and a position synced through a server would mean one partner's
 * "next" moving the other's card out from under them. Local is not the
 * compromise here, it is the design.
 */
export function GameTable({ token, names, producer, deck }: GameTableProps) {
  const [screen, setScreen] = useState<Screen>('door');
  const [side, setSide] = useState<Side | null>(null);
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState(false);

  const key = side ? `liver.game.${token}.${side}` : '';

  /* Read after mount rather than during render: the server has no storage, so
     seeding the state from it would render one number and then correct it.
     Wrapped, because a private window throws on the property access itself
     rather than returning null. */
  useEffect(() => {
    if (!key) return;
    try {
      const saved = Number(window.localStorage.getItem(key));
      if (Number.isFinite(saved) && saved > 0 && saved < deck.length) setAt(saved);
    } catch { /* no storage: start at the top, which is a fine game */ }
  }, [key, deck.length]);

  useEffect(() => {
    if (!key) return;
    try { window.localStorage.setItem(key, String(at)); } catch { /* as above */ }
  }, [key, at]);

  /* The card turns face down first and the next picture is swapped in behind
     it, a little before the rotation ends. Swapping during the turn shows the
     next card mid-rotation, which is the one thing that gives away that this
     is two pictures and not a card. The handle is kept so leaving the screen
     mid-turn cancels it rather than setting state into nothing. */
  const turning = useRef<number | null>(null);
  useEffect(() => () => { if (turning.current) window.clearTimeout(turning.current); }, []);

  const advance = useCallback(() => {
    setOpen(false);
    if (turning.current) window.clearTimeout(turning.current);
    turning.current = window.setTimeout(
      () => setAt((n) => Math.min(n + 1, deck.length)), 260,
    );
  }, [deck.length]);

  const enter = (which: Side) => { setSide(which); setScreen('play'); };

  if (screen === 'rules') {
    return <Rules onBack={() => setScreen(side ? 'play' : 'door')} />;
  }

  if (screen === 'door' || !side) {
    return (
      <Door
        names={names}
        producer={producer}
        onPick={enter}
        onRules={() => setScreen('rules')}
      />
    );
  }

  const finished = at >= deck.length;
  const card = finished ? null : deck[at];

  /* A definite height rather than a minimum, and this is the line the card's
     size hangs off: a percentage height inside a flex column only resolves
     when the column's own height is definite, so under `min-h` the card
     computed to nothing at all and the screen drew a blue dot. The table is
     one screen and never scrolls, so a fixed viewport height is also what it
     should have been. */
  return (
    <div className="relative flex h-[100svh] flex-col overflow-hidden bg-dark px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] text-surface">
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3 text-[11px] uppercase tracking-[.16em] text-surface/55">
        <button type="button" onClick={() => setScreen('door')} className="rounded-xl2 px-2 py-1 hover:text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light">
          {game.switchSide}
        </button>
        <span aria-hidden className="truncate">{producer}</span>
        <button type="button" onClick={() => setScreen('rules')} className="rounded-xl2 px-2 py-1 hover:text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light">
          {game.rulesLink}
        </button>
      </header>

      {finished ? (
        <Finished onRestart={() => { setAt(0); setOpen(false); }} />
      ) : (
        <>
          {/* min-h-0 is load-bearing: a flex child defaults to min-height
              auto, so without it this box refuses to shrink below the card's
              own height and the card pushes the button off a short phone.
              The card is then bounded by the box rather than by a width, so
              it is the screen that decides how big it is. */}
          <div className="flex min-h-0 flex-1 items-center justify-center py-4">
            <Flip card={card as Card} open={open} onOpen={() => setOpen(true)} producer={producer} />
          </div>

          <div className="mx-auto w-full max-w-md space-y-4">
            <div>
              <div className="h-px w-full bg-surface/15">
                <div
                  className="h-px bg-accent-light transition-all duration-500"
                  style={{ width: `${progressOf(at, deck.length)}%` }}
                />
              </div>
              <p className="mt-2 text-center text-[11px] tracking-[.14em] text-surface/45">
                <Ltr>{at + 1} / {deck.length}</Ltr>
              </p>
            </div>

            <button
              type="button"
              onClick={open ? advance : () => setOpen(true)}
              className="w-full rounded-xl2 bg-surface px-5 py-3.5 text-[15px] font-semibold text-dark transition hover:bg-surface/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
            >
              {open ? game.next : game.tapToOpen}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── the two doors ────────────────────────────────────────────────────────── */

function Door({ names, producer, onPick, onRules }: {
  names: readonly string[];
  producer: string;
  onPick: (side: Side) => void;
  onRules: () => void;
}) {
  /* A name that would not split gives the two neutral doors rather than half a
     name, which is the one outcome worse than no name at all. */
  const [a, b] = names.length === 2 ? names : [game.sideA, game.sideB];

  return (
    <div className="flex min-h-[100svh] flex-col justify-center bg-dark px-6 py-12 text-surface">
      <div className="mx-auto w-full max-w-md">
        <p className="text-[11px] uppercase tracking-[.22em] text-accent-light">{game.kicker}</p>
        <h1 className="mt-3 font-display text-3xl font-medium leading-tight">{game.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-surface/70">{game.intro}</p>

        <p className="mt-9 text-[13px] font-semibold tracking-wide text-surface/55">{game.who}</p>
        <div className="mt-3 grid gap-3">
          {([[a, 'a'], [b, 'b']] as const).map(([label, which]) => (
            <button
              key={which}
              type="button"
              onClick={() => onPick(which)}
              className="w-full rounded-xl2 border border-surface/20 bg-surface/5 px-5 py-4 text-start text-[17px] font-medium transition hover:border-accent-light hover:bg-surface/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onRules}
          className="mt-7 text-[13px] text-surface/60 underline underline-offset-4 hover:text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
        >
          {game.rulesLink}
        </button>

        <p className="mt-12 text-[11px] uppercase tracking-[.18em] text-surface/35">{producer}</p>
      </div>
    </div>
  );
}

/* ── how to play ──────────────────────────────────────────────────────────── */

function Rules({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-[100svh] bg-dark px-6 py-12 text-surface">
      <div className="mx-auto w-full max-w-md">
        <h1 className="font-display text-3xl font-medium">{game.rulesTitle}</h1>
        <div className="mt-8 space-y-7">
          {game.rules.map((r) => (
            <section key={r.h}>
              <h2 className="text-[15px] font-semibold text-accent-light">{r.h}</h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-surface/75">{r.p}</p>
            </section>
          ))}
        </div>
        <button
          type="button"
          onClick={onBack}
          className="mt-10 w-full rounded-xl2 bg-surface px-5 py-3.5 text-[15px] font-semibold text-dark transition hover:bg-surface/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
        >
          {game.rulesBack}
        </button>
      </div>
    </div>
  );
}

/* ── one card, face down then face up ─────────────────────────────────────── */

function Flip({ card, open, onOpen, producer }: {
  card: Card; open: boolean; onOpen: () => void; producer: string;
}) {
  return (
    <button
      type="button"
      onClick={open ? undefined : onOpen}
      aria-label={open ? altOf(card) : game.tapToOpen}
      /* The whole card is the target. A finger landing anywhere on it turns
         it, which is what a card does. */
      className={`flip max-h-full w-full max-w-[19rem] ${open ? 'is-open cursor-default' : 'cursor-pointer'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-light`}
      /* The ratio is the shape of a real card and is never given up. Width
         drives it, `max-h-full` clamps it against a short screen, and the
         browser re-derives the width from the clamped height so the card
         shrinks rather than stretching. */
      style={{ aspectRatio: '944 / 1417' }}
    >
      <span className="flip-inner block rounded-xl2">
        {/* Face down. Drawn rather than using his own Card Back file: he asked
            for that one to be left alone, and this is one line to swap if he
            would rather see the real thing here. */}
        <span className="flip-face rounded-xl2 bg-[#3B5FA4] p-3">
          {/* An inset hairline frame and a heart, which is what the front of
              every one of his cards is built from. Drawn rather than using his
              own Card Back file: he asked for that one to be left alone, and
              swapping it in here is a one-line change if he would rather. */}
          <span className="flex size-full flex-col items-center justify-center rounded-xl2 border border-white/30">
            <span aria-hidden className="text-[2.75rem] leading-none text-white/85">&#9825;</span>
            <span className="mt-4 text-[11px] text-white/55">{producer}</span>
          </span>
        </span>
        {/* Face up: his artwork, unchanged. */}
        <span className="flip-face is-back rounded-xl2 bg-white">
          <img
            src={imageOf(card)}
            alt={altOf(card)}
            width={944}
            height={1417}
            /* Plain img and not next/image on purpose: these are already the
               right size and already WebP, and asking the droplet to
               re-encode seventy-four of them on demand is work for nothing. */
            className="size-full object-contain"
            draggable={false}
          />
        </span>
      </span>
    </button>
  );
}

/* ── the end of the deck ──────────────────────────────────────────────────── */

function Finished({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
      <h2 className="font-display text-3xl font-medium">{game.done}</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-surface/70">{game.doneBody}</p>
      <button
        type="button"
        onClick={onRestart}
        className="mt-8 w-full rounded-xl2 bg-surface px-5 py-3.5 text-[15px] font-semibold text-dark transition hover:bg-surface/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
      >
        {game.restart}
      </button>
    </div>
  );
}
