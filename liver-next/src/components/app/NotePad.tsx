'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, CloudOff, Loader2 } from 'lucide-react';
import { saveNote } from '@/app/actions/meetings';
import { useCopy } from '@/components/app/CopyProvider';
import { NOTE_LIMIT } from '@/content/meetings';
import { fill } from '@/lib/copyText';
import { EVENT_ZONE } from '@/lib/clock';

export type Note = {
  id: string | null;
  title: string;
  /** Always set by the page, in the zone the events are in, so the screen
   *  never computes a date the server would have computed differently an
   *  hour either side of midnight. */
  held_on: string;
  body: string;
  /** When the server last had it, for deciding whether a draft left on this
   *  device is newer than what was saved. Absent on a page nobody has
   *  written on yet. */
  updated_at: string | null;
};

/** Stop typing for this long and it saves. Long enough that a pause between
 *  two sentences is not a write; short enough that a phone put down mid
 *  meeting has already saved by the time anybody looks at it. */
const IDLE_MS = 2_500;
/** And never longer than this while somebody keeps typing, so an hour of
 *  continuous writing is not one unsaved hour. */
const FLOOR_MS = 25_000;
/** The counter stays out of the way until the end is in sight. */
const COUNT_FROM = NOTE_LIMIT - 500;
/** How long after a refused save to try it again, doubling up to the ceiling.
 *  The screen says it will try again, so it has to try again: a hall with no
 *  signal is the ordinary case here, and somebody who stopped typing after
 *  the last refusal would otherwise never be saved at all. */
const RETRY_MS = 6_000;
const RETRY_MAX = 60_000;

const timeFmt = (locale: string) =>
  new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'he-IL', {
    timeZone: EVENT_ZONE, hour: '2-digit', minute: '2-digit',
  });

type Draft = { body: string; title: string; heldOn: string; at: number };

/**
 * A page, and nothing else on the screen.
 *
 * He used the product in a real meeting for the first time and asked for the
 * one thing it did not have. Everything else here asks a question first —
 * which meeting is this, then twenty fields in the order the conversation
 * usually goes — and that is worth a great deal when the conversation goes
 * that way and is a wall when somebody is sitting opposite you talking.
 *
 * So the screen is a date, a line for a title if you want one, and the rest
 * of it to write on. What it is underneath is a meeting log with no
 * questions, which means the version history, the sharing switch and the
 * fences around it are the ones that already existed.
 *
 * Three things it has to get right, all of them about not losing a word.
 *
 * It saves on its own, because nobody presses save in a meeting. Quietly:
 * the autosaves do not redraw the event's page behind this one.
 *
 * It keeps a copy on the device as it goes. A save can fail — a hall with no
 * signal is the normal case, not the edge one — and a tab can be closed
 * mid-sentence. What was written is put back when the page is opened again,
 * and the line saying so is the only time this screen mentions any of it.
 *
 * And it never lets two saves cross. A write in flight and another queued
 * behind it used to be how the second-to-last paragraph came back.
 */
