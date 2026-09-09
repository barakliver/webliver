'use server';

import { supabaseServer } from '@/lib/supabase/server';

export type VendorResult = { ok: true; vendorId: string } | { ok: false; error: string };

/**
 * Mark a task as done and optionally capture vendor details.
 * If the task is a vendor_task (determined by template), the form data
 * is saved to the vendors table before marking done.
 */
export async function completeVendorTask(opts: {
  taskId: string;
  eventId: string;
  clientId: string;
  templateId: string;
  vendorData?: {
    name: string;
    contactName: string;
    phone: string;
    email: string;
    cost: string;
    location: string;
    notes: string;
  };
}): Promise<VendorResult> {
  try {
    const sb = await supabaseServer();

    // Fetch template to determine category
    const { data: template, error: templateError } = await sb
      .from('task_templates')
      .select('vendor_category, is_vendor_task')
      .eq('id', opts.templateId)
      .single();

    if (templateError || !template?.is_vendor_task) {
      // Not a vendor task, just mark done
      await sb.from('tasks').update({ done: true }).eq('id', opts.taskId);
      return { ok: true, vendorId: '' };
    }

    let vendorId = '';

    // Create vendor if data provided
    if (opts.vendorData && template.vendor_category) {
      const { data: vendor, error: vendorError } = await sb
        .from('vendor_choices')
        .insert({
          event_id: opts.eventId,
          category: template.vendor_category,
          name: opts.vendorData.name,
          contact_name: opts.vendorData.contactName,
          phone: opts.vendorData.phone,
          email: opts.vendorData.email,
          cost: opts.vendorData.cost ? parseFloat(opts.vendorData.cost) : null,
          location: opts.vendorData.location,
          notes: opts.vendorData.notes,
          task_id: opts.taskId,
          status: 'selected',
        })
        .select('id')
        .single();

      if (vendorError) {
        console.error('[vendor] create failed', vendorError);
        return { ok: false, error: 'Failed to save vendor details' };
      }

      vendorId = vendor!.id;
    }

    // Mark task as done
    await sb
      .from('tasks')
      .update({ done: true, vendor_id: vendorId || null })
      .eq('id', opts.taskId);

    return { ok: true, vendorId };
  } catch (e) {
    console.error('[vendor] action failed', e);
    return { ok: false, error: 'An error occurred' };
  }
}

/**
 * Update vendor details (status, cost, notes, etc)
 */
export async function updateVendor(opts: {
  vendorId: string;
  status?: string;
  cost?: string;
  notes?: string;
  phone?: string;
  contactName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = await supabaseServer();
    const update: Record<string, any> = {};

    if (opts.status) update.status = opts.status;
    if (opts.cost !== undefined) update.cost = opts.cost ? parseFloat(opts.cost) : null;
    if (opts.notes !== undefined) update.notes = opts.notes;
    if (opts.phone !== undefined) update.phone = opts.phone;
    if (opts.contactName !== undefined) update.contact_name = opts.contactName;

    const { error } = await sb.from('vendor_choices').update(update).eq('id', opts.vendorId);

    if (error) {
      console.error('[vendor] update failed', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e) {
    console.error('[vendor] update threw', e);
    return { ok: false, error: 'An error occurred' };
  }
}
