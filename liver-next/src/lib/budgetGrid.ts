/**
 * The budget as a sheet: what each line comes to, what the whole comes to,
 * and the small rules a spreadsheet cell has that a form field does not.
 *
 * Pure and client-safe, because the grid recomputes every total under the
 * finger the moment a cell changes and the server is told afterwards. If
 * the arithmetic lived in a server action the screen would wait a round
 * trip to know what it just typed adds up to. Everything here is also what
 * the Excel export writes, so the two cannot disagree.
 *
 * The three figures a couple should read in one second are `totals`:
 * planned, agreed, and what is left to pay. The fourth and fifth are the
 * producer's: the overrun, and how many quotes wait for a decision.
 */
import { sumIls, toAgorot } from './money.ts';
import { PLAN_CATEGORIES, categoryOf, type PlanCategory } from './budgetPlan.ts';

export const BUDGET_STATUSES = ['idea', 'quoted', 'booked', 'paid', 'cancelled'] as const;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];
export const PAYERS = ['couple', 'parents_a', 'parents_b', 'split'] as const;
export type Payer = (typeof PAYERS)[number];
export const METHODS = ['', 'transfer', 'bit', 'card', 'cash', 'check'] as const;

export type GridItem = {
  id: string;
  category: string | null;
  label: string;
  vendor: string;
  estimate: number | string;
  quoted: number | string | null;
  agreed: number | string | null;
  status: string;
  includes_vat: boolean;
  vat_rate: number | string;
  per_guest: boolean;
  guest_count_override: number | null;
  notes: string;
  paid_by: string;
  due_date: string | null;
  visible_to_couple: boolean;
  sort_order: number;
  source: string;
  created_at?: string;
  updated_at?: string;
  event_vendor_id?: string | null;
};

export type GridPayment = {
  id: string;
  item_id: string;
  amount: number | string;
  paid_at: string | null;
  due_at: string | null;
  method: string;
  paid_by: string;
  reference: string;
  notes: string;
};

const num = (v: number | string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number): number => toAgorot(n) / 100;

export type LineMath = {
  planned: number;
  /** The quote, with VAT the way the line says. Null without a quote. */
  quoted: number | null;
  /** The agreed figure before VAT and after the per-plate multiply. */
  agreedGross: number | null;
  /** What the line actually costs: gross, plus VAT when the price excludes it. */
  agreedIncl: number | null;
  /** Agreed when it exists, else the quote, else the plan: what this line
   *  will cost as far as anybody knows today. */
  expected: number;
  paid: number;
  remaining: number;
  nextDue: { amount: number; date: string } | null;
  /** Expected minus planned. Positive is an overrun. */
  variance: number;
  /** How many guests the per-plate price multiplies by. */
  guests: number | null;
};

/** The guest count a per-plate line multiplies by: its own override when
 *  it has one, else the event's. */
export function guestsFor(item: Pick<GridItem, 'per_guest' | 'guest_count_override'>, eventGuests: number | null): number | null {
  if (!item.per_guest) return null;
  if (item.guest_count_override !== null && item.guest_count_override !== undefined) return item.guest_count_override;
  return eventGuests;
}

/** A figure as the line says it: times the plates when it is per plate,
 *  plus VAT when the price is quoted without it. */
export function withVat(value: number | string | null, item: Pick<GridItem, 'includes_vat' | 'vat_rate' | 'per_guest' | 'guest_count_override'>, eventGuests: number | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const g = guestsFor(item, eventGuests);
  const gross = item.per_guest ? num(value) * (g ?? 0) : num(value);
  return r2(item.includes_vat ? gross : gross * (1 + num(item.vat_rate)));
}

export function computeLine(item: GridItem, payments: readonly GridPayment[], eventGuests: number | null): LineMath {
  const planned = num(item.estimate);
  const quoted = withVat(item.quoted, item, eventGuests);
  const g = guestsFor(item, eventGuests);
  const agreedGross = item.agreed === null || item.agreed === '' ? null
    : r2(item.per_guest ? num(item.agreed) * (g ?? 0) : num(item.agreed));
  const agreedIncl = withVat(item.agreed, item, eventGuests);
  const expected = agreedIncl ?? quoted ?? planned;
  const mine = payments.filter((p) => p.item_id === item.id);
  const paid = sumIls(mine.filter((p) => p.paid_at).map((p) => num(p.amount)));
  const remaining = Math.max(0, r2((agreedIncl ?? 0) - paid));
  const due = mine.filter((p) => !p.paid_at && p.due_at).sort((a, b) => (a.due_at as string).localeCompare(b.due_at as string))[0];
  return {
    planned, quoted, agreedGross, agreedIncl, expected, paid, remaining,
    nextDue: due ? { amount: num(due.amount), date: due.due_at as string } : null,
    variance: r2(expected - planned),
    guests: g,
  };
}

