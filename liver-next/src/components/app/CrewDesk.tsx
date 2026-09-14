'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, ChevronDown, Mail, Phone, Plus, Search, Send, TriangleAlert, UserPlus, Wallet, X } from 'lucide-react';
import {
  addCrewMember, updateCrewMember, archiveCrewMember, inviteCrewMember,
  type CrewMemberResult,
} from '@/app/actions/crewMembers';
import { CREW_SLOTS, type CrewSlot } from '@/lib/crewNeeds';
import { useCopy } from '@/components/app/CopyProvider';
import { Ltr, Money } from '@/components/Ltr';

export type CrewPerson = {
  id: string;
  name: string;
  phone: string;
  email: string;
  roles: string[];
  notes: string;
  /** What this person usually costs for an evening, or null when nobody has
   *  agreed one yet. Null is a real answer and stays one. */
  rate: number | string | null;
  archived_at: string | null;
  /** How many events this person is on. Read once on the server rather than
   *  counted here, so the row can say it without a second request. */
  events?: number;
  /** Everything they have been paid across all of it. Producer-only, like
   *  every other fee in this product: the crew's own two functions in 0091
   *  select neither the fee nor the rate. */
  earned?: number;
  /** How many nights they are booked twice on. */
  clashes?: number;
  /** Whether this person has ever signed in, so the invitation can be seen to
   *  have worked rather than assumed to have. */
  signedIn?: boolean;
};

/** The three roles, in their fixed order, with the words for them. */
function useSlotLabels(): Record<CrewSlot, string> {
  const c = useCopy().crew;
  return { manager: c.slotManager, assistant: c.slotAssistant, social: c.slotSocial };
}

function Save() {
  const c = useCopy().crew;
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? c.saving : c.save}
    </button>
  );
}

function Alert({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
      {text}
    </p>
  );
}

/* The roles as tick boxes rather than a dropdown, because the answer is
   several of them at once: the same person runs a small evening and assists
   on a big one, and a control that only takes one answer would make somebody
   choose which half of the truth to save. */
