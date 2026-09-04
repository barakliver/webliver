import { Money } from '@/components/Ltr';
import { formatDate } from '@/lib/dates';
import { longDate, shortDate } from '@/lib/appDates';
import { EVENT_ZONE } from '@/lib/clock';
import type { Locale } from '@/lib/locale';
import type { BookCopy } from '@/content/appUi';

/**
 * The production book: the whole event on paper, in one document.
 *
 * A producer standing at a venue at four in the afternoon does not have six
 * browser tabs. They have a folder. Everything this product knows about an
 * evening lives on eight different screens, and the day it matters most is
 * the one day the screens are the least use — so this gathers all of it into
 * a single document that prints, and stays useful when the phone is in
 * somebody's pocket and the venue's wifi has given up.
 *
 * Printed rather than generated as a PDF, for the same reason the run sheet
 * is: the browser already lays out Hebrew with digits and times correctly on
 * every device, and every print dialog on earth saves to PDF. Reproducing
 * that in a PDF library would be re-solving bidirectional text badly.
 *
 * Producer-only. Half of what is here — supplier balances, crew fees, who has
 * not paid — is the machinery of the job rather than the couple's evening, and
 * the version the couple reads is their own portal.
 *
 * Pure of any data source, so the whole document can be rendered from
 * fixtures and looked at without standing up a database.
 */

export type BookClient = {
  display_name: string;
  event_date: string | null;
  venue: string | null;
  contact_phone?: string;
  contact_email?: string;
};

export type BookVendor = { id: string; name: string; category: string; phone: string; status: string; call_time: string | null };
export type BookCrew = { id: string; name: string; role: string; phone: string; call_time: string | null };
export type BookMoment = { id: string; at_time: string; title: string; note: string; owner: string };
export type BookTask = { id: string; title: string; due_on: string | null; done: boolean };
export type BookPayment = { id: string; title: string; amount: number; due_on: string | null; paid: boolean };
export type BookGuests = { invited: number; coming: number; declined: number; pending: number; heads: number; diets: { label: string; count: number }[] };

export type BookProps = {
  c: BookCopy;
  locale: Locale;
  client: BookClient;
  brand: { name: string; tagline?: string };
  standing: { phase: string; expected: string; behind: number; ahead: number };
  daysToEvent: number | null;
  guests: BookGuests;
  vendors: BookVendor[];
  crew: BookCrew[];
  moments: BookMoment[];
  tasks: BookTask[];
  payments: BookPayment[];
};

/** The clock as written, never reformatted. A time column is the one place in
 *  this document where the stored string is already exactly right. */
const hhmm = (t: string) => t.slice(0, 5);

/** A label from a copy map, falling back to the stored value.
 *
 *  The maps are typed narrowly by the copy system, and what arrives from the
 *  database is a plain string. Rather than casting at four call sites, the
 *  widening happens once here — and an enum that gains a member shows the raw
 *  value on the page instead of a blank cell, which is the failure a producer
 *  can actually report. */
const label = (map: Record<string, string>, key: string) => map[key] ?? key;

/** A sentence with a number in it.
 *
 *  The copy carries the hole rather than a function that fills it, because
 *  this whole copy object also crosses into client components, and a function
 *  cannot make that trip. A guard in the test suite enforces it, and caught
 *  this file trying. */
const fill = (s: string, n: number) => s.replace('{n}', String(n));

/** How far away the wedding is, in the reader's language.
 *
 *  Three sentences rather than one with a sign in it: Hebrew and English put
 *  "ago" at opposite ends, so a single template with a minus in it reads
 *  wrong in one of the two however it is written. */
const whenIs = (c: BookCopy, n: number) =>
  n === 0 ? c.today : n < 0 ? fill(c.daysAgo, Math.abs(n)) : fill(c.days, n);

