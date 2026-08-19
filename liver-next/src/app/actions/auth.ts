'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

export type AuthResult = { ok: boolean; error?: string; email?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Step one: mail a six digit code. No password is ever stored or compared,
 *  so there is nothing to leak and nothing to reset. */
export async function requestCode(_prev: AuthResult | null, form: FormData): Promise<AuthResult> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const fullName = String(form.get('full_name') ?? '').trim();
  const brandName = String(form.get('brand_name') ?? '').trim();

  if (!EMAIL_RE.test(email)) return { ok: false, error: 'כתובת האימייל לא תקינה' };

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: { full_name: fullName, brand_name: brandName },
    },
  });

  /* Do not tell an anonymous caller whether the address is known: the same
     answer is returned either way, and only a genuine send failure surfaces. */
  if (error) return { ok: false, error: 'לא הצלחנו לשלוח את הקוד כרגע. נסו שוב בעוד רגע.' };
  return { ok: true, email };
}

/** Step two: exchange the code for a session. */
export async function verifyCode(_prev: AuthResult | null, form: FormData): Promise<AuthResult> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const token = String(form.get('code') ?? '').replace(/\D/g, '');

  if (!EMAIL_RE.test(email)) return { ok: false, error: 'כתובת האימייל לא תקינה', email };
  /* The code length is a Supabase project setting, not a constant. Hard coding
     six meant a project issuing eight could never be signed in to, and the
     screen blamed the person typing. Check that digits arrived, and let the
     server be the authority on whether they are the right ones. */
  if (token.length < 4) return { ok: false, error: 'חסרות ספרות בקוד', email };

  const sb = await supabaseServer();
  const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) return { ok: false, error: 'הקוד שגוי או שפג תוקפו', email };

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
