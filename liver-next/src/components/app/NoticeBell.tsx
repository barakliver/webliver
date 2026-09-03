'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, CalendarClock, Check, CheckCheck, CheckCircle2, FileText, Heart, KeyRound, LifeBuoy, Mail,
  MessagesSquare, PenLine, ShoppingBag, Target, Wallet, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { markRead, markAllRead } from '@/app/actions/notifications';
import { noticeCopy } from '@/content/site';
import { cn } from '@/lib/utils';

export type Notice = {
  id: string; kind: keyof typeof noticeCopy.kinds;
  title: string; body: string; href: string;
  read_at: string | null; created_at: string;
};

/* Lucide rather than emoji: emoji render differently on every platform, carry
   a colour we did not choose, and read as decoration next to Hebrew text. */
const ICONS: Record<string, LucideIcon> = {
  lead: Target, rsvp: Mail, task: CheckCircle2, payment: Wallet,
  invite: KeyRound, message: MessagesSquare, contract: PenLine, file: FileText, order: ShoppingBag,
  anniversary: Heart, meeting: CalendarClock, ticket: LifeBuoy,
};

const c = noticeCopy;

const rel = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return c.now;
  if (mins < 60) return c.minutes.replace('{n}', String(mins));
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return c.hours.replace('{n}', String(hrs));
  return c.days.replace('{n}', String(Math.round(hrs / 24)));
};

/**
 * The bell, and what is behind it.
 *
 * Up in the header where every app keeps one, with a count on it that means
 * unread rather than total. Opening it shows the list newest first, each
 * line stamped with how long ago; touching a line marks it read and goes
 * where it points, because a notification is a door, not a notice board.
 *
 * On a phone the list rises from the bottom as a sheet, where a thumb is.
 * On a desk it drops from the bell. Same list, same markup, two positions.
 */
export function NoticeBell({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [, start] = useTransition();
  const panel = useRef<HTMLDivElement>(null);
  const unread = notices.filter((n) => !n.read_at).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const follow = (n: Notice) => {
    setOpen(false);
    if (!n.read_at) {
      const fd = new FormData();
      fd.set('notice_id', n.id);
      start(() => { void markRead(fd); });
    }
    if (n.href) router.push(n.href);
  };

  const readOne = (n: Notice) => {
    const fd = new FormData();
    fd.set('notice_id', n.id);
    start(() => { void markRead(fd); });
  };

  return (
    <div className="relative">
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        aria-expanded={open} aria-haspopup="dialog"
        aria-label={unread > 0 ? `${c.title}: ${unread} ${c.unread}` : c.title}
        title={c.title}
        className="relative grid size-10 place-items-center rounded-xl2 text-ink-soft transition-colors hover:bg-surface-200 hover:text-ink"
      >
        <Bell size={18} strokeWidth={1.5} aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bad px-1 text-[10.5px] font-semibold leading-none tabular-nums text-surface ring-2 ring-card">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* a click anywhere else closes it, without trapping focus */}
          <button
            type="button" aria-hidden tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default bg-ink/20 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panel}
            role="dialog" aria-label={c.title}
            className={cn(
              'z-50 flex flex-col overflow-hidden border border-line bg-card/95 shadow-pop backdrop-blur-xl',
              /* Phone: a sheet from the bottom. Desk: a card under the bell,
                 hung from its end edge so it never runs off the screen. */
              'fixed inset-x-0 bottom-0 max-h-[78svh] rounded-t-card-sm',
              'sm:absolute sm:inset-x-auto sm:end-0 sm:top-12 sm:bottom-auto sm:w-[360px] sm:max-h-[70vh] sm:rounded-card-sm',
            )}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="flex items-baseline gap-2">
                <b className="text-[14.5px] font-medium text-ink">{c.title}</b>
                {unread > 0 && <span className="text-[12.5px] tabular-nums text-ink-mute">{unread} {c.unread}</span>}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <form action={markAllRead}>
                    <button type="submit" className="btn-quiet inline-flex min-h-[36px] items-center gap-1.5 px-2 text-[12.5px]">
                      <CheckCheck size={14} strokeWidth={1.5} aria-hidden />
                      {c.markAll}
                    </button>
                  </form>
                )}
                <button
                  type="button" onClick={() => setOpen(false)} aria-label={c.close}
                  className="grid size-9 place-items-center rounded-xl2 text-ink-mute transition hover:bg-surface-200 hover:text-ink sm:hidden"
                >
                  <X size={16} strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            </div>

            {notices.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <span className="mx-auto grid size-11 place-items-center rounded-full bg-surface-100 text-ink-mute">
                  <Bell size={18} strokeWidth={1.5} aria-hidden />
                </span>
                <p className="mt-3 text-[14px] text-ink">{c.none}</p>
                <p className="mt-1 text-[12.5px] text-ink-mute">{c.noneSub}</p>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {notices.map((n) => {
                  const I = ICONS[n.kind] ?? Bell;
                  const fresh = !n.read_at;
                  return (
                    <li key={n.id} className="border-b border-line last:border-0">
                      <div className={cn('flex items-start gap-3 px-4 py-3 transition-colors', fresh ? 'bg-accent-wash' : 'hover:bg-surface-100')}>
                        <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', fresh ? 'bg-card text-accent' : 'bg-surface-100 text-ink-mute')}>
                          <I size={15} strokeWidth={1.5} aria-hidden />
                        </span>
                        <button
                          type="button" onClick={() => follow(n)}
                          className="min-w-0 flex-1 text-start"
                        >
                          <p className={cn('text-[14px] leading-snug', fresh ? 'font-medium text-ink' : 'text-ink')}>{n.title}</p>
                          {n.body && <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-soft">{n.body}</p>}
                          <p className="mt-1 text-[12px] text-ink-mute">
                            <span>{c.kinds[n.kind] ?? n.kind}</span>
                            <span> · </span>
                            <span>{rel(n.created_at)}</span>
                          </p>
                        </button>
                        {fresh && (
                          <button
                            type="button" onClick={() => readOne(n)}
                            aria-label={c.markOne} title={c.markOne}
                            className="grid size-8 shrink-0 place-items-center rounded-full text-ink-mute transition hover:bg-card hover:text-accent"
                          >
                            <Check size={15} strokeWidth={1.5} aria-hidden />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
