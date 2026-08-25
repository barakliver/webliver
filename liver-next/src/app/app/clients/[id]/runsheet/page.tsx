import Link from 'next/link';
import { formatDate } from '@/lib/dates';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { appCopy } from '@/content/site';
import { AUDIENCES } from '@/content/lists';
import { PrintButton } from '@/components/app/PrintButton';
import { hhmm, inDayOrder, spanOf, humanSpan, crossesMidnight } from '@/lib/runsheet';

export const metadata = { title: appCopy.runsheet.title };

type Item = {
  id: string; track: string; at_time: string; title: string; note: string;
  audience: string[]; owner: string; duration_min: number | null;
};

const dateFmt = new Intl.DateTimeFormat('he-IL', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

/**
 * The run sheet for the day, filtered to one role and built to be printed.
 *
 * Printed, rather than generated as a PDF by a library. Hebrew in the
 * JavaScript PDF libraries means embedding a font and doing bidirectional
 * layout by hand, which they get subtly wrong — a mixed Hebrew-and-digits line
 * like "19:00 קבלת פנים" is exactly the case that breaks. The browser already
 * does this correctly on every phone and laptop, and every one of them can
 * save the result as a PDF from the print dialog. So the page is the document:
 * @media print strips the app around it and what remains is what comes out.
 *
 * Access is deliberately requireAccount rather than producer-only. The couple
 * needs their own sheet on the morning, and the policy on day_schedule already
 * decides who may read the lines — a workspace they are not on returns nothing
 * and they get a 404, the same as anybody else.
 */
export default async function RunsheetPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ for?: string }>;
}) {
  const account = await requireAccount();
  /* The sheet is shared with the couple on purpose, and who is doing each line
     is not. A name against a line is a staffing note, and staffing stays on
     the producer's side of the wall. */
  const staffVisible = account.role !== 'client';
  const { id } = await params;
  const { for: forRaw } = await searchParams;

  const role = AUDIENCES.find((a) => a.value === forRaw)?.value ?? null;
  const c = appCopy.runsheet;

  const sb = await supabaseServer();
  const [{ data: client }, { data: rows }] = await Promise.all([
    sb.from('clients').select('id,display_name,event_date,venue').eq('id', id).maybeSingle(),
    sb.from('day_schedule').select('id,track,at_time,title,note,audience,owner,duration_min')
      .eq('client_id', id).order('at_time'),
  ]);
  if (!client) notFound();

  /* An empty audience means the line is for everyone, so it survives every
     filter. That is the default, and it is why filtering never silently
     empties a sheet somebody spent an evening writing. */
  const all = (rows ?? []) as Item[];
  const filtered = role ? all.filter((i) => i.audience.length === 0 || i.audience.includes(role)) : all;

  /* Sorted here rather than by the query. `order by at_time` is alphabetical
     on the clock, so an evening that ends at 01:00 prints the pack-down as its
     first line — which is not a bug anybody reports, they simply stop trusting
     the sheet. */
  const items = inDayOrder(filtered);
  const roleLabel = AUDIENCES.find((a) => a.value === role)?.label;
  const wraps = crossesMidnight(items.map((i) => i.at_time));

  return (
    <>
      <style>{`
        @media print {
          /* Everything the app puts around the page goes; what is left is the
             document. Backgrounds are dropped too — a run sheet is read on
             white paper under venue lighting, not on a screen. */
          body > * { display: none !important; }
          body > .runsheet-print { display: block !important; }
          .no-print { display: none !important; }
          .runsheet-print { padding: 0; color: #000; background: #fff; }
          .runsheet-row { break-inside: avoid; }
          @page { margin: 16mm 14mm; }
        }
      `}</style>

      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/app/clients/${id}`} className="btn-quiet inline-flex items-center gap-1.5 px-0 text-[14px]">
          <ArrowRight size={16} aria-hidden strokeWidth={1.5} />
          {c.back}
        </Link>
        <PrintButton label={c.print} />
      </div>

      {/* Role switcher. Four sheets from one schedule, because on the day
          nobody has time to read past the lines that are not theirs. */}
      <nav className="no-print mb-7 flex flex-wrap gap-2" aria-label={c.audience}>
        {[{ value: null, label: c.everyone }, ...AUDIENCES].map((a) => {
          const on = a.value === role;
          return (
            <Link
              key={a.value ?? 'all'}
              href={a.value ? `/app/clients/${id}/runsheet?for=${a.value}` : `/app/clients/${id}/runsheet`}
              aria-current={on ? 'page' : undefined}
              className={`min-h-[44px] rounded-xl2 border px-4 text-[14px] leading-[42px] sm:min-h-[38px] sm:leading-[36px] transition ${
                on ? 'border-ink bg-ink font-medium text-surface' : 'border-line-strong text-ink-soft hover:border-accent/40 hover:text-accent'
              }`}
            >
              {a.label}
            </Link>
          );
        })}
      </nav>

      <div className="runsheet-print">
        <header className="border-b-2 border-ink pb-4">
          <h1 className="font-display text-[27px] font-light text-ink">{client.display_name}</h1>
          <p className="mt-1.5 text-[15px] text-ink-soft">
            {formatDate(dateFmt, client.event_date, c.noDate)}
            {client.venue ? ` · ${client.venue}` : ''}
          </p>
          <p className="mt-1 text-[14px] font-medium text-accent">
            {c.sheetFor} {roleLabel ?? c.everyone}
            {items.length > 0 && (
              <span className="text-ink-mute">
                {' · '}
                <span dir="ltr">{hhmm(items[0].at_time)}–{hhmm(items[items.length - 1].at_time)}</span>
                {wraps ? ` ${c.pastMidnight}` : ''}
              </span>
            )}
          </p>
        </header>

        {items.length === 0 ? (
          <p className="mt-8 text-[15px] text-ink-mute">{all.length === 0 ? c.empty : c.emptyForRole}</p>
        ) : (
          <ol className="mt-6">
            {items.map((i, index) => {
              const span = spanOf(items, index);
              return (
                <li key={i.id} className="runsheet-row flex gap-5 border-b border-line py-3.5 last:border-0">
                  {/* Left to right inside a right-to-left page, because a clock
                      reads that way in every language. */}
                  <span className="w-[62px] shrink-0 text-center" dir="ltr">
                    <span className="block font-display text-[17px] font-light tabular-nums text-ink">
                      {hhmm(i.at_time)}
                    </span>
                    {span.minutes !== null && (
                      <span className="mt-0.5 block text-[11.5px] tabular-nums text-ink-mute">
                        {span.stated ? humanSpan(span.minutes) : `↓ ${humanSpan(span.minutes)}`}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] text-ink">{i.title}</p>
                    {i.note && <p className="mt-0.5 text-[14px] text-ink-soft">{i.note}</p>}
                    {staffVisible && i.owner && (
                      <p className="mt-0.5 text-[13px] text-ink-mute">{c.owner}: {i.owner}</p>
                    )}
                  </div>
                  {i.audience.length > 0 && (
                    <span className="shrink-0 self-start text-[12.5px] text-ink-mute">
                      {i.audience.map((a) => AUDIENCES.find((x) => x.value === a)?.label ?? a).join(' · ')}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <p className="mt-8 text-[12.5px] text-ink-mute">
          {client.display_name} · {c.printedOn} {new Date().toLocaleDateString('he-IL')}
        </p>
      </div>
    </>
  );
}
