'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { normalizePhone, displayPhone } from '@/lib/phone';

/**
 * One door.
 *
 * Phone sign-in was built in 0022 and is now closed. Two reasons, and the
 * second is the one that decided it: authorisation in this product is keyed on
 * an email address — an event names up to three of them, and a person who
 * arrives by any other route is signed in and belongs to nothing. And a text
 * message costs money per send and needs a provider that is not configured,
 * so the door was open onto a corridor that ended in "SMS is unavailable".
 *
 * The type keeps both members and `resolve()` still recognises a number,
 * deliberately. Nothing about an account that was created by phone is
 * deleted, renamed or migrated here: those rows stay exactly where they are,
 * and reopening the door is one constant away. A person in that position signs
 * in with the address on their profile and lands on the same account, which is
 * what 0022 built the linking for.
 */
export type Channel = 'email' | 'phone';

/** The single place the door is bolted, so it is one edit to unbolt. */
const PHONE_SIGN_IN = false;

export type AuthResult = {
  ok: boolean;
  error?: string;
  /** The channel the code was actually sent on, which is not always the one
   *  that was asked for: a phone request on a project with no SMS provider
   *  falls back to nothing, and the screen has to say so honestly. */
  channel?: Channel;
  /** Canonical form — lowercased address, or E.164 — and the thing every
   *  later call is made with, so step two can never verify against a
   *  differently punctuated version of what step one sent to. */
  contact?: string;
  /** The same thing, written the way the person who typed it would. */
  display?: string;
  /** When the code left, as epoch milliseconds. The client counts from this
   *  rather than from the moment the response painted, so a slow network does
   *  not make a code look fresher than it is. */
  sentAt?: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What the person typed, resolved into a channel and a canonical contact.
 *  A single field takes either, because asking somebody to first declare
 *  which kind of thing they are about to type is a step that exists for the
 *  program's benefit and not theirs. */
function resolve(raw: string, hint: Channel | null): { channel: Channel; contact: string; display: string } | null {
  const text = raw.trim();
  if (text === '') return null;

  if (hint !== 'phone' && text.includes('@')) {
    const email = text.toLowerCase();
    return EMAIL_RE.test(email) ? { channel: 'email', contact: email, display: email } : null;
  }

  const tel = normalizePhone(text);
  if (tel) return { channel: 'phone', contact: tel, display: displayPhone(tel) };

  /* No '@' and not a usable number. If it was clearly meant as an address,
     say so as an address problem rather than as a phone problem. */
  const email = text.toLowerCase();
  if (EMAIL_RE.test(email)) return { channel: 'email', contact: email, display: email };
  return null;
}

/** Step one: send a one time code, by mail or by text. No password is ever
 *  stored or compared, so there is nothing to leak and nothing to reset. */
export async function requestCode(_prev: AuthResult | null, form: FormData): Promise<AuthResult> {
  const hintRaw = String(form.get('channel') ?? '');
  const hint: Channel | null = hintRaw === 'phone' || hintRaw === 'email' ? hintRaw : null;
  const who = resolve(String(form.get('contact') ?? form.get('email') ?? ''), hint);

  if (!who) {
    return { ok: false, error: 'כתובת האימייל לא תקינה' };
  }

  /* Refused here rather than only hidden on the screen. A form is a
     suggestion; this is the rule. */
  if (!PHONE_SIGN_IN && who.channel === 'phone') {
    return {
      ok: false,
      error: 'הכניסה היא עם כתובת אימייל. נשלח לשם קוד חד פעמי.',
    };
  }

  const fullName = String(form.get('full_name') ?? '').trim();
  const brandName = String(form.get('brand_name') ?? '').trim();
  const data = { full_name: fullName, brand_name: brandName };

  const sb = await supabaseServer();
  const { error } = who.channel === 'email'
    ? await sb.auth.signInWithOtp({ email: who.contact, options: { shouldCreateUser: true, data } })
    : await sb.auth.signInWithOtp({ phone: who.contact, options: { shouldCreateUser: true, data } });

  /* Do not tell an anonymous caller whether the contact is known: the same
     answer is returned either way, and only a genuine send failure surfaces.
     A send failure is not an enumeration signal though — it says nothing
     about the address — so the reason is logged for the server operator and
     the cases a person can actually act on are named on screen. Before this,
     a project with no SMTP configured and a project that had simply hit its
     hourly cap produced the same "try again in a moment", which is wrong
     advice in both cases: one needs configuration, the other needs an hour. */
  if (error) {
    const status = (error as { status?: number }).status;
    console.error('[auth] signInWithOtp failed', { channel: who.channel, status, message: error.message });

    if (status === 429 || /rate limit|only request this after|for security purposes/i.test(error.message)) {
      return { ok: false, channel: who.channel, error: 'נשלחו יותר מדי בקשות. המתינו רגע ונסו שוב.' };
    }
    if (who.channel === 'phone' && /provider|sms|unsupported|not enabled|disabled/i.test(error.message)) {
      /* The most useful thing to say to a couple staring at this is not what
         is misconfigured, it is that the other door is open. */
      return { ok: false, channel: 'phone', error: 'שליחת SMS אינה זמינה כרגע. אפשר להיכנס עם כתובת אימייל.' };
    }
    if (/smtp|sending|provider|not authorized|signups not allowed/i.test(error.message)) {
      return { ok: false, channel: who.channel, error: 'שליחת הקוד אינה מוגדרת בשרת. פנו למנהל המערכת.' };
    }
    return { ok: false, channel: who.channel, error: 'לא הצלחנו לשלוח את הקוד כרגע. נסו שוב בעוד רגע.' };
  }

  return { ok: true, channel: who.channel, contact: who.contact, display: who.display, sentAt: Date.now() };
}

/** Step two: exchange the code for a session. */
export async function verifyCode(_prev: AuthResult | null, form: FormData): Promise<AuthResult> {
  const channel: Channel = String(form.get('channel') ?? '') === 'phone' ? 'phone' : 'email';
  const contact = String(form.get('contact') ?? '').trim();
  const display = String(form.get('display') ?? '') || contact;
  const sentAt = Number(form.get('sent_at') ?? 0) || undefined;
  const token = String(form.get('code') ?? '').replace(/\D/g, '');

  const back = { channel, contact, display, sentAt };

  if (contact === '') return { ok: false, error: 'משהו השתבש. נסו לבקש קוד חדש.', ...back };
  /* The code length is a Supabase project setting, not a constant. Hard coding
     six meant a project issuing eight could never be signed in to, and the
     screen blamed the person typing. Check that digits arrived, and let the
     server be the authority on whether they are the right ones. */
  if (token.length < 4) return { ok: false, error: 'חסרות ספרות בקוד', ...back };

  const sb = await supabaseServer();
  const { error } = channel === 'email'
    ? await sb.auth.verifyOtp({ email: contact, token, type: 'email' })
    : await sb.auth.verifyOtp({ phone: contact, token, type: 'sms' });

  if (error) {
    console.error('[auth] verifyOtp failed', { channel, message: error.message });
    /* Two different problems wore the same sentence before, and the wrong one
       sends people back to their inbox to retype a code that will never work.
       Expired means "press send again"; wrong means "look again". */
    if (/expired/i.test(error.message)) {
      return { ok: false, error: 'הקוד פג תוקף. בקשו קוד חדש בכפתור שלמטה.', ...back };
    }
    return { ok: false, error: 'הקוד אינו נכון. בדקו שוב, או בקשו קוד חדש.', ...back };
  }

  /* Attribution, once there is a session to attribute. Before this point
     there is no producer row to point at and the code is just a string off a
     URL. Failure is silent on purpose: a wrong or already-used code means the
     signup goes unattributed, which is a reporting gap, and refusing to let
     somebody into their own account over it would be absurd. */
  const ref = String(form.get('ref') ?? '').trim();
  if (ref) {
    const { error: refErr } = await sb.rpc('claim_referral', { p_code: ref });
    if (refErr) console.error('[auth] referral not claimed', { message: refErr.message });
  }

  revalidatePath('/', 'layout');
  redirect(safeNext(String(form.get('next') ?? '')));
}

/** Only a path inside this site is ever followed, so a crafted ?next= cannot
 *  bounce somebody straight off to another origin after they sign in. */
function safeNext(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/app';
  return value;
}

export async function signOut(): Promise<void> {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