export type Totals = {
  planned: number;
  /** The ceiling the couple set, or the plan's own sum when they did not. */
  budget: number;
  agreed: number;
  /** Agreed when it exists, else quote, else plan, over every live line. */
  expected: number;
  paid: number;
  remaining: number;
  /** Agreed as a share of the budget, 0 to 1 and past 1 when over. Null
   *  when there is no budget to measure against. */
  closedShare: number | null;
  /** Expected minus budget. Positive is an overrun. Null without a budget. */
  overrun: number | null;
  quotedCount: number;
  nextDue: { amount: number; date: string; label: string } | null;
};

export const isLive = (item: Pick<GridItem, 'status'>): boolean => item.status !== 'cancelled';

export function totals(items: readonly GridItem[], payments: readonly GridPayment[], eventGuests: number | null, target: number | null): Totals {
  const live = items.filter(isLive);
  const lines = live.map((i) => computeLine(i, payments, eventGuests));
  const planned = sumIls(lines.map((l) => l.planned));
  const budget = target !== null && Number.isFinite(target) && target > 0 ? target : planned;
  const agreed = sumIls(lines.map((l) => l.agreedIncl ?? 0));
  const expected = sumIls(lines.map((l) => l.expected));
  const paid = sumIls(lines.map((l) => l.paid));
  const remaining = sumIls(lines.map((l) => l.remaining));
  let next: Totals['nextDue'] = null;
  live.forEach((i, k) => {
    const d = lines[k].nextDue;
    if (d && (!next || d.date < next.date)) next = { ...d, label: i.label };
  });
  return {
    planned, budget, agreed, expected, paid, remaining,
    closedShare: budget > 0 ? agreed / budget : null,
    overrun: budget > 0 ? r2(expected - budget) : null,
    quotedCount: live.filter((i) => i.status === 'quoted').length,
    nextDue: next,
  };
}

/* ── groups ──────────────────────────────────────────────────────────────── */

export type Group = { key: PlanCategory; items: GridItem[]; math: LineMath[] };

/** The lines by area in the plan's own order, each area in its sort order.
 *  An area with nothing in it is not a group: the header row is a sum, and
 *  a sum over nothing is a heading over nothing. */
