import type { Metadata } from 'next';
import { supabasePublic } from '@/lib/supabase/public';
import { currentLocale } from '@/lib/serverLocale';
import { guestSiteFor } from '@/content/ui';
import { weekdayDate } from '@/lib/appDates';
import { formatDate } from '@/lib/dates';
import { GuestSiteView, type GuestSite } from '@/components/guest/GuestSiteView';

export const dynamic = 'force-dynamic';

/**
 * The guests' page.
 *
 * Anonymous by definition: the address is pasted into a family group and
 * opened by two hundred people who have no account. The token in the path is
 * the credential, the database function behind it answers only for a page
 * that is switched on, and a wrong or switched-off token gets the same quiet
 * "not available" so nothing can be learned by guessing.
 *
 * Never indexed. A wedding invitation is not a web page anybody should find
 * by searching for the couple's names.
 */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const locale = await currentLocale();
  const site = await load(token);
  const c = guestSiteFor(locale);
  if (!site) {
    return { title: c.gone, robots: { index: false, follow: false, nocache: true } };
  }

  /* The card WhatsApp draws under the link when it is pasted into a group.
     Names as the title, the date and the venue as the line under it, and no
     image: the platform's share image is somebody else's wedding. */
  const when = formatDate(weekdayDate(locale), site.event_date, c.dateTbd);
  const description = [when, site.venue?.trim()].filter(Boolean).join(' · ');
  return {
    title: site.event_name,
    description,
    robots: { index: false, follow: false, nocache: true },
    openGraph: { type: 'website', title: site.event_name, description, siteName: site.event_name },
    twitter: { card: 'summary', title: site.event_name, description },
  };
}

async function load(token: string): Promise<GuestSite | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  try {
    const { data, error } = await supabasePublic().rpc('guest_site', { p_token: token });
    if (error) { console.error('[guest site] lookup failed', error); return null; }
    const row = (Array.isArray(data) ? data[0] : data) as (Omit<GuestSite, 'moments'> & { moments: unknown }) | null;
    if (!row) return null;
    const moments = Array.isArray(row.moments)
      ? (row.moments as { at?: unknown; title?: unknown }[])
          .filter((m) => typeof m.at === 'string' && typeof m.title === 'string')
          .map((m) => ({ at: String(m.at), title: String(m.title) }))
      : [];
    return { ...row, note: row.note ?? '', producer: row.producer ?? '', moments };
  } catch (e) {
    console.error('[guest site] lookup threw', e);
    return null;
  }
}

export default async function GuestSitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await currentLocale();
  const c = guestSiteFor(locale);
  const site = await load(token);

  if (!site) {
    return (
      <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-14">
        <div className="card w-full max-w-md text-center">
          <h1 className="font-display text-title font-light text-ink">{c.gone}</h1>
          <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">{c.goneBody}</p>
        </div>
      </main>
    );
  }

  return <GuestSiteView site={site} token={token} c={c} locale={locale} />;
}
