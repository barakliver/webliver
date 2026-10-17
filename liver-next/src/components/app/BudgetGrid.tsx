'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Sparkles, Plus, ChevronDown, Wallet } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { StatBar } from '@/components/app/StatBar';
import { StatusDot } from '@/components/app/StatusDot';
import { Sheet } from '@/components/app/Sheet';
import { useDragOnto, Grip, Carried } from '@/components/app/DragOnto';
import { Money } from '@/components/Ltr';
import { useWide } from '@/lib/useWide';
import { fill } from '@/lib/copyText';
import { shortDate } from '@/lib/appDates';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { categoryOf, PLAN_CATEGORIES, type PlanCategory } from '@/lib/budgetPlan';
import {
  BUDGET_STATUSES, METHODS, PAYERS, computeLine, groupItems, groupTotal, totals, parseCell, parseTsv, pushChange,
  moveCell, isLive, type GridItem, type GridPayment, type Change, type CellPos, type Group,
} from '@/lib/budgetGrid';
import {
  patchBudgetCell, addBudgetLine, cancelBudgetLine, restoreBudgetLine, reorderBudgetLines, saveInternalNote,
  addBudgetPayment, setBudgetPaymentPaid, deleteBudgetPayment, splitBudgetPayments, askBudgetApproval, approveBudget, seedBudget,
} from '@/app/actions/budget';
import type { AppUi } from '@/content/appUi';

/**
 * The budget as a sheet.
 *
 * Press a cell, type, Enter: the sheet moves first and the server is told
 * four hundred milliseconds later, one cell per write, and a write that
 * fails puts the old figure back and says so. Every total on the screen is
 * `lib/budgetGrid`, recomputed from the rows under the finger, so the
 * figure in the sticky bar and the figure at the foot of a column cannot
 * disagree.
 *
 * Two things a spreadsheet does not have. A line carries its own
 * payments, so "paid" is never typed: it is the sum of what was paid
 * against the line, and the cell opens the list. And two of the figures
 * are locked for the couple once they are facts - the plan after they
 * approved it, the agreed price after a booking - which the server
 * refuses rather than the screen hiding, because the screen is not the
 * fence.
 *
 * On a phone the same rows are cards and a card opens a sheet of fields:
 * a twelve-column table in a horizontal scroller on a 390px screen asks a
 * thumb to drag sideways inside a page that also scrolls down. `useWide`
 * decides, and on the server, where the width is not known, both are
 * drawn and the wrong one is removed on the tick that hydrates.
 */

type Viewer = 'producer' | 'client';
type Grid = AppUi['money']['grid'];
type Kind = 'text' | 'money' | 'status' | 'vat' | 'derived';
type Col = { key: string; kind: Kind; label: string; align?: 'end'; width: string };

const SAVE_AFTER = 400;
const UNDO_REMOVE_MS = 10_000;
/* Module constants rather than `= []` in the signature: a default written
   there is a new object on every render, and the effect that mirrors it
   into state would re-run forever. */
const NO_VENDORS: string[] = [];
const NO_NOTES: Record<string, string> = {};
const NO_HISTORY: HistoryRow[] = [];

/** A sentence with an amount in it, the amount isolated: `{amount}` in the
 *  wording becomes <Money>, so the shekel sign cannot drift to the wrong
 *  end of the number inside a right-to-left line. */
function Said({ text, amount, vars = {} }: { text: string; amount: number; vars?: Record<string, string | number> }) {
  const [a, b] = fill(text, vars).split('{amount}');
  return <>{a}<Money value={amount} />{b ?? ''}</>;
}

export type HistoryRow = { id: string; title: string; body: string; actor: string; created_at: string };

