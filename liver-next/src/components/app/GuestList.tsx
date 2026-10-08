'use client';

import { Name } from '@/components/Ltr';
import { Pencil } from 'lucide-react';
import { Sheet } from '@/components/app/Sheet';

import { MessageCircle } from 'lucide-react';

import { useActionState, useDeferredValue, useMemo, useState } from 'react';
import { Search, Download, X, Check } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { addGuests, setManyGuestStatus, deleteGuest, setGuestStatus, updateGuest, type GuestResult } from '@/app/actions/guests';
import { DIETS } from '@/content/lists';
import { GuestImport } from '@/components/app/GuestImport';
import { useCopy } from '@/components/app/CopyProvider';
import { toCsv } from '@/lib/csv';
import { DeleteForm } from '@/components/app/ConfirmDelete';
import { normalizePhone } from '@/lib/phone';
import { publicEnv } from '@/lib/env';
import { count, fill } from '@/lib/copyText';
import { Metric } from '@/components/app/Metric';

export type Guest = {
  id: string; full_name: string; side: string; phone: string;
  status: 'pending' | 'attending' | 'declined';
  party_size: number; diet: string; note: string; invite_token: string;
};

function Add() {
  const c = useCopy().guests;
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? c.adding : c.add}
    </button>
  );
}

function CopyLink({ token }: { token: string }) {
  const c = useCopy().guests;
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-quiet px-2 py-1 text-body"
      onClick={async () => {
        const url = `${window.location.origin}/rsvp/${token}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          /* clipboard is blocked in some browsers unless the page is focused,
             so fall back to showing the link rather than failing silently */
          window.prompt(c.copyLink, url);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? c.copied : c.copyLink}
    </button>
  );
}

const dietLabel = (v: string) => DIETS.find((d) => d.value === v)?.label ?? v;

/** The one piece of colour on a guest row, shared by both layouts so the phone
 *  and the desktop can never end up calling the same status different things. */
function StatusChip({ status }: { status: Guest['status'] }) {
  const c = useCopy().guests;
  return (
    <span className={`shrink-0 rounded-xl2 px-3 py-1 text-meta ${
      status === 'attending' ? 'bg-ok-wash text-ok'
      : status === 'declined' ? 'bg-bad-wash text-bad'
      : 'bg-surface-200 text-ink-mute'
    }`}>
      {status === 'attending' ? c.attending : status === 'declined' ? c.declined : c.pending}
    </span>
  );
}

/** The nudge. A guest with a phone who has not answered gets a WhatsApp
 *  link with their own RSVP address in the message, the way the day-of
 *  console reaches a supplier. Nothing is sent by itself: the message opens
 *  in WhatsApp for the couple to press send on, so a reminder is always a
 *  thing somebody chose to do. The dashboard's "remind whoever has not
 *  replied" lands here, and until this existed it landed on nothing. */
function Remind({ guest }: { guest: Guest }) {
  const c = useCopy().guests;
  const phone = normalizePhone(guest.phone);
  if (!phone || guest.status !== 'pending') return null;
  const url = `${publicEnv.siteUrl.replace(/\/+$/, '')}/rsvp/${guest.invite_token}`;
  const text = fill(c.remindText, { name: guest.full_name, url });
  return (
    <a
      href={`https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-quiet inline-flex items-center gap-1 px-2 py-1 text-body"
    >
      <MessageCircle size={13} aria-hidden strokeWidth={1.5} />
      {c.remind}
    </a>
  );
}

/**
 * Correcting a guest.
 *
 * In a sheet rather than inline, and that is the whole reason this works:
 * the list is drawn twice, as cards on a phone and as a table above it, and
 * an inline form would have to be built into both. A thing built twice is a
 * thing built nought times, which is exactly how this product went a year
 * without any way to fix a guest's name at all.
 *
 * What it writes is who somebody is. What it never writes is what they
 * answered — `status`, `party_size` and `responded_at` are on the same row
 * and are the other act, so until now a typo in a name cost a delete, and a
 * delete cost the reply. Nobody rings an aunt a second time over a spelling,
 * so the spelling stayed, and then it was printed on the seating chart.
 */
function EditGuest({ guest, clientId, open, onClose }: {
  guest: Guest; clientId: string; open: boolean; onClose: () => void;
}) {
  const ui = useCopy();
  const c = ui.guests;
  const [state, action] = useActionState<GuestResult | null, FormData>(
    async (prev, form) => {
      const r = await updateGuest(prev, form);
      if (r.ok) onClose();
      return r;
    },
    null,
  );

  return (
    <Sheet open={open} onClose={onClose} title={c.gEdit} sub={c.gEditSub}>
      <form action={action} className="grid gap-3">
        <input type="hidden" name="guest_id" value={guest.id} />
        <input type="hidden" name="client_id" value={clientId} />

        <label className="min-w-0">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.gName}</span>
          <input name="full_name" required defaultValue={guest.full_name} autoComplete="off" className="field"  enterKeyHint="done" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="min-w-0">
            <span className="mb-1 block text-meta font-medium text-ink-soft">{c.gSide}</span>
            <input name="side" defaultValue={guest.side} autoComplete="off" className="field" />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-meta font-medium text-ink-soft">{c.gPhone}</span>
            <input name="phone" type="tel" inputMode="tel" defaultValue={guest.phone} autoComplete="off" className="field" />
          </label>
        </div>
        <label className="min-w-0">
          <span className="mb-1 block text-meta font-medium text-ink-soft">{c.dietCol}</span>
          <select name="diet" defaultValue={guest.diet ?? ''} className="field">
            <option value="" />
            {DIETS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>

        <div className="mt-1 flex items-center gap-3">
          <SaveGuest />
          <button type="button" onClick={onClose} className="btn-quiet px-2 py-1 text-body">
            {c.gCancel}
          </button>
        </div>

        {state && !state.ok && state.error && (
          <p role="alert" className="rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-body text-bad">
            {state.error}
          </p>
        )}
      </form>
    </Sheet>
  );
}

function SaveGuest() {
  const c = useCopy().guests;
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? c.gSaving : c.gSave}
    </button>
  );
}

