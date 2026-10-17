import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendPush } from '@/lib/notify/push';
import { ownerOf } from '@/lib/notify/inboxAlert';
import { ils } from '@/lib/money';
import { shift } from '@/lib/budgetPlan';

/**
 * Two mornings before a supplier is owed money, and the quote nobody
 * decided on.
 *
 * A payment on a budget line falls due; a week before and the day before,
 * the producer gets a push and a bell, and the couple a bell when the
 * budget is open to them and the line is theirs to see. Idempotent by the
 * bell row: the same title on the same day is found and not written twice,
 * which is the same rule the morning letter uses.
 *
 * And a line that has sat at "quoted" for a fortnight is a decision
 * nobody made, so it becomes one task on the producer's own list, once:
 * a task with the same title that is not done is the record that it was
 * already asked.
 */
type DueRow = {
  id: string; item_id: string; client_id: string; amount: number | string; due_at: string;
  budget_items: { label: string; visible_to_couple: boolean } | null;
};
type ClientRow = { display_name: string; producer_id: string; budget_visible: boolean };

async function already(sb: SupabaseClient, profile: string, title: string, today: string): Promise<boolean> {
  const { data } = await sb.from('notifications').select('id').eq('profile_id', profile).eq('title', title)
    .gte('created_at', `${today}T00:00:00+02:00`).limit(1);
  return Boolean(data?.length);
}

export async function sendPaymentReminders(sb: SupabaseClient, today: string): Promise<{ sent: number; errors: string[] }> {
  const out = { sent: 0, errors: [] as string[] };
  const days = [shift(today, 1), shift(today, 7)];
  const { data, error } = await sb.from('budget_payments')
    .select('id,item_id,client_id,amount,due_at,budget_items(label,visible_to_couple)')
    .is('paid_at', null).in('due_at', days);
  if (error) { out.errors.push(`payments: ${error.message}`); return out; }

  for (const p of (data ?? []) as unknown as DueRow[]) {
    const { data: c } = await sb.from('clients').select('display_name,producer_id,budget_visible').eq('id', p.client_id).maybeSingle();
    const cl = c as ClientRow | null;
    if (!cl?.producer_id) continue;
    const label = p.budget_items?.label ?? '';
    const [y, m, d] = p.due_at.split('-');
    /* A push title is a plain string, which is the one place the string form
       of an amount is the right answer. */
    const amount = ils(Number(p.amount));
    const title = `תשלום של ${amount} ל${label} ב-${Number(d)}.${Number(m)}`;
    const href = `/app/clients/${p.client_id}?tab=money`;

    const owner = await ownerOf(sb, cl.producer_id);
    if (owner && !(await already(sb, owner, title, today))) {
      const r = await sendPush(sb, owner, { title, body: cl.display_name, url: href, tag: `pay-${p.id}` });
      if (r.error && !/not configured/.test(r.error)) out.errors.push(`${p.id}: ${r.error}`);
      await sb.rpc('notify', { p_profile: owner, p_kind: 'payment', p_title: title, p_body: cl.display_name, p_href: href });
      out.sent += 1;
    }

    if (cl.budget_visible && p.budget_items?.visible_to_couple) {
      const { data: people } = await sb.from('client_authorized_emails').select('profile_id').eq('client_id', p.client_id);
      for (const row of (people ?? []) as { profile_id: string | null }[]) {
        if (!row.profile_id || (await already(sb, row.profile_id, title, today))) continue;
        await sb.rpc('notify', { p_profile: row.profile_id, p_kind: 'payment', p_title: title, p_body: '', p_href: '/app/portal#budget' });
        out.sent += 1;
      }
    }
    /* Years are not said: a reminder is about a day a fortnight out at most. */
    void y;
  }
  return out;
}

