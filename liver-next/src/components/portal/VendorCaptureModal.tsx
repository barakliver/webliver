'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

type Task = {
  id: string;
  client_id: string;
  event_id: string;
  title: string;
  due_on: string | null;
  done: boolean;
  owner: string;
  created_by: string | null;
  created_at: string;
  category: string;
  vendor_id: string | null;
};

type TaskTemplate = {
  id: string;
  event_type: string;
  title: string;
  description: string;
  is_vendor_task: boolean;
  vendor_category: string | null;
  ask_name: boolean;
  ask_cost: boolean;
  ask_phone: boolean;
  ask_contact_name: boolean;
  ask_location: boolean;
  ask_notes: boolean;
  sort_order: number;
  created_at: string;
};

interface VendorCaptureModalProps {
  task: Task;
  template: TaskTemplate;
  eventId: string;
  onClose: () => void;
  onSaved: (vendorId: string) => void;
}

/** Who was hired, caught at the moment the task is ticked.
 *
 *  "בחר אולם" is done when a hall has been booked, and the useful half of that
 *  is which hall and for how much — which is the half that otherwise lives in a
 *  WhatsApp thread. So ticking it opens this rather than crossing the line out,
 *  and what it asks for comes from the template: a printer has no guest count
 *  and a dressmaker has no phone worth chasing.
 *
 *  Skipping is a real answer and stays one press away. A couple who ticked the
 *  task because the hall was booked a year ago should not have to invent a
 *  price to get the tick. */
export function VendorCaptureModal({ task, template, eventId, onClose, onSaved }: VendorCaptureModalProps) {
  const [form, setForm] = useState({
    name: '', contactName: '', phone: '', email: '',
    cost: '', location: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sb = supabaseBrowser();

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    const { data: vendor, error: insertError } = await sb
      .from('vendor_choices')
      .insert({
        event_id: eventId,
        category: template.vendor_category ?? task.category,
        name: form.name.trim(),
        contact_name: form.contactName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        cost: form.cost ? Number(form.cost) : null,
        location: form.location.trim(),
        notes: form.notes.trim(),
        task_id: task.id,
        status: 'selected',
      })
      .select('id')
      .single();

    /* Said out loud. This threw the error into a try whose only handler was a
       finally, so a refused write left the form sitting there unchanged and
       the couple with no idea the supplier had not been saved. */
    if (insertError || !vendor) {
      setError('לא הצלחנו לשמור את הספק. אפשר לנסות שוב.');
      setSaving(false);
      return;
    }

    /* The link back. A failure here is worth its own sentence: the supplier is
       saved either way, and telling somebody the whole thing failed would send
       them to type it in a second time. */
    const { error: linkError } = await sb
      .from('tasks').update({ vendor_id: vendor.id }).eq('id', task.id);
    if (linkError) {
      setError('הספק נשמר, אבל לא הצלחנו לקשר אותו למשימה.');
      setSaving(false);
      return;
    }

    onSaved(vendor.id);
  };

  const skip = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const { error: doneError } = await sb
      .from('tasks').update({ done: true }).eq('id', task.id);
    if (doneError) {
      setError('לא הצלחנו לסמן את המשימה. אפשר לנסות שוב.');
      setSaving(false);
      return;
    }
    onClose();
  };

  /* There is no ask_email on the template, and inventing a column at this hour
     is worse than reading the one next to it: the address belongs with the
     person you ring, so it appears when the contact does. */
  const askContact = template.ask_contact_name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-xl2 border border-line bg-card p-6">
        <h2 className="font-display text-[18px] font-semibold text-ink">{template.title}</h2>
        {template.description && (
          <p className="mt-1 text-[14px] text-ink-soft">{template.description}</p>
        )}

        <div className="mt-5 grid gap-3">
          {template.ask_name && (
            <input
              name="name" value={form.name} onChange={change}
              placeholder="שם העסק" aria-label="שם העסק" autoFocus className="field"
            />
          )}
          {askContact && (
            <input
              name="contactName" value={form.contactName} onChange={change}
              placeholder="שם איש קשר" aria-label="שם איש קשר" className="field"
            />
          )}
          {template.ask_phone && (
            <input
              type="tel" name="phone" value={form.phone} onChange={change}
              placeholder="טלפון" aria-label="טלפון" className="field"
            />
          )}
          {askContact && (
            <input
              type="email" name="email" value={form.email} onChange={change}
              placeholder="דוא״ל" aria-label="דוא״ל" className="field"
            />
          )}
          {template.ask_cost && (
            <input
              type="number" inputMode="decimal" min="0" name="cost" value={form.cost} onChange={change}
              placeholder="עלות" aria-label="עלות" className="field"
            />
          )}
          {template.ask_location && (
            <input
              name="location" value={form.location} onChange={change}
              placeholder="מיקום" aria-label="מיקום" className="field"
            />
          )}
          {template.ask_notes && (
            <textarea
              name="notes" value={form.notes} onChange={change} rows={3}
              placeholder="הערות" aria-label="הערות" className="field resize-none"
            />
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={skip} disabled={saving} className="btn-quiet flex-1">
            סימון בלי ספק
          </button>
          <button
            type="button" onClick={save}
            disabled={saving || (template.ask_name && !form.name.trim())}
            className="btn-primary flex-1"
          >
            {saving ? 'שומר…' : 'שמירה'}
          </button>
        </div>
      </div>
    </div>
  );
}
