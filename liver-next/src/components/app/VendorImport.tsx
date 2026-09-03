'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { importVendors, type ImportRow, type ImportResult } from '@/app/actions/vendorImport';
import { VENDOR_CATEGORIES } from '@/content/production';
import { vendorCopy } from '@/content/site';
import { Ltr } from '@/components/Ltr';
import { cn } from '@/lib/utils';

const c = vendorCopy.import;

type Field = keyof typeof c.columns;
const FIELDS = Object.keys(c.columns) as Field[];

/* What a column header may be called, in the producer's sheet or in ours.
   Folded to lowercase and stripped of punctuation before comparing, so
   "מס' טלפון" and "טלפון" land on the same field. */
const ALIASES: Record<Field, string[]> = {
  name:         ['שם ספק', 'שם הספק', 'ספק', 'שם', 'name', 'vendor', 'supplier', 'business'],
  category:     ['קטגוריה', 'תחום', 'סוג', 'category', 'type'],
  phone:        ['טלפון', 'נייד', 'מספר טלפון', 'מס טלפון', 'phone', 'mobile', 'tel'],
  email:        ['מייל', 'אימייל', 'דואל', 'דואר אלקטרוני', 'email', 'e-mail', 'mail'],
  agreed_price: ['מחיר מוסכם', 'מחיר', 'עלות', 'סכום', 'price', 'agreed price', 'cost', 'amount'],
  deposit_paid: ['מקדמה ששולמה', 'מקדמה', 'שולם', 'deposit', 'paid', 'deposit paid', 'advance'],
  notes:        ['הערות', 'הערה', 'notes', 'note', 'comments', 'remarks'],
  contact_name: ['איש קשר', 'שם איש קשר', 'contact', 'contact name', 'person'],
  area:         ['אזור', 'עיר', 'מיקום', 'area', 'city', 'region', 'location'],
};