export async function flagStaleQuotes(sb: SupabaseClient, now: Date = new Date()): Promise<{ added: number; errors: string[] }> {
  const out = { added: 0, errors: [] as string[] };
  const cutoff = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const { data, error } = await sb.from('budget_items').select('id,client_id,label,updated_at')
    .eq('status', 'quoted').lt('updated_at', cutoff);
  if (error) { out.errors.push(`quotes: ${error.message}`); return out; }
  for (const it of (data ?? []) as { id: string; client_id: string; label: string }[]) {
    const { data: c } = await sb.from('clients').select('producer_id,display_name').eq('id', it.client_id).maybeSingle();
    const cl = c as { producer_id?: string; display_name?: string } | null;
    if (!cl?.producer_id) continue;
    const title = `להחליט על ${it.label} (${cl.display_name ?? ''})`;
    const { data: open } = await sb.from('producer_tasks').select('id').eq('producer_id', cl.producer_id).eq('title', title).eq('done', false).limit(1);
    if (open?.length) continue;
    const { error: e } = await sb.from('producer_tasks').insert({ producer_id: cl.producer_id, title, note: 'הצעת מחיר מחכה יותר משבועיים' });
    if (e) out.errors.push(`${it.id}: ${e.message}`); else out.added += 1;
  }
  return out;
}

/**
 * The questionnaire nobody opened.
 *
 * Five days after a couple's workspace is opened, if less than a third of
 * the questionnaire is answered, one gentle line on their bell. Once, by
 * the same title rule as the rest. The producer is not told: a reminder
 * about a questionnaire is between the product and the couple.
 */
export async function remindQuestionnaire(sb: SupabaseClient, today: string): Promise<{ sent: number; errors: string[] }> {
  const out = { sent: 0, errors: [] as string[] };
  const cutoff = shift(today, -5);
  const { data, error } = await sb.from('clients').select('id,display_name,created_at')
    .is('archived_at', null).lte('created_at', `${cutoff}T23:59:59+02:00`);
  if (error) { out.errors.push(`clients: ${error.message}`); return out; }
  const title = 'עוד לא סיפרתם לנו מי אתם';
  for (const c of (data ?? []) as { id: string; display_name: string }[]) {
    const { data: p } = await sb.from('couple_profiles').select('completeness').eq('client_id', c.id).maybeSingle();
    if (p && Number((p as { completeness: number | string }).completeness) >= 0.3) continue;
    const { data: people } = await sb.from('client_authorized_emails').select('profile_id').eq('client_id', c.id);
    for (const row of (people ?? []) as { profile_id: string | null }[]) {
      if (!row.profile_id) continue;
      const { data: before } = await sb.from('notifications').select('id').eq('profile_id', row.profile_id).eq('title', title).limit(1);
      if (before?.length) continue;
      await sb.rpc('notify', {
        p_profile: row.profile_id, p_kind: 'task', p_title: title,
        p_body: 'שאלון היכרות קצר, עשרים דקות, אפשר מהטלפון ובשלבים. מאותו רגע המסך שלכם מתאים את עצמו אליכם.',
        p_href: `/app/portal/questionnaire?w=${c.id}`,
      });
      out.sent += 1;
    }
  }
  return out;
}

/** The wedding-day questionnaire, forty-five, thirty-five and twenty-eight
 *  days out, to the couple's bell, once per day of the three. */
export async function remindWeddingDay(sb: SupabaseClient, today: string): Promise<{ sent: number; errors: string[] }> {
  const out = { sent: 0, errors: [] as string[] };
  const days = [45, 35, 28];
  const dates = days.map((d) => shift(today, d));
  const { data, error } = await sb.from('clients').select('id,event_date').is('archived_at', null).in('event_date', dates);
  if (error) { out.errors.push(`clients: ${error.message}`); return out; }
  for (const c of (data ?? []) as { id: string; event_date: string }[]) {
    const left = days[dates.indexOf(c.event_date)];
    const { count } = await sb.from('questionnaire_responses').select('id', { count: 'exact', head: true }).eq('client_id', c.id).eq('form_key', 'wedding_day');
    if ((count ?? 0) >= 30) continue;
    const title = `עוד ${left} ימים. בואו נבנה את היום`;
    const { data: people } = await sb.from('client_authorized_emails').select('profile_id').eq('client_id', c.id);
    for (const row of (people ?? []) as { profile_id: string | null }[]) {
      if (!row.profile_id) continue;
      const { data: before } = await sb.from('notifications').select('id').eq('profile_id', row.profile_id).eq('title', title).limit(1);
      if (before?.length) continue;
      await sb.rpc('notify', {
        p_profile: row.profile_id, p_kind: 'task', p_title: title,
        p_body: 'שאלון יום החתונה: מי נכנס עם מי, איזה שיר, מתי מגיע האוכל לאפטר. עשרים דקות, אפשר מהטלפון.',
        p_href: `/app/portal/questionnaire?w=${c.id}&form=wedding_day`,
      });
      out.sent += 1;
    }
  }
  return out;
}
