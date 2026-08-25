'use client';

import { MAX_CLIENT_EMAILS } from '@/content/lists';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { inviteToClient, revokeInvite, type ActionResult } from '@/app/actions/clients';
import { appCopy } from '@/content/site';

export type Invite = { id: string; email: string; profile_id: string | null };

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const c = appCopy.clientPage;
  return (
    <button type="submit" className="btn-primary whitespace-nowrap" disabled={pending || disabled}>
      {pending ? c.inviting : c.invite}
    </button>
  );
}

export function InviteBox({ clientId, invites }: { clientId: string; invites: Invite[] }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(inviteToClient, null);
  const c = appCopy.clientPage;
  const full = invites.length >= MAX_CLIENT_EMAILS;

  return (
    <section className="card">
      <h2 className="font-display text-[18px] font-light text-ink">{c.access}</h2>
      <p className="mt-1 text-[14px] text-ink-soft">{c.accessSub}</p>

      <ul className="mt-5 space-y-2">
        {invites.length === 0 && (
          <li className="rounded-none bg-warn-wash px-4 py-3 text-[14px] text-warn">{c.accessNone}</li>
        )}
        {invites.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-none border border-line px-4 py-3">
            <div>
              <span dir="ltr" className="text-[14.5px] font-medium text-ink">{i.email}</span>
              <span className={`mr-2 rounded-none px-2.5 py-0.5 text-[12px] ${
                i.profile_id ? 'bg-ok-wash text-ok' : 'bg-surface-200 text-ink-mute'
              }`}>
                {i.profile_id ? c.joined : c.pendingJoin}
              </span>
            </div>
            <form action={revokeInvite}>
              <input type="hidden" name="invite_id" value={i.id} />
              <input type="hidden" name="client_id" value={clientId} />
              <button type="submit" className="btn-ghost px-4 py-1.5 text-[13.5px]">{c.revoke}</button>
            </form>
          </li>
        ))}
      </ul>

      {state?.ok && (
        <p role="status" className="mt-4 rounded-none bg-ok-wash px-4 py-3 text-[14px] text-ok">{c.invited}</p>
      )}
      {state && !state.ok && state.error && (
        <p role="alert" className="mt-4 rounded-none border border-bad/25 bg-bad-wash px-4 py-3 text-[14px] text-bad">
          {state.error}
        </p>
      )}

      {full ? (
        <p className="mt-4 text-[13.5px] text-ink-mute">{c.full}</p>
      ) : (
        <form action={action} className="mt-4 flex flex-wrap gap-3">
          <input type="hidden" name="client_id" value={clientId} />
          <input
            name="email" type="email" required dir="ltr" autoComplete="off"
            placeholder={c.invitePh} className="field flex-1 min-w-[220px]"
          />
          <Submit disabled={full} />
        </form>
      )}
    </section>
  );
}
