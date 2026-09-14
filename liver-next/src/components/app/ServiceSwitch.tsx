'use client';

import { useState } from 'react';
import { setClientService } from '@/app/actions/clients';
import { useCopy } from '@/components/app/CopyProvider';
import { SERVICES, type Service } from '@/lib/eventGroups';

/**
 * The whole production, or the evening itself.
 *
 * Beside the event's colour and above the sections, for the reason the colour
 * is there: what kind of engagement this is does not belong to any one tab of
 * the file. It governs the whole of it — what the list calls this event, which
 * group it is filed under, and what the producer expects of himself when he
 * opens it.
 *
 * A switch rather than a choice made once at the start, because a couple who
 * booked the evening and later asked for the year is one press and not a new
 * file. It is two words on a segmented control, not a dialog: nothing is
 * destroyed, nothing moves, and pressing the other one puts it back.
 */
export function ServiceSwitch({ clientId, service }: { clientId: string; service: Service }) {
  const c = useCopy().statusBoard;
  const label: Record<Service, string> = {
    production: c.serviceProduction,
    management: c.serviceManagement,
  };
  /* The press answers before the server does, the same as every other control
     in here: this one revalidates three paths, and a segment that looks
     unchanged for a second gets pressed again. */
  const [shown, setShown] = useState<Service | null>(null);
  const now = shown ?? service;

  return (
    <div
      role="group"
      aria-label={useCopy().clientPage.service}
      className="inline-flex rounded-xl2 border border-line bg-surface-100 p-1 text-[13.5px]"
    >
      {SERVICES.map((s) => {
        const on = s === now;
        return (
          <form
            key={s}
            action={async (data: FormData) => { setShown(s); await setClientService(data); }}
          >
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="service" value={s} />
            <button
              type="submit"
              aria-pressed={on}
              className={`min-h-[40px] rounded-xl2 px-3.5 transition ${
                on ? 'bg-card font-medium text-ink' : 'text-ink-mute hover:text-ink'
              }`}
            >
              {label[s]}
            </button>
          </form>
        );
      })}
    </div>
  );
}