/** Copy the invitation, remind them, mark them as coming, correct them,
 *  remove them. Same actions wherever the row is drawn. */
function RowActions({ guest, clientId }: { guest: Guest; clientId: string }) {
  const c = useCopy().guests;
  const [editing, setEditing] = useState(false);
  return (
    <>
      <CopyLink token={guest.invite_token} />
      <Remind guest={guest} />
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="grid size-9 place-items-center rounded-control text-ink-mute transition-colors hover:bg-surface-200 hover:text-ink"
        aria-label={c.gEdit}
        title={c.gEdit}
      >
        <Pencil size={15} strokeWidth={1.5} aria-hidden />
      </button>
      <EditGuest guest={guest} clientId={clientId} open={editing} onClose={() => setEditing(false)} />
      {guest.status !== 'attending' && (
        <form action={setGuestStatus}>
          <input type="hidden" name="guest_id" value={guest.id} />
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="status" value="attending" />
          <button type="submit" className="btn-quiet px-2 py-1 text-body">✓</button>
        </form>
      )}
      <DeleteForm action={deleteGuest}>
        <input type="hidden" name="guest_id" value={guest.id} />
        <input type="hidden" name="client_id" value={clientId} />
        <button type="submit" className="btn-quiet px-2 py-1 text-body">{c.remove}</button>
      </DeleteForm>
    </>
  );
}

/**
 * The tick that chooses a row.
 *
 * One component because this list is drawn twice, as cards on a phone and as
 * a table above it, and the two layouts have already been warned about once:
 * a thing built twice is a thing built nought times. A label rather than a
 * bare input, so the whole box is the target and a screen reader is told
 * whose row it is.
 */
function Pick({ on, onPick, name, label }: {
  on: boolean; onPick: () => void; name: string; label: string;
}) {
  return (
    <label className="grid size-11 shrink-0 cursor-pointer place-items-center sm:size-9">
      <span className="sr-only">{`${label}: ${name}`}</span>
      <input
        type="checkbox" checked={on} onChange={onPick}
        className="size-[18px] accent-accent"
      />
    </label>
  );
}

