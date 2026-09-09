'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { sendMail } from '@/lib/notify/mail';
import { sendWhatsApp } from '@/lib/notify/whatsapp';
import { adminLeadEmail, clientConfirmEmail, adminLeadWhatsApp, type LeadPayload } from '@/lib/notify/templates';
import { optional } from '@/lib/env';
import { MIN_EVENT_DATE, MAX_GUESTS } from '@/content/site';

export type LeadResult =
  | { ok: true }
  | { ok: false; error: string; field?: 'full_name' | 'phone' | 'email' | 'event_date' | 'guest_count' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Server-side validation is the authority. The same rules run in the browser
 *  for feedback, but nothing here trusts that they did. */
export async function submitLead(_prev: LeadResult | null, form: FormData): Promise<LeadResult> {
  const v = (k: string) => String(form.get(k) ?? '').trim();

  const payload: LeadPayload = {
    full_name: v('full_name'),
    phone: v('phone'),
    email: v('email').toLowerCase(),
    kind: v('kind') === 'corporate' ? 'corporate' : 'wedding',
    event_date: v('event_date'),
    guest_count: v('guest_count'),
    message: v('message'),
  };

  if (payload.full_name.length < 2) return { ok: false, error: 'נא למלא שם מלא', field: 'full_name' };
  if (!payload.phone && !payload.email) return { ok: false, error: 'נא להשאיר טלפון או אימייל', field: 'phone' };
  if (payload.email && !EMAIL_RE.test(payload.email)) return { ok: false, error: 'כתובת האימייל לא תקינה', field: 'email' };

  if (payload.event_date) {
    if (Number.isNaN(Date.parse(payload.event_date))) return { ok: false, error: 'תאריך לא תקין', field: 'event_date' };
    if (payload.event_date < MIN_EVENT_DATE) return { ok: false, error: 'התאריך צריך להיות משנת 2026 ואילך', field: 'event_date' };
  }

  let guests: number | null = null;
  if (payload.guest_count) {
    guests = Number(payload.guest_count);
    if (!Number.isFinite(guests) || guests <= 0) return { ok: false, error: 'כמות אורחים לא תקינה', field: 'guest_count' };
    if (guests > MAX_GUESTS) return { ok: false, error: `כמות האורחים המרבית היא ${MAX_GUESTS}`, field: 'guest_count' };
  }

  /* The lead is stored first; notifications are best effort once it is safe.
     The write goes through submit_lead(), a security definer function the
     public may execute. Inserting straight into `leads` needed the service
     role — a key that bypasses every policy in the database, asked for by
     nothing in the deploy, and therefore missing on the live server, which is
     why every enquiry was being lost. One narrow door beats one broad key.
     producer_id is not passed: a trigger attributes the enquiry to whoever the
     public site belongs to, so no code path can drop it somewhere unread. */
  try {
    const sb = await supabaseServer();
    const { error } = await sb.rpc('submit_lead', {
      p_full_name: payload.full_name,
      p_phone: payload.phone,
      p_email: payload.email,
      p_kind: payload.kind,
      p_event_date: payload.event_date || null,
      p_guest_count: guests,
      p_message: payload.message,
    });
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
  } catch (e) {
    console.error('[lead] save failed', e);
    return { ok: false, error: 'לא הצלחנו לשמור את הפנייה. נסו שוב או שלחו הודעה בוואטסאפ.' };
  }

  const adminTo = optional('ADMIN_ALERT_EMAIL');
  const results = await Promise.allSettled([
    adminTo ? sendMail({ to: adminTo, subject: `פנייה חדשה מהאתר: ${payload.full_name}`, html: adminLeadEmail(payload), replyTo: payload.email || undefined }) : Promise.resolve({ sent: false }),
    sendWhatsApp(adminLeadWhatsApp(payload)),
    payload.email ? sendMail({ to: payload.email, subject: 'קיבלנו את הפנייה שלכם', html: clientConfirmEmail(payload.full_name.split(' ')[0]) }) : Promise.resolve({ sent: false }),
  ]);
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('[lead] notify channel', i, 'threw', r.reason);
    else if (!r.value.sent && 'error' in r.value && r.value.error) console.warn('[lead] notify channel', i, r.value.error);
  });

  return { ok: true };
}