const fold = (s: unknown) => String(s ?? '').toLowerCase().replace(/['׳"״.:_\-()]/g, ' ').replace(/\s+/g, ' ').trim();

function guess(header: string): Field | '' {
  const h = fold(header);
  if (!h) return '';
  for (const f of FIELDS) if (ALIASES[f].some((a) => fold(a) === h)) return f;
  for (const f of FIELDS) if (ALIASES[f].some((a) => h.includes(fold(a)))) return f;
  return '';
}

type Parsed = { headers: string[]; rows: string[][] };

/**
 * The spreadsheet every producer already keeps, read in the browser.
 *
 * The file never reaches the server. SheetJS parses it here, the producer
 * sees which column landed on which field and fixes the ones the headers did
 * not give away, and only the rows as text go up. That keeps a 4MB workbook
 * off a server action's body limit, and it means the producer approves what
 * is about to be written before anything is.
 *
 * The template is built the same way, from the same column list, so the
 * headers it ships with are exactly the headers the guesser recognises.
 */
export function VendorImport({ existingNames, onDone }: { existingNames: string[]; onDone?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [map, setMap] = useState<Record<number, Field | ''>>({});
  const [busy, setBusy] = useState<'idle' | 'reading' | 'importing'>('idle');
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const read = async (file: File | undefined) => {
    if (!file) return;
    setError(''); setResult(null); setBusy('reading');
    try {
      /* Loaded on demand: the parser is a third of a megabyte and this
         screen is opened once a year. */
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });
      const nonEmpty = grid.filter((r) => Array.isArray(r) && r.some((v) => String(v ?? '').trim() !== ''));
      if (nonEmpty.length < 2) { setError(c.noRows); setBusy('idle'); return; }

      const headers = nonEmpty[0].map((v) => String(v ?? '').trim());
      const rows = nonEmpty.slice(1).map((r) => headers.map((_, i) => String(r[i] ?? '').trim()));

      const initial: Record<number, Field | ''> = {};
      const taken = new Set<Field>();
      headers.forEach((h, i) => {
        const g = guess(h);
        if (g && !taken.has(g)) { initial[i] = g; taken.add(g); } else initial[i] = '';
      });
      setParsed({ headers, rows });
      setMap(initial);
    } catch (e) {
      console.error('[vendors] sheet unreadable', e);
      setError(c.unreadable);
    } finally {
      setBusy('idle');
      if (input.current) input.current.value = '';
    }
  };

  const template = async () => {
    const XLSX = await import('xlsx');
    const headers = FIELDS.map((f) => c.columns[f]);
    const example = [
      'פרחי שרון', VENDOR_CATEGORIES[4].label, '052-0000000', 'sharon@example.com',
      '12000', '3000', 'עיצוב חופה ושולחנות', 'שרון', 'צפון',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    if (!ws['!views']) ws['!views'] = [];
    ws['!views'].push({ RTL: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ספקים');
    XLSX.writeFile(wb, c.templateName);
  };

  const nameCol = useMemo(() => Object.entries(map).find(([, f]) => f === 'name')?.[0], [map]);

  const prepared = useMemo<ImportRow[]>(() => {
    if (!parsed || nameCol === undefined) return [];
    return parsed.rows
      .map((r) => {
        const row: ImportRow = { name: r[Number(nameCol)] ?? '' };
        for (const [i, f] of Object.entries(map)) {
          if (!f || f === 'name') continue;
          const v = r[Number(i)];
          if (v) row[f] = v;
        }
        return row;
      })
      .filter((r) => r.name.trim().length >= 2);
  }, [parsed, map, nameCol]);

  const existing = useMemo(() => new Set(existingNames.map((n) => n.trim().toLowerCase())), [existingNames]);
  const willUpdate = prepared.filter((r) => existing.has(r.name.trim().toLowerCase())).length;
  const willAdd = prepared.length - willUpdate;

  const run = async () => {
    if (prepared.length === 0) return;
    setBusy('importing'); setError('');
    const r = await importVendors(prepared);
    setBusy('idle');
    if (!r.ok) { setError(r.error ?? c.failed); return; }
    setResult(r);
    setParsed(null);
  };

  const choose = (i: number, f: Field | '') => {
    setMap((m) => {
      const next = { ...m, [i]: f };
      /* One field, one column. Choosing a field for this column takes it
         away from whichever column had it. */
      if (f) for (const k of Object.keys(next)) if (Number(k) !== i && next[Number(k)] === f) next[Number(k)] = '';
      return next;
    });
  };

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-[17px] font-semibold text-ink">
            <FileSpreadsheet size={17} strokeWidth={1.5} aria-hidden />
            {c.title}
          </h2>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-soft">{c.sub}</p>
        </div>
        <button type="button" onClick={() => void template()} className="btn-ghost min-h-[38px] px-3.5 text-[13.5px]">
          <Download size={14} strokeWidth={1.5} aria-hidden />
          {c.template}
        </button>
      </div>

      {result && (
        <div className="mt-5 rounded-xl2 border border-ok/30 bg-ok-wash p-4">
          <p className="inline-flex items-center gap-2 text-[14.5px] font-medium text-ok">
            <Check size={16} strokeWidth={1.5} aria-hidden />
            {c.done}
          </p>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            {c.added} <Ltr>{result.added}</Ltr> · {c.updated} <Ltr>{result.updated}</Ltr> · {c.skipped} <Ltr>{result.skipped}</Ltr>
          </p>
          {onDone && (
            <button type="button" onClick={onDone} className="btn-quiet mt-2 px-0 text-[13.5px]">{vendorCopy.close}</button>
          )}
        </div>
      )}

      {!parsed && !result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void read(e.dataTransfer.files?.[0]); }}
          className={cn(
            'mt-5 rounded-card-sm border border-dashed p-6 text-center transition',
            over ? 'border-accent bg-accent-wash' : 'border-line-strong bg-surface-100',
          )}
        >
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-button border border-line-strong bg-card px-5 text-[14px] font-medium text-ink transition hover:border-accent/40 hover:text-accent">
            <Upload size={16} strokeWidth={1.5} aria-hidden />
            {busy === 'reading' ? c.reading : c.choose}
            <input
              ref={input} type="file" className="sr-only" aria-label={c.choose}
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={(e) => void read(e.target.files?.[0])}
            />
          </label>
          <p className="mt-3 text-[13.5px] text-ink-soft">{c.drop}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">{error}</p>
      )}

      {parsed && (
        <div className="mt-5 space-y-5">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[14.5px] font-medium text-ink">{c.mapping}</h3>
              <p className="text-[12.5px] text-ink-mute">{c.mappingSub}</p>
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {parsed.headers.map((h, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl2 border border-line bg-surface-100 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink" title={h}>{h || `עמודה ${i + 1}`}</span>
                  <select
                    value={map[i] ?? ''} onChange={(e) => choose(i, e.target.value as Field | '')}
                    aria-label={`${c.mapping}: ${h}`}
                    className={cn('field min-h-[36px] w-[46%] px-2 py-1 text-[13px]', !map[i] && 'text-ink-mute')}
                  >
                    <option value="">{c.skip}</option>
                    {FIELDS.map((f) => <option key={f} value={f}>{c.columns[f]}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[14.5px] font-medium text-ink">{c.preview}</h3>
              <p className="text-[12.5px] text-ink-mute">
                {c.rowsFound.replace('{n}', String(prepared.length))}
                {prepared.length > 0 && <> · {c.willAdd.replace('{n}', String(willAdd))} · {c.willUpdate.replace('{n}', String(willUpdate))}</>}
              </p>
            </div>
            {nameCol === undefined ? (
              <p className="mt-3 text-[13.5px] text-bad">{c.noRows}</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl2 border border-line">
                <table className="w-full min-w-[560px] text-[13px]">
                  <thead className="bg-surface-100 text-ink-mute">
                    <tr>
                      {FIELDS.filter((f) => Object.values(map).includes(f)).map((f) => (
                        <th key={f} className="px-3 py-2 text-start font-medium">{c.columns[f]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {prepared.slice(0, 6).map((r, i) => (
                      <tr key={i} className={existing.has(r.name.trim().toLowerCase()) ? 'bg-accent-wash' : ''}>
                        {FIELDS.filter((f) => Object.values(map).includes(f)).map((f) => (
                          <td key={f} className="max-w-[220px] truncate px-3 py-2 text-ink">
                            {f === 'phone' || f === 'email' || f === 'agreed_price' || f === 'deposit_paid' ? <Ltr>{r[f] ?? ''}</Ltr> : (r[f] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {prepared.length > 6 && (
                  <p className="border-t border-line px-3 py-2 text-[12.5px] text-ink-mute">
                    {c.previewMore.replace('{n}', String(prepared.length - 6))}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button" onClick={() => void run()} disabled={busy === 'importing' || prepared.length === 0}
              className="btn-primary"
            >
              <Upload size={15} strokeWidth={1.5} aria-hidden />
              {busy === 'importing' ? c.running : c.run}
            </button>
            <button type="button" onClick={() => { setParsed(null); setError(''); }} className="btn-ghost">
              <X size={15} strokeWidth={1.5} aria-hidden />
              {c.cancel}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
