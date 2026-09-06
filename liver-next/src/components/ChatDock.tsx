'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Send, X, type LucideIcon } from 'lucide-react';
import { readNdjson, isNdjson } from '@/lib/ndjsonClient';
import { capTurns, withAnswer, type Turn } from '@/lib/chat';

/**
 * The one chat panel, worn three times.
 *
 * There were two of these, written months apart, and they had drifted the way
 * two copies of anything drift: one read its stream through the shared reader
 * and one had its own, one capped the history at twenty turns and one at
 * twenty-four, one had learned to keep the tail of a torn line and the other
 * never would. Nothing was broken today. Everything about that arrangement
 * meant the next fix would land in one of them.
 *
 * So the parts that are the same are here: the corner button, the panel, the
 * escape key, following the conversation down, the streaming, and every way it
 * can fail. What the three assistants genuinely do differently is a prop.
 *
 * Every failure is a sentence in the conversation rather than an error state.
 * A widget that turns into a broken red box on somebody's wedding page is
 * worse than one that says it cannot answer and points at a person.
 */

export type ChatCopy = {
  title: string;
  greeting: string;
  starters: readonly string[];
  placeholder: string;
  send: string;
  open: string;
  close: string;
  thinking: string;
  wentWrong: string;
  disclaimer: string;
};