export function BudgetGrid({
  clientId, viewer, items: given, payments: givenPayments, guests, target, approvedAt, askedAt,
  vendors = NO_VENDORS, privateNotes = NO_NOTES, history = NO_HISTORY,
}: {
  clientId: string;
  viewer: Viewer;
  items: GridItem[];
  payments: GridPayment[];
  guests: number | null;
  target: number | null;
  approvedAt: string | null;
  askedAt: string | null;
  /** Supplier names for the autocomplete on the supplier cell. */
  vendors?: string[];
  /** The producer's own note per line; never handed to the couple. */
  privateNotes?: Record<string, string>;
  history?: HistoryRow[];
}) {
  const ui = useCopy();
  const c = ui.money.grid;
  const areas = ui.money.plan.categories as Record<PlanCategory, string>;
  const dateFmt = shortDate(ui.locale);
  const fmt = (iso: string | null) => formatDate(dateFmt, iso, '');
  const producer = viewer === 'producer';
  const wide = useWide();

  const [items, setItems] = useState(given);
  const [payments, setPayments] = useState(givenPayments);
  const [notes, setNotes] = useState(privateNotes);
  useEffect(() => { setItems(given); }, [given]);
  useEffect(() => { setPayments(givenPayments); }, [givenPayments]);
  useEffect(() => { setNotes(privateNotes); }, [privateNotes]);

  const [undo, setUndo] = useState<Change[]>([]);
  const [redo, setRedo] = useState<Change[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [sel, setSel] = useState<CellPos | null>(null);
  const [editing, setEditing] = useState<{ pos: CellPos; initial?: string } | null>(null);
  const [paySheet, setPaySheet] = useState<string | null>(null);
  const [cardSheet, setCardSheet] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{ item: GridItem; status: string } | null>(null);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const sheetRef = useRef<HTMLDivElement>(null);

  /* Which areas are folded, remembered per event in this browser only. */
  const FOLD_KEY = `budget-fold-${clientId}`;
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FOLD_KEY);
      if (raw) setFolded(new Set(JSON.parse(raw) as string[]));
    } catch { /* storage refused: everything open */ }
  }, [FOLD_KEY]);
  const toggleFold = (key: string) => {
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { window.localStorage.setItem(FOLD_KEY, JSON.stringify([...next])); } catch { /* same */ }
      return next;
    });
  };

  const say = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 4000);
  }, []);

  const groups = useMemo(() => groupItems(items, payments, guests), [items, payments, guests]);
  const rows = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const sums = useMemo(() => totals(items, payments, guests, target), [items, payments, guests, target]);

  const cols = useMemo<Col[]>(() => {
    const list: Col[] = [
      { key: 'label', kind: 'text', label: c.colLabel, width: 'min-w-[180px]' },
      { key: 'vendor', kind: 'text', label: c.colVendor, width: 'min-w-[120px]' },
      { key: 'status', kind: 'status', label: c.colStatus, width: 'min-w-[96px]' },
      { key: 'estimate', kind: 'money', label: c.colPlanned, align: 'end', width: 'min-w-[96px]' },
      { key: 'quoted', kind: 'money', label: c.colQuoted, align: 'end', width: 'min-w-[96px]' },
      { key: 'agreed', kind: 'money', label: c.colAgreed, align: 'end', width: 'min-w-[110px]' },
      { key: 'includes_vat', kind: 'vat', label: c.colVat, width: 'min-w-[64px]' },
      { key: 'paid', kind: 'derived', label: c.colPaid, align: 'end', width: 'min-w-[96px]' },
      { key: 'remaining', kind: 'derived', label: c.colRemaining, align: 'end', width: 'min-w-[96px]' },
      { key: 'next', kind: 'derived', label: c.colNext, width: 'min-w-[110px]' },
      { key: 'notes', kind: 'text', label: c.colNotes, width: 'min-w-[140px]' },
    ];
    if (producer) list.push({ key: 'internal', kind: 'text', label: c.colInternal, width: 'min-w-[140px]' });
    return list;
  }, [c, producer]);

  /* ── one cell, one write ─────────────────────────────────────────────── */

  const lockedFor = (item: GridItem, field: string): string | null => {
    if (producer) return null;
    if (field === 'estimate' && approvedAt) return c.lockedPlanned;
    if (field === 'agreed' && (item.status === 'booked' || item.status === 'paid')) return ui.money.grid.statuses.booked;
    return null;
  };

  const save = useCallback((itemId: string, field: string, after: unknown, before: unknown) => {
    const key = `${itemId}:${field}`;
    const t = timers.current.get(key);
    if (t) clearTimeout(t);
    timers.current.set(key, setTimeout(() => {
      timers.current.delete(key);
      start(async () => {
        const f = new FormData();
        f.set('item_id', itemId);
        f.set('client_id', clientId);
        f.set('field', field);
        f.set('value', after === null || after === undefined ? '' : String(after));
        const r = field === 'internal'
          ? await (async () => { const g = new FormData(); g.set('item_id', itemId); g.set('client_id', clientId); g.set('internal_notes', String(after ?? '')); return saveInternalNote(null, g); })()
          : await patchBudgetCell(null, f);
        if (!r.ok) {
          if (field === 'internal') setNotes((n) => ({ ...n, [itemId]: String(before ?? '') }));
          else setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, [field]: before } : i)));
          say(r.error ?? c.saveFailed);
        }
      });
    }, SAVE_AFTER));
  }, [clientId, say, c.saveFailed]);

  const commit = useCallback((itemId: string, field: string, after: unknown, record = true) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const lock = lockedFor(item, field);
    if (lock) { say(lock); return; }
    const before = field === 'internal' ? (notes[itemId] ?? '') : (item as unknown as Record<string, unknown>)[field];
    const same = (before ?? null) === (after ?? null) || String(before ?? '') === String(after ?? '');
    if (same) return;
    if (field === 'internal') setNotes((n) => ({ ...n, [itemId]: String(after ?? '') }));
    else {
      setItems((prev) => prev.map((i) => {
        if (i.id !== itemId) return i;
        const next = { ...i, [field]: after } as GridItem;
        /* The status follows the figure, the same rule the server applies,
           so the sheet reads right before the round trip. */
        if (field === 'agreed' && after !== null && (i.status === 'idea' || i.status === 'quoted')) next.status = 'booked';
        if (field === 'quoted' && after !== null && i.status === 'idea') next.status = 'quoted';
        return next;
      }));
    }
    if (record) {
      setUndo((u) => pushChange(u, { itemId, field, before, after }));
      setRedo([]);
    }
    save(itemId, field, after, before);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, notes, save, say, approvedAt, producer]);

  const doUndo = () => {
    const last = undo[undo.length - 1];
    if (!last) return;
    setUndo((u) => u.slice(0, -1));
    setRedo((r) => [...r, last]);
    commit(last.itemId, last.field, last.before, false);
  };
  const doRedo = () => {
    const last = redo[redo.length - 1];
    if (!last) return;
    setRedo((r) => r.slice(0, -1));
    setUndo((u) => pushChange(u, last));
    commit(last.itemId, last.field, last.after, false);
  };

  /* ── rows ─────────────────────────────────────────────────────────────── */

  const addLine = (category: PlanCategory) => {
    start(async () => {
      const f = new FormData();
      f.set('client_id', clientId);
      f.set('category', category);
      const r = await addBudgetLine(null, f);
      if (!r.ok || !r.id) { say(r.error ?? c.saveFailed); return; }
      const sort = Math.max(0, ...items.map((i) => i.sort_order)) + 1;
      const fresh: GridItem = {
        id: r.id, category, label: c.newLine, vendor: '', estimate: 0, quoted: null, agreed: null, status: 'idea',
        includes_vat: true, vat_rate: 0.18, per_guest: false, guest_count_override: null, notes: '', paid_by: 'couple',
        due_date: null, visible_to_couple: true, sort_order: sort, source: 'manual', created_at: new Date().toISOString(),
      };
      setItems((prev) => [...prev, fresh]);
      if (wide === false) setCardSheet(r.id);
    });
  };

  const removeLine = (item: GridItem) => {
    const count = payments.filter((p) => p.item_id === item.id).length;
    if (count > 0 && !window.confirm(fill(c.cancelAsk, { label: item.label, n: count }))) return;
    const status = item.status;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'cancelled' } : i)));
    setRemoved({ item, status });
    setSel(null);
    window.setTimeout(() => setRemoved((r) => (r?.item.id === item.id ? null : r)), UNDO_REMOVE_MS);
    start(async () => {
      const f = new FormData();
      f.set('item_id', item.id);
      f.set('client_id', clientId);
      const r = await cancelBudgetLine(null, f);
      if (!r.ok) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status } : i)));
        setRemoved(null);
        say(r.error ?? c.saveFailed);
      }
    });
  };

  const restoreLine = () => {
    if (!removed) return;
    const { item, status } = removed;
    setRemoved(null);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status } : i)));
    start(async () => {
      const f = new FormData();
      f.set('item_id', item.id);
      f.set('client_id', clientId);
      f.set('status', status);
      const r = await restoreBudgetLine(null, f);
      if (!r.ok) say(r.error ?? c.saveFailed);
    });
  };

  /* Dragging a row onto another row puts it before that row, in that
     row's area; onto an area's foot puts it last there. The press path
     for the same move is the status cell plus the category on the card. */
  const drag = useDragOnto<string>({
    canDrop: (id, zone) => zone.startsWith('row:') ? zone !== `row:${id}` : zone.startsWith('cat:'),
    onDrop: (id, zone) => {
      const moved = items.find((i) => i.id === id);
      if (!moved) return;
      const fromKey = categoryOf(moved);
      let toKey: PlanCategory;
      let before: string | null = null;
      if (zone.startsWith('row:')) {
        const t = items.find((i) => i.id === zone.slice(4));
        if (!t) return;
        toKey = categoryOf(t); before = t.id;
      } else toKey = zone.slice(4) as PlanCategory;
      const ordered = (key: PlanCategory) => groups.find((g) => g.key === key)?.items.map((i) => i.id).filter((x) => x !== id) ?? [];
      const target = ordered(toKey);
      const at = before ? target.indexOf(before) : target.length;
      target.splice(at < 0 ? target.length : at, 0, id);
      const source = fromKey === toKey ? null : ordered(fromKey);
      setItems((prev) => prev.map((i) => {
        const k = target.indexOf(i.id);
        if (k >= 0) return { ...i, category: toKey, sort_order: k + 1 };
        const s = source ? source.indexOf(i.id) : -1;
        if (s >= 0) return { ...i, sort_order: s + 1 };
        return i;
      }));
      start(async () => {
        const f = new FormData();
        f.set('client_id', clientId); f.set('category', toKey); f.set('ids', target.join(','));
        const r = await reorderBudgetLines(null, f);
        if (!r.ok) say(r.error ?? c.saveFailed);
        if (source && source.length) {
          const g = new FormData();
          g.set('client_id', clientId); g.set('category', fromKey); g.set('ids', source.join(','));
          await reorderBudgetLines(null, g);
        }
      });
    },
  });

  /* ── the keyboard ─────────────────────────────────────────────────────── */

  const editable = (col: Col) => col.kind !== 'derived';

  const onKey = (e: React.KeyboardEvent) => {
    if (editing || !sel) return;
    const item = rows[sel.row];
    const col = cols[sel.col];
    if (!item || !col) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return; }
    const nav: Record<string, Parameters<typeof moveCell>[1]> = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' };
    if (nav[e.key]) { e.preventDefault(); setSel(moveCell(sel, nav[e.key], rows.length, cols.length)); return; }
    if (e.key === 'Tab') { e.preventDefault(); setSel(moveCell(sel, e.shiftKey ? 'ShiftTab' : 'Tab', rows.length, cols.length)); return; }
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      if (col.kind === 'derived') { if (col.key === 'paid' || col.key === 'remaining' || col.key === 'next') setPaySheet(item.id); return; }
      setEditing({ pos: sel }); return;
    }
    if (e.key === 'Escape') { setSel(null); return; }
    if (e.key === 'Backspace' && editable(col)) {
      e.preventDefault();
      if (col.kind === 'text') commit(item.id, col.key, '');
      else if (col.kind === 'money' && col.key !== 'estimate') commit(item.id, col.key, null);
      else if (col.kind === 'money') commit(item.id, col.key, 0);
      return;
    }
    if (e.key === 'Delete') { e.preventDefault(); removeLine(item); return; }
    if (e.key.length === 1 && !mod && (col.kind === 'text' || col.kind === 'money')) {
      e.preventDefault();
      setEditing({ pos: sel, initial: e.key });
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (editing || !sel) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return;
    e.preventDefault();
    const grid = parseTsv(text);
    grid.forEach((line, dr) => {
      const item = rows[sel.row + dr];
      if (!item) return;
      line.forEach((cell, dc) => {
        const col = cols[sel.col + dc];
        if (!col) return;
        if (col.kind === 'text') commit(item.id, col.key, cell.trim());
        else if (col.kind === 'money') { const n = parseCell(cell); if (n !== undefined) commit(item.id, col.key, col.key === 'estimate' ? (n ?? 0) : n); }
      });
    });
  };

  /* ── drawing a cell ───────────────────────────────────────────────────── */

  const rawOf = (item: GridItem, col: Col): string => {
    if (col.key === 'internal') return notes[item.id] ?? '';
    const v = (item as unknown as Record<string, unknown>)[col.key];
    if (col.kind === 'money') return v === null || v === undefined ? '' : String(v);
    return String(v ?? '');
  };

  const finishEdit = (item: GridItem, col: Col, raw: string, then?: Parameters<typeof moveCell>[1]) => {
    setEditing(null);
    if (col.kind === 'money') {
      const n = parseCell(raw);
      if (n === undefined) { say(ui.money.grid.saveFailed); return; }
      commit(item.id, col.key, col.key === 'estimate' ? (n ?? 0) : n);
    } else if (col.kind === 'text') commit(item.id, col.key, raw);
    if (then && sel) setSel(moveCell(sel, then, rows.length, cols.length));
    sheetRef.current?.focus();
  };

  const cellProps = {
    c, notes, producer, clientId, fmt, rawOf, say,
    onPick: (pos: CellPos) => { setSel(pos); sheetRef.current?.focus(); },
    onEdit: (pos: CellPos) => setEditing({ pos }),
    onPay: (id: string) => setPaySheet(id),
    onCommit: (id: string, field: string, value: unknown) => { commit(id, field, value); setEditing(null); sheetRef.current?.focus(); },
    onCancel: () => { setEditing(null); sheetRef.current?.focus(); },
    onFinish: finishEdit,
  };

  /* ── pieces ───────────────────────────────────────────────────────────── */

  const stats = (
    <StatBar sticky className="-mx-4 sm:-mx-6" progress={sums.closedShare} stats={[
      { label: c.statBudget, value: <Money value={sums.budget} /> },
      { label: c.statAgreed, value: <Money value={sums.agreed} />, sub: sums.closedShare === null ? undefined : `${Math.round(sums.closedShare * 100)}%` },
      { label: c.statPaid, value: <Money value={sums.paid} /> },
      { label: c.statRemaining, value: <Money value={sums.remaining} /> },
      ...(producer && sums.overrun !== null && sums.overrun > 0 ? [{ label: c.statOverrun, value: <Money value={sums.overrun} />, tone: 'bad' as const }] : []),
    ]} />
  );

  const nextLine = (
    <p className="mt-3 text-body text-ink-soft">
      {sums.nextDue ? <Said text={c.nextDue} amount={sums.nextDue.amount} vars={{ label: sums.nextDue.label, date: fmt(sums.nextDue.date) }} /> : c.nextDueNone}
      {producer && sums.quotedCount > 0 && <span className="text-ink-mute"> · {fill(c.quotedWaiting, { n: sums.quotedCount })}</span>}
    </p>
  );

  const approval = producer ? (
    <form action={async (f) => { const r = await askBudgetApproval(null, f); if (!r.ok) say(r.error ?? c.saveFailed); }} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      {approvedAt ? <span className="text-meta text-ok">{fill(c.approved, { date: fmt(approvedAt) })}</span>
        : askedAt ? <span className="text-meta text-ink-mute">{fill(c.asked, { date: fmt(askedAt) })}</span>
        : <button type="submit" className="btn-quiet text-body">{c.askApproval}</button>}
    </form>
  ) : askedAt && !approvedAt ? (
    <form action={async (f) => { const r = await approveBudget(null, f); if (!r.ok) say(r.error ?? c.saveFailed); }}
      className="flex flex-wrap items-center justify-between gap-3 rounded-card-sm border border-accent-line bg-accent-wash px-4 py-3">
      <input type="hidden" name="client_id" value={clientId} />
      <p className="text-body text-ink">{c.approvalBanner}</p>
      <button type="submit" className="btn-primary">{c.approve}</button>
    </form>
  ) : approvedAt ? <p className="text-meta text-ink-mute">{fill(c.approved, { date: fmt(approvedAt) })}</p> : null;

  const seed = items.length === 0 && (
    <form action={async (f) => { const r = await seedBudget(null, f); if (!r.ok) say(r.error ?? c.saveFailed); }} className="mt-4 flex flex-wrap items-center gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      <p className="text-body text-ink-mute">{c.empty}</p>
      <button type="submit" className="btn-quiet text-body" disabled={!target}>{c.seed}</button>
      {!target && <span className="text-meta text-ink-mute">{c.seedNeedsTarget}</span>}
    </form>
  );

  const groupHead = (g: Group, cols: number) => {
    const t = groupTotal(g);
    const open = !folded.has(g.key);
    return (
      <tr key={`h-${g.key}`} className="bg-surface-200" {...drag.zone(`cat:${g.key}`)}>
        <td colSpan={cols} className={cn('border-b border-line px-2 py-1.5', drag.over === `cat:${g.key}` && 'bg-accent-wash')}>
          <button type="button" onClick={() => toggleFold(g.key)} aria-expanded={open}
            className="flex w-full items-center gap-2 text-body font-medium text-ink">
            <ChevronDown size={14} strokeWidth={1.5} aria-hidden className={cn('transition-transform duration-touch', !open && '-rotate-90')} />
            <span>{areas[g.key]}</span>
            <span className="text-meta font-normal text-ink-mute">{g.items.length}</span>
            <span className="ms-auto flex gap-6 text-meta font-normal tabular-nums text-ink-soft">
              <span>{c.colPlanned} <Money value={t.planned} /></span>
              <span>{c.colAgreed} <Money value={t.agreed} /></span>
              <span>{c.colRemaining} <Money value={t.remaining} /></span>
            </span>
          </button>
        </td>
      </tr>
    );
  };

  const table = (
    <div
      ref={sheetRef}
      tabIndex={0}
      role="group"
      aria-label={c.title}
      onKeyDown={onKey}
      onPaste={onPaste}
      className={cn('mt-5 overflow-x-auto rounded-card-sm border border-line outline-none focus-visible:ring-2 focus-visible:ring-accent', wide === null && 'hidden sm:block')}
    >
      <datalist id={`vendors-${clientId}`}>{vendors.map((v) => <option key={v} value={v} />)}</datalist>
      <table className="w-full border-collapse text-body">
        <thead>
          <tr className="bg-card">
            <th className="w-8 border-b border-line" />
            {cols.map((col) => (
              <th key={col.key} scope="col" className={cn('border-b border-line px-2 py-2 text-start text-micro font-medium text-ink-mute', col.width, col.align === 'end' && 'text-end')}>{col.label}</th>
            ))}
            <th className="w-8 border-b border-line" />
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const open = !folded.has(g.key);
            const offset = rows.indexOf(g.items[0]);
            return [
              groupHead(g, cols.length + 2),
              /* The grip lifts and nothing else does: `drag.row` on the whole
                 row takes pointer capture on mousedown, and a captured
                 pointer's click is delivered to the row rather than to the
                 cell under it, so no cell could be pressed. */
              ...(open ? g.items.map((item, k) => (
                <tr key={item.id} {...drag.zone(`row:${item.id}`)}
                  className={cn('bg-card', drag.over === `row:${item.id}` && 'border-t-2 border-t-accent', !item.visible_to_couple && producer && 'bg-surface-200')}>
                  <td className="border-b border-line"><Grip label={`${c.drag}: ${item.label}`} {...drag.grip(item.id)} /></td>
                  {cols.map((col, ci) => {
                    const pos = { row: offset + k, col: ci };
                    const isEditing = editing?.pos.row === pos.row && editing?.pos.col === pos.col;
                    return <Cell key={col.key} item={item} col={col} math={g.math[k]} pos={pos} selected={sel?.row === pos.row && sel?.col === pos.col}
                      isEditing={isEditing} initial={isEditing ? editing?.initial : undefined} {...cellProps} />;
                  })}
                  <td className="border-b border-line px-1">
                    {producer && (
                      <button type="button" title={item.visible_to_couple ? c.hideFromCouple : c.showToCouple}
                        className="inline-flex size-8 items-center justify-center rounded-control text-ink-mute hover:text-ink"
                        onClick={() => commit(item.id, 'visible_to_couple', !item.visible_to_couple)}>
                        {item.visible_to_couple ? <Eye size={14} strokeWidth={1.5} aria-hidden /> : <EyeOff size={14} strokeWidth={1.5} aria-hidden />}
                        <span className="sr-only">{item.visible_to_couple ? c.hideFromCouple : c.showToCouple}</span>
                      </button>
                    )}
                  </td>
                </tr>
              )) : []),
              open ? (
                <tr key={`add-${g.key}`}>
                  <td colSpan={cols.length + 2} className="border-b border-line px-2 py-1">
                    <button type="button" onClick={() => addLine(g.key)} className="inline-flex items-center gap-1 text-meta text-ink-mute hover:text-ink">
                      <Plus size={13} strokeWidth={1.5} aria-hidden />{c.addLine}
                    </button>
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </tbody>
        <tfoot>
          <tr className="sticky bottom-0 bg-surface-200 text-body font-medium text-ink">
            <td className="px-2 py-2" />
            <td className="px-2 py-2" colSpan={3}>{c.total}</td>
            <td className="px-2 py-2 text-end tabular-nums"><Money value={sums.planned} /></td>
            <td className="px-2 py-2" />
            <td className="px-2 py-2 text-end tabular-nums"><Money value={sums.agreed} className={cn(sums.overrun !== null && sums.overrun > 0 && 'text-bad')} /></td>
            <td className="px-2 py-2" />
            <td className="px-2 py-2 text-end tabular-nums"><Money value={sums.paid} /></td>
            <td className="px-2 py-2 text-end tabular-nums"><Money value={sums.remaining} /></td>
            <td className="px-2 py-2" colSpan={cols.length - 9 + 1} />
          </tr>
        </tfoot>
      </table>
    </div>
  );

  const cards = (
    <div className={cn('mt-4 space-y-5', wide === null && 'sm:hidden')}>
      {groups.map((g) => {
        const t = groupTotal(g);
        return (
          <section key={g.key} aria-label={areas[g.key]}>
            <h3 className="flex items-baseline justify-between text-body font-medium text-ink">
              <span>{areas[g.key]} <span className="text-meta font-normal text-ink-mute">{g.items.length}</span></span>
              <span className="text-meta font-normal tabular-nums text-ink-soft"><Money value={t.agreed} /></span>
            </h3>
            <ul className="mt-2 list-none space-y-px overflow-hidden rounded-card-sm border border-line p-0">
              {g.items.map((item, k) => {
                const m = g.math[k];
                return (
                  <li key={item.id}>
                    <button type="button" onClick={() => setCardSheet(item.id)} className="flex min-h-[56px] w-full items-center gap-3 bg-card px-3 py-2 text-start">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-ink">{item.label}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-meta text-ink-mute">
                          <StatusDot tone={item.status} label={c.statuses[item.status as keyof typeof c.statuses] ?? item.status} className="text-meta" />
                          {m.nextDue && <span>· <Money value={m.nextDue.amount} /> {fmt(m.nextDue.date)}</span>}
                        </span>
                      </span>
                      <span className="shrink-0 text-end">
                        <span className="block text-body tabular-nums text-ink"><Money value={m.agreedIncl ?? m.expected} /></span>
                        <span className="block text-meta tabular-nums text-ink-mute">{c.colPaid} <Money value={m.paid} /></span>
                      </span>
                    </button>
                  </li>
                );
              })}
              <li>
                <button type="button" onClick={() => addLine(g.key)} className="flex min-h-[44px] w-full items-center gap-1 bg-card px-3 text-meta text-ink-mute">
                  <Plus size={13} strokeWidth={1.5} aria-hidden />{c.addLine}
                </button>
              </li>
            </ul>
          </section>
        );
      })}
      {groups.length === 0 && items.length > 0 && null}
      {groups.length === 0 && items.length === 0 && (
        <ul className="list-none p-0">
          {PLAN_CATEGORIES.slice(0, 1).map((k) => (
            <li key={k}><button type="button" onClick={() => addLine(k)} className="btn-quiet text-body"><Plus size={13} strokeWidth={1.5} aria-hidden /> {c.addLine}</button></li>
          ))}
        </ul>
      )}
    </div>
  );

  const current = cardSheet ? items.find((i) => i.id === cardSheet) ?? null : null;
  const payItem = paySheet ? items.find((i) => i.id === paySheet) ?? null : null;

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="head-panel">{c.title}</h2>
          <p className="mt-1 text-body text-ink-soft">{producer ? c.subProducer : c.subClient}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {items.length > 0 && (
            <a href={`/app/budget/${clientId}/xlsx`} className="btn-quiet text-body" download>{c.exportXlsx}</a>
          )}
          {approval}
        </div>
      </div>

      <div className="mt-5">{stats}</div>
      {nextLine}
      {seed}

      {items.length > 0 && (wide === null || wide) && table}
      {items.length > 0 && (wide === null || !wide) && cards}
      {items.length > 0 && wide && <p className="mt-2 text-micro text-ink-mute">{c.keys}</p>}
      {items.length === 0 && groups.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {PLAN_CATEGORIES.slice(0, 4).map((k) => (
            <button key={k} type="button" onClick={() => addLine(k)} className="btn-quiet text-body">
              <Plus size={13} strokeWidth={1.5} aria-hidden /> {areas[k]}
            </button>
          ))}
        </div>
      )}

      {producer && history.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-body text-ink-soft">{c.history}</summary>
          <ul className="mt-2 list-none space-y-1 p-0 text-meta text-ink-mute">
            {history.map((h) => (
              <li key={h.id} className="flex gap-3"><span className="shrink-0 tabular-nums">{fmt(h.created_at)}</span><span className="truncate">{h.title}{h.body ? ` (${h.body})` : ''}</span></li>
            ))}
          </ul>
        </details>
      )}

      <Carried at={drag.at}>{drag.item ? items.find((i) => i.id === drag.item)?.label : null}</Carried>

      {(toast || removed) && (
        <div role="status" className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-control border border-line bg-card px-4 py-3 text-body text-ink shadow-pop">
          <span>{removed ? c.removed : toast}</span>
          {removed && <button type="button" className="btn-quiet px-2 py-1 text-body" onClick={restoreLine}>{c.undo}</button>}
        </div>
      )}

      <Sheet open={Boolean(current)} onClose={() => setCardSheet(null)} title={current?.label ?? c.edit}>
        {current && <CardFields item={current} c={c} areas={areas} producer={producer} note={notes[current.id] ?? ''} commit={commit}
          onPayments={() => { setPaySheet(current.id); setCardSheet(null); }} onRemove={() => { removeLine(current); setCardSheet(null); }} />}
      </Sheet>

      <Sheet open={Boolean(payItem)} onClose={() => setPaySheet(null)} title={payItem ? fill(c.payTitle, { label: payItem.label }) : ''}>
        {payItem && (
          <PaymentsList item={payItem} clientId={clientId} c={c} payments={payments.filter((p) => p.item_id === payItem.id)}
            remaining={computeLine(payItem, payments, guests).remaining} fmt={fmt} say={say}
            setPayments={setPayments} />
        )}
      </Sheet>
    </section>
  );
}

