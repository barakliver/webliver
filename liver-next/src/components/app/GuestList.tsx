'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addGuests, deleteGuest, setGuestStatus, type GuestResult } from '@/app/actions/guests';
import { DIETS } from '@/content/lists';
import { GuestImport } from '@/components/app/GuestImport';
import { useCopy } from '@/components/app/CopyProvider';
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
      className="btn-quiet px-2 py-1 text-[13px]"
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
    <span className={`shrink-0 rounded-xl2 px-3 py-1 text-[12.5px] ${
      status === 'attending' ? 'bg-ok-wash text-ok'
      : status === 'declined' ? 'bg-bad-wash text-bad'
      : 'bg-surface-200 text-ink-mute'
    }`}>
      {status === 'attending' ? c.attending : status === 'declined' ? c.declined : c.pending}
    </span>
  );
}

/** Copy the invitation, mark them as coming, remove them. Same three actions
 *  wherever the row is drawn. */
function RowActions({ guest, clientId }: { guest: Guest; clientId: string }) {
  const c = useCopy().guests;
  return (
    <>
      <CopyLink token={guest.invite_token} />
      {guest.status !== 'attending' && (
        <form action={setGuestStatus}>
          <input type="hidden" name="guest_id" value={guest.id} />
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="status" value="attending" />
          <button type="submit" className="btn-quiet px-2 py-1 text-[13px]">✓</button>
        </form>
      )}
      <form action={deleteGuest}>
        <input type="hidden" name="guest_id" value={guest.id} />
        <input type="hidden" name="client_id" value={clientId} />
        <button type="submit" className="btn-quiet px-2 py-1 text-[13px]">{c.remove}</button>
      </form>
    </>
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

  const shown = filter === 'all' ? guests : guests.filter((g) => g.status === filter);

  /* Each tile is the way into the part of the list it counts. The detail
     behind "24 מגיעים" is those twenty four names, and they are already on
     this screen: tapping the figure filters the list under it rather than
     opening another one. The head count filters to the same people, because
     the number is those guests plus their partners. */
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
      <h2 className="font-display text-[18px] font-semibold text-ink">{c.title}</h2>
      <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>

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
          <p className="mt-1.5 text-[12.5px] text-ink-mute">{c.addHint}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input name="side" placeholder={c.side} autoComplete="off" className="field w-[180px]" aria-label={c.side} />
          <Add />
        </div>
      </form>

      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
          {state.error}
        </p>
      )}
      <GuestImport clientId={clientId} />


      {guests.length === 0 ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.none}</p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {([['all', c.invited], ['attending', c.attending], ['pending', c.pending], ['declined', c.declined]] as const).map(
              ([v, label]) => (
                <button
                  key={v} type="button" onClick={() => setFilter(v)} aria-pressed={filter === v}
                  className={`inline-flex min-h-[44px] items-center rounded-xl2 px-4 text-[13.5px] transition sm:min-h-0 sm:py-1.5 ${
                    filter === v ? 'bg-ink text-surface' : 'border border-line bg-card/70 text-ink-soft hover:bg-card'
                  }`}
                >{label}</button>
              )
            )}
          </div>

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
              <li key={g.id} className="rounded-xl2 border border-line px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{g.full_name}</p>
                    <p className="text-[12.5px] text-ink-mute">
                      {[g.side, g.phone].filter(Boolean).join(' · ') || '·'}
                    </p>
                  </div>
                  <StatusChip status={g.status} />
                </div>

                {g.status === 'attending' && (
                  <p className="mt-2 text-[13px] text-ink-soft">
                    {g.party_size} {c.party} · {dietLabel(g.diet)}
                  </p>
                )}
                {g.note && <p className="mt-1 text-[13px] text-ink-soft">{g.note}</p>}

                <div className="mt-3 flex flex-wrap items-center gap-1">
                  <RowActions guest={g} clientId={clientId} />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full text-right text-[14.5px]">
              <thead>
                <tr className="border-b border-line text-[12.5px] text-ink-mute">
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
                  <tr key={g.id} className="border-b border-line last:border-0">
                    <td className="py-3">
                      <div className="font-medium text-ink">{g.full_name}</div>
                      <div className="text-[12.5px] text-ink-mute">
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
