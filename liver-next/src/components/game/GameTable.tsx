'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { NotebookPen, X } from 'lucide-react';
import { game } from '@/content/game';
import { altOf, imageOf, type Card } from '@/content/cards';
import { progressOf } from '@/lib/game';
import { loadGameNotes, saveGameNote } from '@/app/actions/game';
import { Ltr } from '@/components/Ltr';

type Side = 'a' | 'b';
type Screen = 'door' | 'rules' | 'play' | 'notebook';

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
  /* The notebook, by card. A Map rather than an array because every read of
     it is "what did I write on this one", and the only writer is the pad. */
  const [notes, setNotes] = useState<Map<number, string>>(new Map());
  const [padOpen, setPadOpen] = useState(false);

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

  /* Fetched once a side is chosen, and only that side's. Both of them are in
     the same room and can read each other's screens all they like; what this
     avoids is one partner's device quietly holding the other's answers. A
     notebook that will not load is not worth a red screen in the middle of a
     game, so a failure leaves it empty and the pad still writes. */
  useEffect(() => {
    if (!side) return;
    let live = true;
    void loadGameNotes(token, side).then((r) => {
      if (live && r.ok) setNotes(new Map(r.notes.map((n) => [n.card_id, n.body])));
    });
    return () => { live = false; };
  }, [token, side]);

  const enter = (which: Side) => { setSide(which); setScreen('play'); };

  if (screen === 'rules') {
    return <Rules onBack={() => setScreen(side ? 'play' : 'door')} />;
  }

  if (screen === 'notebook' && side) {
    return (
      <Notebook
        deck={deck}
        notes={notes}
        onBack={() => setScreen('play')}
        onGo={(i) => { setAt(i); setOpen(true); setScreen('play'); }}
      />
    );
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
  const hasNote = !!(card && (notes.get(card.id) ?? '').trim());

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
        {/* The producer's name was here and the notebook is worth more: the
            name is already on the back of every card and on the door. */}
        <button type="button" onClick={() => setScreen('notebook')} className="inline-flex items-center gap-1.5 rounded-xl2 px-2 py-1 hover:text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light">
          <NotebookPen size={13} strokeWidth={1.5} aria-hidden />
          {game.notebook}
          {notes.size > 0 && <Ltr className="text-accent-light">{notes.size}</Ltr>}
        </button>
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

            <div className="flex gap-2">
              <button
                type="button"
                onClick={open ? advance : () => setOpen(true)}
                className="flex-1 rounded-xl2 bg-surface px-5 py-3.5 text-[15px] font-semibold text-dark transition hover:bg-surface/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
              >
                {open ? game.next : game.tapToOpen}
              </button>
              {/* Beside the next button rather than on the card: the card is
                  one target that turns over, and a second target on top of it
                  is a card that sometimes does not turn. */}
              <button
                type="button"
                onClick={() => { setOpen(true); setPadOpen(true); }}
                aria-label={hasNote ? game.noteEdit : game.noteAdd}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl2 border px-4 py-3.5 text-[14px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light ${hasNote ? 'border-accent-light bg-accent-light/15 text-accent-light' : 'border-surface/25 text-surface/75 hover:border-surface/50'}`}
              >
                <NotebookPen size={15} strokeWidth={1.5} aria-hidden />
                {game.noteAdd}
              </button>
            </div>
          </div>
        </>
      )}

      {padOpen && card && (
        <NotePad
          card={card}
          value={notes.get(card.id) ?? ''}
          onClose={() => setPadOpen(false)}
          onSave={async (body) => {
            const r = await saveGameNote(token, side, card.id, body);
            if (!r.ok) return false;
            setNotes((prev) => {
              const next = new Map(prev);
              if (body.trim()) next.set(card.id, body.trim());
              else next.delete(card.id);
              return next;
            });
            return true;
          }}
        />
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

/* ── the pad, over the card ───────────────────────────────────────────────── */

/**
 * One note, on one card.
 *
 * A sheet over the table rather than a screen of its own, because the thing
 * being written about has to stay visible behind it — the note is "what we
 * said about *this*", and a pad that hides the card is a pad you fill in from
 * memory. The card's own words are repeated at the top for the same reason,
 * and because on a short phone the sheet covers most of the picture anyway.
 *
 * Saves on a press and not on every keystroke. A note is a sentence somebody
 * is in the middle of writing; sending each letter to a server would fill the
 * log with drafts and still lose the last word if the connection went.
 */
function NotePad({ card, value, onClose, onSave }: {
  card: Card;
  value: string;
  onClose: () => void;
  onSave: (body: string) => Promise<boolean>;
}) {
  const [text, setText] = useState(value);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const panel = useRef<HTMLDivElement>(null);
  /* The caller passes a fresh arrow every render, so naming `onClose` in the
     dependency list below re-runs the whole effect on every keystroke — which
     tears down and rebuilds the listener, and, far worse, runs the cleanup's
     `opener.focus()` and pulls the caret straight back out of the textarea.
     The pad was unusable after one character. Held in a ref so the effect runs
     once and still calls the current one. */
  const close = useRef(onClose);
  close.current = onClose;

  /* The four things `components/app/Sheet.tsx` gets right, written again here
     rather than imported. Not an oversight: that component reads its close
     label from `useCopy()`, which means a CopyProvider, which means shipping
     the whole app's copy to a route whose entire design is that it is not the
     app. Twenty lines of behaviour is the cheaper of the two.
       Escape closes it, because a modal with no keyboard exit is a trap.
       Focus moves in on open and back to the opener on close.
       The page behind stops scrolling.
       The backdrop closes it and the panel does not. */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current(); }
    };
    window.addEventListener('keydown', onKey);
    const id = requestAnimationFrame(() => panel.current?.querySelector('textarea')?.focus());
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
    /* Once, on open. Everything it needs that can change is read through a
       ref, so there is nothing here that should re-run it. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () => {
    setFailed(false);
    start(async () => {
      const ok = await onSave(text);
      if (!ok) { setFailed(true); return; }
      setSaved(true);
      window.setTimeout(onClose, 550);
    });
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-scrim/70 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-10">
      {/* The ground behind it closes it, the way a sheet does everywhere else
          in this product. */}
      <button
        type="button" aria-label={game.noteClose} onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={game.noteEdit}
        className="relative mx-auto w-full max-w-md rounded-xl2 bg-surface p-5 text-ink shadow-pop"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] leading-snug text-ink-soft">{altOf(card)}</p>
          <button
            type="button" onClick={onClose} aria-label={game.noteClose}
            className="-me-1 -mt-1 shrink-0 rounded-xl2 p-1.5 text-ink-mute hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        <label className="label mt-4 block" htmlFor="game-note">{game.noteEdit}</label>
        <textarea
          id="game-note" rows={4} maxLength={600}
          value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }}
          placeholder={game.notePlaceholder}
          className="field resize-y"
        />

        {failed && (
          <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
            {game.noteTrouble}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={pending} className="btn-primary">
            {pending ? game.noteSaving : game.noteSave}
          </button>
          {value && (
            /* Clearing the box is how somebody says "never mind", and the
               database turns an empty body into a delete, so this is the same
               path as a save rather than a second one. */
            <button
              type="button" disabled={pending}
              onClick={() => { setText(''); start(async () => { await onSave(''); onClose(); }); }}
              className="btn-ghost"
            >
              {game.noteClear}
            </button>
          )}
          {saved && <span className="text-[13.5px] text-ok">{game.noteSaved}</span>}
        </div>
      </div>
    </div>
  );
}

/* ── everything written so far ────────────────────────────────────────────── */

/**
 * The notebook.
 *
 * In the order the cards are dealt rather than the order they were written,
 * so it reads as a pass through the deck and a card's note sits where the card
 * does. Each entry names the card it belongs to and opens it: a note that says
 * "the garden" is worth nothing six weeks later without the question above it.
 */
function Notebook({ deck, notes, onBack, onGo }: {
  deck: readonly Card[];
  notes: Map<number, string>;
  onBack: () => void;
  onGo: (index: number) => void;
}) {
  const written = deck
    .map((card, index) => ({ card, index, body: (notes.get(card.id) ?? '').trim() }))
    .filter((r) => r.body);

  return (
    <div className="min-h-[100svh] bg-dark px-6 py-12 text-surface">
      <div className="mx-auto w-full max-w-md">
        <h1 className="font-display text-3xl font-medium">{game.notebook}</h1>
        <p className="mt-2 text-[13px] text-surface/55">{game.notebookMine}</p>

        {written.length === 0 ? (
          <div className="mt-10">
            <p className="text-[17px] font-medium">{game.notebookEmpty}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-surface/70">{game.notebookEmptyBody}</p>
          </div>
        ) : (
          <ul className="mt-8 space-y-6">
            {written.map(({ card, index, body }) => (
              <li key={card.id} className="border-t border-surface/15 pt-5">
                <p className="text-[13px] leading-snug text-accent-light">{altOf(card)}</p>
                {/* Their own words, kept exactly as typed, line breaks and
                    all. `whitespace-pre-line` rather than a paragraph per
                    line: somebody writing three things under each other means
                    three things under each other. */}
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{body}</p>
                <button
                  type="button" onClick={() => onGo(index)}
                  className="mt-2 text-[13px] text-surface/60 underline underline-offset-4 hover:text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
                >
                  {game.goToCard} <Ltr>{index + 1}</Ltr>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button" onClick={onBack}
          className="mt-10 w-full rounded-xl2 bg-surface px-5 py-3.5 text-[15px] font-semibold text-dark transition hover:bg-surface/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
        >
          {game.notebookBack}
        </button>
      </div>
    </div>
  );
}
