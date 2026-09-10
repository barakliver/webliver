import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendMail } from '@/lib/notify/mail';
import { budgetDigestEmail } from '@/lib/notify/templates';
import { readPlan, weekly, shift, type WeekItem, type WeekPayment } from '@/lib/budgetPlan';
import { publicEnv } from '@/lib/env';

/**
 * The Sunday letter.
 *
 * Once a week, for every event with a date ahead of it and a budget worth
 * reading: what was booked and what was paid since last Sunday, where the
 * commitments stand against the ceiling, the one area to watch, the next
 * payment due, and any area past its plan by more than a tenth, named at
 * the top with a trade-off. To the producer always; to the couple when the
 * budget is open to them.
 *
 * Idempotent by the date column: a sweep that runs twice on a Sunday, or a
 * hand-run after the nightly one, writes once. Runs under the service role
 * because it reads every producer's rows; nothing here is reachable from a
 * browser.
 */
export async function sendBudgetDigests(sb: SupabaseClient, today: string): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const out = { sent: 0, skipped: 0, errors: [] as string[] };
  const cutoff = shift(today, -6);

  const { data: clients, error } = await sb
    .from('clients')
    .select('id,display_name,event_date,budget_target,budget_plan,budget_visible,budget_digest_on,producer_id')
    .is('archived_at', null)
    .not('event_date', 'is', null)
    .gte('event_date', shift(today, -14));
  if (error) { out.errors.push(`clients: ${error.message}`); return out; }

  for (const c of clients ?? []) {
    if (c.budget_digest_on && String(c.budget_digest_on) >= cutoff) { out.skipped += 1; continue; }

    const [{ data: items }, { data: payments }, { data: producer }, { data: couple }] = await Promise.all([
      sb.from('budget_items').select('category,label,estimate,agreed,vendor,created_at').eq('client_id', c.id),
      sb.from('payments').select('title,amount,paid,paid_on,due_on').eq('client_id', c.id),
      sb.from('producers').select('contact_email,brand_name,owner_id').eq('id', c.producer_id).maybeSingle(),
      sb.from('client_authorized_emails').select('email').eq('client_id', c.id),
    ]);

    const plan = readPlan(c.budget_plan);
    const lines = (items ?? []) as WeekItem[];
    /* Nothing to say yet: no plan and no line. A letter that reads "nothing
       happened" every Sunday is a letter that gets filtered. */
    if (!plan && lines.length === 0) { out.skipped += 1; continue; }

    const w = weekly(lines, (payments ?? []) as WeekPayment[], plan, c.budget_target === null ? null : Number(c.budget_target), today);

    const to = new Set<string>();
    let producerMail = String(producer?.contact_email ?? '').trim();
    if (!producerMail && producer?.owner_id) {
      const { data: prof } = await sb.from('profiles').select('email').eq('id', producer.owner_id).maybeSingle();
      producerMail = String(prof?.email ?? '').trim();
    }
    if (producerMail) to.add(producerMail.toLowerCase());
    if (c.budget_visible) for (const e of couple ?? []) if (e.email) to.add(String(e.email).toLowerCase());

    const html = budgetDigestEmail({
      eventName: String(c.display_name ?? ''),
      week: w,
      url: `${publicEnv.siteUrl}/app/clients/${c.id}?tab=money`,
      brand: producer?.brand_name ? { name: String(producer.brand_name) } : undefined,
    });

    let any = false;
    for (const addr of to) {
      const r = await sendMail({ to: addr, subject: `תקציב ${c.display_name}: השבוע`, html });
      if (r.sent) any = true;
      else if (r.error && !/not configured/.test(r.error)) out.errors.push(`${c.id} ${addr}: ${r.error}`);
    }

    /* The producer's bell too, so the letter is not the only trace. */
    if (producer?.owner_id) {
      await sb.rpc('notify', {
        p_profile: producer.owner_id,
        p_kind: 'payment',
        p_title: `תקציב ${c.display_name}: השבוע`,
        p_body: w.flagged.length > 0 ? `חריגה ב-${w.flagged.length} תחומים. הסיכום במייל ובלשונית הכסף.` : 'הסיכום השבועי במייל ובלשונית הכסף.',
        p_href: `/app/clients/${c.id}?tab=money`,
      });
    }

    const { error: markErr } = await sb.from('clients').update({ budget_digest_on: today }).eq('id', c.id);
    if (markErr) out.errors.push(`${c.id} mark: ${markErr.message}`);
    if (any || to.size === 0) out.sent += 1; else out.sent += 1;
  }
  return out;
}
