'use client';

import { useState, useTransition } from 'react';
import { Check, Music, Package, Users } from 'lucide-react';
import { saveSong, setEquipment, saveCouple } from '@/app/actions/eventFile';
import { MUSIC_MOMENTS, EQUIPMENT_CHECK, COUPLE_DETAIL_FIELDS } from '@/content/eventFile';
import { eventFileCopy as c } from '@/content/site';
import { Ltr } from '@/components/Ltr';

export type Song = { moment: string; song: string; artist: string; note: string };
export type Kit = { item: string; needed: boolean; sorted: boolean };
export type Person = { person: 'a' | 'b'; name: string; fields: Record<string, string> };

/**
 * His own three lists, on the screen at last.
 *
 * Every one of them is rendered from the shipped content rather than from
 * whatever rows happen to exist, so a moment nobody has chosen a song for is
 * still on the page asking. That is the entire point of the list: the second
 * entrance after the change of clothes is not forgotten because somebody
 * deleted it, it is forgotten because nobody wrote it down, and a row that
 * only appears once it has been filled in cannot remind anybody of anything.
 */
export function EventFileLists({ clientId, songs, kit, people, viewer }: {
  clientId: string;
  songs: Song[];
  kit: Kit[];
  people: Person[];
  viewer: 'producer' | 'client';
}) {
  return (
    <div className="space-y-6">
      <MusicList clientId={clientId} songs={songs} />
      {/* Production logistics: the couple may read it, the producer decides
          it. Nothing sensitive, and a couple who can see there is a generator
          stops asking whether there is one. */}
      <Equipment clientId={clientId} kit={kit} editable={viewer === 'producer'} />
      <Couple clientId={clientId} people={people} />
    </div>
  );
}

/* ── the seven moments ────────────────────────────────────────────────────── */

