'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient, requireWorkspaceAccess } from '@/lib/supabase/server';
import type { ActionResult } from './workspace';

/**
 * Phase 4 actions: platform governance, producer branding, and the day-of
 * cockpit.
 *
 * Every admin action re-checks authorization inside the database function as
 * well. The check here produces a clean message; the check there is what
 * actually protects the data.
 */

async function run<T>(revalidate: string | null, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (revalidate) revalidatePath(revalidate);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unexpected error' };
  }
}

// ---------------------------------------------------------------------------
// Super Admin governance
// ---------------------------------------------------------------------------

export async function setProducerStatus(input: {
  producerId: string;
  status: 'pending' | 'approved' | 'suspended';
}): Promise<ActionResult<{ status: string }>> {
  const parsed = z
    .object({
      producerId: z.string().uuid(),
      status: z.enum(['pending', 'approved', 'suspended']),
    })
    .parse(input);

  return run('/admin', async () => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.rpc('admin_set_producer_status', {
      p_producer_id: parsed.producerId,
      p_status: parsed.status,
    });
    if (error) throw new Error(error.message);
    return data as { status: string };
  });
}

export async function setFeatureFlag(input: {
  key: string;
  tier: 'diy' | 'managed' | 'agency';
  enabled: boolean;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      key: z.string().min(1).max(64),
      tier: z.enum(['diy', 'managed', 'agency']),
      enabled: z.boolean(),
    })
    .parse(input);

  return run('/admin', async () => {
    const supabase = await getSupabaseServerClient();
    const column =
      parsed.tier === 'diy' ? 'enabled_diy' : parsed.tier === 'managed' ? 'enabled_managed' : 'enabled_agency';

    const { error } = await supabase
      .from('feature_flags')
      .update({ [column]: parsed.enabled })
      .eq('key', parsed.key);

    // RLS rejects a non-admin here, which surfaces as a permission error.
    if (error) throw new Error(error.message);
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Producer branding (white label)
// ---------------------------------------------------------------------------

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour must be a #RRGGBB value');

export async function saveBranding(input: {
  brand_name?: string;
  logo_url?: string | null;
  color_ink?: string;
  color_accent?: string;
  color_paper?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
  website_url?: string | null;
  custom_domain?: string | null;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      brand_name: z.string().trim().min(1).max(80).optional(),
      logo_url: z.string().trim().url().nullable().optional().or(z.literal('')),
      color_ink: hexColor.optional(),
      color_accent: hexColor.optional(),
      color_paper: hexColor.optional(),
      contact_email: z.string().trim().email().nullable().optional().or(z.literal('')),
      contact_phone: z.string().trim().max(40).nullable().optional().or(z.literal('')),
      contact_whatsapp: z.string().trim().max(40).nullable().optional().or(z.literal('')),
      website_url: z.string().trim().url().nullable().optional().or(z.literal('')),
      custom_domain: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Enter a hostname such as events.example.com')
        .nullable()
        .optional()
        .or(z.literal('')),
    })
    .parse(input);

  return run('/dashboard', async () => {
    const supabase = await getSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not signed in.');

    const patch: Record<string, unknown> = Object.fromEntries(
      Object.entries(parsed)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, v === '' ? null : v]),
    );
    // Changing the domain always re-enters verification.
    if ('custom_domain' in patch) patch.domain_verified = false;

    const { error } = await supabase
      .from('producers')
      .update(patch)
      .eq('owner_user_id', auth.user.id);
    if (error) throw new Error(error.message);
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Day-of cockpit
// ---------------------------------------------------------------------------

const vendorRole = z.enum([
  'catering', 'sound', 'lighting', 'dj', 'band', 'photo', 'video', 'magnets',
  'design', 'flowers', 'rabbi', 'security', 'transport', 'other',
]);

export async function addVendorCheckin(input: {
  clientId: string;
  role: z.infer<typeof vendorRole>;
  vendor_name: string;
  phone?: string;
  expected_at?: string | null;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      clientId: z.string().uuid(),
      role: vendorRole,
      vendor_name: z.string().trim().min(1).max(120),
      phone: z.string().trim().max(40).optional(),
      expected_at: z.string().datetime({ offset: true }).nullable().optional(),
    })
    .parse(input);

  return run(`/workspace/${parsed.clientId}`, async () => {
    const { supabase } = await requireWorkspaceAccess(parsed.clientId);
    const { error } = await supabase.from('vendor_checkins').insert({
      client_id: parsed.clientId,
      role: parsed.role,
      vendor_name: parsed.vendor_name,
      phone: parsed.phone || null,
      expected_at: parsed.expected_at ?? null,
    });
    if (error) throw new Error(error.message);
    return undefined;
  });
}

export async function setVendorStatus(input: {
  clientId: string;
  id: string;
  status: 'expected' | 'arrived' | 'late' | 'no_show';
}): Promise<ActionResult> {
  const parsed = z
    .object({
      clientId: z.string().uuid(),
      id: z.string().uuid(),
      status: z.enum(['expected', 'arrived', 'late', 'no_show']),
    })
    .parse(input);

  return run(`/workspace/${parsed.clientId}`, async () => {
    const { supabase } = await requireWorkspaceAccess(parsed.clientId);
    const { error } = await supabase
      .from('vendor_checkins')
      .update({
        status: parsed.status,
        arrived_at: parsed.status === 'arrived' ? new Date().toISOString() : null,
      })
      .eq('id', parsed.id)
      .eq('client_id', parsed.clientId);
    if (error) throw new Error(error.message);
    return undefined;
  });
}

/**
 * Emergency broadcast to on-site vendors.
 *
 * The send itself goes through the WhatsApp provider configured for the tenant.
 * Until that credential is wired, this records the broadcast and reports
 * honestly that nothing was delivered — it never claims a send it did not make.
 */
export async function broadcastToVendors(input: {
  clientId: string;
  message: string;
}): Promise<ActionResult<{ recipients: number; delivered: number; pendingProvider: boolean }>> {
  const parsed = z
    .object({
      clientId: z.string().uuid(),
      message: z.string().trim().min(2).max(600),
    })
    .parse(input);

  return run(`/workspace/${parsed.clientId}`, async () => {
    const { supabase, user } = await requireWorkspaceAccess(parsed.clientId);

    const { data: vendors, error: vendorError } = await supabase
      .from('vendor_checkins')
      .select('id,phone,status')
      .eq('client_id', parsed.clientId)
      .not('phone', 'is', null);
    if (vendorError) throw new Error(vendorError.message);

    const recipients = (vendors ?? []).filter((v) => v.status !== 'no_show').length;
    const providerReady = Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_ID);
    const delivered = 0; // Updated by the provider integration once configured.

    const { error } = await supabase.from('vendor_broadcasts').insert({
      client_id: parsed.clientId,
      message: parsed.message,
      channel: 'whatsapp',
      recipients,
      delivered,
      sent_by: user.id,
    });
    if (error) throw new Error(error.message);

    return { recipients, delivered, pendingProvider: !providerReady };
  });
}
