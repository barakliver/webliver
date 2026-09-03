import type { Metadata } from 'next';
import { formatDate } from '@/lib/dates';
import { supabaseServer } from '@/lib/supabase/server';
import { getSiteCopy } from '@/lib/siteCopy';
import { supabasePublic } from '@/lib/supabase/public';
import { brandForHost } from '@/lib/branding';
import { rsvpFor } from '@/content/ui';
import { currentLocale } from '@/lib/serverLocale';
import { RsvpForm } from './RsvpForm';

export const dynamic = 'force-dynamic';
/* A guest list is nobody's business but the couple's, and an invitation link
   is a credential, so this page must never be indexed or cached anywhere. */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: rsvpFor(await currentLocale()).eyebrow,
    robots: { index: false, follow: false, nocache: true },
  };
}

/* The long, written out date, in the language the guest is reading. Never
   wrapped in an ltr isolate: `15 באוקטובר 2025` comes out as
   `באוקטובר 2025 15` the moment it is. */
const dateFmtFor = (locale: string) => new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'he-IL', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

type Lookup = {
  guest_name: string; event_name: string; event_date: string | null; venue: string;
  status: string; party_size: number; diet: string; note: string; responded: boolean;
};

export default async function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const locale = await currentLocale();
  const rsvpCopy = rsvpFor(locale);
  const site = await getSiteCopy(supabasePublic(), locale);
  /* The name at the head of the invitation. A guest on a tenant's domain is a
     guest of that tenant's couple; the platform's name means nothing to them. */
  const host = await brandForHost();
  const brandLine = host.isPlatform ? site.brand : host.name;
  const dateFmt = dateFmtFor(locale);

  const sb = await supabaseServer();
  const { data } = await sb.rpc('rsvp_lookup', { p_token: token });
  const guest = (Array.isArray(data) ? data[0] : null) as Lookup | null;

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-14">
      <div className="w-full max-w-lg">
        <p className="mb-6 text-center font-display text-[19px] font-semibold text-ink">{brandLine}</p>

        {!guest ? (
          <div className="card text-center">
            <h1 className="font-display text-title font-semibold text-ink">{rsvpCopy.badLink}</h1>
            <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">{rsvpCopy.badLinkBody}</p>
          </div>
        ) : (
          <>
            <header className="mb-6 text-center">
              <p className="eyebrow">{rsvpCopy.eyebrow}</p>
              <h1 className="mt-2 font-display text-title font-semibold text-ink">
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
              copy={rsvpCopy}
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
