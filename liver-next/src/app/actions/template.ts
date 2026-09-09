'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { TASK_TEMPLATE, BUDGET_LINES, SUPPLIER_ROLES } from '@/content/eventFile';

export type TemplateResult = { ok: boolean; error?: string; added?: number };

/** Every task the template offers, by title, so a submitted pick can be
 *  checked against the list rather than trusted. A form is text somebody
 *  typed, and this one decides what lands in a workspace. */
const KNOWN_TASKS = new Map(
  TASK_TEMPLATE.flatMap((g) => g.tasks.map((t) => [t.title, t] as const))
);

function producerOnly(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
}

/**
 * Applying the parts of the event file somebody actually wants.
 *
 * A picker rather than a button, because the whole list is never right. Some
 * of these tasks do not apply to a small event, some couples are doing their
 * own invitations, and a template that arrives all or nothing is a template
 * that gets applied once and then unpicked by hand for twenty minutes.
 *
 * Sharing is decided per line, here, at the moment of adding. That is the
 * point at which somebody is actually thinking about who this is for.
 */
export async function applyTaskTemplate(_prev: TemplateResult | null, form: FormData): Promise<TemplateResult> {
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'רק מפיק יכול להוסיף מהתבנית' };

  const picked = form.getAll('task').map(String).filter((t) => KNOWN_TASKS.has(t));
  if (picked.length === 0) return { ok: false, error: 'לא נבחרה אף משימה' };

  /* Shared is per line and arrives as its own field, so a line that is not
     ticked shared is private. Absence is a decision here, not a default. */
  const shared = new Set(form.getAll('shared').map(String));

  const sb = await supabaseServer();
  const rows = picked.map((title) => {
    const t = KNOWN_TASKS.get(title)!;
    return {
      client_id: clientId,
      title: t.note ? `${title} · ${t.note}` : title,
      visible_to_client: shared.has(title),
    };
  });

  const { error } = await sb.from('tasks').insert(rows);
  if (error) {
    console.error('[template] tasks failed', error);
    return { ok: false, error: 'לא הצלחנו להוסיף את המשימות' };
  }

  producerOnly(clientId);
  return { ok: true, added: rows.length };
}

/** The budget as his spreadsheet lays it out. Amounts are left at zero rather
 *  than guessed: a number nobody typed, sitting in a budget, gets added up. */
export async function applyBudgetTemplate(_prev: TemplateResult | null, form: FormData): Promise<TemplateResult> {
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'רק מפיק יכול להוסיף מהתבנית' };

  const known = new Map(BUDGET_LINES.map((b) => [b.label, b] as const));
  const picked = form.getAll('line').map(String).filter((l) => known.has(l));
  if (picked.length === 0) return { ok: false, error: 'לא נבחרה אף שורה' };

  const sb = await supabaseServer();
  const { error } = await sb.from('budget_items').insert(
    picked.map((label) => ({
      client_id: clientId,
      label,
      category: known.get(label)!.category,
      estimate: 0,
    }))
  );
  if (error) {
    console.error('[template] budget failed', error);
    return { ok: false, error: 'לא הצלחנו להוסיף את שורות התקציב' };
  }

  producerOnly(clientId);
  return { ok: true, added: picked.length };
}

/** The fourteen suppliers on every one of his events, as empty cards waiting
 *  for a name and a number. */
export async function applySupplierTemplate(_prev: TemplateResult | null, form: FormData): Promise<TemplateResult> {
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'רק מפיק יכול להוסיף מהתבנית' };

  const known = new Map(SUPPLIER_ROLES.map((r) => [r.name, r] as const));
  const picked = form.getAll('role').map(String).filter((r) => known.has(r));
  if (picked.length === 0) return { ok: false, error: 'לא נבחר אף תפקיד' };

  const sb = await supabaseServer();
  const { error } = await sb.from('event_vendors').insert(
    picked.map((name) => ({
      client_id: clientId,
      name,
      category: known.get(name)!.category,
      status: 'shortlist' as const,
    }))
  );
  if (error) {
    console.error('[template] suppliers failed', error);
    return { ok: false, error: 'לא הצלחנו להוסיף את הספקים' };
  }

  producerOnly(clientId);
  return { ok: true, added: picked.length };
}
