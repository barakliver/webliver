'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  addGuest,
  assignGuestToTable,
  deleteGuest,
  deleteTable,
  importGuestsCsv,
  updateGuest,
  upsertTable,
} from '@/app/actions/workspace';
import { useRealtimeRows } from '@/lib/hooks/useRealtimeRows';
import { ConnectionBadge } from './BrideMode';
import type {
  GuestRow,
  MealPreference,
  RsvpStatus,
  SeatingTableRow,
} from '@/lib/supabase/database.types';

/**
 * Interactive RSVP & table seating engine.
 *
 * Guest list with CSV import, personalized RSVP links, meal preference tags,
 * and a drag-and-drop seating chart. dnd-kit is used rather than HTML5 drag
 * events because the couple works from a phone, where HTML5 DnD does not fire.
 */

const MEALS: { key: MealPreference; he: string; icon: string }[] = [
  { key: 'regular', he: 'רגיל', icon: '🍽' },
  { key: 'vegan', he: 'טבעוני', icon: '🌱' },
  { key: 'vegetarian', he: 'צמחוני', icon: '🥗' },
  { key: 'gluten_free', he: 'ללא גלוטן', icon: '🌾' },
  { key: 'kosher', he: 'כשר', icon: '✡️' },
  { key: 'child', he: 'ילדים', icon: '🧒' },
];
const MEAL_LABEL = new Map(MEALS.map((m) => [m.key, m]));

const STATUS_LABEL: Record<RsvpStatus, { he: string; cls: string }> = {
  pending: { he: 'ממתין', cls: 'badge badge-wait' },
  attending: { he: 'מגיע', cls: 'badge badge-live' },
  declined: { he: 'לא מגיע', cls: 'badge badge-off' },
  maybe: { he: 'אולי', cls: 'badge badge-wait' },
};

const UNSEATED = 'unseated';

interface Props {
  clientId: string;
  initialGuests: GuestRow[];
  initialTables: SeatingTableRow[];
  siteUrl: string;
}