/* ── one cell ─────────────────────────────────────────────────────────────
 *
 * A component of its own at module level, and that is not style. It was
 * first written inside the grid, which made it a new component type on
 * every render, so React unmounted and rebuilt every cell whenever the
 * selection moved - and a click that began on a cell ended on a cell that
 * no longer existed. Nothing could be pressed. */

type CellCtx = {
  c: Grid; notes: Record<string, string>; producer: boolean; clientId: string;
  fmt: (iso: string | null) => string; rawOf: (item: GridItem, col: Col) => string; say: (t: string) => void;
  onPick: (pos: CellPos) => void; onEdit: (pos: CellPos) => void; onPay: (id: string) => void;
  onCommit: (id: string, field: string, value: unknown) => void; onCancel: () => void;
  onFinish: (item: GridItem, col: Col, raw: string, then?: Parameters<typeof moveCell>[1]) => void;
};

function Cell({ item, col, math, pos, selected, isEditing, initial, c, notes, producer, clientId, fmt, rawOf, onPick, onEdit, onPay, onCommit, onCancel, onFinish }: {
  item: GridItem; col: Col; math: ReturnType<typeof computeLine>; pos: CellPos; selected: boolean; isEditing: boolean; initial?: string;
} & CellCtx) {
  const editable = col.kind !== 'derived';
  const base = cn(
    'relative h-11 whitespace-nowrap border-b border-line px-2 text-body',
    col.align === 'end' ? 'text-end tabular-nums' : '',
    selected && 'outline outline-2 -outline-offset-2 outline-accent',
    col.kind === 'derived' ? 'text-ink-soft' : 'text-ink',
  );
  const open = () => { if (editable) onEdit(pos); else if (col.key !== 'next' || math.nextDue) onPay(item.id); };

  if (isEditing && col.kind === 'status') {
    return (
      <td className={base}>
        <select autoFocus className="field h-8 w-full py-0 text-body" defaultValue={item.status}
          onChange={(e) => onCommit(item.id, 'status', e.target.value)}
          onBlur={onCancel}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}>
          {BUDGET_STATUSES.map((s) => <option key={s} value={s}>{c.statuses[s]}</option>)}
        </select>
      </td>
    );
  }
  if (isEditing && col.kind === 'vat') {
    return (
      <td className={base}>
        <select autoFocus className="field h-8 w-full py-0 text-body" defaultValue={item.includes_vat ? 'true' : 'false'}
          onChange={(e) => onCommit(item.id, 'includes_vat', e.target.value === 'true')}
          onBlur={onCancel}>
          <option value="true">{c.vatIncl}</option>
          <option value="false">{c.vatExcl}</option>
        </select>
      </td>
    );
  }
  if (isEditing) {
    return (
      <td className={base}>
        <input
          autoFocus
          list={col.key === 'vendor' ? `vendors-${clientId}` : undefined}
          defaultValue={initial ?? rawOf(item, col)}
          inputMode={col.kind === 'money' ? 'decimal' : undefined}
          dir={col.kind === 'money' ? 'ltr' : undefined}
          className={cn('field h-8 w-full py-0 text-body', col.align === 'end' && 'text-end')}
          onFocus={(e) => { if (initial === undefined) e.currentTarget.select(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onFinish(item, col, e.currentTarget.value, 'Enter'); }
            else if (e.key === 'Tab') { e.preventDefault(); onFinish(item, col, e.currentTarget.value, e.shiftKey ? 'ShiftTab' : 'Tab'); }
            else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
          }}
          onBlur={(e) => onFinish(item, col, e.currentTarget.value)}
        />
      </td>
    );
  }

  let body: ReactNode;
  switch (col.key) {
    case 'label':
      body = (
        <span className="flex items-center gap-1.5">
          {item.source.startsWith('ai_suggestion:') && (
            <Link href="/app/inbox" title={fill(c.fromAi, { date: fmt(item.created_at ?? null) })} className="text-accent" onClick={(e) => e.stopPropagation()}>
              <Sparkles size={13} strokeWidth={1.5} aria-hidden /><span className="sr-only">{c.openInbox}</span>
            </Link>
          )}
          {producer && !item.visible_to_couple && <EyeOff size={13} strokeWidth={1.5} aria-label={c.hiddenFromCouple} className="text-ink-mute" />}
          <span className="truncate">{item.label}</span>
        </span>
      );
      break;
    case 'status': body = <StatusDot tone={item.status} label={c.statuses[item.status as keyof typeof c.statuses] ?? item.status} />; break;
    case 'estimate': body = <Money value={math.planned} />; break;
    case 'quoted': body = math.quoted === null ? <span className="text-ink-mute">·</span> : <Money value={math.quoted} />; break;
    case 'agreed':
      body = item.agreed === null || item.agreed === '' ? <span className="text-ink-mute">·</span> : item.per_guest ? (
        <span className="block leading-tight">
          <span className="block"><Said text={c.perGuestRow.replace('{price}', '{amount}')} amount={Number(item.agreed)} vars={{ n: math.guests ?? 0 }} /></span>
          <span className="block text-meta text-ink-mute"><Money value={math.agreedIncl} /></span>
        </span>
      ) : <Money value={math.agreedIncl} className={cn(math.variance > 0 && 'text-bad')} />;
      break;
    case 'includes_vat': body = <span className="text-meta text-ink-soft">{item.includes_vat ? c.vatIncl : c.vatExcl}</span>; break;
    case 'paid': body = <button type="button" className="underline-offset-2 hover:underline" onClick={(e) => { e.stopPropagation(); onPay(item.id); }}><Money value={math.paid} /></button>; break;
    case 'remaining': body = <Money value={math.remaining} />; break;
    case 'next': body = math.nextDue ? <span className="text-meta"><Money value={math.nextDue.amount} /> · {fmt(math.nextDue.date)}</span> : <span className="text-ink-mute">·</span>; break;
    case 'notes': body = <span className="block max-w-[220px] truncate text-meta text-ink-soft">{item.notes}</span>; break;
    case 'internal': body = <span className="block max-w-[220px] truncate text-meta text-ink-soft">{notes[item.id] ?? ''}</span>; break;
    default: body = <span className="truncate">{rawOf(item, col)}</span>;
  }
  return (
    <td className={cn(base, 'cursor-cell')} onClick={() => onPick(pos)} onDoubleClick={open}>
      {body}
    </td>
  );
}

