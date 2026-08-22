'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import Anthropic from '@anthropic-ai/sdk';
// The SDK's structured-output helper is built against Zod 4, which ships from
// zod@3.25 under the `zod/v4` subpath. Using it here keeps `zodOutputFormat`
// type-safe without forcing the rest of the app off the Zod 3 API.
import * as z from 'zod/v4';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { requireWorkspaceAccess } from '@/lib/supabase/server';
import type { BudgetItemRow, ReceiptRow } from '@/lib/supabase/database.types';
import type { ActionResult } from './workspace';

/**
 * AI vision receipt scanner — סריקת קבלות ומעקב הוצאות
 *
 * Upload a vendor receipt or advance-payment slip, extract the amount, vendor,
 * category and date with Claude vision, and append the result to the live
 * budget tracker.
 *
 * Extraction is a structured output, so the model returns a validated object
 * rather than prose we would have to parse.
 */

const BUDGET_CATEGORIES = [
  'venue',
  'catering',
  'bar',
  'music',
  'photography',
  'video',
  'design',
  'flowers',
  'attire',
  'makeup',
  'rentals',
  'transport',
  'production',
  'other',
] as const;

const ReceiptExtraction = z.object({
  vendor: z.string().describe('Business name exactly as printed on the receipt.'),
  amount: z.number().describe('Total amount charged, as a number with no currency symbol.'),
  currency: z
    .string()
    .describe('ISO 4217 code. Israeli receipts marked ₪ or ש"ח are ILS.'),
  receipt_date: z
    .string()
    .describe('Date on the receipt as YYYY-MM-DD. Use an empty string when it is not printed.'),
  category: z
    .enum(BUDGET_CATEGORIES)
    .describe('Best-fit wedding budget category for this vendor.'),
  is_deposit: z
    .boolean()
    .describe('True when the receipt is an advance/deposit (מקדמה) rather than a full payment.'),
  confidence: z
    .number()
    .describe('Confidence between 0 and 1 that the amount and vendor were read correctly.'),
  notes: z.string().describe('Anything ambiguous a human should double-check. May be empty.'),
});

export type ReceiptExtractionResult = z.infer<typeof ReceiptExtraction>;

const SYSTEM_PROMPT = [
  'You read photographed receipts and invoices from event vendors, most often Israeli and in Hebrew.',
  'Report the total actually charged — the bottom-line total, including VAT (מע"מ), not a subtotal or a line item.',
  'Hebrew receipts write dates as DD/MM/YYYY; convert to YYYY-MM-DD and never swap day and month.',
  'A receipt marked מקדמה, דמי רצינות, or advance is a deposit.',
  'When a value is genuinely unreadable, lower the confidence rather than guessing.',
].join(' ');

const scanSchema = z.object({
  clientId: z.string().uuid(),
  dataUrl: z.string().startsWith('data:image/'),
  fileName: z.string().max(200).optional(),
});

export interface ScanReceiptResponse {
  receipt: ReceiptRow;
  budgetItem: BudgetItemRow | null;
  extraction: ReceiptExtractionResult | null;
}

