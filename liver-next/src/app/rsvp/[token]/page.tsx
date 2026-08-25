import type { Metadata } from 'next';
import { formatDate } from '@/lib/dates';
import { supabaseServer } from '@/lib/supabase/server';
import { site, rsvpCopy } from '@/content/site';
import { RsvpForm } from './RsvpForm';

export const dynamic = 'force-dynamic';
/* A guest list is nobody's business but the couple's, and an invitation link
   is a credential, so this page must never be indexed or cached anywhere. */
export const metadata: Metadata = {
  title: rsvpCopy.eyebrow,
  robots: { index: false, follow: false, nocache: true },
};

const dateFmt = new Intl.DateTimeFormat('he-IL', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

type Lookup = {
  guest_name: string; event_name: string; event_date: string | null; venue: string;
  status: string; party_size: number; diet: string; note: string; responded: boolean;
};

export default async function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const sb = await supabaseServer();
  const { data } = await sb.rpc('rsvp_lookup', { p_token: token });
  const guest = (Array.isArray(data) ? data[0] : null) as Lookup | null;

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-14">
      <div className="w-full max-w-lg">
        <p className="mb-6 text-center font-display text-[19px] font-light text-ink">{site.brand}</p>

        {!guest ? (
          <div className="card text-center">
            <h1 className="font-display text-title font-light text-ink">{rsvpCopy.badLink}</h1>
            <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">{rsvpCopy.badLinkBody}</p>
          </div>
        ) : (
          <>
            <header className="mb-6 text-center">
              <p className="eyebrow">{rsvpCopy.eyebrow}</p>
              <h1 className="mt-2 font-display text-title font-light text-ink">
                {rsvpCopy.hello} {guest.guest_name}
              </h1>
              <p className="mt-3 text-[16px] text-ink-soft">
                {rsvpCopy.invitedTo}
                <b className="text-ink"> {guest.event_name}</b>
              </p>
              {(guest.event_date || guest.venue) && (
                <p className="mt-1 text-[14.5px] text-ink-mute">
                  {formatDate(dateFmt, guest.event_date, '')}
                  {guest.event_date && guest.venue ? ' · ' : ''}
                  {guest.venue}
                </p>
              )}
            </header>

            <RsvpForm
              token={token}
              initial={{
                status: guest.status,
                partySize: guest.party_size,
                diet: guest.diet,
                note: guest.note,
                responded: guest.responded,
              }}
            />
          </>
        )}
      </div>
    </main>
  );
}