/* ── a card's fields, on a phone ──────────────────────────────────────────── */

function CardFields({ item, c, areas, producer, note, commit, onPayments, onRemove }: {
  item: GridItem; c: Grid; areas: Record<PlanCategory, string>; producer: boolean; note: string;
  commit: (id: string, field: string, value: unknown) => void; onPayments: () => void; onRemove: () => void;
}) {
  const money = (field: 'estimate' | 'quoted' | 'agreed', label: string) => (
    <label className="min-w-0">
      <span className="mb-1 block text-meta text-ink-soft">{label}</span>
      <input className="field" inputMode="decimal" dir="ltr" defaultValue={item[field] === null ? '' : String(item[field])}
        onBlur={(e) => { const n = parseCell(e.currentTarget.value); if (n !== undefined) commit(item.id, field, field === 'estimate' ? (n ?? 0) : n); }} />
    </label>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="col-span-2 min-w-0">
        <span className="mb-1 block text-meta text-ink-soft">{c.colLabel}</span>
        <input className="field" defaultValue={item.label} onBlur={(e) => commit(item.id, 'label', e.currentTarget.value.trim())} />
      </label>
      <label className="min-w-0">
        <span className="mb-1 block text-meta text-ink-soft">{c.colVendor}</span>
        <input className="field" defaultValue={item.vendor} onBlur={(e) => commit(item.id, 'vendor', e.currentTarget.value.trim())} />
      </label>
      <label className="min-w-0">
        <span className="mb-1 block text-meta text-ink-soft">{c.colStatus}</span>
        <select className="field" defaultValue={item.status} onChange={(e) => commit(item.id, 'status', e.target.value)}>
          {BUDGET_STATUSES.map((s) => <option key={s} value={s}>{c.statuses[s]}</option>)}
        </select>
      </label>
      {money('estimate', c.colPlanned)}
      {money('quoted', c.colQuoted)}
      {money('agreed', c.colAgreed)}
      <label className="min-w-0">
        <span className="mb-1 block text-meta text-ink-soft">{c.colVat}</span>
        <select className="field" defaultValue={item.includes_vat ? 'true' : 'false'} onChange={(e) => commit(item.id, 'includes_vat', e.target.value === 'true')}>
          <option value="true">{c.vatIncl}</option><option value="false">{c.vatExcl}</option>
        </select>
      </label>
      <label className="flex min-w-0 items-center gap-2 text-body text-ink-soft">
        <input type="checkbox" className="size-4" defaultChecked={item.per_guest} onChange={(e) => commit(item.id, 'per_guest', e.target.checked)} />{c.perGuest}
      </label>
      <label className="min-w-0">
        <span className="mb-1 block text-meta text-ink-soft">{c.payers.couple}</span>
        <select className="field" defaultValue={item.paid_by} onChange={(e) => commit(item.id, 'paid_by', e.target.value)}>
          {PAYERS.map((p) => <option key={p} value={p}>{c.payers[p]}</option>)}
        </select>
      </label>
      <label className="col-span-2 min-w-0">
        <span className="mb-1 block text-meta text-ink-soft">{areas.other ? c.colStatus : ''}</span>
        <select className="field" defaultValue={categoryOf(item)} onChange={(e) => commit(item.id, 'category', e.target.value)}>
          {PLAN_CATEGORIES.map((k) => <option key={k} value={k}>{areas[k]}</option>)}
        </select>
      </label>
      <label className="col-span-2 min-w-0">
        <span className="mb-1 block text-meta text-ink-soft">{c.colNotes}</span>
        <textarea className="field min-h-[64px]" defaultValue={item.notes} onBlur={(e) => commit(item.id, 'notes', e.currentTarget.value.trim())} />
      </label>
      {producer && (
        <label className="col-span-2 min-w-0">
          <span className="mb-1 block text-meta text-ink-soft">{c.colInternal}</span>
          <textarea className="field min-h-[64px]" defaultValue={note} onBlur={(e) => commit(item.id, 'internal', e.currentTarget.value.trim())} />
        </label>
      )}
      {producer && (
        <label className="col-span-2 flex items-center gap-2 text-body text-ink-soft">
          <input type="checkbox" className="size-4" defaultChecked={item.visible_to_couple} onChange={(e) => commit(item.id, 'visible_to_couple', e.target.checked)} />{c.colVisible}
        </label>
      )}
      <div className="col-span-2 flex items-center justify-between pt-2">
        <button type="button" className="btn-quiet text-body" onClick={onPayments}><Wallet size={14} strokeWidth={1.5} aria-hidden /> {c.colPaid}</button>
        <button type="button" className="btn-quiet px-2 py-1 text-body text-bad" onClick={onRemove}>{c.payRemove}</button>
      </div>
    </div>
  );
}

