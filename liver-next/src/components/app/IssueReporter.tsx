'use client';

import { useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bug, Check, ImagePlus, X } from 'lucide-react';
import { Sheet } from '@/components/app/Sheet';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fileTicket } from '@/app/actions/tickets';
import { ticketCopy as c } from '@/content/site';
import { cn } from '@/lib/utils';

const MAX_SHOT = 5 * 1024 * 1024;
type Category = keyof typeof c.categories;
const CATEGORIES = Object.keys(c.categories) as Category[];

/**
 * Saying the platform is wrong, from wherever it went wrong.
 *
 * The button lives in the chrome rather than in a menu, because a report is
 * made at the moment of noticing. What the reporter is not asked for is the
 * part they could not answer anyway: which screen, which browser, which
 * account. The form captures those itself and says that it does, so nobody
 * types a URL into a box.
 *
 * The screenshot goes straight from the browser to the private bucket, under
 * the reporter's own folder; the server records the path. Same shape as the
 * shared folder, for the same reason: a picture of a screen is bigger than a
 * server action wants to carry.
 */
export function IssueReporter({ userId, compact }: { userId: string; compact?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>('visual');
  const [body, setBody] = useState('');
  const [shot, setShot] = useState<File | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const reset = () => { setBody(''); setShot(null); setCategory('visual'); setState('idle'); setError(''); };

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError(c.badType); return; }
    if (f.size > MAX_SHOT) { setError(c.tooBig); return; }
    setError(''); setShot(f);
  };

  const send = async () => {
    if (body.trim().length < 2) { setError(c.empty); return; }
    setState('sending'); setError('');

    let screenshotPath = '';
    if (shot) {
      const ext = (shot.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png';
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      screenshotPath = path;
      const { error: upErr } = await supabaseBrowser().storage.from('support').upload(path, shot, {
        contentType: shot.type, upsert: false,
      });
      /* A screenshot that failed to land is not a reason to lose the words.
         The report goes without it, and says nothing about it: the log has
         the failure. */
      if (upErr) { console.error('[tickets] screenshot upload failed', upErr); screenshotPath = ''; }
    }

    const r = await fileTicket({
      category, body: body.trim(),
      route: pathname ?? '',
      agent: `${navigator.userAgent} · ${window.innerWidth}×${window.innerHeight}${window.matchMedia('(display-mode: standalone)').matches ? ' · installed' : ''}`,
      screenshotPath: screenshotPath || undefined,
    });

    if (r.ok) {
      setState('sent');
    } else {
      setState('idle');
      setError(r.error ?? c.failed);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { reset(); setOpen(true); }}
        aria-label={c.open}
        title={c.open}
        className={cn(
          'grid place-items-center rounded-xl2 text-ink-mute transition-colors hover:bg-surface-200 hover:text-ink',
          compact ? 'min-h-[40px] min-w-[40px]' : 'size-9',
        )}
      >
        <Bug size={compact ? 17 : 16} strokeWidth={1.5} aria-hidden />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={c.title} sub={c.sub}>
        {state === 'sent' ? (
          <div className="py-4 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-ok-wash text-ok">
              <Check size={22} strokeWidth={1.5} aria-hidden />
            </span>
            <p className="mt-4 text-[16px] font-medium text-ink">{c.sent}</p>
            <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-soft">{c.sentSub}</p>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost mt-6">{c.close}</button>
          </div>
        ) : (
          <div>
            <p className="label">{c.category}</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((k) => (
                <button
                  key={k} type="button" onClick={() => setCategory(k)} aria-pressed={category === k}
                  className={cn(
                    'min-h-[40px] rounded-xl2 border px-3.5 text-[13.5px] transition-colors',
                    category === k ? 'border-ink bg-ink text-surface' : 'border-line text-ink-soft hover:border-line-strong hover:text-ink',
                  )}
                >
                  {c.categories[k]}
                </button>
              ))}
            </div>

            <label className="label mt-5" htmlFor="ticket-body">{c.body}</label>
            <textarea
              id="ticket-body" value={body} onChange={(e) => setBody(e.target.value)}
              rows={4} maxLength={2000} placeholder={c.bodyPh}
              className="field resize-none"
            />

            <div className="mt-4">
              <p className="label">{c.screenshot}</p>
              {shot ? (
                <div className="flex items-center gap-3 rounded-xl2 border border-line bg-surface-100 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(shot)} alt="" className="h-14 w-20 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft" dir="ltr">{shot.name}</span>
                  <button
                    type="button" onClick={() => setShot(null)} aria-label={c.screenshotRemove}
                    className="grid size-9 place-items-center rounded-xl2 text-ink-mute transition hover:bg-surface-200 hover:text-ink"
                  >
                    <X size={15} strokeWidth={1.5} aria-hidden />
                  </button>
                </div>
              ) : (
                <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl2 border border-line-strong bg-card px-4 text-[13.5px] text-ink transition hover:border-accent/40 hover:text-accent">
                  <ImagePlus size={15} strokeWidth={1.5} aria-hidden />
                  {c.screenshot}
                  <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
                </label>
              )}
              <p className="mt-1.5 text-[12.5px] text-ink-mute">{c.screenshotHint}</p>
            </div>

            <p className="mt-4 text-[12.5px] leading-relaxed text-ink-mute">{c.auto}</p>

            {error && <p role="alert" className="mt-3 text-[13.5px] text-bad">{error}</p>}

            <button
              type="button" onClick={() => void send()} disabled={state === 'sending'}
              className="btn-primary mt-5 w-full"
            >
              {state === 'sending' ? c.sending : c.submit}
            </button>
          </div>
        )}
      </Sheet>
    </>
  );
}