export default function RsvpSeatingEngine({
  clientId,
  initialGuests,
  initialTables,
  siteUrl,
}: Props) {
  const guests = useRealtimeRows({
    table: 'guests_rsvp',
    clientId,
    initial: initialGuests,
    sort: (a, b) => a.full_name.localeCompare(b.full_name, 'he'),
  });
  const tables = useRealtimeRows({
    table: 'tables_seating',
    clientId,
    initial: initialTables,
    sort: (a, b) => a.label.localeCompare(b.label, 'he', { numeric: true }),
  });

  const [tab, setTab] = useState<'guests' | 'seating'>('guests');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState<GuestRow | null>(null);
  const [pending, startTransition] = useTransition();
  const csvRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const stats = useMemo(() => {
    const rows = guests.rows;
    const attending = rows.filter((g) => g.status === 'attending');
    const seats = attending.reduce((sum, g) => sum + g.party_size, 0);
    const meals = new Map<MealPreference, number>();
    for (const g of attending) {
      meals.set(g.meal_preference, (meals.get(g.meal_preference) ?? 0) + g.party_size);
    }
    return {
      total: rows.length,
      attending: attending.length,
      declined: rows.filter((g) => g.status === 'declined').length,
      pending: rows.filter((g) => g.status === 'pending').length,
      seats,
      seated: attending.filter((g) => g.table_id).reduce((s, g) => s + g.party_size, 0),
      meals,
      giftCount: rows.filter((g) => g.gift_method && g.gift_method !== 'none').length,
    };
  }, [guests.rows]);

  const byTable = useMemo(() => {
    const map = new Map<string, GuestRow[]>();
    map.set(UNSEATED, []);
    for (const table of tables.rows) map.set(table.id, []);
    for (const guest of guests.rows) {
      if (guest.status === 'declined') continue;
      const key = guest.table_id && map.has(guest.table_id) ? guest.table_id : UNSEATED;
      map.get(key)!.push(guest);
    }
    return map;
  }, [guests.rows, tables.rows]);

  function move(guestId: string, tableId: string | null) {
    const snapshot = guests.rows;
    guests.setRows((current) =>
      current.map((g) => (g.id === guestId ? { ...g, table_id: tableId } : g)),
    );
    setError(null);
    startTransition(async () => {
      const result = await assignGuestToTable({ clientId, guestId, tableId });
      if (!result.ok) {
        guests.setRows(snapshot);
        setError(result.error ?? 'לא הצלחנו לשבץ.');
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const guestId = String(event.active.id);
    const over = event.over?.id ? String(event.over.id) : null;
    if (!over) return;
    const target = over === UNSEATED ? null : over;
    const guest = guests.rows.find((g) => g.id === guestId);
    if (!guest || (guest.table_id ?? null) === target) return;
    move(guestId, target);
  }

  function handleDragStart(event: DragStartEvent) {
    setDragging(guests.rows.find((g) => g.id === String(event.active.id)) ?? null);
  }

  async function handleCsv(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotice(null);
    const text = await file.text();
    const result = await importGuestsCsv({ clientId, csv: text });
    if (!result.ok) {
      setError(result.error ?? 'הייבוא נכשל.');
    } else {
      const { inserted, skipped } = result.data!;
      setNotice(
        `יובאו ${inserted} אורחים.` + (skipped.length ? ` ${skipped.length} שורות דולגו.` : ''),
      );
      await guests.refresh();
    }
    if (csvRef.current) csvRef.current.value = '';
  }

  return (
    <section className="stack" aria-labelledby="rsvp-title">
      <div className="spread">
        <div>
          <h2 id="rsvp-title" style={{ fontSize: 22 }}>
            📋 אישורי הגעה וסידור הושבה
          </h2>
          <p className="muted small">ניהול רשימת מוזמנים, קישורים אישיים והושבה בגרירה.</p>
        </div>
        <ConnectionBadge status={guests.status} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))' }}>
        <Stat n={stats.total} label="מוזמנים" />
        <Stat n={stats.attending} label="אישרו" tone="var(--green)" />
        <Stat n={stats.pending} label="ממתינים" tone="var(--amber)" />
        <Stat n={stats.declined} label="לא מגיעים" tone="var(--red)" />
        <Stat n={stats.seats} label="מקומות" />
        <Stat n={stats.giftCount} label="מתנות דיגיטליות" tone="var(--gold)" />
      </div>

      {stats.meals.size > 0 && (
        <div className="card">
          <b className="small">התפלגות מנות (למטבח)</b>
          <div className="row" style={{ marginTop: 8 }}>
            {MEALS.filter((m) => stats.meals.get(m.key)).map((m) => (
              <span key={m.key} className="chip" aria-pressed={false}>
                {m.icon} {m.he}: <b>{stats.meals.get(m.key)}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="row" role="tablist" aria-label="תצוגה">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'guests'}
          className="chip"
          aria-pressed={tab === 'guests'}
          onClick={() => setTab('guests')}
        >
          רשימת מוזמנים
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'seating'}
          className="chip"
          aria-pressed={tab === 'seating'}
          onClick={() => setTab('seating')}
        >
          מפת הושבה
        </button>
      </div>

      {error && (
        <div className="alert alert-err" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="alert alert-ok" role="status">
          {notice}
        </div>
      )}

      {tab === 'guests' ? (
        <GuestList
          clientId={clientId}
          rows={guests.rows}
          siteUrl={siteUrl}
          pending={pending}
          csvRef={csvRef}
          onCsv={handleCsv}
          onChanged={() => void guests.refresh()}
          onError={setError}
        />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          <SeatingBoard
            clientId={clientId}
            tables={tables.rows}
            byTable={byTable}
            onMove={move}
            onChanged={() => void tables.refresh()}
            onError={setError}
          />
          <DragOverlay>
            {dragging ? (
              <div className="card" style={{ padding: '8px 12px', boxShadow: '0 12px 30px rgba(0,0,0,.2)' }}>
                <b className="small">{dragging.full_name}</b>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </section>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 12 }}>
      <div className="serif" style={{ fontSize: 24, color: tone ?? 'inherit' }}>
        {n}
      </div>
      <div className="muted small">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guest list
// ---------------------------------------------------------------------------

function GuestList({
  clientId,
  rows,
  siteUrl,
  pending,
  csvRef,
  onCsv,
  onChanged,
  onError,
}: {
  clientId: string;
  rows: GuestRow[];
  siteUrl: string;
  pending: boolean;
  csvRef: React.RefObject<HTMLInputElement | null>;
  onCsv: (file: File | undefined) => Promise<void>;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [meal, setMeal] = useState<MealPreference>('regular');
  const [copied, setCopied] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    const result = await addGuest({
      clientId,
      full_name: name.trim(),
      party_size: partySize,
      meal_preference: meal,
      side: 'shared',
    });
    if (!result.ok) onError(result.error ?? 'ההוספה נכשלה.');
    else {
      setName('');
      setPartySize(1);
      onChanged();
    }
  }

  async function copyLink(token: string) {
    const url = `${siteUrl.replace(/\/$/, '')}/rsvp/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      onError('לא הצלחנו להעתיק. הקישור: ' + url);
    }
  }

  return (
    <div className="stack">
      <div className="card stack">
        <b className="small">הוספת מוזמן</b>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
          <div>
            <label htmlFor="g-name">שם</label>
            <input
              id="g-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
            />
          </div>
          <div>
            <label htmlFor="g-size">כמות</label>
            <input
              id="g-size"
              type="number"
              min={1}
              max={20}
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="g-meal">מנה</label>
            <select id="g-meal" value={meal} onChange={(e) => setMeal(e.target.value as MealPreference)}>
              {MEALS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.icon} {m.he}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <button type="button" className="btn btn-gold btn-sm" onClick={() => void submit()} disabled={pending}>
            הוספה
          </button>
          <label htmlFor="g-csv" className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
            ייבוא CSV
          </label>
          <input
            id="g-csv"
            ref={csvRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => void onCsv(e.target.files?.[0])}
          />
          <span className="muted small">עמודות: שם, מייל, טלפון, כמות, מנה</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <p className="muted">עדיין אין מוזמנים. הוסיפו ידנית או ייבאו קובץ CSV.</p>
        </div>
      ) : (
        <ul className="stack" style={{ listStyle: 'none' }}>
          {rows.map((guest) => {
            const meta = MEAL_LABEL.get(guest.meal_preference);
            const status = STATUS_LABEL[guest.status];
            return (
              <li key={guest.id} className="card">
                <div className="spread" style={{ flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <b>{guest.full_name}</b>{' '}
                    <span className={status.cls}>{status.he}</span>
                    <div className="muted small">
                      {guest.party_size} מקומות · {meta?.icon} {meta?.he}
                      {guest.allergies ? ` · אלרגיות: ${guest.allergies}` : ''}
                    </div>
                    {guest.blessing && (
                      <div className="small" style={{ marginTop: 4, fontStyle: 'italic' }}>
                        “{guest.blessing}”
                      </div>
                    )}
                    {guest.gift_method && guest.gift_method !== 'none' && (
                      <div className="muted small">
                        🎁 מתנה דיגיטלית: {guest.gift_method}
                        {guest.gift_amount ? ` · ₪${guest.gift_amount}` : ''}
                      </div>
                    )}
                  </div>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => void copyLink(guest.token)}
                    >
                      {copied === guest.token ? '✓ הועתק' : 'העתקת קישור אישי'}
                    </button>
                    <select
                      aria-label={`סטטוס עבור ${guest.full_name}`}
                      value={guest.status}
                      style={{ width: 'auto', fontSize: 12, padding: '5px 8px' }}
                      onChange={async (e) => {
                        const result = await updateGuest({
                          clientId,
                          id: guest.id,
                          patch: { status: e.target.value as RsvpStatus },
                        });
                        if (!result.ok) onError(result.error ?? 'העדכון נכשל.');
                        else onChanged();
                      }}
                    >
                      {(Object.keys(STATUS_LABEL) as RsvpStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s].he}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-red btn-xs"
                      onClick={async () => {
                        const result = await deleteGuest({ clientId, id: guest.id });
                        if (!result.ok) onError(result.error ?? 'המחיקה נכשלה.');
                        else onChanged();
                      }}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seating board
// ---------------------------------------------------------------------------

function SeatingBoard({
  clientId,
  tables,
  byTable,
  onMove,
  onChanged,
  onError,
}: {
  clientId: string;
  tables: SeatingTableRow[];
  byTable: Map<string, GuestRow[]>;
  onMove: (guestId: string, tableId: string | null) => void;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [capacity, setCapacity] = useState(12);

  async function addTable() {
    const next = label.trim() || `שולחן ${tables.length + 1}`;
    const result = await upsertTable({ clientId, label: next, capacity });
    if (!result.ok) onError(result.error ?? 'לא הצלחנו להוסיף שולחן.');
    else {
      setLabel('');
      onChanged();
    }
  }

  return (
    <div className="stack">
      <div className="card row">
        <div style={{ flex: '1 1 160px' }}>
          <label htmlFor="t-label">שם שולחן</label>
          <input
            id="t-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`שולחן ${tables.length + 1}`}
          />
        </div>
        <div style={{ flex: '0 1 110px' }}>
          <label htmlFor="t-cap">מקומות</label>
          <input
            id="t-cap"
            type="number"
            min={1}
            max={40}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
        </div>
        <button type="button" className="btn btn-dark btn-sm" onClick={() => void addTable()}>
          הוספת שולחן
        </button>
      </div>

      <p className="muted small">
        גררו אורח אל שולחן כדי לשבץ. אפשר גם לבחור שולחן מהתפריט — נגיש גם במקלדת.
      </p>

      <DropZone id={UNSEATED} title="ממתינים לשיבוץ" guests={byTable.get(UNSEATED) ?? []} tables={tables} onMove={onMove} />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))' }}>
        {tables.map((table) => (
          <DropZone
            key={table.id}
            id={table.id}
            title={table.label}
            table={table}
            guests={byTable.get(table.id) ?? []}
            tables={tables}
            onMove={onMove}
            onDelete={async () => {
              const result = await deleteTable({ clientId, id: table.id });
              if (!result.ok) onError(result.error ?? 'המחיקה נכשלה.');
              else onChanged();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function DropZone({
  id,
  title,
  guests,
  tables,
  table,
  onMove,
  onDelete,
}: {
  id: string;
  title: string;
  guests: GuestRow[];
  tables: SeatingTableRow[];
  table?: SeatingTableRow;
  onMove: (guestId: string, tableId: string | null) => void;
  onDelete?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const seated = guests.reduce((sum, g) => sum + g.party_size, 0);
  const full = table ? seated >= table.capacity : false;

  return (
    <div
      ref={setNodeRef}
      className="card"
      style={{
        borderColor: isOver ? 'var(--gold)' : full ? 'var(--amber)' : 'var(--line)',
        background: isOver ? '#fffaf0' : 'var(--card)',
        minHeight: 96,
      }}
    >
      <div className="spread">
        <b className="small">
          {table ? '🍽 ' : '⏳ '}
          {title}
        </b>
        <span className="muted small">
          {table ? `${seated}/${table.capacity}` : guests.length}
        </span>
      </div>

      <ul className="stack" style={{ listStyle: 'none', gap: 6, marginTop: 8 }}>
        {guests.map((guest) => (
          <DraggableGuest
            key={guest.id}
            guest={guest}
            tables={tables}
            currentTableId={table?.id ?? null}
            onMove={onMove}
          />
        ))}
        {guests.length === 0 && <li className="muted small">גררו לכאן אורחים</li>}
      </ul>

      {onDelete && (
        <button type="button" className="btn btn-red btn-xs" style={{ marginTop: 8 }} onClick={onDelete}>
          מחיקת שולחן
        </button>
      )}
    </div>
  );
}

function DraggableGuest({
  guest,
  tables,
  currentTableId,
  onMove,
}: {
  guest: GuestRow;
  tables: SeatingTableRow[];
  currentTableId: string | null;
  onMove: (guestId: string, tableId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: guest.id });
  const meal = MEAL_LABEL.get(guest.meal_preference);

  return (
    <li
      ref={setNodeRef}
      style={{
        opacity: isDragging ? 0.4 : 1,
        border: '1px solid var(--line)',
        borderRadius: 9,
        padding: '6px 9px',
        background: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span
        {...listeners}
        {...attributes}
        style={{ cursor: 'grab', touchAction: 'none', minWidth: 0, flex: 1 }}
      >
        <b className="small">{guest.full_name}</b>{' '}
        <span className="muted small">
          ×{guest.party_size} {meal?.icon}
        </span>
      </span>
      {/* Keyboard/assistive path — dragging is not the only way to seat someone. */}
      <select
        aria-label={`שיבוץ ${guest.full_name}`}
        value={currentTableId ?? UNSEATED}
        onChange={(e) => onMove(guest.id, e.target.value === UNSEATED ? null : e.target.value)}
        style={{ width: 'auto', fontSize: 11, padding: '3px 6px' }}
      >
        <option value={UNSEATED}>ללא שולחן</option>
        {tables.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </li>
  );
}
