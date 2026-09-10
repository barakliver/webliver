import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendMail } from '@/lib/notify/mail';
import { supplierDigestEmail } from '@/lib/notify/templates';
import { hqRows, atRisk, summary, type HqVendor, type HqContract, type HqLine } from '@/lib/vendorHq';
import { shift } from '@/lib/budgetPlan';
import { publicEnv } from '@/lib/env';

/**
 * The Monday letter: four lines per event about its suppliers.
 *
 * Suppliers locked with a signed contract, deposits paid, balances due in
 * the next thirty days, and the one thing to do this week. Plus the three
 * relationships most likely to bite, each with its reason. To the producer,
 * by email and in the bell. Once a week per event, by the date column.
 */
export async function sendVendorDigests(sb: SupabaseClient, today: string): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const out = { sent: 0, skipped: 0, errors: [] as string[] };
  const cutoff = shift(today, -6);

  const { data: clients, error } = await sb
    .from('clients')
    .select('id,display_name,event_date,vendor_digest_on,producer_id')
    .is('archived_at', null)
    .not('event_date', 'is', null)
    .gte('event_date', today);
  if (error) { out.errors.push(`clients: ${error.message}`); return out; }

  for (const c of clients ?? []) {
    if (c.vendor_digest_on && String(c.vendor_digest_on) >= cutoff) { out.skipped += 1; continue; }

    const [{ data: vendors }, { data: contracts }, { data: lines }, { data: producer }] = await Promise.all([
      sb.from('event_vendors').select('id,name,category,phone,status,notes,deposit,deposit_paid_on,balance_due_on,last_contact_on,waiting_on,next_action').eq('client_id', c.id),
      sb.from('contracts').select('party_name,status,signed_at').eq('client_id', c.id),
      sb.from('budget_items').select('event_vendor_id,estimate,agreed').eq('client_id', c.id).not('event_vendor_id', 'is', null),
      sb.from('producers').select('contact_email,brand_name,owner_id').eq('id', c.producer_id).maybeSingle(),
    ]);

    const rows = hqRows((vendors ?? []) as HqVendor[], (contracts ?? []) as HqContract[], (lines ?? []) as HqLine[], today);
    if (rows.length === 0) { out.skipped += 1; continue; }
    const sum = summary(rows, today);
    const risky = atRisk(rows);

    let to = String(producer?.contact_email ?? '').trim();
    if (!to && producer?.owner_id) {
      const { data: prof } = await sb.from('profiles').select('email').eq('id', producer.owner_id).maybeSingle();
      to = String(prof?.email ?? '').trim();
    }

    const url = `${publicEnv.siteUrl}/app/clients/${c.id}?tab=crew`;
    if (to) {
      const r = await sendMail({
        to,
        subject: `ספקים של ${c.display_name}: השבוע`,
        html: supplierDigestEmail({ eventName: String(c.display_name ?? ''), sum, risky, url, brand: producer?.brand_name ? { name: String(producer.brand_name) } : undefined }),
      });
      if (!r.sent && r.error && !/not configured/.test(r.error)) out.errors.push(`${c.id}: ${r.error}`);
    }
    if (producer?.owner_id) {
      await sb.rpc('notify', {
        p_profile: producer.owner_id,
        p_kind: 'contract',
        p_title: `ספקים של ${c.display_name}: השבוע`,
        p_body: sum.first
          ? `${sum.locked} מתוך ${sum.total} סגורים עם הסכם. הדבר הכי חשוב: ${sum.first.vendor.name}.`
          : `${sum.locked} מתוך ${sum.total} סגורים עם הסכם. הכל ירוק.`,
        p_href: url,
      });
    }

    const { error: markErr } = await sb.from('clients').update({ vendor_digest_on: today }).eq('id', c.id);
    if (markErr) out.errors.push(`${c.id} mark: ${markErr.message}`);
    out.sent += 1;
  }
  return out;
}
