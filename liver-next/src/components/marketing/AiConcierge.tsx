'use client';

import { useEffect, useRef, useState } from 'react';
import { MessagesSquare, Send, X } from 'lucide-react';
import { conciergeCopy as c } from '@/content/site';

type Turn = { role: 'user' | 'assistant'; content: string };

/* The history the server will accept, matched here so the browser never sends
   more than the route will read. */
const MAX_TURNS = 20;

/**
 * A concierge, not a chatbot.
 *
 * It opens closed and stays closed until somebody asks it something, because a
 * panel that springs open on a wedding photographer's homepage is an
 * interruption dressed as help. The opening line names what it can actually
 * answer rather than saying hello, so the first question is a real one.
 *
 * Every failure it can have is a sentence pointing at a human. No key
 * configured, rate limited, the API down: all three come back as a reply from
 * the concierge rather than as an error state, so the widget is never a broken
 * thing on a page whose whole job is to look like somebody is in charge.
 */
export function AiConcierge() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* Follow the conversation down, and put the caret where the next thing is
     typed. Both only once the panel is actually open. */
  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy, open]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;

    const next = [...turns, { role: 'user' as const, content: text }].slice(-MAX_TURNS);
    setTurns(next);
    setDraft('');
    setBusy(true);

    try {
      const res = await fetch('/api/ai-concierge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json()) as { reply?: string };
      setTurns((prev) => [...prev, { role: 'assistant', content: data.reply || c.wentWrong }]);
    } catch {
      /* The network, rather than the service. Same answer either way, because
         the difference is not something the person typing can act on. */
      setTurns((prev) => [...prev, { role: 'assistant', content: c.wentWrong }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <>
      {/* Above the dock rather than beside it: the dock owns the bottom edge,
          and two things competing for one corner is how a floating button ends
          up on top of a phone's home indicator. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? c.close : c.open}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] left-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full glass-strong text-accent shadow-dock transition hover:text-ink sm:left-6"
      >
        {open ? <X size={20} strokeWidth={2} aria-hidden /> : <MessagesSquare size={20} strokeWidth={1.75} aria-hidden />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={c.title}
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+10.5rem)] z-40 flex max-h-[58svh] flex-col overflow-hidden rounded-4xl glass-strong shadow-lift sm:inset-x-auto sm:left-6 sm:w-[24rem]"
        >
          <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-display text-[16.5px] font-semibold text-ink">{c.title}</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-mute">{c.sub}</p>
            </div>
            <button
              type="button" onClick={() => setOpen(false)} aria-label={c.close}
              className="rounded-full p-1.5 text-ink-mute transition hover:bg-surface-200 hover:text-ink"
            >
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {turns.length === 0 && (
              <div className="space-y-3">
                <p className="text-[14px] leading-relaxed text-ink-soft">{c.greeting}</p>
                {/* Openers rather than a blank box. Nobody's first thought is a
                    well-formed question, and three real ones show what this
                    can be asked about. */}
                <div className="flex flex-wrap gap-2">
                  {c.starters.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setDraft(s); inputRef.current?.focus(); }}
                      className="rounded-full border border-line px-3 py-1.5 text-[12.5px] text-ink-soft transition hover:border-accent/40 hover:text-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((t, i) => (
              <p
                key={i}
                className={
                  t.role === 'user'
                    ? 'ms-8 rounded-2xl rounded-se-md bg-ink px-3.5 py-2.5 text-[14px] leading-relaxed text-surface'
                    : 'me-4 whitespace-pre-line text-[14px] leading-relaxed text-ink'
                }
              >
                {t.content}
              </p>
            ))}

            {busy && (
              <p className="text-[13.5px] text-ink-mute" role="status">{c.thinking}</p>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void send(); }}
            className="flex items-center gap-2 border-t border-line px-3 py-3"
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={1000}
              placeholder={c.placeholder}
              aria-label={c.placeholder}
              className="field min-h-[42px] flex-1 border-0 bg-transparent px-2 py-2 focus:ring-0"
            />
            <button
              type="submit"
              disabled={busy || draft.trim() === ''}
              aria-label={c.send}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-surface transition hover:bg-ink-soft disabled:opacity-40"
            >
              <Send size={16} strokeWidth={2} aria-hidden />
            </button>
          </form>

          <p className="px-5 pb-3 text-[11.5px] text-ink-mute">{c.disclaimer}</p>
        </div>
      )}
    </>
  );
}
