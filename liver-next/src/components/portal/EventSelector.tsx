'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
type Event = {
  id: string;
  client_id: string;
  event_type: string;
  display_name: string;
  event_date: string | null;
  location: string;
  guest_estimate: number | null;
  created_at: string;
};

interface EventSelectorProps {
  clientId: string;
  currentEventId?: string;
  onEventChange: (eventId: string) => void;
}

export function EventSelector({ clientId, currentEventId, onEventChange }: EventSelectorProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const sb = supabaseBrowser();

  const loadEvents = async () => {
    setLoading(true);
    const { data } = await sb
      .from('events')
      .select('*')
      .eq('client_id', clientId)
      .order('event_date', { ascending: true, nullsFirst: false });

    setEvents((data ?? []) as Event[]);
    if (!currentEventId && data?.[0]) {
      onEventChange(data[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, [clientId]);

  if (loading) return <div className="h-12 bg-neutral-100 animate-pulse rounded" />;

  return (
    <div className="flex items-center gap-2 mb-6">
      <div className="flex-1 flex gap-2 overflow-x-auto pb-2">
        {events.map((e) => (
          <button
            key={e.id}
            onClick={() => onEventChange(e.id)}
            className={`
              px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors
              ${currentEventId === e.id
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }
            `}
          >
            {e.display_name}
            {e.event_date && (
              <span className="text-sm ml-2 opacity-75">
                {new Date(e.event_date).toLocaleDateString('he-IL')}
              </span>
            )}
          </button>
        ))}
      </div>
      <button
        onClick={() => setShowForm(true)}
        className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex-shrink-0"
      >
        + אירוע
      </button>
      {showForm && <CreateEventModal clientId={clientId} onClose={() => setShowForm(false)} onCreated={loadEvents} />}
    </div>
  );
}

interface CreateEventModalProps {
  clientId: string;
  onClose: () => void;
  onCreated: () => void;
}

function CreateEventModal({ clientId, onClose, onCreated }: CreateEventModalProps) {
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState('wedding');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const sb = supabaseBrowser();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);

    try {
      const { error } = await sb.from('events').insert({
        client_id: clientId,
        event_type: eventType,
        display_name: name,
        event_date: date || null,
        location,
      });

      if (!error) {
        // Auto-create tasks from templates
        const { data: templates } = await sb
          .from('task_templates')
          .select('*')
          .eq('event_type', eventType);

        if (templates?.length) {
          const { data: event } = await sb
            .from('events')
            .select('id')
            .eq('client_id', clientId)
            .eq('display_name', name)
            .limit(1)
            .single();

          if (event) {
            const tasksToInsert = templates.map((t) => ({
              event_id: event.id,
              client_id: clientId,
              title: t.title,
              category: eventType,
              done: false,
              owner: 'producer' as const,
            }));

            await sb.from('tasks').insert(tasksToInsert);
          }
        }

        onCreated();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">אירוע חדש</h2>

        <input
          type="text"
          placeholder="שם האירוע"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-4 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="w-full mb-4 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="wedding">חתונה</option>
          <option value="henna">חינה</option>
          <option value="groom_party">שבת חתן</option>
          <option value="rehearsal">חזרה</option>
          <option value="post_party">ארוחה בערב</option>
        </select>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full mb-4 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="text"
          placeholder="מיקום"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full mb-4 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
            disabled={loading}
          >
            ביטול
          </button>
          <button
            onClick={handleCreate}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            disabled={loading || !name.trim()}
          >
            {loading ? '...' : 'יצור'}
          </button>
        </div>
      </div>
    </div>
  );
}
