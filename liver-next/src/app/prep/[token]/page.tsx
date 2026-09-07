import type { Metadata } from 'next';
import { supabasePublic } from '@/lib/supabase/public';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentLocale } from '@/lib/serverLocale';
import { prepViewFor } from '@/content/prepView';
import { weekdayDate } from '@/lib/appDates';
import { formatDate } from '@/lib/dates';
import { PrepView, type PrepFace, type PrepLook } from '@/components/PrepView';

export const dynamic = 'force-dynamic';

/**
 * The page a photographer or a stylist opens from a link.
 *
 * Anonymous, like the guests' page and the signing page: a supplier is not
 * going to open an account to look at eight photographs. The token in the path
 * is the credential and `prep_sheet` is the only thing that reads it — an
 * argument to a function rather than a condition inside a policy, which is
 * what makes it a credential at all. A policy asking whether a share exists
 * cannot see which token was presented and answers yes to everybody.
 *
 * A wrong token, a revoked one and an expired one all produce the same quiet
 * page, so nothing is learnable by trying.
 *
 * Never indexed. These are photographs of somebody's family.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

type Sheet = {
  event_name: string; event_date: string | null; venue: string | null;
  producer: string | null; scope: string;
  faces: PrepFace[]; looks: PrepLook[];
};

/**
 * The pictures, signed.
 *
 * The bucket is private, and it stays private: an event's photographs are not
 * something to make world-readable so that a link can work. So the stored
 * paths are exchanged here, on the server, for urls that expire in an hour —
 * long enough to read the page and short enough that a screenshot of the
 * address bar is worth nothing tomorrow.
 *
 * The service-role client is what can sign them, and this is the whole of what
 * it is used for on this route. It never reads a row: `prep_sheet` already
 * decided what this token may see, under the anon key, and handing that
 * decision to a client that bypasses row level security would be handing it to
 * nobody.
 */
async function sign(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const wanted = paths.filter(Boolean);
  if (wanted.length === 0) return out;
  try {
    const { data, error } = await supabaseAdmin().storage.from('files').createSignedUrls(wanted, 60 * 60);
    if (error) { console.error('[prep] signing failed', error); return out; }
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
    }
  } catch (e) {
    console.error('[prep] signing threw', e);
  }
  return out;
}

async function load(token: string): Promise<Sheet | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  try {
    const { data, error } = await supabasePublic().rpc('prep_sheet', { p_token: token });
    if (error) { console.error('[prep] lookup failed', error); return null; }
    const row = (Array.isArray(data) ? data[0] : data) as Sheet | null;
    if (!row) return null;
    return {
      ...row,
      faces: Array.isArray(row.faces) ? row.faces : [],
      looks: Array.isArray(row.looks) ? row.looks : [],
    };
  } catch (e) {
    console.error('[prep] lookup threw', e);
    return null;
  }
}

export default async function PrepPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await currentLocale();
  const c = prepViewFor(locale);
  const sheet = await load(token);

  /* The same page for a token that never existed, one that was revoked and
     one that expired. Three different sentences would be three different
     things to learn by guessing. */
  if (!sheet) {
    return (
      <main id="main" className="shell max-w-lg py-20 text-center">
        <h1 className="font-display text-[24px] font-semibold text-ink">{c.gone}</h1>
        <p className="mt-2 text-[15px] text-ink-soft">{c.goneSub}</p>
      </main>
    );
  }

  const urls = await sign([
    ...sheet.faces.map((f) => f.url ?? ''),
    ...sheet.looks.map((l) => l.url ?? ''),
  ]);
  const signed = <T extends { url: string | null }>(row: T): T =>
    ({ ...row, url: row.url ? urls.get(row.url) ?? null : null });

  return (
    <PrepView
      c={c}
      eventName={sheet.event_name}
      dateLabel={formatDate(weekdayDate(locale), sheet.event_date, c.dateTbd)}
      venue={sheet.venue ?? ''}
      producer={sheet.producer ?? ''}
      faces={sheet.faces.map(signed)}
      looks={sheet.looks.map(signed)}
    />
  );
}
