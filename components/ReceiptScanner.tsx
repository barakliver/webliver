'use client';

import { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { scanReceipt } from '@/app/actions/receipts';
import { deleteBudgetItem } from '@/app/actions/workspace';
import { useRealtimeRows } from '@/lib/hooks/useRealtimeRows';
import { ConnectionBadge } from './BrideMode';
import type { BudgetItemRow, ReceiptRow } from '@/lib/supabase/database.types';

/**
 * AI vision receipt scanner — סריקת קבלות ומעקב הוצאות
 *
 * Photograph a vendor receipt, Claude reads the vendor, amount, category and
 * date, and the line lands in the live budget tracker as paid (or as a deposit
 * when the receipt says מקדמה).
 */

const CATEGORY_HE: Record<string, string> = {
  venue: 'מקום',
  catering: 'קייטרינג',
  bar: 'בר',
  music: 'מוזיקה',
  photography: 'צילום',
  video: 'וידאו',
  design: 'עיצוב',
  flowers: 'פרחים',
  attire: 'לבוש',
  makeup: 'איפור ושיער',
  rentals: 'השכרות',
  transport: 'הסעות',
  production: 'הפקה',
  other: 'אחר',
};

const STATUS_HE: Record<string, string> = { planned: 'מתוכנן', deposit: 'מקדמה', paid: 'שולם' };

const ils = (n: number) => `₪${Math.round(n).toLocaleString('en-US')}`;

interface Props {
  clientId: string;
  initialBudget: BudgetItemRow[];
  initialReceipts: ReceiptRow[];
}

export default function ReceiptScanner({ clientId, initialBudget, initialReceipts }: Props) {
  const budget = useRealtimeRows({
    table: 'budget_items',
    clientId,
    initial: initialBudget,
    sort: (a, b) => b.created_at.localeCompare(a.created_at),
  });
  const receipts = useRealtimeRows({
    table: 'receipts',
    clientId,
    initial: initialReceipts,
    sort: (a, b) => b.created_at.localeCompare(a.created_at),
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<{ vendor: string; amount: number; confidence: number } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => {
    const rows = budget.rows;
    return {
      planned: rows.reduce((s, r) => s + Number(r.amount_planned ?? 0), 0),
      paid: rows.reduce((s, r) => s + Number(r.amount_paid ?? 0), 0),
      scanned: rows.filter((r) => r.source === 'receipt_scan').length,
    };
  }, [budget.rows]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setLastScan(null);

    if (!file.type.startsWith('image/')) {
      setError('אפשר להעלות תמונה בלבד.');
      return;
    }
    // HEIC comes straight off an iPhone but Claude vision does not accept it.
    if (/heic|heif/i.test(file.type)) {
      setError('פורמט HEIC אינו נתמך לסריקה. שמרו כ-JPEG ונסו שוב.');
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      const result = await scanReceipt({ clientId, dataUrl, fileName: file.name });
      if (!result.ok) {
        setError(result.error ?? 'הסריקה נכשלה.');
      } else if (result.data) {
        const { extraction, budgetItem } = result.data;
        if (extraction) {
          setLastScan({
            vendor: extraction.vendor,
            amount: extraction.amount,
            confidence: extraction.confidence,
          });
        }
        if (budgetItem) {
          budget.setRows((current) =>
            current.some((r) => r.id === budgetItem.id) ? current : [budgetItem, ...current],
          );
        }
        await receipts.refresh();
      }
    } catch {
      setError('לא הצלחנו לקרוא את הקובץ.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <section className="stack" aria-labelledby="receipt-title">
      <div className="spread">
        <div>
          <h2 id="receipt-title" style={{ fontSize: 22 }}>
            🧾 סריקת קבלות ומעקב הוצאות
          </h2>
          <p className="muted small">
            צלמו קבלה או מקדמה — הסכום, הספק והתאריך ייקלטו אוטומטית לתקציב.
          </p>
        </div>
        <ConnectionBadge status={budget.status} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
        <Metric value={ils(totals.planned)} label="תקציב מתוכנן" />
        <Metric value={ils(totals.paid)} label="שולם" tone="var(--green)" />
        <Metric value={ils(Math.max(0, totals.planned - totals.paid))} label="יתרה" tone="var(--gold)" />
        <Metric value={String(totals.scanned)} label="נקלטו מסריקה" />
      </div>

      <div className="card stack">
        <label htmlFor="receipt-file">העלאת קבלה</label>
        <input
          id="receipt-file"
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          disabled={busy}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <p className="muted small">JPEG, PNG או WebP · עד 10MB · הקבלה נשמרת בארכיון פרטי.</p>
        {busy && (
          <p className="small" role="status">
            ⏳ קורא את הקבלה…
          </p>
        )}
      </div>

      {error && (
        <div className="alert alert-err" role="alert">
          {error}
        </div>
      )}

      {lastScan && (
        <div className="alert alert-ok" role="status">
          נקלט: <b>{lastScan.vendor}</b> · {ils(lastScan.amount)}
          {lastScan.confidence < 0.75 && (
            <>
              {' '}
              — <b>ודאו את הסכום ידנית</b> (ביטחון {Math.round(lastScan.confidence * 100)}%).
            </>
          )}
        </div>
      )}

      {budget.rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <p className="muted">עדיין אין תנועות בתקציב.</p>
        </div>
      ) : (
        <ul className="stack" style={{ listStyle: 'none' }}>
          {budget.rows.map((item) => {
            const receipt = receipts.rows.find((r) => r.budget_item_id === item.id);
            const lowConfidence = receipt?.confidence != null && receipt.confidence < 0.75;
            return (
              <li key={item.id} className="card">
                <div className="spread" style={{ flexWrap: 'wrap', gap: 12 }}>
                  <div className="row" style={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
                    {receipt?.image_url && (
                      <div
                        style={{
                          position: 'relative',
                          width: 54,
                          height: 54,
                          borderRadius: 8,
                          overflow: 'hidden',
                          flexShrink: 0,
                          background: '#f1ece2',
                        }}
                      >
                        <Image
                          src={receipt.image_url}
                          alt={`קבלה מ-${item.vendor ?? ''}`}
                          fill
                          sizes="54px"
                          style={{ objectFit: 'cover' }}
                          unoptimized
                        />
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <b>{item.vendor || CATEGORY_HE[item.category] || item.category}</b>{' '}
                      <span className="badge badge-live">{STATUS_HE[item.status] ?? item.status}</span>
                      {item.source === 'receipt_scan' && (
                        <span className="badge badge-wait" style={{ marginInlineStart: 4 }}>
                          ✨ סריקה
                        </span>
                      )}
                      <div className="muted small">
                        {CATEGORY_HE[item.category] ?? item.category}
                        {item.paid_at ? ` · ${new Date(item.paid_at).toLocaleDateString('he-IL')}` : ''}
                      </div>
                      {item.description && <div className="muted small">{item.description}</div>}
                      {lowConfidence && (
                        <div className="small" style={{ color: 'var(--amber)' }}>
                          ⚠️ זיהוי בביטחון נמוך — כדאי לאמת מול הקבלה.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="row">
                    <b className="serif" style={{ fontSize: 18 }}>
                      {ils(Number(item.amount_paid || item.amount_planned))}
                    </b>
                    <button
                      type="button"
                      className="btn btn-red btn-xs"
                      onClick={async () => {
                        const snapshot = budget.rows;
                        budget.setRows((current) => current.filter((r) => r.id !== item.id));
                        const result = await deleteBudgetItem({ clientId, id: item.id });
                        if (!result.ok) {
                          budget.setRows(snapshot);
                          setError(result.error ?? 'המחיקה נכשלה.');
                        }
                      }}
                      aria-label={`מחיקת ${item.vendor ?? item.category}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {receipts.rows.some((r) => r.status === 'failed') && (
        <div className="card">
          <b className="small">סריקות שנכשלו</b>
          <ul className="stack" style={{ gap: 6, marginTop: 8, listStyle: 'none' }}>
            {receipts.rows
              .filter((r) => r.status === 'failed')
              .map((r) => (
                <li key={r.id} className="muted small">
                  {new Date(r.created_at).toLocaleString('he-IL')} — {r.error ?? 'שגיאה לא ידועה'}
                </li>
              ))}
          </ul>
          <p className="muted small" style={{ marginTop: 6 }}>
            הקבלות נשמרו בארכיון — אפשר להעלות שוב או להזין ידנית.
          </p>
        </div>
      )}
    </section>
  );
}

function Metric({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 12 }}>
      <div className="serif" style={{ fontSize: 20, color: tone ?? 'inherit' }}>
        {value}
      </div>
      <div className="muted small">{label}</div>
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}