export function groupItems(items: readonly GridItem[], payments: readonly GridPayment[], eventGuests: number | null, showCancelled = false): Group[] {
  const by = new Map<PlanCategory, GridItem[]>();
  for (const i of items) {
    if (!showCancelled && !isLive(i)) continue;
    const k = categoryOf(i);
    const list = by.get(k) ?? [];
    list.push(i);
    by.set(k, list);
  }
  const out: Group[] = [];
  for (const key of PLAN_CATEGORIES) {
    const list = by.get(key);
    if (!list) continue;
    list.sort((a, b) => (a.sort_order - b.sort_order) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
    out.push({ key, items: list, math: list.map((i) => computeLine(i, payments, eventGuests)) });
  }
  return out;
}

export function groupTotal(g: Group): { planned: number; expected: number; agreed: number; paid: number; remaining: number } {
  return {
    planned: sumIls(g.math.map((m) => m.planned)),
    expected: sumIls(g.math.map((m) => m.expected)),
    agreed: sumIls(g.math.map((m) => m.agreedIncl ?? 0)),
    paid: sumIls(g.math.map((m) => m.paid)),
    remaining: sumIls(g.math.map((m) => m.remaining)),
  };
}

/* ── what somebody typed ─────────────────────────────────────────────────── */

/**
 * A number the way people write one into a budget: `12000`, `12,000`,
 * `12k`, `12.5k`, `12 אלף`, `₪12,000`, `12,000 ש"ח`. Blank is null, which
 * clears the cell, and anything that is not a number is undefined, which
 * the cell refuses rather than writing zero.
 */
export function parseCell(raw: string): number | null | undefined {
  const s = raw.trim();
  if (!s) return null;
  const thousands = /^(.*?)\s*(k|K|אלף)$/.exec(s);
  /* The sign is stripped by its code point: this is a parser taking a
     symbol off, not a screen putting one on. */
  const body = (thousands ? thousands[1] : s).replace(/[\s,\u20AA]/g, '').replace(/ש"ח|ש״ח|שח/g, '');
  if (!/^-?\d*\.?\d+$/.test(body)) return undefined;
  const n = Number(body) * (thousands ? 1000 : 1);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return r2(n);
}

/** A pasted range, as rows of cells. Tabs between cells and newlines
 *  between rows is what every spreadsheet puts on the clipboard. */
export function parseTsv(text: string): string[][] {
  return text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map((line) => line.split('\t'));
}

/* ── undo ────────────────────────────────────────────────────────────────── */

export type Change = { itemId: string; field: string; before: unknown; after: unknown };
export const UNDO_LIMIT = 50;

/** The stack with one more change on it and never more than fifty. */
export function pushChange(stack: readonly Change[], change: Change, limit = UNDO_LIMIT): Change[] {
  const next = [...stack, change];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/* ── splitting what is left ──────────────────────────────────────────────── */

function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, last);
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * What is left, as `n` equal payments a month apart starting a month from
 * `from`. Equal to the agora, with the remainder on the last one, so the
 * parts add back to the whole exactly: 10,000 in three is 3,333.33 twice
 * and 3,333.34 once, never 9,999.99.
 */
export function splitRemaining(remaining: number, n: number, from: string): { amount: number; due_at: string }[] {
  const count = Math.max(1, Math.min(24, Math.floor(n)));
  const total = toAgorot(remaining);
  if (total <= 0) return [];
  const each = Math.floor(total / count);
  const out: { amount: number; due_at: string }[] = [];
  for (let k = 0; k < count; k++) {
    const agorot = k === count - 1 ? total - each * (count - 1) : each;
    out.push({ amount: agorot / 100, due_at: addMonths(from, k + 1) });
  }
  return out;
}

/* ── moving between cells ────────────────────────────────────────────────── */

export type CellPos = { row: number; col: number };

/**
 * The next cell for a key. Tab is the next column and wraps to the next
 * row; Enter is the row below in the same column. The sheet is drawn
 * right to left, so "next" is visually leftwards, which is what a Hebrew
 * speaker's Tab has always done in Excel. Stays put at the edges rather
 * than wrapping around the sheet.
 */
export function moveCell(pos: CellPos, key: 'Tab' | 'ShiftTab' | 'Enter' | 'Up' | 'Down' | 'Left' | 'Right', rows: number, cols: number): CellPos {
  const clamp = (p: CellPos): CellPos => ({
    row: Math.max(0, Math.min(rows - 1, p.row)), col: Math.max(0, Math.min(cols - 1, p.col)),
  });
  switch (key) {
    case 'Tab':
      if (pos.col + 1 < cols) return { row: pos.row, col: pos.col + 1 };
      return pos.row + 1 < rows ? { row: pos.row + 1, col: 0 } : pos;
    case 'ShiftTab':
      if (pos.col > 0) return { row: pos.row, col: pos.col - 1 };
      return pos.row > 0 ? { row: pos.row - 1, col: cols - 1 } : pos;
    case 'Enter':
    case 'Down':
      return clamp({ row: pos.row + 1, col: pos.col });
    case 'Up':
      return clamp({ row: pos.row - 1, col: pos.col });
    /* The sheet is RTL: the arrow pointing left moves to the next column. */
    case 'Left':
      return clamp({ row: pos.row, col: pos.col + 1 });
    case 'Right':
      return clamp({ row: pos.row, col: pos.col - 1 });
  }
}

/* ── the plan as a starting point ────────────────────────────────────────── */

/** Planned lines from a total and a split, for a budget with nothing in it:
 *  one line per area with the area's share of the total, so a couple opens
 *  a sheet with figures on it rather than a blank one. */
export function seedLines(total: number, splits: Record<PlanCategory, number>, labels: Record<PlanCategory, string>): { category: PlanCategory; label: string; estimate: number }[] {
  return PLAN_CATEGORIES
    .filter((k) => splits[k] > 0)
    .map((k) => ({ category: k, label: labels[k], estimate: r2(total * splits[k] / 100) }));
}
