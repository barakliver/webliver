import Link from 'next/link';
import { formatDate } from '@/lib/dates';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { appCopy } from '@/content/site';
import { AUDIENCES } from '@/content/lists';
import { PrintButton } from '@/components/app/PrintButton';
import { RunSheet } from '@/components/app/RunSheet';
import { brandFor } from '@/lib/branding';
import { safeRows } from '@/lib/safe';
import { hhmm, inDayOrder, spanOf, humanSpan, crossesMidnight } from '@/lib/runsheet';
import { EVENT_ZONE } from '@/lib/clock';

export const metadata = { title: appCopy.runsheet.title };

type Item = {
  id: string; track: string; at_time: string; title: string; note: string;
  audience: string[]; owner: string; duration_min: number | null;
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: EVENT_ZONE,
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
  const [{ data: client }, { data: rows }, brand] = await Promise.all([
    sb.from('clients').select('id,display_name,event_date,venue').eq('id', id).maybeSingle(),
    sb.from('day_schedule').select('id,track,at_time,title,note,audience,owner,duration_min')
      .eq('client_id', id).order('at_time'),
    brandFor(account),
  ]);
  if (!client) notFound();

  /* The numbers, only for the producer's copy. A couple holding this sheet is
     holding their own evening; everybody's mobile number is a staffing list.
     Fetched at all only when it will be rendered. */
  const contacts = staffVisible
    ? [
        ...(await safeRows<{ id: string; name: string; role: string; phone: string; call_time: string | null }>(
          'run sheet crew',
          sb.from('crew').select('id,name,role,phone,call_time').eq('client_id', id),
        )).map((m) => ({ id: m.id, name: m.name, role: m.role, phone: m.phone, at: m.call_time })),
        ...(await safeRows<{ id: string; name: string; category: string; phone: string; call_time: string | null }>(
          'run sheet suppliers',
          sb.from('event_vendors').select('id,name,category,phone,call_time').eq('client_id', id),
        )).map((v) => ({ id: v.id, name: v.name, role: v.category, phone: v.phone, at: v.call_time })),
      ]
    : [];

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

      <RunSheet
        c={c}
        client={client}
        brand={{ name: brand.name, tagline: brand.tagline || undefined }}
        lines={items}
        contacts={contacts}
        roleLabel={roleLabel}
        staffVisible={staffVisible}
        dateLabel={formatDate(dateFmt, client.event_date, '')}
        audienceLabel={(v) => AUDIENCES.find((x) => x.value === v)?.label ?? v}
        printedLabel={new Date().toLocaleDateString('he-IL', { timeZone: EVENT_ZONE })}
      />
    </>
  );
}
