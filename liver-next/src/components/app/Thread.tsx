'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Send, MessagesSquare } from 'lucide-react';
import { sendMessage, deleteMessage, markThreadRead, type MessageResult } from '@/app/actions/messages';
import { Avatar } from '@/components/app/Avatar';
import { threadCopy } from '@/content/site';

export type Message = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
};

const c = threadCopy;

const timeFmt = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long' });

/** "Today" and "yesterday" are what people actually say, and a date is only
 *  useful once it is far enough away to have stopped being either. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
     Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000
  );
  if (days === 0) return c.today;
  if (days === 1) return c.yesterday;
  return dayFmt.format(d);
}

function Send_({ }: Record<string, never>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
      <Send size={16} aria-hidden strokeWidth={1.5} />
      {pending ? c.sending : c.send}
    </button>
  );
}

export function Thread({ clientId, messages, viewerId }: {
  clientId: string; messages: Message[]; viewerId: string;
}) {
  const [state, action] = useActionState<MessageResult | null, FormData>(sendMessage, null);
  const formRef = useRef<HTMLFormElement>(null);

  /* Clear the box only once the message is actually saved. Clearing on submit
     looks quicker and loses what somebody wrote the one time it fails. */
  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);

  /* Read means the thread rendered, not that the page was opened. The count
     of messages is the dependency so arriving replies re-mark it while the
     screen is still open. */
  useEffect(() => { void markThreadRead(clientId); }, [clientId, messages.length]);

  let lastDay = '';

  return (
    <section className="card">
      <h2 className="flex items-center gap-2 font-display text-[18px] font-light text-ink">
        <MessagesSquare size={18} aria-hidden strokeWidth={1.5} />
        {c.title}
      </h2>
      <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>

      {messages.length === 0 ? (
        <p className="mt-5 rounded-xl2 bg-surface-100 px-4 py-3 text-[14.5px] text-ink-mute">{c.empty}</p>
      ) : (
        <ol className="mt-5 space-y-3">
          {messages.map((m) => {
            const mine = m.author_id === viewerId;
            const day = dayLabel(m.created_at);
            const newDay = day !== lastDay;
            lastDay = day;

            return (
              <li key={m.id}>
                {newDay && (
                  <p className="mb-3 mt-5 text-center text-[12.5px] text-ink-mute first:mt-0">{day}</p>
                )}
                <div className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
                  <Avatar name={m.author_name} src={m.author_avatar} size={32} />
                  <div className={`min-w-0 max-w-[80%] ${mine ? 'text-left' : ''}`}>
                    <div
                      className={`rounded-xl2 px-3.5 py-2.5 text-[14.5px] leading-[1.65] ${
                        mine ? 'bg-ink text-surface' : 'bg-surface-200 text-ink'
                      }`}
                    >
                      {!mine && <p className="mb-0.5 text-[12.5px] font-medium text-accent">{m.author_name}</p>}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                    <div className={`mt-1 flex items-center gap-2 text-[12px] text-ink-mute ${mine ? 'justify-end' : ''}`}>
                      <time dateTime={m.created_at}>{timeFmt.format(new Date(m.created_at))}</time>
                      {mine && (
                        <form action={deleteMessage}>
                          <input type="hidden" name="message_id" value={m.id} />
                          <input type="hidden" name="client_id" value={clientId} />
                          <button type="submit" className="text-ink-mute underline-offset-2 hover:underline">
                            {c.retract}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <form ref={formRef} action={action} className="mt-5 flex items-end gap-2">
        <input type="hidden" name="client_id" value={clientId} />
        <textarea
          name="body"
          required
          rows={2}
          maxLength={4000}
          placeholder={c.placeholder}
          className="field min-h-[46px] flex-1 resize-y"
          aria-label={c.send}
        />
        <Send_ />
      </form>
      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-xl2 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">{state.error}</p>
      )}
    </section>
  );
}