export function ChatDock({
  copy: c,
  endpoint,
  icon: Icon,
  subtitle,
  footer,
  extraBody,
  onEvent,
  renderActions,
  resetKey = null,
  multiline = false,
  maxChars = 1000,
  maxTurns = 20,
  startersSend = false,
  launcherClass,
  panelClass,
}: {
  copy: ChatCopy;
  /** The route this one talks to. Each assistant has its own, and each route
   *  decides for itself who is allowed to reach it. */
  endpoint: string;
  icon: LucideIcon;
  /** Under the title. The producer's says which event the answer is about,
   *  because a draft addressed to the wrong couple is worse than no draft. */
  subtitle?: ReactNode;
  /** After the disclaimer. The producer's carries the business name. */
  footer?: string;
  /** Sent with every message. The producer's names the open event. */
  extraBody?: Record<string, unknown>;
  /** Anything in the stream that is not a word of the answer. */
  onEvent?: (event: Record<string, unknown>) => void;
  /** Under a finished answer. The producer's offers to copy it and to open
   *  WhatsApp with it; the other two have nothing to put there. */
  renderActions?: (text: string, index: number) => ReactNode;
  /** Changing it starts a new conversation. A draft about the last couple has
   *  no business under this one's name. */
  resetKey?: string | null;
  multiline?: boolean;
  maxChars?: number;
  maxTurns?: number;
  /** Whether an opener asks the question or only writes it into the box. */
  startersSend?: boolean;
  launcherClass?: string;
  panelClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const lineRef = useRef<HTMLInputElement>(null);
  /* Whichever of the two was rendered. The caret goes back into it after every
     answer, because the next question is usually a follow-up. */
  const focusField = () => (multiline ? textRef.current : lineRef.current)?.focus();

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

  useEffect(() => { if (open) focusField(); }, [open]);

  useEffect(() => { setTurns([]); }, [resetKey]);

  const send = async (text0?: string) => {
    const text = (text0 ?? draft).trim();
    if (!text || busy) return;

    const next = capTurns([...turns, { role: 'user' as const, content: text }], maxTurns);
    setTurns(next);
    setDraft('');
    setBusy(true);

    const show = (content: string) => setTurns((prev) => withAnswer(prev, content));

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        /* Asking for the answer in pieces. Every route here still speaks plain
           JSON to anybody who does not ask, which is what the deploy checker
           and the fallback below rely on. */
        body: JSON.stringify({ ...extraBody, messages: next, stream: true }),
      });

      if (!isNdjson(res)) {
        /* Rate limited, no key, or a browser with no readable body. One
           object, one bubble. */
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        onEvent?.(data);
        show(typeof data.reply === 'string' && data.reply ? data.reply : c.wentWrong);
        return;
      }

      let answer = '';
      await readNdjson(res, (ev) => {
        onEvent?.(ev);
        if (typeof ev.delta === 'string' && ev.delta) { answer += ev.delta; show(answer); }
      });
      if (!answer) show(c.wentWrong);
    } catch {
      /* The network, rather than the service. Same answer either way, because
         the difference is not something the person typing can act on. */
      show(c.wentWrong);
    } finally {
      setBusy(false);
      focusField();
    }
  };

  return (
    <>
      {/* `end` rather than a side, so it mirrors with the page. In Hebrew the
          two are the same corner, which is why a hard-coded `left` read as
          correct for months; in English they are not. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? c.close : c.open}
        title={c.open}
        className={launcherClass ?? 'fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] end-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full glass-strong text-accent shadow-dock transition hover:text-ink sm:end-6'}
      >
        {open ? <X size={20} strokeWidth={1.5} aria-hidden /> : <Icon size={20} strokeWidth={1.5} aria-hidden />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={c.title}
          className={panelClass ?? 'fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+10.5rem)] z-40 flex max-h-[58svh] flex-col overflow-hidden rounded-xl2 glass-strong shadow-pop sm:inset-x-auto sm:end-6 sm:w-[24rem]'}
        >
          <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="inline-flex items-center gap-2 font-display text-[16.5px] font-semibold text-ink">
                <Icon size={15} strokeWidth={1.5} aria-hidden className="text-accent" />
                {c.title}
              </h2>
              {subtitle}
            </div>
            <button
              type="button" onClick={() => setOpen(false)} aria-label={c.close}
              className="rounded-xl2 p-1.5 text-ink-mute transition hover:bg-surface-200 hover:text-ink"
            >
              <X size={16} strokeWidth={1.5} aria-hidden />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {turns.length === 0 && (
              <div className="space-y-3">
                <p className="text-[14px] leading-relaxed text-ink-soft">{c.greeting}</p>
                {/* Openers rather than a blank box. Nobody's first thought is a
                    well-formed question, and three real ones show what this can
                    be asked about. */}
                <div className="flex flex-wrap gap-2">
                  {c.starters.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        if (startersSend) void send(s);
                        else { setDraft(s); focusField(); }
                      }}
                      className="rounded-xl2 border border-line px-3 py-1.5 text-start text-[12.5px] text-ink-soft transition hover:border-accent/40 hover:text-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((t, i) => (
              t.role === 'user' ? (
                <p key={i} className="ms-8 rounded-xl2 rounded-se-md bg-ink px-3.5 py-2.5 text-[14px] leading-relaxed text-surface">
                  {t.content}
                </p>
              ) : (
                <div key={i} className="me-2">
                  <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink">{t.content}</p>
                  {/* Only once it has stopped writing. Offering to copy half an
                      answer is offering to copy the wrong thing. */}
                  {renderActions && !(busy && i === turns.length - 1) && renderActions(t.content, i)}
                </div>
              )
            ))}

            {/* Only until the first words land. Once the answer is being
                written, the answer is the progress indicator, and leaving
                "רגע" under it says the opposite of what the screen shows. */}
            {busy && turns[turns.length - 1]?.role !== 'assistant' && (
              <p className="text-[13.5px] text-ink-mute" role="status">{c.thinking}</p>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void send(); }}
            className="flex items-end gap-2 border-t border-line px-3 py-3"
          >
            {/* Two elements rather than one rendered from a variable. A
                multi-line box is right where answers are drafted and sent on,
                and wrong on a page where Enter should ask the question. */}
            {multiline ? (
              <textarea
                ref={textRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
                }}
                rows={1}
                maxLength={maxChars}
                placeholder={c.placeholder}
                aria-label={c.placeholder}
                className="field max-h-32 min-h-[42px] flex-1 resize-none border-0 bg-transparent px-2 py-2.5 focus:ring-0"
              />
            ) : (
              <input
                ref={lineRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={maxChars}
                placeholder={c.placeholder}
                aria-label={c.placeholder}
                className="field min-h-[42px] flex-1 border-0 bg-transparent px-2 py-2 focus:ring-0"
              />
            )}
            <button
              type="submit"
              disabled={busy || draft.trim() === ''}
              aria-label={c.send}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-surface transition hover:bg-ink-soft disabled:opacity-40"
            >
              <Send size={16} strokeWidth={1.5} aria-hidden />
            </button>
          </form>

          <p className="px-5 pb-3 text-[11.5px] text-ink-mute">
            {c.disclaimer}{footer ? ` · ${footer}` : ''}
          </p>
        </div>
      )}
    </>
  );
}
