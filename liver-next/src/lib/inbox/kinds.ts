/**
 * What a suggested action may ask to write, and the shape each one takes.
 *
 * Pure, so the test next door can hold every kind to its rule. The model
 * proposes a payload; nothing of it reaches a table until `validateAction`
 * has turned it into exactly the columns the write will use, and refused
 * what it cannot. A budget line with no amount is not a budget line, a task
 * with no title is not a task, and a payment marked paid on a date that is
 * not a date is the kind of row this whole file exists to keep out.
 */

export const ACTION_KINDS = [
  'budget_add_item', 'budget_update_item', 'budget_mark_paid',
  'vendor_create', 'vendor_update',
  'task_create', 'task_complete',
  'timeline_update', 'couple_field_update', 'meeting_summary', 'reply_draft',
] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export const isActionKind = (k: string): k is ActionKind => (ACTION_KINDS as readonly string[]).includes(k);

/** The kinds that write nothing to the event: approving them marks them
 *  applied and that is the whole act. */
export const QUIET_KINDS = new Set<ActionKind>(['reply_draft']);

export type Valid =
  | { ok: true; kind: ActionKind; data: Record<string, unknown> }
  | { ok: false; error: string };

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const money = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[^\d.]/g, '')) : NaN;
  return Number.isFinite(n) && n >= 0 && n < 100_000_000 ? Math.round(n * 100) / 100 : null;
};
const isoDate = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v.trim());
  return m && !Number.isNaN(Date.parse(m[1] + 'T00:00:00Z')) ? m[1] : null;
};
const clockTime = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)/.exec(v.trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
};
const uuid = (v: unknown): string | null =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;

const VENDOR_STATES = new Set(['shortlist', 'booked', 'cancelled']);
const COUPLE_FIELDS = new Set(['guest_estimate', 'event_date', 'venue', 'contact_phone', 'contact_email']);

