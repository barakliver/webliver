'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
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

export function VendorCaptureModal({ task, template, eventId, onClose, onSaved }: VendorCaptureModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    cost: '',
    location: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const sb = createClient();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      // Create vendor record
      const { data: vendor, error: vendorError } = await sb
        .from('vendors')
        .insert({
          event_id: eventId,
          category: template.vendor_category!,
          name: formData.name,
          contact_name: formData.contactName,
          phone: formData.phone,
          email: formData.email,
          cost: formData.cost ? parseFloat(formData.cost) : null,
          location: formData.location,
          notes: formData.notes,
          task_id: task.id,
          status: 'selected',
        })
        .select('id')
        .single();

      if (vendorError) throw vendorError;

      // Link vendor to task
      if (vendor) {
        await sb
          .from('tasks')
          .update({ vendor_id: vendor.id })
          .eq('id', task.id);

        onSaved(vendor.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      // Just mark as done without capturing vendor
      await sb
        .from('tasks')
        .update({ done: true })
        .eq('id', task.id);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-2">{template.title}</h2>
        <p className="text-neutral-600 mb-4">{template.description}</p>

        {template.ask_name && (
          <input
            type="text"
            name="name"
            placeholder="שם העסק"
            value={formData.name}
            onChange={handleChange}
            className="w-full mb-3 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {template.ask_contact_name && (
          <input
            type="text"
            name="contactName"
            placeholder="שם איש קשר"
            value={formData.contactName}
            onChange={handleChange}
            className="w-full mb-3 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {template.ask_phone && (
          <input
            type="tel"
            name="phone"
            placeholder="טלפון"
            value={formData.phone}
            onChange={handleChange}
            className="w-full mb-3 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        <input
          type="email"
          name="email"
          placeholder="דוא״ל"
          value={formData.email}
          onChange={handleChange}
          className="w-full mb-3 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {template.ask_cost && (
          <input
            type="number"
            name="cost"
            placeholder="עלות"
            value={formData.cost}
            onChange={handleChange}
            className="w-full mb-3 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {template.ask_location && (
          <input
            type="text"
            name="location"
            placeholder="מיקום"
            value={formData.location}
            onChange={handleChange}
            className="w-full mb-3 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {template.ask_notes && (
          <textarea
            name="notes"
            placeholder="הערות"
            value={formData.notes}
            onChange={handleChange}
            className="w-full mb-3 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
          />
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setShowSkip(!showSkip)}
            className="flex-1 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            {showSkip ? 'ביטול' : 'דלג'}
          </button>
          {showSkip && (
            <button
              onClick={handleSkip}
              className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              דלג ודי
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? '...' : 'שמור'}
          </button>
        </div>
      </div>
    </div>
  );
}
