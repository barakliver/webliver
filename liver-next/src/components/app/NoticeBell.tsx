'use client';

import Link from 'next/link';
import { useState } from 'react';
import { markRead, markAllRead } from '@/app/actions/notifications';
import { noticeCopy } from '@/content/site';

export type Notice = {
  id: string; kind: keyof typeof noticeCopy.kinds;
  title: string; body: string; href: string;
  read_at: string | null; created_at: string;
};

const ICONS: Record<string, string> = {
  lead: '🎯', rsvp: '✉️', task: '✅', payment: '₪', invite: '🔑',
};

const rel = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `לפני ${hrs} שע׳`;
  return `לפני ${Math.round(hrs / 24)} ימים`;
};

export function NoticeBell({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState(false);
  const c = noticeCopy;
  const unread = notices.filter((n) => !n.read_at).length;

  return (
    <div className="relative">
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        aria-expanded={open} aria-label={c.title}
        className="relative rounded-full border border-line-strong bg-white/60 px-3 py-2 text-[15px] hover:bg-white"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* a click anywhere else closes it, without trapping focus */}
          <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute top-12 z-50 w-[330px] max-w-[86vw] overflow-hidden rounded-2xl border border-line bg-white shadow-lift"
               style={{ insetInlineStart: 0 }}>
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <b className="text-[14px] text-ink">{c.title}</b>
              {unread > 0 && (
                <form action={markAllRead}>
                  <button type="submit" className="btn-quiet px-2 py-1 text-[12.5px]">{c.markAll}</button>
                </form>
              )}
            </div>

            {notices.length === 0 ? (
              <p className="px-4 py-6 text-center text-[14px] text-ink-mute">{c.none}</p>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto">
                {notices.map((n) => (
                  <li key={n.id} className={`border-b border-line last:border-0 ${n.read_at ? '' : 'bg-bronze-wash/60'}`}>
                    <div className="flex gap-3 px-4 py-3">
                      <span aria-hidden className="text-[15px]">{ICONS[n.kind] ?? '•'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-ink">{n.title}</p>
                        {n.body && <p className="truncate text-[13px] text-ink-soft">{n.body}</p>}
                        <p className="mt-0.5 text-[12px] text-ink-mute">{rel(n.created_at)}</p>
                        {n.href && (
                          <Link href={n.href} onClick={() => setOpen(false)} className="mt-1 inline-block text-[12.5px] text-bronze">
                            {c.open} ←
                          </Link>
                        )}
                      </div>
                      {!n.read_at && (
                        <form action={markRead}>
                          <input type="hidden" name="notice_id" value={n.id} />
                          <button type="submit" className="btn-quiet px-1.5 py-0 text-[12px]" aria-label={c.markAll}>✓</button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
