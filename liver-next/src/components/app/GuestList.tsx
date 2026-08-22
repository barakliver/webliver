'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addGuests, deleteGuest, setGuestStatus, type GuestResult } from '@/app/actions/guests';
import { DIETS } from '@/content/lists';
import { GuestImport } from '@/components/app/GuestImport';
import { guestsCopy } from '@/content/site';

export type Guest = {
  id: string; full_name: string; side: string; phone: string;
  status: 'pending' | 'attending' | 'declined';
  party_size: number; diet: string; note: string; invite_token: string;
};

function Add() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? guestsCopy.adding : guestsCopy.add}
    </button>
  );
}

function CopyLink({ token }: { token: string }) {
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
          window.prompt(guestsCopy.copyLink, url);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? guestsCopy.copied : guestsCopy.copyLink}
    </button>
  );
}

const dietLabel = (v: string) => DIETS.find((d) => d.value === v)?.label ?? v;

export function GuestList({ clientId, guests }: { clientId: string; guests: Guest[] }) {
  const [state, action] = useActionState<GuestResult | null, FormData>(addGuests, null);
  const [filter, setFilter] = useState<'all' | Guest['status']>('all');
  const c = guestsCopy;

  const attending = guests.filter((g) => g.status === 'attending');
  const declined = guests.filter((g) => g.status === 'declined');
  const pending = guests.filter((g) => g.status === 'pending');
  /* the number that matters for catering is people, not invitations */
  const heads = attending.reduce((a, g) => a + Number(g.party_size || 0), 0);

  const shown = filter === 'all' ? guests : guests.filter((g) => g.status === filter);

  const tiles: [string, number, string][] = [
    [c.invited, guests.length, 'bg-surface-200 text-ink'],
    [c.attending, attending.length, 'bg-ok-wash text-ok'],
    [c.pending, pending.length, 'bg-warn-wash text-warn'],
    [c.heads, heads, 'bg-accent-wash text-ink'],
  ];

  return (
    <section className="card">
      <h2 className="font-display text-[18px] font-semibold text-ink">{c.title}</h2>
      <p className="mt-1 text-[14px] text-ink-soft">{c.sub}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {tiles.map(([label, value, tone]) => (
          <div key={label} className={`rounded-2xl px-4 py-3 ${tone}`}>
            <div className="text-[12.5px] opacity-80">{label}</div>
            <div className="font-display text-[24px] font-semibold tabular-nums">{value}</div>
          </div>
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
        <p role="alert" className="mt-3 rounded-2xl border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
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
                  className={`rounded-full px-4 py-1.5 text-[13.5px] transition ${
                    filter === v ? 'bg-ink text-white' : 'border border-line bg-white/70 text-ink-soft hover:bg-white'
                  }`}
                >{label}</button>
              )
            )}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-right text-[14.5px]">
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
                        {[g.side, g.phone].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`rounded-full px-3 py-1 text-[12.5px] ${
                        g.status === 'attending' ? 'bg-ok-wash text-ok'
                        : g.status === 'declined' ? 'bg-bad-wash text-bad'
                        : 'bg-surface-200 text-ink-mute'
                      }`}>
                        {g.status === 'attending' ? c.attending : g.status === 'declined' ? c.declined : c.pending}
                      </span>
                    </td>
                    <td className="py-3 tabular-nums text-ink-soft">{g.status === 'attending' ? g.party_size : '—'}</td>
                    <td className="py-3 text-ink-soft">{g.status === 'attending' ? dietLabel(g.diet) : '—'}</td>
                    <td className="py-3 text-ink-soft">{g.note || '—'}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        <CopyLink token={g.invite_token} />
                        {g.status !== 'attending' && (
                          <form action={setGuestStatus}>
                            <input type="hidden" name="guest_id" value={g.id} />
                            <input type="hidden" name="client_id" value={clientId} />
                            <input type="hidden" name="status" value="attending" />
                            <button type="submit" className="btn-quiet px-2 py-1 text-[13px]">✓</button>
                          </form>
                        )}
                        <form action={deleteGuest}>
                          <input type="hidden" name="guest_id" value={g.id} />
                          <input type="hidden" name="client_id" value={clientId} />
                          <button type="submit" className="btn-quiet px-2 py-1 text-[13px]">{c.remove}</button>
                        </form>
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
