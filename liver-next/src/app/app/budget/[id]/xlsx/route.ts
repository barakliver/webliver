import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { computeLine, isLive, type GridItem, type GridPayment } from '@/lib/budgetGrid';
import { categoryOf } from '@/lib/budgetPlan';
import { appCopy } from '@/content/site';

/**
 * The budget as a workbook somebody can keep working in.
 *
 * Two sheets: the lines, and the payments behind them. The figures that
 * are sums are written as formulas rather than values, so a parent who
 * opens it and changes one agreed price sees the total move - a sheet of
 * pasted numbers is a photograph of a budget, not a budget. "Paid" on a
 * line is a SUMIFS over the payments sheet for the same reason.
 *
 * Served from here rather than built in the browser: the rows are behind
 * row level security, so the couple's file holds the lines they may see
 * and nothing else, and the producer's holds all of them.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAccount();
  const { id } = await params;
  const sb = await supabaseServer();
  const [{ data: client }, { data: items }, { data: payments }] = await Promise.all([
    sb.from('clients').select('display_name,guest_estimate').eq('id', id).maybeSingle(),
    sb.from('budget_items').select('*').eq('client_id', id).order('sort_order').order('created_at'),
    sb.from('budget_payments').select('*').eq('client_id', id).order('due_at', { ascending: true, nullsFirst: false }),
  ]);
  const c = appCopy.money.grid;
  const areas = appCopy.money.plan.categories as Record<string, string>;
  const guests = (client as { guest_estimate?: number | null } | null)?.guest_estimate ?? null;
  const rows = ((items ?? []) as GridItem[]).filter(isLive);
  const pays = (payments ?? []) as GridPayment[];

  /* The unit, named once. The number format is Excel's and not a sentence
     on a screen, which is why the symbol is spelled rather than typed. */
  const ILS = `#,##0 "${String.fromCharCode(0x20aa)}"`;
  const money = (v: number | null) => (v === null ? { t: 's', v: '' } : { t: 'n', v, z: ILS });
  const formula = (f: string) => ({ t: 'n', f, z: ILS });

  const PAY_SHEET = 'תשלומים';
  const head1 = ['#', c.colLabel, appCopy.money.budCategory, c.colVendor, c.colStatus, c.colPlanned, c.colQuoted, c.colAgreed, c.colPaid, c.colRemaining, c.colNext, c.colNotes];
  const sheet1: unknown[][] = [head1];
  rows.forEach((it, k) => {
    const m = computeLine(it, pays, guests);
    const r = k + 2;
    sheet1.push([
      k + 1, it.label, areas[categoryOf(it)] ?? '', it.vendor, c.statuses[it.status as keyof typeof c.statuses] ?? it.status,
      money(m.planned), money(m.quoted), money(m.agreedIncl),
      formula(`SUMIFS('${PAY_SHEET}'!C:C,'${PAY_SHEET}'!A:A,A${r},'${PAY_SHEET}'!D:D,"<>")`),
      formula(`MAX(0,H${r}-I${r})`),
      m.nextDue ? m.nextDue.date : '', it.notes,
    ]);
  });
  const last = rows.length + 1;
  if (rows.length) {
    sheet1.push([
      '', c.total, '', '', '',
      formula(`SUM(F2:F${last})`), formula(`SUM(G2:G${last})`), formula(`SUM(H2:H${last})`),
      formula(`SUM(I2:I${last})`), formula(`SUM(J2:J${last})`), '', '',
    ]);
  }

  const head2 = ['#', c.colLabel, c.payAmount, c.payPaidOn, c.payDue, c.payMethod, c.payBy, c.payRef, c.payNotes];
  const sheet2: unknown[][] = [head2];
  for (const p of pays) {
    const k = rows.findIndex((r) => r.id === p.item_id);
    if (k < 0) continue;
    sheet2.push([k + 1, rows[k].label, money(Number(p.amount)), p.paid_at ?? '', p.due_at ?? '',
      c.methods[p.method as keyof typeof c.methods] ?? p.method, p.paid_by, p.reference, p.notes]);
  }

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1);
  ws1['!cols'] = [4, 28, 16, 18, 10, 12, 12, 12, 12, 12, 12, 30].map((w) => ({ wch: w }));
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2);
  ws2['!cols'] = [4, 28, 12, 12, 12, 10, 14, 12, 30].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws1, c.title);
  XLSX.utils.book_append_sheet(wb, ws2, PAY_SHEET);
  wb.Workbook = { Views: [{ RTL: true }] };

  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const name = encodeURIComponent(`${(client as { display_name?: string } | null)?.display_name ?? 'budget'} ${c.title}.xlsx`);
  return new NextResponse(new Uint8Array(out), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${name}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
