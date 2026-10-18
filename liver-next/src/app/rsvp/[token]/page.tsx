import type { Metadata } from 'next';
import { formatDate, daysUntil } from '@/lib/dates';
import { CountUp } from '@/components/guest/CountUp';
import { supabaseServer } from '@/lib/supabase/server';
import { getSiteCopy } from '@/lib/siteCopy';
import { supabasePublic } from '@/lib/supabase/public';
import { brandForHost } from '@/lib/branding';
import { rsvpFor } from '@/content/ui';
import { currentLocale } from '@/lib/serverLocale';
import { RsvpForm } from './RsvpForm';
import { EVENT_ZONE } from '@/lib/clock';

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
  timeZone: EVENT_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
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
  const left = guest ? daysUntil(guest.event_date) : null;

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-14">
      <div className="w-full max-w-lg">
        <p className="mb-6 text-center font-display text-subhead font-normal text-ink">{brandLine}</p>

        {!guest ? (
          <div className="card text-center">
            <h1 className="font-display text-title font-light text-ink">{rsvpCopy.badLink}</h1>
            <p className="mt-3 text-lead leading-relaxed text-ink-soft">{rsvpCopy.badLinkBody}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-panel border border-line-soft bg-card">
            {/* The invitation as an object: their names on the band, the day and
                the place under them, and the days left as the one number that
                counts up when the page opens. The form is the lower half of the
                same thing and not a second card under it. */}
            <header className="band-dark px-6 py-8 text-center sm:px-8 sm:py-10">
              <p className="animate-rise text-body text-accent-light">
                {rsvpCopy.hello} <bdi>{guest.guest_name}</bdi>, {rsvpCopy.invitedTo}
              </p>
              <h1 className="animate-rise mt-2 font-display text-display font-light leading-[1.1]" style={{ animationDelay: '.1s' }}>
                {guest.event_name}
              </h1>
              {(guest.event_date || guest.venue) && (
                <p className="animate-rise mt-3 text-body text-accent-light" style={{ animationDelay: '.2s' }}>
                  {formatDate(dateFmt, guest.event_date, '')}
                  {guest.event_date && guest.venue ? ' · ' : ''}
                  {guest.venue}
                </p>
              )}
              {left !== null && left > 0 && (
                <p className="mt-5 flex items-end justify-center gap-3">
                  <span className="font-display text-[56px] font-light leading-[.9] text-accent-light"><CountUp n={left} /></span>
                  <span className="pb-1 text-body text-accent-light">{rsvpCopy.daysLeft}</span>
                </p>
              )}
              {left === 0 && <p className="mt-5 font-display text-panel font-light text-accent-light">{rsvpCopy.today}</p>}
            </header>

            <RsvpForm
              token={token}
              copy={rsvpCopy}
              event={{ name: guest.event_name, date: guest.event_date, venue: guest.venue }}
              initial={{
                status: guest.status,
                partySize: guest.party_size,
                diet: guest.diet,
                note: guest.note,
                responded: guest.responded,
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}
