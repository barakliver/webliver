'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount, ROOT_ADMIN_EMAIL } from '@/lib/auth';
import { sendMail } from '@/lib/notify/mail';
import { supportTicketEmail } from '@/lib/notify/templates';
import { publicEnv } from '@/lib/env';

export type TicketResult = { ok: boolean; error?: string };

const CATEGORIES = new Set(['visual', 'auth', 'data', 'other']);
const BUCKET = 'support';

/**
 * Somebody saying the platform is wrong.
 *
 * Saved first, mailed second. The row is the record and the mail is the
 * alert; a mail service that is down must not lose the report, so the send
 * is attempted and its failure logged, and the person is told their report
 * was received either way, because it was.
 *
 * The screenshot arrives as a path in the private bucket, put there by the
 * browser under the reporter's own folder. Checked here the same way the
 * shared folder checks its paths: a row may not point at somebody else's
 * object.
 */
export async function fileTicket(input: {
  category: string; body: string; route: string; agent: string; screenshotPath?: string;
}): Promise<TicketResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: 'צריך להתחבר' };

  const body = String(input.body ?? '').trim().slice(0, 2000);
  if (body.length < 2) return { ok: false, error: 'נא לכתוב מה קרה' };
  const category = CATEGORIES.has(input.category) ? input.category : 'other';
  const route = String(input.route ?? '').slice(0, 300);
  const agent = String(input.agent ?? '').slice(0, 400);

  const screenshot = String(input.screenshotPath ?? '').trim();
  if (screenshot && (!screenshot.startsWith(`${account.id}/`) || screenshot.includes('..'))) {
    return { ok: false, error: 'צילום המסך לא נשמר במקום הנכון' };
  }

  const sb = await supabaseServer();
  const { data: row, error } = await sb
    .from('support_tickets')
    .insert({
      reporter_id: account.id,
      producer_id: account.producer?.id ?? null,
      category, body, route, agent,
      screenshot_path: screenshot || null,
    })
    .select('id,created_at')
    .single();

  if (error || !row) {
    console.error('[tickets] insert failed', error);
    return { ok: false, error: 'לא הצלחנו לשלוח. נסו שוב.' };
  }

  /* The alert. A signed link for the screenshot, good for a week, which is
     longer than any ticket should wait and shorter than forever. */
  let screenshotUrl = '';
  if (screenshot) {
    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(screenshot, 60 * 60 * 24 * 7);
    screenshotUrl = signed?.signedUrl ?? '';
  }

  const mail = await sendMail({
    to: ROOT_ADMIN_EMAIL,
    subject: `דיווח על תקלה · ${account.fullName || account.email}`,
    replyTo: account.email || undefined,
    html: supportTicketEmail({
      id: row.id,
      category, body, route, agent,
      reporter: account.fullName || account.email,
      email: account.email,
      role: account.role,
      producer: account.producer?.brandName ?? '',
      screenshotUrl,
      consoleUrl: `${publicEnv.siteUrl}/app/admin/tickets`,
    }),
  });
  if (!mail.sent) console.error('[tickets] alert not sent', { id: row.id, reason: mail.error });

  revalidatePath('/app/admin/tickets');
  return { ok: true };
}

/** Closing and reopening, by the account that answers. The policy refuses
 *  anybody else, so there is nothing to check here beyond the id. */
export async function setTicketStatus(form: FormData): Promise<void> {
  const id = String(form.get('ticket_id') ?? '');
  const status = String(form.get('status') ?? '') === 'closed' ? 'closed' : 'open';
  if (!id) return;

  const sb = await supabaseServer();
  const { error } = await sb
    .from('support_tickets')
    .update({ status, resolved_at: status === 'closed' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) console.error('[tickets] status change failed', error);
  revalidatePath('/app/admin/tickets');
}
