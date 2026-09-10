'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { productionCategoryOf, categoryLabel } from '@/content/production';

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
export function VendorCaptureModal({ task, template, onClose, onSaved }: VendorCaptureModalProps) {
  const [form, setForm] = useState({
    name: '', contactName: '', phone: '', email: '',
    cost: '', location: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Once the supplier row exists it is remembered here, so a retry after the
     budget line or the link failed does not write the DJ a second time. */
  const [savedId, setSavedId] = useState<string | null>(null);
  const sb = supabaseBrowser();

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  /* Where it lands: event_vendors, the table the suppliers tab, the run
     sheet, the day-of console, the book and the numbers sheet all read. The
     first version of this wrote to a table of its own, and a DJ saved there
     was a DJ nobody ever saw again. The checklist's category ('dj') becomes
     the event file's ('music') on the way in. */
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    const category = productionCategoryOf(template.vendor_category ?? task.category);
    const name = form.name.trim().slice(0, 120);
    const cost = form.cost.trim() ? Number(form.cost) : null;
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      setError('העלות לא נראית כמו מספר.');
      setSaving(false);
      return;
    }

    let vendorId = savedId;
    if (!vendorId) {
      /* Everything the form asked that event_vendors has no column for goes
         into the note, labelled, rather than being dropped. */
      const notes = [
        form.contactName.trim() && `איש קשר: ${form.contactName.trim()}`,
        form.email.trim() && `אימייל: ${form.email.trim()}`,
        form.location.trim() && `מיקום: ${form.location.trim()}`,
        form.notes.trim(),
      ].filter(Boolean).join('\n').slice(0, 500);

      const { data: vendor, error: insertError } = await sb
        .from('event_vendors')
        .insert({
          client_id: task.client_id,
          name,
          category,
          phone: form.phone.trim().slice(0, 40),
          status: 'booked',
          notes,
        })
        .select('id')
        .single();

      /* Said out loud. This threw the error into a try whose only handler was
         a finally, so a refused write left the form sitting there unchanged
         and the couple with no idea the supplier had not been saved. */
      if (insertError || !vendor) {
        setError('לא הצלחנו לשמור את הספק. אפשר לנסות שוב.');
        setSaving(false);
        return;
      }
      vendorId = vendor.id as string;
      setSavedId(vendorId);
    }

    /* Money has one home, the budget, and the supplier's line links back to
       the card. Only when a figure was given: a line of zero is a question,
       not a record. */
    if (cost !== null && cost > 0) {
      /* The line is named for what was ticked ("צלם סטילס"), and the supplier
         sits in the supplier column. It was the business's name in both, which
         read as a budget with a line called "קרא" and no photographer on it. */
      const { error: budgetError } = await sb.from('budget_items').insert({
        client_id: task.client_id,
        category: categoryLabel(category),
        label: task.title.slice(0, 120),
        estimate: cost,
        agreed: cost,
        vendor: name,
        event_vendor_id: vendorId,
      });
      if (budgetError) {
        setError('הספק נשמר, אבל העלות לא נכנסה לתקציב. אפשר לנסות שוב, או להוסיף אותה בתקציב.');
        setSaving(false);
        return;
      }
    }

    /* The link back. A failure here is worth its own sentence: the supplier is
       saved either way, and telling somebody the whole thing failed would send
       them to type it in a second time. */
    const { error: linkError } = await sb
      .from('tasks').update({ event_vendor_id: vendorId }).eq('id', task.id);
    if (linkError) {
      setError('הספק נשמר, אבל לא הצלחנו לקשר אותו למשימה.');
      setSaving(false);
      return;
    }

    onSaved(vendorId);
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

  /* Changing your mind. The first version had two buttons, save and "tick
     without a supplier", and no way to close the form and leave the task as
     it was: somebody who ticked the wrong line had to invent a supplier or
     accept the tick. The backdrop and the third button both just close. */
  const cancel = () => { if (!saving) onClose(); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) cancel(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="vendor-capture-title" className="w-full max-w-md rounded-xl2 border border-line bg-card p-6">
        <h2 id="vendor-capture-title" className="font-display text-[18px] font-semibold text-ink">{template.title}</h2>
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

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={cancel} disabled={saving} className="btn-quiet px-3">
            ביטול
          </button>
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
