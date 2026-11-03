/**
 * The rules of a conference sign-up, pure and tested.
 *
 * What is easy to get wrong here, and each is in a test: consent is asked
 * separately from the terms and never ticked for somebody; a phone is judged by
 * the digits in it and not by how it was typed; a CSV opened in Excel runs
 * anything that starts with `=`, so those cells are defanged; and a mailing
 * goes only to people who agreed and have not left, however the list was
 * filtered on the screen.
 */

/** Bumped when the terms change in a way a person should re-accept. It is
 *  stored with every acceptance, so the day somebody asks what they agreed to
 *  there is an answer. */
export const TERMS_VERSION = '2026-11';

export type JoinFields = { name: string; phone: string; email: string; terms: boolean };

export type JoinProblem = 'name' | 'phone' | 'email' | 'terms';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The digits of a phone, whatever separated them. */
export const phoneDigits = (s: string): string => s.replace(/\D/g, '');

/** Which fields are not good enough yet, in the order the form asks them. */
export function joinProblems(f: JoinFields): JoinProblem[] {
  const out: JoinProblem[] = [];
  if (f.name.trim().length < 2) out.push('name');
  if (phoneDigits(f.phone).length < 7 || f.phone.trim().length > 30) out.push('phone');
  if (!EMAIL.test(f.email.trim()) || f.email.trim().length > 200) out.push('email');
  if (!f.terms) out.push('terms');
  return out;
}

/** The address a QR points at. On the app host, because that is where a
 *  session exists and so where Google can fill the form in. */
export function joinUrl(base: string, token: string): string {
  return `${base.replace(/\/+$/, '')}/join/${token}`;
}

export type ContactRow = {
  name: string; phone: string; email: string; campaign: string;
  terms_version: string; terms_accepted_at: string;
  broadcast_consent: boolean; broadcast_consent_at: string | null; broadcast_revoked_at: string | null;
  created_at: string; note: string;
};

/** A cell that a spreadsheet would run as a formula is a cell that starts with
 *  one of these. A leading apostrophe makes it text in Excel and Sheets. */
function cell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** UTF-8 with a byte order mark, because Excel opens a Hebrew CSV as
 *  gibberish without one. Header in Hebrew, since that is who reads it. */
export function contactsCsv(rows: readonly ContactRow[]): string {
  const head = ['שם', 'טלפון', 'מייל', 'קמפיין', 'אישר תנאים (גרסה)', 'אישר תנאים בתאריך',
    'ברשימת תפוצה', 'אישר רשימה בתאריך', 'הסיר מהרשימה בתאריך', 'נרשם בתאריך', 'הערה'];
  const lines = rows.map((r) => [
    r.name, r.phone, r.email, r.campaign, r.terms_version, r.terms_accepted_at,
    r.broadcast_consent ? 'כן' : 'לא', r.broadcast_consent_at ?? '', r.broadcast_revoked_at ?? '',
    r.created_at, r.note,
  ].map((c) => cell(String(c))).join(','));
  return '﻿' + [head.map(cell).join(','), ...lines].join('\r\n') + '\r\n';
}

/** Who may be written to: agreed, not left, and with an address. The only
 *  place that decides it, so the screen's count and the send cannot differ. */
export function mayBeWritten<T extends Pick<ContactRow, 'broadcast_consent' | 'broadcast_revoked_at' | 'email'>>(
  rows: readonly T[],
): T[] {
  return rows.filter((r) => r.broadcast_consent && !r.broadcast_revoked_at && r.email.includes('@'));
}

/** The link in the foot of every mailing. */
export function unsubscribeUrl(base: string, token: string): string {
  return `${base.replace(/\/+$/, '')}/unsubscribe/${token}`;
}
