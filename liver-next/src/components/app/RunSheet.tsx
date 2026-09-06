import { hhmm, spanOf, humanSpan, crossesMidnight, eventMinutes } from '@/lib/runsheet';

/**
 * The page somebody holds at eleven at night.
 *
 * This is not the production book and not the numbers sheet. Those are read
 * sitting down, weeks out, in daylight. This one is carried: held in one hand
 * in a hall that has been dimmed for the first dance, glanced at between two
 * conversations, and marked with a pen.
 *
 * Everything here follows from that and from nothing else.
 *
 *   The clock is the biggest thing on the page. It is what somebody looks for
 *   when they glance down, and a 17px time read at arm's length under venue
 *   lighting is the reason people go back to writing their own.
 *
 *   Every line has a box to tick. A run sheet is worked through, not read,
 *   and a printed page with nothing to mark is a page somebody stops looking
 *   at halfway through the evening because they have lost their place.
 *
 *   The phone numbers are on the same sheet. At 23:40 the question is never
 *   "who is the caterer", it is "what is the caterer's number", and having
 *   that answer on a second piece of paper means it is in a folder in a car.
 *
 * Pure of any data source, like the other two documents, so it can be looked
 * at without a database — which is how the things above were found.
 */

export type SheetLine = {
  id: string;
  at_time: string;
  title: string;
  note: string;
  owner: string;
  audience: string[];
};

export type SheetContact = { id: string; name: string; role: string; phone: string; at: string | null };

export type RunSheetCopy = {
  noDate: string;
  sheetFor: string;
  everyone: string;
  pastMidnight: string;
  owner: string;
  empty: string;
  emptyForRole: string;
  printedOn: string;
  contacts: string;
  noContacts: string;
};

export function RunSheet({
  c, client, brand, lines, contacts, roleLabel, staffVisible, dateLabel, audienceLabel, printedLabel,
}: {
  c: RunSheetCopy;
  client: { display_name: string; venue: string | null };
  brand: { name: string; tagline?: string };
  lines: SheetLine[];
  /** Producer-side only. A couple holding this sheet does not get everybody's
   *  mobile number, which is a staffing list rather than their evening. */
  contacts: SheetContact[];
  roleLabel?: string;
  staffVisible: boolean;
  dateLabel: string;
  audienceLabel: (value: string) => string;
  printedLabel: string;
}) {
  const wraps = crossesMidnight(lines.map((l) => l.at_time));
  const ordered = [...lines].sort(
    (a, b) => eventMinutes(a.at_time, wraps) - eventMinutes(b.at_time, wraps),
  );

  const withTimes = contacts.filter((p) => p.phone);
  const callWraps = crossesMidnight(withTimes.map((p) => p.at ?? '').filter(Boolean));
  const people = [...withTimes].sort((a, b) => {
    if (!a.at) return 1;
    if (!b.at) return -1;
    return eventMinutes(a.at, callWraps) - eventMinutes(b.at, callWraps);
  });

  return (
    <div className="print-doc">
      <header className="print-block border-b-2 border-ink pb-4">
        <p className="text-[12px] uppercase tracking-[0.14em] text-ink-soft">{brand.name}</p>
        <h1 className="mt-1.5 font-display text-[27px] font-semibold text-ink">{client.display_name}</h1>
        <p className="mt-1.5 text-[15px] text-ink-soft">
          {dateLabel || c.noDate}
          {client.venue ? ` · ${client.venue}` : ''}
        </p>
        <p className="mt-1 text-[14px] font-medium text-accent">
          {c.sheetFor} {roleLabel ?? c.everyone}
          {ordered.length > 0 && (
            <span className="text-ink-mute">
              {' · '}
              <span dir="ltr">{hhmm(ordered[0].at_time)}–{hhmm(ordered[ordered.length - 1].at_time)}</span>
              {wraps ? ` ${c.pastMidnight}` : ''}
            </span>
          )}
        </p>
      </header>

      {ordered.length === 0 ? (
        <p className="mt-8 text-[15px] text-ink-mute">{lines.length === 0 ? c.empty : c.emptyForRole}</p>
      ) : (
        <ol className="mt-5">
          {ordered.map((i, index) => {
            const span = spanOf(ordered, index);
            return (
              <li key={i.id} className="print-block flex items-start gap-4 border-b border-line py-3 last:border-0">
                {/* A real box, drawn rather than a character, so it survives a
                    printer that has never heard of the font it was set in. */}
                <span
                  aria-hidden
                  className="mt-1 h-[19px] w-[19px] shrink-0 rounded-[3px] border-[1.5px] border-ink/50"
                />

                {/* Left to right inside a right-to-left page, because a clock
                    reads that way in every language. */}
                <span className="w-[86px] shrink-0 text-center" dir="ltr">
                  <span className="block font-display text-[23px] font-semibold leading-none tabular-nums text-ink">
                    {hhmm(i.at_time)}
                  </span>
                  {/* Two corrections to one small line. It is kept on a single
                      line, because a duration like "שעה ורבע" wrapped under the
                      clock and made every row taller than it needed to be —
                      which on a document measured in pages is what turned one
                      page into one page and an orphan line. And it is put back
                      into Hebrew: the column above is dir="ltr" because a clock
                      reads that way in every language, and the duration
                      inherited it, which threw the leading number to the wrong
                      end. Measured 111px out of place before this attribute. */}
                  {span.minutes !== null && (
                    <span dir="rtl" className="mt-1 block whitespace-nowrap text-[11.5px] tabular-nums text-ink-mute">
                      {span.stated ? humanSpan(span.minutes) : `↓ ${humanSpan(span.minutes)}`}
                    </span>
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[17px] leading-snug text-ink">{i.title}</p>
                  {i.note && <p className="mt-0.5 text-[14px] leading-snug text-ink-soft">{i.note}</p>}
                  {staffVisible && i.owner && (
                    <p className="mt-0.5 text-[13px] text-ink-mute">{c.owner}: {i.owner}</p>
                  )}
                </div>

                {i.audience.length > 0 && (
                  <span className="shrink-0 self-start text-[12.5px] text-ink-mute">
                    {i.audience.map(audienceLabel).join(' · ')}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* The numbers, on the same sheet as the evening they belong to. Kept to
          the end because it is looked up rather than read, and started on a
          fresh page so a call list is never split in half. */}
      {staffVisible && (
        <section className="print-block mt-7">
          <h2 className="border-b border-ink/20 pb-1.5 font-display text-[16px] font-semibold text-ink">
            {c.contacts}
          </h2>
          {people.length === 0 ? (
            <p className="mt-3 text-[13.5px] text-ink-mute">{c.noContacts}</p>
          ) : (
            <table className="mt-2 w-full text-[14px]">
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="w-[62px] py-2 text-center align-top tabular-nums text-ink-soft" dir="ltr">
                      {p.at ? hhmm(p.at) : ''}
                    </td>
                    <td className="py-2 align-top font-medium text-ink">{p.name}</td>
                    <td className="py-2 align-top text-ink-soft">{p.role}</td>
                    {/* The biggest thing in this table, because it is the only
                        part of it anybody ever reads out loud. */}
                    <td className="py-2 text-end align-top">
                      <span dir="ltr" className="text-[16px] font-medium tabular-nums text-ink">{p.phone}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <footer className="print-block mt-6 text-[12.5px] text-ink-mute">
        {brand.name}
        {brand.tagline ? ` · ${brand.tagline}` : ''}
        {' · '}
        {c.printedOn} {printedLabel}
      </footer>
    </div>
  );
}
