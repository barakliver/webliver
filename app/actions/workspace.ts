'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireWorkspaceAccess, getSupabaseAnonClient } from '@/lib/supabase/server';
import {
  guestInputSchema,
  guestSideSchema as guestSide,
  mealPreferenceSchema as mealPreference,
  parseGuestCsv,
} from '@/lib/domain/guests';
import type {
  BudgetItemRow,
  GuestRow,
  MoodboardRow,
  SeatingTableRow,
} from '@/lib/supabase/database.types';

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

/**
 * Every action funnels through here so a thrown error becomes a typed result
 * instead of an unhandled rejection in the client component.
 */
async function run<T>(clientId: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath(`/workspace/${clientId}`);
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return { ok: false, error: message };
  }
}

const uuid = z.string().uuid();

// ---------------------------------------------------------------------------
// 1 · Bride Mode — moodboard vault
// ---------------------------------------------------------------------------

const moodCategory = z.enum(['chuppah', 'floral', 'table', 'lighting', 'attire', 'other']);

const addMoodboardSchema = z.object({
  clientId: uuid,
  category: moodCategory,
  caption: z.string().trim().max(280).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  /** Data URL from the file input, uploaded to private storage here. */
  dataUrl: z.string().startsWith('data:image/'),
  fileName: z.string().max(200).optional(),
});