function RolePicker({ chosen }: { chosen?: string[] }) {
  const c = useCopy().crew;
  const labels = useSlotLabels();
  return (
    <fieldset className="min-w-0">
      <legend className="label">{c.deskRoles}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {CREW_SLOTS.map((s) => (
          <label
            key={s}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl2 border border-line-soft
                       bg-surface-100 px-3 py-2 text-[14px] text-ink-soft transition-colors
                       hover:border-accent/40 has-[:checked]:border-accent has-[:checked]:bg-accent-wash has-[:checked]:text-ink"
          >
            <input
              type="checkbox" name="roles" value={s}
              defaultChecked={chosen?.includes(s)}
              className="size-4 accent-[var(--accent)]"
            />
            {labels[s]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Fields({ person }: { person?: CrewPerson }) {
  const c = useCopy().crew;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor={`n-${person?.id ?? 'new'}`}>{c.name}</label>
          <input
            id={`n-${person?.id ?? 'new'}`} name="name" required defaultValue={person?.name}
            autoComplete="off" className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor={`p-${person?.id ?? 'new'}`}>{c.phone}</label>
          <input
            id={`p-${person?.id ?? 'new'}`} name="phone" type="tel" defaultValue={person?.phone}
            autoComplete="off" className="field" dir="ltr"
          />
        </div>
        <div>
          <label className="label" htmlFor={`e-${person?.id ?? 'new'}`}>{c.deskEmail}</label>
          <input
            id={`e-${person?.id ?? 'new'}`} name="email" type="email" defaultValue={person?.email}
            autoComplete="off" className="field" dir="ltr"
          />
        </div>
        {/* The usual rate, which the assignment takes a copy of. Blank is a
            real answer: plenty of a crew is on a day rate agreed by message
            and not written down yet, and a field that insists on a number is
            a field that gets a made-up one. */}
        <div>
          <label className="label" htmlFor={`r-${person?.id ?? 'new'}`}>{c.deskRate}</label>
          <input
            id={`r-${person?.id ?? 'new'}`} name="rate" type="number" min="0" step="50"
            defaultValue={person?.rate === null || person?.rate === undefined ? '' : String(person.rate)}
            placeholder={c.feePh} autoComplete="off" className="field" inputMode="numeric"
          />
          <p className="mt-1 text-[12px] text-ink-mute">{c.deskRateHint}</p>
        </div>
      </div>

      <RolePicker chosen={person?.roles} />

      <div>
        <label className="label" htmlFor={`o-${person?.id ?? 'new'}`}>{c.notes}</label>
        <textarea
          id={`o-${person?.id ?? 'new'}`} name="notes" rows={2} defaultValue={person?.notes}
          className="field"
        />
      </div>
    </div>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const c = useCopy().crew;
  const [state, action] = useActionState<CrewMemberResult | null, FormData>(
    async (prev, form) => {
      const r = await addCrewMember(prev, form);
      if (r.ok) onDone();
      return r;
    }, null,
  );
  return (
    <form action={action} className="card mt-4 p-4 sm:p-5">
      <Fields />
      {state?.error && <Alert text={state.error} />}
      <div className="mt-4 flex flex-wrap gap-2">
        <Save />
        <button type="button" onClick={onDone} className="btn-ghost">{c.cancel}</button>
      </div>
    </form>
  );
}

function EditForm({ person }: { person: CrewPerson }) {
  const c = useCopy().crew;
  const [state, action] = useActionState<CrewMemberResult | null, FormData>(updateCrewMember, null);
  return (
    <>
      <form action={action} className="mt-4">
        <input type="hidden" name="member_id" value={person.id} />
        <Fields person={person} />
        {state?.error && <Alert text={state.error} />}
        <div className="mt-4"><Save /></div>
      </form>

      <div className="mt-3 border-t border-line-soft pt-3">
        <InviteButton person={person} />
      </div>

      {/* Retire rather than delete, which is why this is not a delete dialog:
          nothing is lost and last August's event keeps its crew. */}
      <form action={archiveCrewMember} className="mt-2">
        <input type="hidden" name="member_id" value={person.id} />
        <input type="hidden" name="archived" value={person.archived_at ? '0' : '1'} />
        <button type="submit" className="btn-ghost text-[13.5px]">
          {person.archived_at ? c.deskRestore : c.deskArchive}
        </button>
      </form>
    </>
  );
}

/* The invitation, which is only ever an invitation: no token, nothing that
   expires, and nothing that works if it is forwarded. It can be sent again as
   often as he likes, which is why the button stays after it succeeds. */
/* Its own component so `useFormStatus` reads the form it is inside, which is
   the only place that hook answers anything. */
function SendInvite({ sent, disabled }: { sent: boolean; disabled: boolean }) {
  const c = useCopy().crew;
  const { pending } = useFormStatus();
  return (
    <button
      type="submit" className="btn-ghost inline-flex items-center gap-1.5 text-[13.5px]"
      disabled={pending || disabled}
    >
      <Send size={14} aria-hidden strokeWidth={1.5} />
      {pending ? c.inviteSending : sent ? c.inviteAgain : c.invite}
    </button>
  );
}

function InviteButton({ person }: { person: CrewPerson }) {
  const c = useCopy().crew;
  const [state, action] = useActionState<CrewMemberResult | null, FormData>(inviteCrewMember, null);
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="member_id" value={person.id} />
      <SendInvite sent={!!state?.ok} disabled={!person.email} />
      {state?.ok && (
        <span className="inline-flex items-center gap-1 text-[13px] text-good">
          <Check size={14} aria-hidden strokeWidth={1.5} />{c.inviteSent}
        </span>
      )}
      {state?.error && <span className="text-[13px] text-bad">{state.error}</span>}
      {!person.email && <span className="text-[13px] text-ink-mute">{c.inviteNoEmail}</span>}
    </form>
  );
}

function RoleBadges({ roles }: { roles: string[] }) {
  const c = useCopy().crew;
  const labels = useSlotLabels();
  const known = CREW_SLOTS.filter((s) => roles.includes(s));
  if (known.length === 0) {
    return <span className="text-[13px] text-ink-mute">{c.deskRolesNone}</span>;
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {known.map((s) => (
        <span
          key={s}
          className="inline-flex items-center rounded-xl2 bg-accent-wash px-2 py-0.5 text-[12.5px] text-accent"
        >
          {labels[s]}
        </span>
      ))}
    </span>
  );
}

function PersonRow({ person }: { person: CrewPerson }) {
  const c = useCopy().crew;
  return (
    <li data-crew={`${person.name} ${person.phone} ${person.email}`}>
      <details className="card group p-0">
        <summary
          className="flex cursor-pointer list-none items-start justify-between gap-4 p-4 sm:p-5
                     [&::-webkit-details-marker]:hidden"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[17px] font-semibold text-ink">{person.name}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <RoleBadges roles={person.roles} />
              {/* The clash, on the person rather than only in the list above:
                  this is the row somebody opens to fix it. */}
              {!!person.clashes && person.clashes > 0 && (
                <span className="inline-flex items-center gap-1 rounded-xl2 bg-bad-wash px-2 py-0.5 text-[12.5px] text-bad">
                  <TriangleAlert size={12} aria-hidden strokeWidth={1.5} />
                  {c.clashBadge}
                </span>
              )}
              {person.email && (
                <span className={`text-[12.5px] ${person.signedIn ? 'text-good' : 'text-ink-mute'}`}>
                  {person.signedIn ? c.deskSignedIn : c.deskNotSignedIn}
                </span>
              )}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-mute">
              {person.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={13} aria-hidden strokeWidth={1.5} />
                  <Ltr>{person.phone}</Ltr>
                </span>
              )}
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Mail size={13} aria-hidden strokeWidth={1.5} />
                {person.email ? <Ltr>{person.email}</Ltr> : c.deskNoEmail}
              </span>
              {typeof person.earned === 'number' && person.earned > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <dfn className="not-italic text-ink-mute">{c.deskEarned}</dfn>
                  <Money value={person.earned} />
                </span>
              )}
              {person.rate !== null && person.rate !== undefined && (
                <span className="inline-flex items-center gap-1.5">
                  <Wallet size={13} aria-hidden strokeWidth={1.5} />
                  <Money value={Number(person.rate)} />
                </span>
              )}
              {typeof person.events === 'number' && (
                <span>
                  {person.events > 0 ? `${person.events} ${c.deskEvents}` : c.deskNoEvents}
                </span>
              )}
            </span>
          </span>
          <ChevronDown
            size={18} strokeWidth={1.5} aria-hidden
            className="mt-1 shrink-0 text-ink-mute transition-transform duration-200 group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-line-soft px-4 pb-4 sm:px-5 sm:pb-5">
          <EditForm person={person} />
        </div>
      </details>
    </li>
  );
}

/**
 * The producer's own crew, as a list of people rather than a list of evenings.
 *
 * Everything here exists so that putting Tal on an event is one press instead
 * of typing her name and number again. The rows are closed at rest and say
 * what they are: the name, the roles she can fill, how to reach her, and how
 * many events she is already on. Opening one is how you edit it.
 */
export function CrewDesk({ people }: { people: CrewPerson[] }) {
  const c = useCopy().crew;
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');

  const live = useMemo(() => people.filter((p) => !p.archived_at), [people]);
  const archived = useMemo(() => people.filter((p) => p.archived_at), [people]);

  /* Every word has to appear somewhere in the row, in any order, so "טל 052"
     finds her and so does "052 טל". Matching the whole query as one string
     would fail on the second. */
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return live;
    return live.filter((p) => {
      const hay = `${p.name} ${p.phone} ${p.email}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [live, q]);

  return (
    <section aria-labelledby="crew-desk">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="crew-desk" className="font-display text-[22px] font-semibold text-ink">{c.deskTitle}</h2>
          <p className="mt-1 text-[14px] text-ink-soft">{c.deskSub}</p>
        {/* Said out loud, because it is the one thing on this screen somebody
            would otherwise have to assume. */}
        <p className="mt-1 text-[12.5px] text-ink-mute">{c.deskMoneyPrivate}</p>
        </div>
        <button
          type="button" onClick={() => setAdding((v) => !v)}
          className="btn-primary inline-flex items-center gap-2"
          aria-expanded={adding}
        >
          {adding ? <X size={16} aria-hidden strokeWidth={1.5} /> : <Plus size={16} aria-hidden strokeWidth={1.5} />}
          {adding ? c.close : c.deskAdd}
        </button>
      </header>

      {adding && <AddForm onDone={() => setAdding(false)} />}

      {/* Always, now. It was hidden below six people on the theory that a
          short list finds itself, which is true until the day it is not and
          somebody has learnt there is no search here. */}
      {live.length > 0 && (
        <div className="relative mt-5">
          <Search
            size={16} strokeWidth={1.5} aria-hidden
            className="pointer-events-none absolute inset-y-0 my-auto start-3.5 text-ink-mute"
          />
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)}
            aria-label={c.deskSearch} placeholder={c.deskSearchPh}
            className="field ps-10 [&::-webkit-search-cancel-button]:appearance-none"
          />
        </div>
      )}

      {live.length === 0 ? (
        <div className="card mt-5 p-6 text-center">
          <UserPlus size={22} strokeWidth={1.5} aria-hidden className="mx-auto text-ink-mute" />
          <p className="mt-3 text-[15px] text-ink">{c.deskNone}</p>
          <p className="mt-1 text-[13.5px] text-ink-mute">{c.deskNoneHint}</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-5 text-[14px] text-ink-mute">{c.deskNoMatch}</p>
      ) : (
        /* The list folds too. Fifteen people is a long way to scroll past on
           the way to the season board, and the row says how many are inside
           so closing it hides nothing. Open by default: this is the screen
           they are the subject of. */
        <details open className="group/list mt-5">
          <summary
            className="flex cursor-pointer list-none items-center gap-3 py-1
                       [&::-webkit-details-marker]:hidden"
          >
            <span className="font-display text-[16px] font-semibold text-ink">{c.deskPeople}</span>
            <span className="text-[13px] text-ink-mute"><Ltr>{String(shown.length)}</Ltr></span>
            <ChevronDown
              size={17} strokeWidth={1.5} aria-hidden
              className="shrink-0 text-ink-mute transition-transform duration-200 group-open/list:rotate-180"
            />
          </summary>
          <ul id="crew-list" className="mt-3 list-none space-y-3 p-0">
            {shown.map((p) => <PersonRow key={p.id} person={p} />)}
          </ul>
        </details>
      )}

      {archived.length > 0 && (
        <details className="group mt-8">
          <summary
            className="flex cursor-pointer list-none items-center gap-3 py-1
                       [&::-webkit-details-marker]:hidden"
          >
            <span className="font-display text-[17px] font-semibold text-ink">{c.deskArchivedTitle}</span>
            <span className="text-[13px] text-ink-mute">{archived.length}</span>
            <ChevronDown
              size={18} strokeWidth={1.5} aria-hidden
              className="shrink-0 text-ink-mute transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <p className="mt-1 text-[13.5px] text-ink-mute">{c.deskArchivedSub}</p>
          <ul className="mt-3 list-none space-y-3 p-0">
            {archived.map((p) => <PersonRow key={p.id} person={p} />)}
          </ul>
        </details>
      )}
    </section>
  );
}