/** Section heading and a rule, repeated eight times, so they cannot drift. */
function Part({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="print-block mt-8">
      <h2 className="border-b border-ink/20 pb-1.5 font-display text-[17px] font-semibold text-ink">
        {title}
        {count !== undefined && <span className="ms-2 text-[13px] font-normal text-ink-soft">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[13.5px] text-ink-mute">{children}</p>;
}

export function ProductionBook(props: BookProps) {
  const { c, locale, client, brand, standing, daysToEvent, guests, vendors, crew, moments, tasks, payments } = props;

  const long = longDate(locale);
  const short = shortDate(locale);
  const date = formatDate(long, client.event_date, '');
  const openTasks = tasks.filter((t) => !t.done);
  const owed = payments.filter((p) => !p.paid).reduce((n, p) => n + Number(p.amount), 0);
  const paid = payments.filter((p) => p.paid).reduce((n, p) => n + Number(p.amount), 0);

  /* Grouped so a caterer's three lines sit together rather than scattered
     through a list sorted by when somebody happened to type them in. */
  const byCategory = new Map<string, BookVendor[]>();
  for (const v of vendors) {
    const key = v.category || c.uncategorised;
    byCategory.set(key, [...(byCategory.get(key) ?? []), v]);
  }

  /* One clock for everyone who has to be somewhere at a time, because on the
     day nobody cares which table a person was stored in. */
  const arrivals = [
    ...crew.filter((m) => m.call_time).map((m) => ({ id: m.id, name: m.name, role: m.role, phone: m.phone, at: m.call_time! })),
    ...vendors.filter((v) => v.call_time).map((v) => ({ id: v.id, name: v.name, role: v.category, phone: v.phone, at: v.call_time! })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="print-doc mx-auto max-w-[860px] text-ink">
      {/* ── cover ─────────────────────────────────────────────────────────── */}
      <header className="print-block border-b-2 border-ink pb-5">
        <p className="text-[12px] uppercase tracking-[0.14em] text-ink-soft">{brand.name}</p>
        <h1 className="mt-2 font-display text-[30px] font-semibold leading-tight">{client.display_name}</h1>
        <p className="mt-1.5 text-[15px] text-ink-soft">
          {date || c.noDate}
          {client.venue ? ` · ${client.venue}` : ''}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2 text-[13.5px] sm:grid-cols-4">
          <div>
            <dt className="text-ink-mute">{c.countdown}</dt>
            <dd className="font-medium">{daysToEvent === null ? c.noDate : whenIs(c, daysToEvent)}</dd>
          </div>
          <div>
            <dt className="text-ink-mute">{c.stage}</dt>
            <dd className="font-medium">
              {label(c.phase, standing.phase)}
              {standing.behind > 0 && <span className="ms-1.5 text-bad">{fill(c.behind, standing.behind)}</span>}
              {standing.ahead > 0 && <span className="ms-1.5 text-good">{fill(c.ahead, standing.ahead)}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-ink-mute">{c.heads}</dt>
            <dd className="font-medium">{guests.heads}</dd>
          </div>
          <div>
            <dt className="text-ink-mute">{c.suppliers}</dt>
            <dd className="font-medium">{vendors.length}</dd>
          </div>
        </dl>

        {(client.contact_phone || client.contact_email) && (
          <p className="mt-4 text-[13.5px] text-ink-soft">
            {c.reachCouple}: {[client.contact_phone, client.contact_email].filter(Boolean).join(' · ')}
          </p>
        )}
      </header>

      {/* ── who arrives when ──────────────────────────────────────────────── */}
      <Part title={c.arrivals} count={arrivals.length}>
        {arrivals.length === 0 ? <Empty>{c.noArrivals}</Empty> : (
          <table className="mt-3 w-full text-[13.5px]">
            <tbody>
              {arrivals.map((a) => (
                <tr key={a.id} className="print-block border-b border-ink/10">
                  <td className="w-16 py-1.5 font-medium tabular-nums">{hhmm(a.at)}</td>
                  <td className="py-1.5">{a.name}</td>
                  <td className="py-1.5 text-ink-soft">{a.role}</td>
                  <td className="py-1.5 text-end tabular-nums text-ink-soft">{a.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Part>

      {/* ── the running order ─────────────────────────────────────────────── */}
      <Part title={c.runningOrder} count={moments.length}>
        {moments.length === 0 ? <Empty>{c.noOrder}</Empty> : (
          <table className="mt-3 w-full text-[13.5px]">
            <tbody>
              {moments.map((m) => (
                <tr key={m.id} className="print-block border-b border-ink/10 align-top">
                  <td className="w-16 py-1.5 font-medium tabular-nums">{hhmm(m.at_time)}</td>
                  <td className="py-1.5">
                    <span className="font-medium">{m.title}</span>
                    {m.note && <span className="block text-[12.5px] text-ink-soft">{m.note}</span>}
                  </td>
                  <td className="w-28 py-1.5 text-end text-ink-soft">{m.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Part>

      {/* ── suppliers ─────────────────────────────────────────────────────── */}
      <Part title={c.suppliers} count={vendors.length}>
        {vendors.length === 0 ? <Empty>{c.noSuppliers}</Empty> : (
          <div className="mt-3 space-y-4">
            {[...byCategory.entries()].map(([category, list]) => (
              <div key={category} className="print-block">
                <h3 className="text-[12px] uppercase tracking-[0.1em] text-ink-mute">{category}</h3>
                <table className="mt-1 w-full text-[13.5px]">
                  <tbody>
                    {list.map((v) => (
                      <tr key={v.id} className="border-b border-ink/10">
                        <td className="py-1.5 font-medium">{v.name}</td>
                        <td className="py-1.5 text-ink-soft">{label(c.vendorStatus, v.status)}</td>
                        <td className="py-1.5 text-end tabular-nums text-ink-soft">{v.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </Part>

      {/* ── guests ────────────────────────────────────────────────────────── */}
      <Part title={c.guests}>
        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-[13.5px] sm:grid-cols-4">
          <div><dt className="text-ink-mute">{c.invited}</dt><dd className="font-medium">{guests.invited}</dd></div>
          <div><dt className="text-ink-mute">{c.coming}</dt><dd className="font-medium">{guests.coming}</dd></div>
          <div><dt className="text-ink-mute">{c.declined}</dt><dd className="font-medium">{guests.declined}</dd></div>
          <div><dt className="text-ink-mute">{c.pending}</dt><dd className="font-medium">{guests.pending}</dd></div>
        </dl>
        {guests.diets.length > 0 && (
          <p className="mt-3 text-[13.5px] text-ink-soft">
            {c.diets}: {guests.diets.map((d) => `${d.label} ${d.count}`).join(' · ')}
          </p>
        )}
      </Part>

      {/* ── what is still open ────────────────────────────────────────────── */}
      <Part title={c.open} count={openTasks.length}>
        {openTasks.length === 0 ? <Empty>{c.noOpen}</Empty> : (
          <ul className="mt-3 list-none space-y-1.5 p-0 text-[13.5px]">
            {openTasks.map((t) => (
              <li key={t.id} className="print-block flex items-baseline justify-between gap-4 border-b border-ink/10 pb-1.5">
                <span>{t.title}</span>
                <span className="shrink-0 tabular-nums text-ink-soft">{formatDate(short, t.due_on, c.noDue)}</span>
              </li>
            ))}
          </ul>
        )}
      </Part>

      {/* ── money ─────────────────────────────────────────────────────────── */}
      <Part title={c.money}>
        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-[13.5px]">
          <div><dt className="text-ink-mute">{c.paid}</dt><dd className="font-medium"><Money value={paid} /></dd></div>
          <div><dt className="text-ink-mute">{c.owed}</dt><dd className="font-medium"><Money value={owed} /></dd></div>
        </dl>
        {payments.length > 0 && (
          <table className="mt-3 w-full text-[13.5px]">
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="print-block border-b border-ink/10">
                  <td className="py-1.5">{p.title}</td>
                  <td className="py-1.5 text-ink-soft">{p.paid ? c.paid : formatDate(short, p.due_on, c.noDue)}</td>
                  <td className="py-1.5 text-end font-medium"><Money value={Number(p.amount)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Part>

      {/* ── signature ─────────────────────────────────────────────────────── */}
      <footer className="print-block mt-10 border-t border-ink/20 pt-3 text-[12px] text-ink-mute">
        {/* The paper carries the producer's business, never the platform's:
            what a venue manager holds is their supplier's stationery. The
            printing date is on it because a production book is out of date
            the moment somebody books a florist, and a sheet in a folder with
            no date on it is one nobody can tell is stale. */}
        {brand.name}
        {brand.tagline ? ` · ${brand.tagline}` : ''}
        {' · '}
        {c.printedOn} {new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
          dateStyle: 'short', timeStyle: 'short', timeZone: EVENT_ZONE,
        }).format(new Date())}
      </footer>
    </div>
  );
}
