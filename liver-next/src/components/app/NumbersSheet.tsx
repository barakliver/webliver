import { appCopy } from '@/content/site';
import { DIETS } from '@/content/lists';
import { formatDate } from '@/lib/dates';
import { hhmm, inDayOrder } from '@/lib/runsheet';

const c = appCopy.numbers;

export type SheetGuest = {
  id: string; full_name: string; status: string; party_size: number | null;
  diet: string; table_id: string | null;
};
export type SheetTable = { id: string; name: string; seats: number };
export type SheetMoment = { id: string; at_time: string; title: string; key_moment: boolean | null };
export type SheetArrival = { id: string; name: string; role: string; call_time: string | null };

const dateFmt = new Intl.DateTimeFormat('he-IL', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-[34px] font-light leading-none tabular-nums text-ink">{value}</p>
    </div>
  );
}

const withParty = (g: SheetGuest) =>
  Number(g.party_size || 0) > 1 ? `${g.full_name} (${g.party_size})` : g.full_name;

/**
 * The printable body of the numbers sheet, pure of any data source, so the
 * design harness can look at it with invented rows and the page can hand it
 * real ones. All the arithmetic a supplier cares about lives here: heads,
 * meals, seats, and the two clocks.
 */
export function NumbersSheet({ client, guests, tables, day, arrivals: arrivalsIn, brand }: {
  client: { display_name: string; event_date: string | null; venue: string | null };
  guests: SheetGuest[];
  tables: SheetTable[];
  day: SheetMoment[];
  /** Crew and event vendors, already merged: a call time is a call time. */
  arrivals: SheetArrival[];
  brand: { name: string; tagline?: string };
}) {
  const attending = guests.filter((g) => g.status === 'attending');
  const heads = attending.reduce((n, g) => n + Number(g.party_size || 0), 0);
  const pending = guests.filter((g) => g.status === 'pending').length;
  const declined = guests.filter((g) => g.status === 'declined').length;

  /* Meals, the way a caterer counts them: by heads, not by households. A row's
     diet covers its whole party, which is how the data is entered - a family
     that keeps kosher keeps it together. */
  const dietTally = new Map<string, number>();
  for (const g of attending) {
    if (!g.diet || g.diet === 'none') continue;
    const label = DIETS.find((d) => d.value === g.diet)?.label ?? g.diet;
    dietTally.set(label, (dietTally.get(label) ?? 0) + Number(g.party_size || 0));
  }
  const special = [...dietTally.values()].reduce((a, b) => a + b, 0);

  const byTable = new Map<string, SheetGuest[]>();
  for (const g of attending) {
    if (!g.table_id) continue;
    const list = byTable.get(g.table_id) ?? [];
    list.push(g);
    byTable.set(g.table_id, list);
  }
  const unseated = attending.filter((g) => !g.table_id);

  const moments = inDayOrder(day.filter((d) => d.key_moment && d.at_time));
  const arrivals = inDayOrder(
    arrivalsIn.filter((a) => a.call_time).map((a) => ({ ...a, at_time: a.call_time! }))
  );

  return (
    <div className="sheet-print">
      <header className="border-b-2 border-ink pb-4">
        <h1 className="font-display text-[27px] font-light text-ink">{client.display_name}</h1>
        <p className="mt-1.5 text-[15px] text-ink-soft">
          {formatDate(dateFmt, client.event_date, appCopy.runsheet.noDate)}
          {client.venue ? ` · ${client.venue}` : ''}
        </p>
        <p className="mt-1 text-[14px] font-medium text-accent">{c.title} · {c.sub}</p>
      </header>

      {/* ── how many ──────────────────────────────────────────────────── */}
      <section className="sheet-block mt-8">
        <h2 className="font-display text-[19px] font-light text-ink">{c.counts}</h2>
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          <Stat label={c.heads} value={heads} />
          <Stat label={c.attending} value={attending.length} />
          <Stat label={c.pending} value={pending} />
          <Stat label={c.declined} value={declined} />
        </div>
      </section>

      {/* ── the meals ─────────────────────────────────────────────────── */}
      <section className="sheet-block mt-9">
        <h2 className="font-display text-[19px] font-light text-ink">{c.diet}</h2>
        {heads === 0 ? (
          <p className="mt-3 text-[14.5px] text-ink-mute">{c.dietNone}</p>
        ) : (
          <ul className="mt-3 max-w-md list-none divide-y divide-line border-y border-line p-0 text-[15px]">
            <li className="flex items-baseline justify-between py-2.5">
              <span className="text-ink">{c.dietRegular}</span>
              <span className="tabular-nums text-ink">{heads - special} {c.meals}</span>
            </li>
            {[...dietTally.entries()].map(([label, n]) => (
              <li key={label} className="flex items-baseline justify-between py-2.5">
                <span className="text-ink">{label}</span>
                <span className="tabular-nums text-ink">{n} {c.meals}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── who sits where ────────────────────────────────────────────── */}
      <section className="mt-9">
        <h2 className="font-display text-[19px] font-light text-ink">{c.seating}</h2>
        {tables.length === 0 ? (
          <p className="mt-3 text-[14.5px] text-ink-mute">{c.seatingNone}</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {tables.map((t) => {
              const seated = byTable.get(t.id) ?? [];
              const seats = seated.reduce((n, g) => n + Number(g.party_size || 0), 0);
              return (
                <div key={t.id} className="sheet-block rounded-xl2 border border-line p-4">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-medium text-ink">{t.name}</span>
                    <span className="text-[12.5px] tabular-nums text-ink-mute">
                      {seats} {c.seatedShort} · {t.seats} {c.seatsShort}
                    </span>
                  </p>
                  {seated.length > 0 && (
                    <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                      {seated.map(withParty).join(' · ')}
                    </p>
                  )}
                </div>
              );
            })}
            {unseated.length > 0 && (
              <div className="sheet-block rounded-xl2 border border-dashed border-line-strong p-4">
                <p className="text-[15px] font-medium text-ink">{c.unseated}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                  {unseated.map(withParty).join(' · ')}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── when ──────────────────────────────────────────────────────── */}
      <div className="mt-9 grid gap-9 sm:grid-cols-2">
        <section className="sheet-block">
          <h2 className="font-display text-[19px] font-light text-ink">{c.schedule}</h2>
          {moments.length === 0 ? (
            <p className="mt-3 text-[14.5px] text-ink-mute">{c.scheduleNone}</p>
          ) : (
            <ul className="mt-3 list-none divide-y divide-line border-y border-line p-0">
              {moments.map((m) => (
                <li key={m.id} className="flex items-baseline gap-4 py-2.5 text-[15px]">
                  <span className="w-[46px] shrink-0 tabular-nums text-ink" dir="ltr">{hhmm(m.at_time)}</span>
                  <span className="min-w-0 text-ink">{m.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sheet-block">
          <h2 className="font-display text-[19px] font-light text-ink">{c.arrivals}</h2>
          {arrivals.length === 0 ? (
            <p className="mt-3 text-[14.5px] text-ink-mute">{c.arrivalsNone}</p>
          ) : (
            <ul className="mt-3 list-none divide-y divide-line border-y border-line p-0">
              {arrivals.map((a) => (
                <li key={a.id} className="flex items-baseline gap-4 py-2.5 text-[15px]">
                  <span className="w-[46px] shrink-0 tabular-nums text-ink" dir="ltr">{hhmm(a.at_time)}</span>
                  <span className="min-w-0 text-ink">
                    {a.name}
                    {a.role && <span className="text-ink-mute"> · {a.role}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="mt-10 border-t border-line pt-4 text-[12.5px] text-ink-mute">
        <p>{c.updated}</p>
        <p className="mt-1 text-ink-soft">{brand.name}{brand.tagline ? ` · ${brand.tagline}` : ''}</p>
      </footer>
    </div>
  );
}