function MusicList({ clientId, songs }: { clientId: string; songs: Song[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const by = new Map(songs.map((s) => [s.moment, s]));
  const chosen = MUSIC_MOMENTS.filter((m) => (by.get(m)?.song ?? '').trim() !== '').length;

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 text-accent">
          <Music size={16} strokeWidth={1.5} aria-hidden />
          <h2 className="eyebrow">{c.music.title}</h2>
        </div>
        <p className="text-[13px] text-ink-mute">
          <Ltr>{c.music.chosen(chosen, MUSIC_MOMENTS.length)}</Ltr>
        </p>
      </div>
      <p className="mt-2 text-[13.5px] text-ink-soft">{c.music.sub}</p>

      <ul className="mt-4 divide-y divide-line border-t border-line">
        {MUSIC_MOMENTS.map((moment) => {
          const row = by.get(moment);
          const has = (row?.song ?? '').trim() !== '';
          const on = open === moment;

          return (
            <li key={moment} className="py-3">
              <button
                type="button"
                onClick={() => setOpen(on ? null : moment)}
                aria-expanded={on}
                className="flex w-full items-center justify-between gap-3 text-start"
              >
                <span className="min-w-0">
                  <span className="block text-[15px] text-ink">{moment}</span>
                  <span className={`mt-0.5 block text-[13.5px] ${has ? 'text-ink-soft' : 'text-ink-mute'}`}>
                    {has ? [row?.song, row?.artist].filter(Boolean).join(' · ') : '·'}
                  </span>
                </span>
                {has && <Check size={16} aria-hidden strokeWidth={1.5} className="shrink-0 text-ok" />}
              </button>

              {on && (
                <form action={saveSong} className="mt-3 grid gap-2 rounded-card-sm bg-surface-100 p-3 sm:grid-cols-[1fr_1fr_auto]">
                  <input type="hidden" name="client_id" value={clientId} />
                  <input type="hidden" name="moment" value={moment} />
                  <input
                    name="song" defaultValue={row?.song} maxLength={200}
                    placeholder={c.music.songPh} aria-label={c.music.song}
                    className="field" autoComplete="off"
                  />
                  <input
                    name="artist" defaultValue={row?.artist} maxLength={160}
                    placeholder={c.music.artist} aria-label={c.music.artist}
                    className="field" autoComplete="off"
                  />
                  <button type="submit" className="btn-primary whitespace-nowrap">{c.music.save}</button>
                  <input
                    name="note" defaultValue={row?.note} maxLength={500}
                    placeholder={c.music.notePh} aria-label={c.music.note}
                    className="field sm:col-span-3" autoComplete="off"
                  />
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── the equipment ────────────────────────────────────────────────────────── */

const STATES = ['off', 'needed', 'sorted'] as const;
type State = (typeof STATES)[number];

/**
 * Nothing decided is not the same as decided against.
 *
 * An item with no row has never been looked at; `off` means somebody checked
 * and said no. Collapsing the two made a fresh event show "not needed" against
 * the sound system, which is both a lie and an absurd one — and it is the same
 * mistake as a checkbox that cannot say "we need it and have not booked it",
 * only made by the default instead of by the control.
 */
const stateOf = (k?: Kit): State | null => {
  if (!k) return null;
  return k.sorted ? 'sorted' : k.needed ? 'needed' : 'off';
};

function Equipment({ clientId, kit, editable }: {
  clientId: string; kit: Kit[]; editable: boolean;
}) {
  const [, start] = useTransition();
  const by = new Map(kit.map((k) => [k.item, k]));
  /* Undecided counts as open. An item nobody has looked at is exactly the one
     worth being reminded of, and leaving it out of the count would make a
     fresh event read as fully sorted. */
  const open = EQUIPMENT_CHECK.filter((i) => {
    const s = stateOf(by.get(i));
    return s === null || s === 'needed';
  }).length;

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 text-accent">
          <Package size={16} strokeWidth={1.5} aria-hidden />
          <h2 className="eyebrow">{c.equipment.title}</h2>
        </div>
        <p className={`text-[13px] ${open > 0 ? 'text-warn' : 'text-ink-mute'}`}>
          {open > 0 ? <Ltr>{c.equipment.openCount(open)}</Ltr> : c.equipment.allSorted}
        </p>
      </div>
      <p className="mt-2 text-[13.5px] text-ink-soft">{c.equipment.sub}</p>

      <ul className="mt-4 divide-y divide-line border-t border-line">
        {EQUIPMENT_CHECK.map((item) => {
          const now = stateOf(by.get(item));
          const undecided = now === null;
          return (
            <li key={item} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="text-[15px] text-ink">{item}</span>

              {editable ? (
                <span role="group" aria-label={item} className="flex rounded-button border border-line-strong p-0.5">
                  {STATES.map((s) => (
                    <form key={s} action={(fd) => start(() => void setEquipment(fd))}>
                      <input type="hidden" name="client_id" value={clientId} />
                      <input type="hidden" name="item" value={item} />
                      <input type="hidden" name="state" value={s} />
                      <button
                        type="submit"
                        aria-pressed={now === s}
                        className={`min-h-[38px] rounded-control px-3 text-[13px] transition ${
                          now === s
                            ? s === 'sorted' ? 'bg-ok-wash text-ok'
                              : s === 'needed' ? 'bg-warn-wash text-warn'
                              : 'bg-surface-200 text-ink-mute'
                            : 'text-ink-mute hover:text-ink'
                        }`}
                      >
                        {c.equipment[s]}
                      </button>
                    </form>
                  ))}
                </span>
              ) : (
                <span className={`text-[13.5px] ${
                  now === 'sorted' ? 'text-ok' : now === 'needed' ? 'text-warn' : 'text-ink-mute'
                }`}>
                  {undecided ? c.equipment.undecided : c.equipment[now]}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── the two of them ──────────────────────────────────────────────────────── */

function Couple({ clientId, people }: { clientId: string; people: Person[] }) {
  const by = new Map(people.map((p) => [p.person, p]));

  return (
    <section className="card">
      <div className="flex items-center gap-2 text-accent">
        <Users size={16} strokeWidth={1.5} aria-hidden />
        <h2 className="eyebrow">{c.couple.title}</h2>
      </div>
      <p className="mt-2 text-[13.5px] text-ink-soft">{c.couple.sub}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {(['a', 'b'] as const).map((person) => (
          <Side
            key={person}
            clientId={clientId}
            person={person}
            row={by.get(person)}
          />
        ))}
      </div>
    </section>
  );
}

function Side({ clientId, person, row }: {
  clientId: string; person: 'a' | 'b'; row?: Person;
}) {
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();
  const filled = COUPLE_DETAIL_FIELDS.filter((f) => (row?.fields?.[f] ?? '').trim() !== '').length;

  return (
    <form
      action={(fd) => start(() => { void saveCouple(fd); setSaved(true); })}
      className="rounded-card-sm border border-line bg-surface-100 p-4"
    >
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="person" value={person} />

      <p className="text-[11.5px] tracking-[.14em] text-ink-mute">
        {person === 'a' ? c.couple.personA : c.couple.personB}
      </p>

      <input
        name="name" defaultValue={row?.name} maxLength={120}
        placeholder={c.couple.namePh} aria-label={c.couple.name}
        className="field mt-2 w-full" autoComplete="off"
      />

      <div className="mt-3 space-y-2">
        {COUPLE_DETAIL_FIELDS.map((f) => (
          <label key={f} className="block text-[12.5px] text-ink-mute">
            {f}
            <input
              name={`f:${f}`}
              defaultValue={row?.fields?.[f] ?? ''}
              maxLength={600}
              aria-label={f}
              className="field mt-0.5 w-full"
              autoComplete="off"
            />
          </label>
        ))}
      </div>

      {filled === 0 && <p className="mt-3 text-[12.5px] text-ink-mute">{c.couple.emptyHint}</p>}

      <div className="mt-4 flex items-center justify-end gap-3">
        {saved && <span role="status" className="text-[13px] text-ok">{c.couple.saved}</span>}
        <button type="submit" className="btn-primary">{c.couple.save}</button>
      </div>
    </form>
  );
}