export function validateAction(kind: string, payload: unknown): Valid {
  if (!isActionKind(kind)) return { ok: false, error: `סוג פעולה לא מוכר: ${kind}` };
  const p = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;

  switch (kind) {
    case 'budget_add_item': {
      const label = str(p.label, 120) || str(p.vendor_name, 120);
      const estimate = money(p.amount_quoted ?? p.estimate ?? p.amount);
      if (!label) return { ok: false, error: 'שורת תקציב בלי שם' };
      if (estimate === null) return { ok: false, error: 'שורת תקציב בלי סכום' };
      /* A line born from a quote is a quote: the figure goes into the
         quote column and the status says so, and the plan takes the same
         figure so the sheet has something to measure against. */
      const agreed = money(p.agreed);
      return { ok: true, kind, data: {
        category: str(p.category, 40), label, estimate, quoted: estimate, agreed,
        status: agreed !== null ? 'booked' : 'quoted',
        vendor: str(p.vendor_name ?? p.vendor, 120), notes: str(p.notes, 2000),
      } };
    }
    case 'budget_update_item': {
      const id = uuid(p.budget_item_id ?? p.id);
      if (!id) return { ok: false, error: 'עדכון תקציב בלי שורה' };
      const data: Record<string, unknown> = { id };
      const agreed = money(p.agreed);
      if (agreed !== null) { data.agreed = agreed; data.status = 'booked'; }
      const quoted = money(p.quoted ?? p.amount_quoted ?? p.amount);
      if (quoted !== null) data.quoted = quoted;
      const estimate = money(p.estimate);
      if (estimate !== null) data.estimate = estimate;
      if (str(p.status, 20) && ['idea', 'quoted', 'booked', 'paid', 'cancelled'].includes(str(p.status, 20))) data.status = str(p.status, 20);
      if (str(p.vendor_name ?? p.vendor, 120)) data.vendor = str(p.vendor_name ?? p.vendor, 120);
      if (str(p.notes, 2000)) data.notes = str(p.notes, 2000);
      if (Object.keys(data).length === 1) return { ok: false, error: 'עדכון תקציב בלי מה לעדכן' };
      return { ok: true, kind, data };
    }
    case 'budget_mark_paid': {
      /* Two shapes. A payment on the couple's schedule is marked paid; a
         sum paid to a supplier against a budget line is recorded as a new
         payment on that line. */
      const itemId = uuid(p.budget_item_id);
      const paid_on = isoDate(p.paid_on) ?? null;
      if (itemId) {
        const amount = money(p.amount ?? p.amount_paid);
        if (amount === null || amount <= 0) return { ok: false, error: 'תשלום לספק בלי סכום' };
        return { ok: true, kind, data: { item_id: itemId, amount, paid_on, reference: str(p.reference, 80) } };
      }
      const id = uuid(p.payment_id ?? p.id);
      if (!id) return { ok: false, error: 'תשלום בלי שורה' };
      return { ok: true, kind, data: { id, paid_on } };
    }
    case 'vendor_create': {
      const name = str(p.name ?? p.vendor_name, 120);
      if (!name) return { ok: false, error: 'ספק בלי שם' };
      return { ok: true, kind, data: {
        name, category: str(p.category, 40), contact_name: str(p.contact_name, 120),
        phone: str(p.phone, 40), email: str(p.email, 160).toLowerCase(), notes: str(p.notes, 2000),
        status: VENDOR_STATES.has(str(p.status, 20)) ? str(p.status, 20) : 'shortlist',
      } };
    }
    case 'vendor_update': {
      const id = uuid(p.vendor_id ?? p.id);
      if (!id) return { ok: false, error: 'עדכון ספק בלי ספק' };
      const data: Record<string, unknown> = { id };
      for (const k of ['contact_name', 'phone', 'email', 'notes', 'category'] as const) {
        const v = str(p[k], k === 'notes' ? 2000 : 120);
        if (v) data[k] = k === 'email' ? v.toLowerCase() : v;
      }
      if (Object.keys(data).length === 1) return { ok: false, error: 'עדכון ספק בלי מה לעדכן' };
      return { ok: true, kind, data };
    }
    case 'task_create': {
      const title = str(p.title, 200);
      if (title.length < 2) return { ok: false, error: 'משימה בלי כותרת' };
      return { ok: true, kind, data: {
        title, due_on: isoDate(p.due_date ?? p.due_on), owner: p.owner === 'client' ? 'client' : 'producer',
        notes: str(p.notes, 2000),
      } };
    }
    case 'task_complete': {
      const id = uuid(p.task_id ?? p.id);
      if (!id) return { ok: false, error: 'סגירת משימה בלי משימה' };
      return { ok: true, kind, data: { id } };
    }
    case 'timeline_update': {
      const title = str(p.title, 200);
      const at = clockTime(p.at_time ?? p.time);
      if (!title) return { ok: false, error: 'שורת לוז בלי כותרת' };
      if (!at) return { ok: false, error: 'שורת לוז בלי שעה' };
      return { ok: true, kind, data: { title, at_time: at, note: str(p.note ?? p.notes, 2000), id: uuid(p.schedule_id ?? p.id) } };
    }
    case 'couple_field_update': {
      const field = str(p.field, 40);
      if (!COUPLE_FIELDS.has(field)) return { ok: false, error: `שדה לא ניתן לעדכון: ${field || '?'}` };
      let value: unknown = p.value;
      if (field === 'guest_estimate') {
        const n = money(value);
        if (n === null || n <= 0 || n > 5000) return { ok: false, error: 'כמות אורחים לא תקינה' };
        value = Math.round(n);
      } else if (field === 'event_date') {
        value = isoDate(value);
        if (!value) return { ok: false, error: 'תאריך לא תקין' };
      } else {
        value = str(value, field === 'venue' ? 200 : 160);
        if (!value) return { ok: false, error: 'ערך ריק' };
      }
      return { ok: true, kind, data: { field, value } };
    }
    case 'meeting_summary': {
      const summary = str(p.summary, 20000);
      if (summary.length < 10) return { ok: false, error: 'סיכום קצר מדי' };
      return { ok: true, kind, data: { title: str(p.title, 200) || 'סיכום', summary, held_on: isoDate(p.held_on ?? p.date) } };
    }
    case 'reply_draft': {
      const text = str(p.text, 4000);
      if (!text) return { ok: false, error: 'טיוטה ריקה' };
      return { ok: true, kind, data: { channel: str(p.channel, 20) || 'whatsapp', text } };
    }
  }
}
