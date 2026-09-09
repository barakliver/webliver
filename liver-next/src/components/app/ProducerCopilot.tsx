'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Check, Copy, MessageCircle, Sparkles } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { ChatDock } from '@/components/ChatDock';
import { cn } from '@/lib/utils';

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
 *
 * The panel itself is `ChatDock`. What stays here is the three things that
 * make this one the producer's: the event it is standing in, what the answer
 * was built from, and the fact that an answer here is a draft going somewhere.
 */
export function ProducerCopilot({ brandName }: { brandName: string }) {
  const c = useCopy().copilot;
  const pathname = usePathname();
  const [eventName, setEventName] = useState<string | null>(null);
  /* What the answer was built from. Shown rather than implied: an assistant
     that reads somebody's event and does not say what it read is asking to be
     trusted on the strength of sounding confident. */
  const [read, setRead] = useState<{ key: string; n: number }[] | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const clientId = pathname?.match(/^\/app\/clients\/([0-9a-f-]{36})/i)?.[1] ?? null;

  /* The assistant stays out of the way where the answer is already on the
     screen: the couple's book, and the producer's own knowledge shelf. One
     assistant per corner. */
  const hidden = pathname?.startsWith('/app/guide') || pathname?.startsWith('/app/knowledge');
  if (hidden) return null;

  const copy = async (i: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1400);
    } catch { /* selectable text; copying by hand still works */ }
  };

  return (
    <ChatDock
      copy={c}
      endpoint="/api/copilot"
      icon={Sparkles}
      footer={brandName}
      extraBody={{ clientId }}
      resetKey={clientId}
      multiline
      startersSend
      maxChars={2000}
      maxTurns={24}
      launcherClass="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] end-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full glass-strong text-accent shadow-dock transition hover:text-ink lg:bottom-6 lg:end-6"
      panelClass="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+9.5rem)] z-40 flex max-h-[62svh] flex-col overflow-hidden rounded-xl2 glass-strong shadow-pop sm:inset-x-auto sm:end-4 sm:w-[26rem] lg:bottom-[5.5rem] lg:end-6 lg:max-h-[70vh]"
      onEvent={(ev) => {
        if (typeof ev.event === 'string' || ev.event === null) {
          setEventName((ev.event as string | null) ?? null);
        }
        if (Array.isArray(ev.read)) setRead(ev.read as { key: string; n: number }[]);
      }}
      subtitle={
        <>
          <p className="mt-0.5 truncate text-[12.5px] text-ink-mute">
            {eventName ? `${c.context}: ${eventName}` : clientId ? c.sub : `${c.context}: ${c.noContext}`}
          </p>
          {/* Counts, never rows. Listing the guest list to prove it had read
              the guest list would be the leak it is meant to settle. */}
          {read && read.length > 0 && (
            <p className="mt-1 truncate text-[11.5px] text-ink-mute" title={c.read}>
              {c.read}:{' '}
              {read.map((r) => `${r.n} ${c.reads[r.key as keyof typeof c.reads] ?? r.key}`).join(' · ')}
            </p>
          )}
        </>
      }
      renderActions={(text, i) => (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <button
            type="button" onClick={() => void copy(i, text)}
            className={cn(
              'inline-flex min-h-[32px] items-center gap-1.5 rounded-xl2 px-2 text-[12px] transition',
              copied === i ? 'text-ok' : 'text-ink-mute hover:bg-surface-200 hover:text-ink',
            )}
          >
            {copied === i ? <Check size={13} strokeWidth={1.5} aria-hidden /> : <Copy size={13} strokeWidth={1.5} aria-hidden />}
            {copied === i ? c.copied : c.copy}
          </button>
          {/* Most drafts are going to WhatsApp anyway. One tap opens it with
              the text in the box and no recipient chosen, which is the right
              order: read, choose, send. */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-xl2 px-2 text-[12px] text-ink-mute transition hover:bg-surface-200 hover:text-ink"
          >
            <MessageCircle size={13} strokeWidth={1.5} aria-hidden />
            {c.whatsapp}
          </a>
        </div>
      )}
    />
  );
}