export function GuestList({ clientId, guests }: { clientId: string; guests: Guest[] }) {
  const [state, action] = useActionState<GuestResult | null, FormData>(addGuests, null);
  const [filter, setFilter] = useState<'all' | Guest['status']>('all');
  const c = useCopy().guests;

  const attending = guests.filter((g) => g.status === 'attending');
  const declined = guests.filter((g) => g.status === 'declined');
  const pending = guests.filter((g) => g.status === 'pending');
  /* the number that matters for catering is people, not invitations */
  const heads = attending.reduce((a, g) => a + Number(g.party_size || 0), 0);

  /* Deferred, so typing into a box above three hundred rows stays typing.
     Without it every keystroke re-filters and re-renders the whole list
     before the next letter lands, and the box is where that is felt. */
  /* Who is selected, as ids rather than rows: the rows are re-derived by
     every filter and every keystroke, and a set of objects would hold on to
     the ones that scrolled out of the answer. */
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const seeking = useDeferredValue(query);

  const shown = useMemo(() => {
    const byStatus = filter === 'all' ? guests : guests.filter((g) => g.status === filter);
    const q = seeking.trim().toLowerCase();
    if (!q) return byStatus;
    /* Name, side and phone: the three things somebody has in their head when
       they are looking for one guest. A phone typed with or without its
       dashes finds the same person. */
    const bare = q.replace(/[^0-9a-z\u0590-\u05ff]/g, '');
    return byStatus.filter((g) =>
      g.full_name.toLowerCase().includes(q)
      || (g.side ?? '').toLowerCase().includes(q)
      || (bare.length > 2 && (g.phone ?? '').replace(/[^0-9]/g, '').includes(bare)));
  }, [guests, filter, seeking]);

  /* Each tile is the way into the part of the list it counts. The detail
     behind "24 מגיעים" is those twenty four names, and they are already on
     this screen: tapping the figure filters the list under it rather than
     opening another one. The head count filters to the same people, because
     the number is those guests plus their partners. */
  /* The list somebody takes to the caterer, or opens in a spreadsheet to
     do the one thing this screen does not do. Exactly what is on screen:
     the filter and the search are part of the question being asked. */
  const toggle = (id: string) => setPicked((was) => {
    const next = new Set(was);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  /* Only ever what is on screen. "Select all" that reaches past the filter
     is how somebody marks three hundred people attending while looking at
     eleven. */
  const allShown = shown.length > 0 && shown.every((g) => picked.has(g.id));
  const pickAll = () => setPicked((was) => {
    const next = new Set(was);
    if (allShown) shown.forEach((g) => next.delete(g.id));
    else shown.forEach((g) => next.add(g.id));
    return next;
  });

  const download = () => {
    const rows = [
      [c.guest, c.status, c.party, c.dietCol, c.noteCol],
      ...shown.map((g) => [
        g.full_name, c.statuses[g.status] ?? g.status,
        String(g.party_size ?? ''), g.diet ?? '', g.note ?? '',
      ]),
    ];
    /* A BOM, or Excel opens Hebrew as mojibake and somebody decides the
       export is broken. */
    const blob = new Blob(['\uFEFF' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${c.exportName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tiles: {
    label: string; value: number; tone: 'ink' | 'ok' | 'warn' | 'accent';
    to: 'all' | Guest['status'];
  }[] = [
    { label: c.invited,   value: guests.length,    tone: 'ink',    to: 'all' },
    { label: c.attending, value: attending.length, tone: 'ok',     to: 'attending' },
    { label: c.pending,   value: pending.length,   tone: 'warn',   to: 'pending' },
    { label: c.heads,     value: heads,            tone: 'accent', to: 'attending' },
  ];

  return (
    <section className="card">
      <h2 className="head-panel">{c.title}</h2>
      <p className="mt-1 text-body text-ink-soft">{c.sub}</p>

      <div className="mt-6 grid gap-x-8 gap-y-8 grid-cols-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <Metric
            key={t.label}
            kicker={t.label}
            value={t.value.toLocaleString('en-US')}
            tone={t.tone}
            label={`${t.label} · ${c.showOnly}`}
            onClick={guests.length === 0 ? undefined : () => setFilter(t.to)}
          />
        ))}
      </div>

      <form action={action} className="mt-6 space-y-3">
        <input type="hidden" name="client_id" value={clientId} />
        <div>
          <label className="label" htmlFor="g-names">{c.addTitle}</label>
          <textarea id="g-names" name="names" rows={3} className="field" placeholder={c.addPh} />
          <p className="mt-1.5 text-meta text-ink-mute">{c.addHint}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input name="side" placeholder={c.side} autoComplete="off" className="field w-[180px]" aria-label={c.side} />
          <Add />
        </div>
      </form>

      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-body text-bad">
          {state.error}
        </p>
      )}
      {/* The box empties on a write and nothing else on this screen says how
          many went in, or that two lines did not. A list that silently
          swallows two of twelve is a list somebody counts by hand later. */}
      {state?.ok && (state.added ?? 0) > 0 && (
        <p role="status" className="mt-3 rounded-control bg-ok-wash px-4 py-2.5 text-body text-ok">
          {count(c.addDone, state.added ?? 0)}
          {state.skipped ? ` \u00B7 ${count(c.addSkipped, state.skipped)}` : ''}
        </p>
      )}
      <GuestImport clientId={clientId} />


      {guests.length === 0 ? (
        <p className="mt-6 text-body text-ink-mute">{c.none}</p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {([['all', c.invited], ['attending', c.attending], ['pending', c.pending], ['declined', c.declined]] as const).map(
              ([v, label]) => (
                <button
                  key={v} type="button" onClick={() => setFilter(v)} aria-pressed={filter === v}
                  className={`inline-flex min-h-[44px] items-center rounded-xl2 px-4 text-body transition sm:min-h-0 sm:py-1.5 ${
                    filter === v ? 'bg-ink text-surface' : 'border border-line bg-card/70 text-ink-soft hover:bg-card'
                  }`}
                >{label}</button>
              )
            )}
          </div>

          {/* Three hundred names is past the point where scrolling is looking.
              The box sits under the filters because it narrows what they
              chose rather than replacing it. */}
          {guests.length > 20 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="relative min-w-[12rem] flex-1">
                <span className="sr-only">{c.search}</span>
                <Search
                  size={15} strokeWidth={1.5} aria-hidden
                  className="pointer-events-none absolute inset-y-0 my-auto start-3 text-ink-mute"
                />
                <input
                  type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder={c.searchPh} autoComplete="off" enterKeyHint="search"
                  className="field w-full ps-9"
                />
              </label>
              <button
                type="button" onClick={download}
                className="btn-quiet inline-flex min-h-[44px] items-center gap-1.5 px-3 text-body sm:min-h-0"
              >
                <Download size={15} strokeWidth={1.5} aria-hidden />
                {c.exportCsv}
              </button>
            </div>
          )}

          {/* A list filtered down to nothing is the one case where the screen
              has to offer the way out. Without this somebody clears the box
              by hand, or decides the guest is not there. */}
          {shown.length === 0 && (
            <p className="mt-5 flex flex-wrap items-center gap-3 text-body text-ink-mute">
              {c.noneMatch}
              <button
                type="button"
                onClick={() => { setQuery(''); setFilter('all'); }}
                className="btn-quiet inline-flex items-center gap-1.5 px-2 py-1 text-body"
              >
                <X size={14} strokeWidth={1.5} aria-hidden />
                {c.clearFilters}
              </button>
            </p>
          )}

          {/* The bar only exists while something is chosen, and it says how
              many rather than "selected": a number is the thing somebody is
              checking before they press. It sticks, because the press that
              applies the answer is at the top and the names being answered
              for run down past the fold. */}
          {picked.size > 0 && (
            <form
              action={setManyGuestStatus}
              className="sticky top-16 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-card border border-accent/30 bg-accent-wash px-4 py-3"
            >
              <input type="hidden" name="client_id" value={clientId} />
              {[...picked].map((id) => <input key={id} type="hidden" name="guest_id" value={id} />)}

              <span className="me-auto text-body font-medium text-ink">
                {fill(c.chosen, { n: picked.size })}
              </span>
              {(['attending', 'declined', 'pending'] as const).map((s) => (
                <button
                  key={s} type="submit" name="status" value={s}
                  className="btn-quiet min-h-[44px] rounded-control bg-card px-3 text-body sm:min-h-0"
                >
                  {c.statuses[s]}
                </button>
              ))}
              <button
                type="button" onClick={() => setPicked(new Set())}
                className="btn-quiet inline-flex min-h-[44px] items-center gap-1.5 px-2 text-body sm:min-h-0"
              >
                <X size={14} strokeWidth={1.5} aria-hidden />
                {c.clearChosen}
              </button>
              {/* Said before the press, not after: answering for somebody
                  sets their party back to one, and a family who had already
                  typed their numbers would lose them quietly. */}
              <p className="w-full text-meta text-ink-soft">{c.chosenWarn}</p>
            </form>
          )}

          {/* Cards on a phone, a table from the small breakpoint up.

              It was one table with a 680px minimum inside a horizontal
              scroller, which on a 390px screen shows a little over half of it
              and asks a thumb to drag sideways inside a page that also scrolls
              down. Six columns is a desktop shape. The pieces that carry
              meaning, the status chip and the row's actions, are shared
              components rather than written twice, so the two layouts cannot
              drift into showing different things. */}
          <ul className="mt-4 space-y-2.5 sm:hidden">
            {shown.map((g) => (
              <li key={g.id} className={`rounded-card-sm border px-4 py-3.5 ${
                picked.has(g.id) ? 'border-accent/40 bg-accent-wash' : 'border-line'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <Pick on={picked.has(g.id)} onPick={() => toggle(g.id)} name={g.full_name} label={c.choose} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink"><Name>{g.full_name}</Name></p>
                    <p className="text-meta text-ink-mute">
                      {[g.side, g.phone].filter(Boolean).join(' · ') || '·'}
                    </p>
                  </div>
                  <StatusChip status={g.status} />
                </div>

                {g.status === 'attending' && (
                  <p className="mt-2 text-body text-ink-soft">
                    {g.party_size} {c.party} · {dietLabel(g.diet)}
                  </p>
                )}
                {g.note && <p className="mt-1 text-body text-ink-soft">{g.note}</p>}

                <div className="mt-3 flex flex-wrap items-center gap-1">
                  <RowActions guest={g} clientId={clientId} />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full text-right text-body">
              {/* The head stays while the names scroll. Six columns of
                  figures mean nothing once the row that names them has gone
                  off the top, and at three hundred rows it goes off the top
                  immediately. */}
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-line text-meta text-ink-mute">
                  {/* Chooses everything the filter and the search left, and
                      nothing beyond it. A "select all" that reaches past what
                      is on screen is how somebody answers for three hundred
                      people while looking at eleven. */}
                  <th scope="col" className="w-10 py-2">
                    <Pick on={allShown} onPick={pickAll} name={c.invited} label={c.chooseAll} />
                  </th>
                  <th scope="col" className="py-2 font-medium">{c.guest}</th>
                  <th scope="col" className="py-2 font-medium">{c.status}</th>
                  <th scope="col" className="py-2 font-medium">{c.party}</th>
                  <th scope="col" className="py-2 font-medium">{c.dietCol}</th>
                  <th scope="col" className="py-2 font-medium">{c.noteCol}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((g) => (
                  <tr key={g.id} className={`border-b border-line last:border-0 ${
                    picked.has(g.id) ? 'bg-accent-wash' : ''
                  }`}>
                    <td className="py-3">
                      <Pick on={picked.has(g.id)} onPick={() => toggle(g.id)} name={g.full_name} label={c.choose} />
                    </td>
                    <td className="py-3">
                      <div className="font-medium text-ink"><Name>{g.full_name}</Name></div>
                      <div className="text-meta text-ink-mute">
                        {[g.side, g.phone].filter(Boolean).join(' · ') || '·'}
                      </div>
                    </td>
                    <td className="py-3"><StatusChip status={g.status} /></td>
                    <td className="py-3 tabular-nums text-ink-soft">{g.status === 'attending' ? g.party_size : '·'}</td>
                    <td className="py-3 text-ink-soft">{g.status === 'attending' ? dietLabel(g.diet) : '·'}</td>
                    <td className="py-3 text-ink-soft">{g.note || '·'}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        <RowActions guest={g} clientId={clientId} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