export function NotePad({ clientId, eventName, note, takeFocus = true }: {
  clientId: string; eventName: string; note: Note;
  /** Off in the gallery, where ninety panels share a page. */
  takeFocus?: boolean;
}) {
  const ui = useCopy();
  const c = ui.note;
  const router = useRouter();

  const [title, setTitle] = useState(note.title);
  const [heldOn, setHeldOn] = useState(note.held_on);
  const [body, setBody] = useState(note.body);
  const [state, setState] = useState<'clean' | 'dirty' | 'saving' | 'failed'>('clean');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [restored, setRestored] = useState(false);

  const id = useRef(note.id);
  const lastSaved = useRef(Date.now());
  const inFlight = useRef(false);
  const again = useRef(false);
  const touched = useRef(false);
  const retries = useRef(0);
  const area = useRef<HTMLTextAreaElement>(null);
  /* Fixed for the life of the screen: a new page gets its id on the first
     save, and a draft that moved key at that moment would be a draft nobody
     could find again. */
  const key = useRef(`liver.note.${clientId}.${note.id ?? 'new'}`);

  /* Everything the saver needs, read at the moment it runs rather than
     captured when it was scheduled. A debounce that closes over the text
     saves the text as it was three seconds ago. */
  const now = useRef({ title, heldOn, body });
  now.current = { title, heldOn, body };

  const draft = useCallback((d: Draft | null) => {
    try {
      if (d) localStorage.setItem(key.current, JSON.stringify(d));
      else localStorage.removeItem(key.current);
    } catch { /* a browser refusing storage is not a reason to stop typing */ }
  }, []);

  const save = useCallback(async (quiet: boolean): Promise<boolean> => {
    if (inFlight.current) { again.current = true; return false; }
    const sending = { ...now.current };
    if (!id.current && !sending.body.trim()) return true;

    inFlight.current = true;
    setState('saving');
    const res = await saveNote({
      id: id.current ?? undefined,
      clientId,
      title: sending.title,
      heldOn: sending.heldOn,
      body: sending.body,
      quiet,
    });
    inFlight.current = false;
    lastSaved.current = Date.now();

    if (!res.ok) { setState('failed'); return false; }
    retries.current = 0;

    if (res.id && !id.current) {
      id.current = res.id;
      /* The address learns which page this is, without telling the router:
         a navigation here would rebuild this screen from the server and take
         the cursor with it. A refresh mid-meeting now reopens the page. */
      try {
        window.history.replaceState(null, '', `?id=${res.id}`);
      } catch { /* the page works without it */ }
    }

    /* Anything typed while that was in the air is still unsaved. */
    const moved = JSON.stringify(sending) !== JSON.stringify(now.current);
    setSavedAt(new Date());
    setState(moved ? 'dirty' : 'clean');
    if (!moved) { draft(null); setRestored(false); }
    if (again.current || moved) { again.current = false; void save(true); }
    return true;
  }, [clientId, draft]);

  /* What was left on this device, if it is newer than what the server had.
     Silent when there is nothing to put back, which is almost always. */
  useEffect(() => {
    let held: Draft | null = null;
    try {
      const raw = localStorage.getItem(key.current);
      held = raw ? (JSON.parse(raw) as Draft) : null;
    } catch { held = null; }
    if (!held || typeof held.body !== 'string') return;

    const serverAt = note.updated_at ? Date.parse(note.updated_at) : 0;
    if (!(held.at > serverAt) || held.body === note.body) return;

    setTitle(held.title ?? '');
    setHeldOn(held.heldOn || note.held_on);
    setBody(held.body);
    setRestored(true);
    setState('dirty');
    touched.current = true;
  }, [note.updated_at, note.body, note.held_on]);

  /* The autosave. One timer, replaced on every keystroke, and pulled forward
     when the floor is due — so a pause saves, and no pause at all still
     saves. */
  useEffect(() => {
    if (!touched.current) return undefined;
    setState((s) => (s === 'saving' ? s : 'dirty'));
    draft({ ...now.current, at: Date.now() });
    const due = Math.max(0, FLOOR_MS - (Date.now() - lastSaved.current));
    const t = setTimeout(() => void save(true), Math.min(IDLE_MS, due));
    return () => clearTimeout(t);
  }, [title, heldOn, body, save, draft]);

  /* The line under the date says it will try again. This is it trying again,
     backing off as it goes, until it lands or the page is closed. */
  useEffect(() => {
    if (state !== 'failed') return undefined;
    const wait = Math.min(RETRY_MAX, RETRY_MS * 2 ** retries.current);
    retries.current += 1;
    const t = setTimeout(() => void save(true), wait);
    return () => clearTimeout(t);
  }, [state, save]);

  /* Leaving, by any of the ways there are to leave. The device copy is the
     one that survives a tab closed mid-sentence; the save is what makes the
     page appear in the list. */
  useEffect(() => {
    const onHide = () => {
      draft({ ...now.current, at: Date.now() });
      if (touched.current) void save(true);
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      draft({ ...now.current, at: Date.now() });
      if (state === 'clean') return;
      e.preventDefault();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, [save, draft, state]);

  /* Ctrl-S, because somebody who has written in a word processor for twenty
     years will press it, and a browser's own save dialogue over a meeting
     note is a small betrayal. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  /* The page grows with what is on it rather than scrolling inside a box:
     a field with its own scrollbar hides the paragraph above the one being
     written, which is the paragraph somebody is usually looking at. */
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  const change = (set: (v: string) => void) => (v: string) => { touched.current = true; set(v); };

  const finish = async () => {
    const ok = await save(false);
    if (ok) { draft(null); router.push(`/app/clients/${clientId}`); }
  };

  const left = NOTE_LIMIT - body.length;

  return (
    <div className="mx-auto max-w-[46rem]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/app/clients/${clientId}`} className="btn-quiet inline-block px-0 text-[14px]">
          ← {c.back}
        </Link>
        <p className="text-[13px] text-ink-mute">{eventName}</p>
      </div>

      <div className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            type="date" value={heldOn} onChange={(e) => change(setHeldOn)(e.target.value)}
            aria-label={c.held}
            className="field h-11 min-h-0 w-[170px] py-1 text-[14px]"
          />
          <Status state={state} at={savedAt} ever={!!savedAt || !!note.id} c={c} locale={ui.locale} />
        </div>

        {/* No border and no label. It is the name of the page, and a page
            usually does not need one: left empty it takes the first line. */}
        <input
          value={title} onChange={(e) => change(setTitle)(e.target.value)}
          placeholder={c.titlePh}
          aria-label={c.title}
          maxLength={200}
          className="mt-5 w-full border-0 bg-transparent p-0 font-display text-[21px] font-semibold text-ink placeholder:text-ink-mute/70 focus:outline-none sm:text-[26px]"
        />

        <hr className="hairline mt-4" />

        {restored && (
          <p className="mt-4 rounded-control border border-accent/25 bg-accent-wash px-4 py-2.5 text-[13.5px] text-ink">
            {c.restored}
          </p>
        )}

        <textarea
          ref={area}
          value={body}
          onChange={(e) => change(setBody)(e.target.value.slice(0, NOTE_LIMIT))}
          placeholder={c.bodyPh}
          aria-label={c.title}
          autoFocus={takeFocus}
          className="mt-4 min-h-[58vh] w-full resize-none border-0 bg-transparent p-0 text-[17px] leading-[1.9] text-ink placeholder:text-ink-mute/70 focus:outline-none"
        />

        {body.length >= COUNT_FROM && (
          <p className={`mt-2 text-[12.5px] ${left <= 0 ? 'text-bad' : 'text-ink-mute'}`}>
            {left <= 0 ? c.full : fill(c.nearLimit, { n: left })}
          </p>
        )}
      </div>

      {/* No sharing switch. The column is there and the meeting forms offer
          one, but nothing on the couple's screen has ever read a meeting, so
          the switch shows them nothing — and a second copy of a control that
          does nothing is not what this screen was asked for. */}
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={() => void finish()} className="btn-primary">
          {c.done}
        </button>
      </div>
    </div>
  );
}

/** Where it stands, in one line that is never a dialogue box. A save that
 *  failed says so and keeps trying; what was written is on the device either
 *  way. */
function Status({ state, at, ever, c, locale }: {
  state: 'clean' | 'dirty' | 'saving' | 'failed';
  at: Date | null;
  /** Whether there is anything saved to be reassured about. A page opened a
   *  second ago and never written on said "saved", which is a lie told by a
   *  default rather than by anything that happened. */
  ever: boolean;
  c: { saving: string; saved: string; savedAt: string; unsaved: string; failed: string };
  locale: string;
}) {
  if (state === 'failed') {
    return (
      <p role="status" className="inline-flex items-center gap-1.5 text-[13px] text-bad">
        <CloudOff size={14} aria-hidden strokeWidth={1.5} />
        {c.failed}
      </p>
    );
  }
  if (state === 'saving') {
    return (
      <p role="status" className="inline-flex items-center gap-1.5 text-[13px] text-ink-mute">
        <Loader2 size={14} aria-hidden strokeWidth={1.5} className="animate-spin motion-reduce:animate-none" />
        {c.saving}
      </p>
    );
  }
  if (state === 'dirty') {
    return <p role="status" className="text-[13px] text-ink-mute">{c.unsaved}</p>;
  }
  if (!ever) return <span aria-hidden />;
  return (
    <p role="status" className="inline-flex items-center gap-1.5 text-[13px] text-ink-mute">
      <Check size={14} aria-hidden strokeWidth={1.5} />
      {at ? fill(c.savedAt, { at: timeFmt(locale).format(at) }) : c.saved}
    </p>
  );
}