export async function scanReceipt(
  input: z.infer<typeof scanSchema>,
): Promise<ActionResult<ScanReceiptResponse>> {
  let parsed: z.infer<typeof scanSchema>;
  try {
    parsed = scanSchema.parse(input);
  } catch {
    return { ok: false, error: 'Unsupported image.' };
  }

  let receiptId: string | null = null;

  try {
    const { supabase, user } = await requireWorkspaceAccess(parsed.clientId);

    const { mime, bytes } = decodeImageDataUrl(parsed.dataUrl);
    if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('Receipt image exceeds the 10MB limit.');

    // 1 — persist the original first, so a failed extraction still leaves an
    // auditable record the producer can retry or fill in by hand.
    const extension = mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'jpg';
    const storagePath = `${parsed.clientId}/${randomUUID()}.${extension}`;

    const upload = await supabase.storage
      .from('receipts')
      .upload(storagePath, bytes, { contentType: mime, upsert: false });
    if (upload.error) throw new Error(upload.error.message);

    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        client_id: parsed.clientId,
        storage_path: storagePath,
        status: 'pending',
        created_by: user.id,
      })
      .select('*')
      .single();
    if (receiptError) throw new Error(receiptError.message);
    receiptId = receipt.id;

    // 2 — extract.
    const extraction = await extractReceipt(mime, bytes);

    // 3 — append to the live budget as a paid (or deposit) line.
    const amount = Math.max(0, Number(extraction.amount) || 0);
    const status = extraction.is_deposit ? 'deposit' : 'paid';
    const receiptDate = /^\d{4}-\d{2}-\d{2}$/.test(extraction.receipt_date)
      ? extraction.receipt_date
      : null;

    const { data: budgetItem, error: budgetError } = await supabase
      .from('budget_items')
      .insert({
        client_id: parsed.clientId,
        category: extraction.category,
        vendor: extraction.vendor,
        description: extraction.notes || null,
        amount_planned: amount,
        amount_paid: amount,
        currency: normalizeCurrency(extraction.currency),
        status,
        paid_at: receiptDate ? new Date(`${receiptDate}T12:00:00Z`).toISOString() : new Date().toISOString(),
        source: 'receipt_scan',
        receipt_id: receipt.id,
      })
      .select('*')
      .single();
    if (budgetError) throw new Error(budgetError.message);

    const signed = await supabase.storage
      .from('receipts')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    const { data: finalReceipt } = await supabase
      .from('receipts')
      .update({
        vendor: extraction.vendor,
        amount,
        currency: normalizeCurrency(extraction.currency),
        category: extraction.category,
        receipt_date: receiptDate,
        raw_extraction: extraction,
        confidence: clamp01(extraction.confidence),
        status: 'processed',
        budget_item_id: budgetItem.id,
        image_url: signed.data?.signedUrl ?? null,
      })
      .eq('id', receipt.id)
      .select('*')
      .single();

    revalidatePath(`/workspace/${parsed.clientId}`);
    return {
      ok: true,
      data: {
        receipt: (finalReceipt ?? receipt) as ReceiptRow,
        budgetItem: budgetItem as BudgetItemRow,
        extraction,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Receipt scan failed.';

    // Mark the stored receipt as failed so the UI can offer a retry.
    if (receiptId) {
      try {
        const { supabase } = await requireWorkspaceAccess(parsed.clientId);
        await supabase
          .from('receipts')
          .update({ status: 'failed', error: message.slice(0, 500) })
          .eq('id', receiptId);
      } catch {
        // The original error is the one worth reporting.
      }
    }

    revalidatePath(`/workspace/${parsed.clientId}`);
    return { ok: false, error: message };
  }
}

async function extractReceipt(mime: string, bytes: Buffer): Promise<ReceiptExtractionResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Receipt scanning is not configured: ANTHROPIC_API_KEY is missing.');
  }

  const client = new Anthropic();

  const response = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    output_config: {
      format: zodOutputFormat(ReceiptExtraction),
      // Reading a receipt is a bounded task; medium keeps latency sane while
      // still reasoning about Hebrew layouts and VAT lines.
      effort: 'medium',
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: toClaudeMediaType(mime),
              data: bytes.toString('base64'),
            },
          },
          {
            type: 'text',
            text: 'Extract the payment details from this vendor receipt.',
          },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('The image could not be processed.');
  }

  const parsed = response.parsed_output;
  if (!parsed) throw new Error('Could not read this receipt. Enter the amount manually.');
  return parsed;
}

/** Claude accepts jpeg, png, gif and webp; HEIC must be converted first. */
function toClaudeMediaType(mime: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  switch (mime) {
    case 'image/png':
      return 'image/png';
    case 'image/gif':
      return 'image/gif';
    case 'image/webp':
      return 'image/webp';
    case 'image/jpeg':
    case 'image/jpg':
      return 'image/jpeg';
    default:
      throw new Error(`Unsupported image type for scanning: ${mime}. Use JPEG, PNG or WebP.`);
  }
}

function decodeImageDataUrl(dataUrl: string): { mime: string; bytes: Buffer } {
  const match = /^data:([a-z0-9.+/-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match || !match[1] || !match[2]) throw new Error('Unsupported image encoding.');
  return { mime: match[1].toLowerCase(), bytes: Buffer.from(match[2], 'base64') };
}

function normalizeCurrency(value: string): string {
  const code = String(value ?? '').trim().toUpperCase();
  if (/^(ILS|NIS|₪|SHEKEL)$/.test(code)) return 'ILS';
  return /^[A-Z]{3}$/.test(code) ? code : 'ILS';
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