/* ── the payments behind a line ───────────────────────────────────────────── */

function PaymentsList({ item, clientId, c, payments, remaining, fmt, say, setPayments }: {
  item: GridItem; clientId: string; c: Grid; payments: GridPayment[]; remaining: number;
  fmt: (iso: string | null) => string; say: (t: string) => void;
  setPayments: React.Dispatch<React.SetStateAction<GridPayment[]>>;
}) {
  const [, start] = useTransition();
  const [n, setN] = useState(3);

  const add = async (f: FormData) => {
    f.set('item_id', item.id); f.set('client_id', clientId);
    const r = await addBudgetPayment(null, f);
    if (!r.ok || !r.id) { say(r.error ?? c.saveFailed); return; }
    setPayments((prev) => [...prev, {
      id: r.id as string, item_id: item.id, amount: Number(String(f.get('amount') ?? '').replace(/[^\d.]/g, '')) || 0,
      paid_at: String(f.get('paid_at') ?? '') || null, due_at: String(f.get('due_at') ?? '') || null,
      method: String(f.get('method') ?? ''), paid_by: String(f.get('paid_by') ?? ''), reference: String(f.get('reference') ?? ''), notes: '',
    }]);
  };
  const mark = (p: GridPayment, paid: boolean) => {
    const was = p.paid_at;
    setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, paid_at: paid ? new Date().toISOString().slice(0, 10) : null } : x)));
    start(async () => {
      const f = new FormData(); f.set('payment_id', p.id); f.set('client_id', clientId); f.set('paid', String(paid));
      const r = await setBudgetPaymentPaid(null, f);
      if (!r.ok) { setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, paid_at: was } : x))); say(r.error ?? c.saveFailed); }
    });
  };
  const remove = (p: GridPayment) => {
    setPayments((prev) => prev.filter((x) => x.id !== p.id));
    start(async () => {
      const f = new FormData(); f.set('payment_id', p.id); f.set('client_id', clientId);
      const r = await deleteBudgetPayment(null, f);
      if (!r.ok) { setPayments((prev) => [...prev, p]); say(r.error ?? c.saveFailed); }
    });
  };
  const split = () => {
    start(async () => {
      const f = new FormData(); f.set('item_id', item.id); f.set('client_id', clientId); f.set('count', String(n)); f.set('remaining', String(remaining));
      const r = await splitBudgetPayments(null, f);
      if (!r.ok) say(r.error ?? c.saveFailed);
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-body text-ink-soft"><Said text={c.payRemaining} amount={remaining} /></p>
      {payments.length === 0 ? <p className="text-body text-ink-mute">{c.payNone}</p> : (
        <ul className="list-none space-y-px overflow-hidden rounded-card-sm border border-line p-0">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 bg-card px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-body tabular-nums text-ink"><Money value={Number(p.amount)} /></span>
                <span className="block text-meta text-ink-mute">
                  {p.paid_at ? `${c.payPaid} ${fmt(p.paid_at)}` : p.due_at ? `${c.payDue} ${fmt(p.due_at)}` : c.payOpen}
                  {p.method && ` · ${c.methods[p.method as keyof typeof c.methods] ?? p.method}`}
                  {p.reference && ` · ${p.reference}`}
                </span>
              </span>
              <StatusDot tone={p.paid_at ? 'ok' : 'warn'} label={p.paid_at ? c.payPaid : c.payOpen} className="text-meta" />
              <button type="button" className="btn-quiet px-2 py-1 text-meta" onClick={() => mark(p, !p.paid_at)}>{p.paid_at ? c.payUnmark : c.payMark}</button>
              <button type="button" className="btn-quiet px-2 py-1 text-meta text-bad" onClick={() => remove(p)}>{c.payRemove}</button>
            </li>
          ))}
        </ul>
      )}

      <form action={add} className="grid grid-cols-2 gap-3 border-t border-line pt-4">
        <label className="min-w-0">
          <span className="mb-1 block text-meta text-ink-soft">{c.payAmount}</span>
          <input name="amount" required inputMode="decimal" dir="ltr" className="field" autoComplete="off" />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-meta text-ink-soft">{c.payDue}</span>
          <input name="due_at" type="date" className="field" />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-meta text-ink-soft">{c.payPaidOn}</span>
          <input name="paid_at" type="date" className="field" />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-meta text-ink-soft">{c.payMethod}</span>
          <select name="method" className="field" defaultValue="">
            {METHODS.map((m) => <option key={m} value={m}>{c.methods[m as keyof typeof c.methods]}</option>)}
          </select>
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-meta text-ink-soft">{c.payBy}</span>
          <input name="paid_by" className="field" autoComplete="off" />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-meta text-ink-soft">{c.payRef}</span>
          <input name="reference" className="field" autoComplete="off" />
        </label>
        <div className="col-span-2"><button type="submit" className="btn-primary">{c.payAdd}</button></div>
      </form>

      {remaining > 0 && (
        <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <label className="min-w-0">
            <span className="mb-1 block text-meta text-ink-soft">{c.paySplitN}</span>
            <input type="number" min={2} max={24} value={n} onChange={(e) => setN(Number(e.target.value) || 2)} className="field w-24" dir="ltr" />
          </label>
          <button type="button" className="btn-quiet text-body" onClick={split}>{c.paySplit}</button>
        </div>
      )}
    </div>
  );
}
