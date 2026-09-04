'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Check, Copy, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { copilotCopy as c } from '@/content/site';
import { readNdjson, isNdjson } from '@/lib/ndjsonClient';
import { cn } from '@/lib/utils';

type Turn = { role: 'user' | 'assistant'; content: string };
const MAX_TURNS = 24;

/**
 * The producer's assistant, floating over the console.
 *
 * Distinct from the concierge on the public site in every way that matters:
 * it speaks to the producer, it knows the event they have open, and what it
 * writes is meant to be copied out and sent. So every answer carries a copy
 * button, and the header says which event the answer is about, because a
 * draft to the wrong couple is worse than no draft.
 *
 * Which event is read off the address: /app/clients/<id> is the one open.
 * Anywhere else the assistant answers from the book and the playbook alone,
 * and says so.
 */
export function ProducerCopilot({ brandName }: { brandName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [eventName, setEventName] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const clientId = pathname?.match(/^\/app\/clients\/([0-9a-f-]{36})/i)?.[1] ?? null;

  /* The guide page carries the concierge in the same corner. One assistant
     per corner. */
  /* The assistant stays out of the way where the answer is already on the
     screen: the couple's book, and the producer's own knowledge shelf. */
  const hidden = pathname?.startsWith('/app/guide') || pathname?.startsWith('/app/knowledge');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy, open]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  /* A new event opened is a new conversation: a draft about the last couple
     has no business under this one's name. */
  useEffect(() => { setTurns([]); setEventName(null); }, [clientId]);

  const send = async (text0?: string) => {
    const text = (text0 ?? draft).trim();
    if (!text || busy) return;
    const next = [...turns, { role: 'user' as const, content: text }].slice(-MAX_TURNS);
    setTurns(next);
    setDraft('');
    setBusy(true);

    const show = (content: string) => {
      setTurns((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant') copy[copy.length - 1] = { role: 'assistant', content };
        else copy.push({ role: 'assistant', content });
        return copy;
      });
    };

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next, clientId, stream: true }),
      });

      if (!isNdjson(res)) {
        const data = (await res.json().catch(() => ({}))) as { reply?: string; event?: string | null };
        if (typeof data.event === 'string') setEventName(data.event);
        show(data.reply || c.wentWrong);
        return;
      }

      let answer = '';
      await readNdjson(res, (ev) => {
        if (typeof ev.event === 'string' || ev.event === null) setEventName((ev.event as string | null) ?? null);
        if (typeof ev.delta === 'string' && ev.delta) { answer += ev.delta; show(answer); }
      });
      if (!answer) show(c.wentWrong);
    } catch {
      show(c.wentWrong);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const copy = async (i: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1400);
    } catch { /* selectable text; copying by hand still works */ }
  };

  if (hidden) return null;

  return (
    <>
      {/* Above the phone's bottom bar and clear of the desk's corner. `end`
          rather than a side, so it mirrors with the page. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? c.close : c.open}
        title={c.open}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] end-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full glass-strong text-accent shadow-dock transition hover:text-ink lg:bottom-6 lg:end-6"
      >
        {open ? <X size={20} strokeWidth={1.5} aria-hidden /> : <Sparkles size={20} strokeWidth={1.5} aria-hidden />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={c.title}
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+9.5rem)] z-40 flex max-h-[62svh] flex-col overflow-hidden rounded-xl2 glass-strong shadow-pop sm:inset-x-auto sm:end-4 sm:w-[26rem] lg:bottom-[5.5rem] lg:end-6 lg:max-h-[70vh]"
        >
          <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="inline-flex items-center gap-2 font-display text-[16.5px] font-semibold text-ink">
                <Sparkles size={15} strokeWidth={1.5} aria-hidden className="text-accent" />
                {c.title}
              </h2>
              <p className="mt-0.5 truncate text-[12.5px] text-ink-mute">
                {eventName ? `${c.context}: ${eventName}` : clientId ? c.sub : `${c.context}: ${c.noContext}`}
              </p>
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
                <div className="flex flex-wrap gap-2">
                  {c.starters.map((s) => (
                    <button
                      key={s} type="button" onClick={() => void send(s)}
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
                <div key={i} className="group me-2">
                  <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink">{t.content}</p>
                  {!(busy && i === turns.length - 1) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <button
                        type="button" onClick={() => void copy(i, t.content)}
                        className={cn(
                          'inline-flex min-h-[32px] items-center gap-1.5 rounded-xl2 px-2 text-[12px] transition',
                          copied === i ? 'text-ok' : 'text-ink-mute hover:bg-surface-200 hover:text-ink',
                        )}
                      >
                        {copied === i ? <Check size={13} strokeWidth={1.5} aria-hidden /> : <Copy size={13} strokeWidth={1.5} aria-hidden />}
                        {copied === i ? c.copied : c.copy}
                      </button>
                      {/* Most drafts are going to WhatsApp anyway. One tap opens
                          it with the text in the box and no recipient chosen,
                          which is the right order: read, choose, send. */}
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(t.content)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex min-h-[32px] items-center gap-1.5 rounded-xl2 px-2 text-[12px] text-ink-mute transition hover:bg-surface-200 hover:text-ink"
                      >
                        <MessageCircle size={13} strokeWidth={1.5} aria-hidden />
                        {c.whatsapp}
                      </a>
                    </div>
                  )}
                </div>
              )
            ))}

            {busy && turns[turns.length - 1]?.role !== 'assistant' && (
              <p className="text-[13.5px] text-ink-mute" role="status">{c.thinking}</p>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void send(); }}
            className="flex items-end gap-2 border-t border-line px-3 py-3"
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              rows={1}
              maxLength={2000}
              placeholder={c.placeholder}
              aria-label={c.placeholder}
              className="field max-h-32 min-h-[42px] flex-1 resize-none border-0 bg-transparent px-2 py-2.5 focus:ring-0"
            />
            <button
              type="submit"
              disabled={busy || draft.trim() === ''}
              aria-label={c.send}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-surface transition hover:bg-ink-soft disabled:opacity-40"
            >
              <Send size={16} strokeWidth={1.5} aria-hidden />
            </button>
          </form>

          <p className="px-5 pb-3 text-[11.5px] text-ink-mute">{c.disclaimer} · {brandName}</p>
        </div>
      )}
    </>
  );
}
