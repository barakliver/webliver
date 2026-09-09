'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { PortalEvent } from '@/lib/portal';

/** The celebrations in one workspace, and the one currently being read.
 *
 *  Which event is open lives in the address rather than in this component, for
 *  two reasons. A couple comparing the henna list with the wedding list wants
 *  two tabs, and state held here cannot be in two tabs at once. And the
 *  filtering happens on the server, where the rows already are — a selection
 *  held in a hook would mean shipping every event's tasks to the browser and
 *  hiding most of them, which is the same page pretending to be smaller.
 *
 *  The rows arrive as a prop for the same reason: the server has already read
 *  them to answer the question, so fetching them again here would only buy a
 *  skeleton on every visit. */
export function EventSelector({ clientId, events, selectedId, labels }: {
  clientId: string;
  events: PortalEvent[];
  selectedId: string | null;
  labels: { add: string; empty: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [showForm, setShowForm] = useState(false);

  /* One celebration is not a choice, so there is nothing to choose between —
     but the button that adds a second one still has to be there. */
  const soleEvent = events.length <= 1;

  const open = (id: string) => {
    const next = new URLSearchParams();
    next.set('event', id);
    router.push(`${pathname}?${next}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!soleEvent && (
        <div
          role="tablist"
          aria-label={labels.empty}
          className="flex min-w-0 flex-1 gap-2 overflow-x-auto"
        >
          {events.map((e) => {
            const on = e.id === selectedId;
            return (
              <button
                key={e.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => open(e.id)}
                className={`whitespace-nowrap rounded-xl2 border px-3 py-2 text-[14px] transition ${
                  on
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-card text-ink-soft hover:border-ink'
                }`}
              >
                {e.display_name}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="btn-quiet whitespace-nowrap px-3 py-2 text-[14px]"
      >
        {labels.add}
      </button>

      {showForm && (
        <CreateEventModal
          clientId={clientId}
          onClose={() => setShowForm(false)}
          onCreated={(id) => {
            setShowForm(false);
            /* Straight to the new list. Refreshing without it would land the
               couple back on the event they were already looking at, with no
               sign that anything had happened. */
            open(id);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

const TYPES = [
  { key: 'wedding', name: 'חתונה' },
  { key: 'henna', name: 'חינה' },
  { key: 'groom_party', name: 'שבת חתן' },
  { key: 'rehearsal', name: 'חזרה' },
  { key: 'post_party', name: 'ארוחת ערב' },
];

function CreateEventModal({ clientId, onClose, onCreated }: {
  clientId: string;
  onClose: () => void;
  onCreated: (eventId: string) => void;
}) {
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState('henna');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sb = supabaseBrowser();

  const create = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);

    /* The id comes back from the insert itself. Looking the row up afterwards
       by its name was wrong in a way that only shows on the second henna: two
       events called the same thing, and the checklist lands on whichever one
       the database happened to return first. */
    const { data: event, error: insertError } = await sb
      .from('events')
      .insert({
        client_id: clientId,
        event_type: eventType,
        display_name: name.trim(),
        event_date: date || null,
        location,
      })
      .select('id')
      .single();

    if (insertError || !event) {
      setError('לא הצלחנו לפתוח את האירוע. אפשר לנסות שוב.');
      setSaving(false);
      return;
    }

    /* The starter checklist. A failure here is worth saying out loud rather
       than swallowing: the event exists either way, but a couple who was
       promised a list and got an empty one has no way to tell that the list
       was the part that broke. */
    const { data: templates } = await sb
      .from('task_templates')
      .select('title,vendor_category,sort_order')
      .eq('event_type', eventType)
      .order('sort_order');

    if (templates?.length) {
      const { error: taskError } = await sb.from('tasks').insert(
        templates.map((t) => ({
          event_id: event.id,
          client_id: clientId,
          title: t.title,
          category: t.vendor_category ?? '',
          done: false,
          owner: 'client' as const,
        })),
      );
      if (taskError) {
        setError('האירוע נפתח, אבל רשימת המשימות לא נוצרה.');
        setSaving(false);
        return;
      }
    }

    onCreated(event.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-xl2 border border-line bg-card p-6">
        <h2 className="font-display text-[18px] font-semibold text-ink">אירוע נוסף</h2>
        <p className="mt-1 text-[14px] text-ink-soft">
          חינה, שבת חתן, ארוחת ערב. לכל אחד התאריך והרשימה שלו.
        </p>

        <div className="mt-5 grid gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם האירוע"
            aria-label="שם האירוע"
            autoFocus
            className="field"
          />
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            aria-label="סוג האירוע"
            className="field"
          >
            {TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="תאריך"
            className="field"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="מיקום"
            aria-label="מיקום"
            className="field"
          />
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="btn-quiet flex-1">
            ביטול
          </button>
          <button
            type="button"
            onClick={create}
            disabled={saving || !name.trim()}
            className="btn-primary flex-1"
          >
            {saving ? 'פותח…' : 'פתיחה'}
          </button>
        </div>
      </div>
    </div>
  );
}