export async function addMoodboardImage(
  input: z.infer<typeof addMoodboardSchema>,
): Promise<ActionResult<MoodboardRow>> {
  const parsed = addMoodboardSchema.parse(input);
  return run(parsed.clientId, async () => {
    const { supabase, user } = await requireWorkspaceAccess(parsed.clientId);

    const { mime, bytes } = decodeDataUrl(parsed.dataUrl);
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('Image exceeds the 8MB limit.');

    const extension = mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'jpg';
    const storagePath = `${parsed.clientId}/${randomUUID()}.${extension}`;

    const upload = await supabase.storage
      .from('moodboards')
      .upload(storagePath, bytes, { contentType: mime, upsert: false });
    if (upload.error) throw new Error(upload.error.message);

    // Bucket is private, so hand the UI a time-limited signed URL.
    const signed = await supabase.storage.from('moodboards').createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    if (signed.error) throw new Error(signed.error.message);

    const { data: maxRow } = await supabase
      .from('moodboards')
      .select('position')
      .eq('client_id', parsed.clientId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from('moodboards')
      .insert({
        client_id: parsed.clientId,
        category: parsed.category,
        caption: parsed.caption ?? null,
        tags: parsed.tags ?? [],
        storage_path: storagePath,
        image_url: signed.data.signedUrl,
        position: (maxRow?.position ?? 0) + 1,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as MoodboardRow;
  });
}

const updateMoodboardSchema = z.object({
  clientId: uuid,
  id: uuid,
  category: moodCategory.optional(),
  caption: z.string().trim().max(280).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
});

export async function updateMoodboardImage(
  input: z.infer<typeof updateMoodboardSchema>,
): Promise<ActionResult> {
  const parsed = updateMoodboardSchema.parse(input);
  return run(parsed.clientId, async () => {
    const { supabase } = await requireWorkspaceAccess(parsed.clientId);
    const patch: Record<string, unknown> = {};
    if (parsed.category !== undefined) patch.category = parsed.category;
    if (parsed.caption !== undefined) patch.caption = parsed.caption;
    if (parsed.tags !== undefined) patch.tags = parsed.tags;
    if (Object.keys(patch).length === 0) return undefined;

    const { error } = await supabase
      .from('moodboards')
      .update(patch)
      .eq('id', parsed.id)
      .eq('client_id', parsed.clientId);
    if (error) throw new Error(error.message);
    return undefined;
  });
}

export async function deleteMoodboardImage(
  input: { clientId: string; id: string },
): Promise<ActionResult> {
  const parsed = z.object({ clientId: uuid, id: uuid }).parse(input);
  return run(parsed.clientId, async () => {
    const { supabase } = await requireWorkspaceAccess(parsed.clientId);

    const { data: row } = await supabase
      .from('moodboards')
      .select('storage_path')
      .eq('id', parsed.id)
      .eq('client_id', parsed.clientId)
      .maybeSingle();

    const { error } = await supabase
      .from('moodboards')
      .delete()
      .eq('id', parsed.id)
      .eq('client_id', parsed.clientId);
    if (error) throw new Error(error.message);

    // Best-effort: a missing object must not fail the delete the user asked for.
    if (row?.storage_path) {
      await supabase.storage.from('moodboards').remove([row.storage_path]);
    }
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// 2 · Guests & seating
// ---------------------------------------------------------------------------

export async function addGuest(
  input: { clientId: string } & z.infer<typeof guestInputSchema>,
): Promise<ActionResult<GuestRow>> {
  const { clientId, ...rest } = input;
  const parsed = guestInputSchema.parse(rest);
  return run(clientId, async () => {
    const { supabase } = await requireWorkspaceAccess(clientId);
    const { data, error } = await supabase
      .from('guests_rsvp')
      .insert({
        client_id: clientId,
        full_name: parsed.full_name,
        email: parsed.email || null,
        phone: parsed.phone || null,
        side: parsed.side,
        party_size: parsed.party_size,
        meal_preference: parsed.meal_preference,
        allergies: parsed.allergies || null,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as GuestRow;
  });
}

/**
 * CSV import. Accepts a header row and maps common Hebrew/English column names.
 * Rows that cannot be parsed are reported rather than silently dropped.
 */
export async function importGuestsCsv(
  input: { clientId: string; csv: string },
): Promise<ActionResult<{ inserted: number; skipped: string[] }>> {
  const parsed = z.object({ clientId: uuid, csv: z.string().min(1).max(1_000_000) }).parse(input);
  return run(parsed.clientId, async () => {
    const { supabase } = await requireWorkspaceAccess(parsed.clientId);
    const { rows, skipped } = parseGuestCsv(parsed.csv);
    if (rows.length === 0) {
      throw new Error(
        skipped.length > 0 ? `No valid rows. First problem: ${skipped[0]}` : 'The file has no rows.',
      );
    }

    const { data, error } = await supabase
      .from('guests_rsvp')
      .insert(rows.map((row) => ({ ...row, client_id: parsed.clientId })))
      .select('id');
    if (error) throw new Error(error.message);

    return { inserted: data?.length ?? 0, skipped };
  });
}

export async function updateGuest(
  input: {
    clientId: string;
    id: string;
    patch: Partial<{
      full_name: string;
      party_size: number;
      meal_preference: z.infer<typeof mealPreference>;
      status: 'pending' | 'attending' | 'declined' | 'maybe';
      side: z.infer<typeof guestSide>;
      allergies: string | null;
      notes: string | null;
    }>;
  },
): Promise<ActionResult> {
  const parsed = z.object({ clientId: uuid, id: uuid }).parse(input);
  return run(parsed.clientId, async () => {
    const { supabase } = await requireWorkspaceAccess(parsed.clientId);
    const { error } = await supabase
      .from('guests_rsvp')
      .update(input.patch)
      .eq('id', parsed.id)
      .eq('client_id', parsed.clientId);
    if (error) throw new Error(error.message);
    return undefined;
  });
}

export async function deleteGuest(input: { clientId: string; id: string }): Promise<ActionResult> {
  const parsed = z.object({ clientId: uuid, id: uuid }).parse(input);
  return run(parsed.clientId, async () => {
    const { supabase } = await requireWorkspaceAccess(parsed.clientId);
    const { error } = await supabase
      .from('guests_rsvp')
      .delete()
      .eq('id', parsed.id)
      .eq('client_id', parsed.clientId);
    if (error) throw new Error(error.message);
    return undefined;
  });
}

/** Seats a guest at a table, or clears the assignment when tableId is null. */
export async function assignGuestToTable(
  input: { clientId: string; guestId: string; tableId: string | null },
): Promise<ActionResult> {
  const parsed = z
    .object({ clientId: uuid, guestId: uuid, tableId: uuid.nullable() })
    .parse(input);
  return run(parsed.clientId, async () => {
    const { supabase } = await requireWorkspaceAccess(parsed.clientId);

    if (parsed.tableId) {
      // Refuse to overfill a table. The DB guarantees the table belongs to this
      // workspace; capacity is a product rule, enforced here.
      const [{ data: table }, { data: seated }] = await Promise.all([
        supabase
          .from('tables_seating')
          .select('capacity,label')
          .eq('id', parsed.tableId)
          .eq('client_id', parsed.clientId)
          .maybeSingle(),
        supabase
          .from('guests_rsvp')
          .select('id,party_size')
          .eq('client_id', parsed.clientId)
          .eq('table_id', parsed.tableId),
      ]);

      if (!table) throw new Error('Table not found in this workspace.');

      const { data: guest } = await supabase
        .from('guests_rsvp')
        .select('party_size')
        .eq('id', parsed.guestId)
        .eq('client_id', parsed.clientId)
        .maybeSingle();

      const alreadySeated = (seated ?? [])
        .filter((row) => row.id !== parsed.guestId)
        .reduce((sum, row) => sum + (row.party_size ?? 0), 0);

      if (alreadySeated + (guest?.party_size ?? 1) > table.capacity) {
        throw new Error(`${table.label} is full (${table.capacity} seats).`);
      }
    }

    const { error } = await supabase
      .from('guests_rsvp')
      .update({ table_id: parsed.tableId })
      .eq('id', parsed.guestId)
      .eq('client_id', parsed.clientId);
    if (error) throw new Error(error.message);
    return undefined;
  });
}

export async function upsertTable(
  input: {
    clientId: string;
    id?: string;
    label: string;
    shape?: 'round' | 'rectangle' | 'head';
    capacity?: number;
    pos_x?: number;
    pos_y?: number;
  },
): Promise<ActionResult<SeatingTableRow>> {
  const parsed = z
    .object({
      clientId: uuid,
      id: uuid.optional(),
      label: z.string().trim().min(1).max(60),
      shape: z.enum(['round', 'rectangle', 'head']).default('round'),
      capacity: z.coerce.number().int().min(1).max(40).default(12),
      pos_x: z.coerce.number().default(0),
      pos_y: z.coerce.number().default(0),
    })
    .parse(input);

  return run(parsed.clientId, async () => {
    const { supabase } = await requireWorkspaceAccess(parsed.clientId);
    const payload = {
      client_id: parsed.clientId,
      label: parsed.label,
      shape: parsed.shape,
      capacity: parsed.capacity,
      pos_x: parsed.pos_x,
      pos_y: parsed.pos_y,
    };

    const query = parsed.id
      ? supabase.from('tables_seating').update(payload).eq('id', parsed.id).eq('client_id', parsed.clientId)
      : supabase.from('tables_seating').insert(payload);

    const { data, error } = await query.select('*').single();
    if (error) throw new Error(error.message);
    return data as SeatingTableRow;
  });
}

export async function deleteTable(input: { clientId: string; id: string }): Promise<ActionResult> {
  const parsed = z.object({ clientId: uuid, id: uuid }).parse(input);
  return run(parsed.clientId, async () => {
    const { supabase } = await requireWorkspaceAccess(parsed.clientId);
    // guests_rsvp.table_id is ON DELETE SET NULL, so seated guests are released.
    const { error } = await supabase
      .from('tables_seating')
      .delete()
      .eq('id', parsed.id)
      .eq('client_id', parsed.clientId);
    if (error) throw new Error(error.message);
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// 3 · Budget
// ---------------------------------------------------------------------------

export async function upsertBudgetItem(
  input: {
    clientId: string;
    id?: string;
    category: string;
    vendor?: string;
    description?: string;
    amount_planned?: number;
    amount_paid?: number;
    status?: 'planned' | 'deposit' | 'paid';
    due_date?: string | null;
  },
): Promise<ActionResult<BudgetItemRow>> {
  const parsed = z
    .object({
      clientId: uuid,
      id: uuid.optional(),
      category: z.string().trim().min(1).max(60),
      vendor: z.string().trim().max(120).optional(),
      description: z.string().trim().max(400).optional(),
      amount_planned: z.coerce.number().min(0).max(10_000_000).default(0),
      amount_paid: z.coerce.number().min(0).max(10_000_000).default(0),
      status: z.enum(['planned', 'deposit', 'paid']).default('planned'),
      due_date: z.string().date().nullable().optional(),
    })
    .parse(input);

  return run(parsed.clientId, async () => {
    const { supabase } = await requireWorkspaceAccess(parsed.clientId);
    const payload = {
      client_id: parsed.clientId,
      category: parsed.category,
      vendor: parsed.vendor ?? null,
      description: parsed.description ?? null,
      amount_planned: parsed.amount_planned,
      amount_paid: parsed.amount_paid,
      status: parsed.status,
      due_date: parsed.due_date ?? null,
      paid_at: parsed.status === 'paid' ? new Date().toISOString() : null,
    };

    const query = parsed.id
      ? supabase.from('budget_items').update(payload).eq('id', parsed.id).eq('client_id', parsed.clientId)
      : supabase.from('budget_items').insert(payload);

    const { data, error } = await query.select('*').single();
    if (error) throw new Error(error.message);
    return data as BudgetItemRow;
  });
}

export async function deleteBudgetItem(
  input: { clientId: string; id: string },
): Promise<ActionResult> {
  const parsed = z.object({ clientId: uuid, id: uuid }).parse(input);
  return run(parsed.clientId, async () => {
    const { supabase } = await requireWorkspaceAccess(parsed.clientId);
    const { error } = await supabase
      .from('budget_items')
      .delete()
      .eq('id', parsed.id)
      .eq('client_id', parsed.clientId);
    if (error) throw new Error(error.message);
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// 4 · Event settings (digital gift links, calendar feed)
// ---------------------------------------------------------------------------

export async function saveEventSettings(
  input: {
    clientId: string;
    gift_paybox_url?: string | null;
    gift_bit_url?: string | null;
    gift_card_url?: string | null;
    gift_message?: string | null;
    event_start?: string | null;
    event_end?: string | null;
    venue_name?: string | null;
    venue_address?: string | null;
  },
): Promise<ActionResult<{ calendar_token: string }>> {
  const httpUrl = z
    .string()
    .trim()
    .url()
    .refine((u) => u.startsWith('https://'), 'Gift links must use https.')
    .nullable()
    .optional()
    .or(z.literal(''));

  const parsed = z
    .object({
      clientId: uuid,
      gift_paybox_url: httpUrl,
      gift_bit_url: httpUrl,
      gift_card_url: httpUrl,
      gift_message: z.string().trim().max(400).nullable().optional(),
      event_start: z.string().datetime({ offset: true }).nullable().optional(),
      event_end: z.string().datetime({ offset: true }).nullable().optional(),
      venue_name: z.string().trim().max(160).nullable().optional(),
      venue_address: z.string().trim().max(240).nullable().optional(),
    })
    .parse(input);

  return run(parsed.clientId, async () => {
    const { supabase } = await requireWorkspaceAccess(parsed.clientId);
    const { clientId, ...fields } = parsed;
    const payload = Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, v === '' ? null : v]),
    );

    const { data, error } = await supabase
      .from('event_settings')
      .upsert({ client_id: clientId, ...payload }, { onConflict: 'client_id' })
      .select('calendar_token')
      .single();
    if (error) throw new Error(error.message);
    return { calendar_token: data.calendar_token };
  });
}

// ---------------------------------------------------------------------------
// 5 · Public guest RSVP submission (anonymous, token-scoped)
// ---------------------------------------------------------------------------

export async function submitRsvp(input: {
  token: string;
  status: 'attending' | 'declined' | 'maybe';
  party_size?: number;
  meal_preference?: z.infer<typeof mealPreference>;
  allergies?: string;
  gift_method?: 'paybox' | 'bit' | 'card' | 'none';
  gift_amount?: number;
  blessing?: string;
}): Promise<ActionResult<{ status: string; party_size: number }>> {
  const parsed = z
    .object({
      token: z.string().trim().min(8).max(128),
      status: z.enum(['attending', 'declined', 'maybe']),
      party_size: z.coerce.number().int().min(0).max(20).optional(),
      meal_preference: mealPreference.optional(),
      allergies: z.string().trim().max(200).optional(),
      gift_method: z.enum(['paybox', 'bit', 'card', 'none']).optional(),
      gift_amount: z.coerce.number().min(0).max(100_000).optional(),
      blessing: z.string().trim().max(1000).optional(),
    })
    .parse(input);

  try {
    // Anonymous client: the SECURITY DEFINER RPC is the only reachable surface.
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase.rpc('rsvp_submit', {
      p_token: parsed.token,
      p_status: parsed.status,
      p_party_size: parsed.party_size ?? null,
      p_meal: parsed.meal_preference ?? null,
      p_allergies: parsed.allergies ?? null,
      p_gift_method: parsed.gift_method ?? null,
      p_gift_amount: parsed.gift_amount ?? null,
      p_blessing: parsed.blessing ?? null,
    });
    if (error) throw new Error(error.message);

    revalidatePath(`/rsvp/${parsed.token}`);
    const result = data as { status: string; party_size: number };
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save your RSVP.' };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeDataUrl(dataUrl: string): { mime: string; bytes: Buffer } {
  const match = /^data:([a-z0-9.+/-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match || !match[1] || !match[2]) throw new Error('Unsupported image encoding.');
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (!allowed.includes(match[1].toLowerCase())) {
    throw new Error(`Unsupported image type: ${match[1]}`);
  }
  return { mime: match[1].toLowerCase(), bytes: Buffer.from(match[2], 'base64') };
}
