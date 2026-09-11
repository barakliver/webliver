'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { shiftDate } from '@/content/timeline';
import { todayInZone } from '@/lib/clock';
import { startingTasks, MAX_MUST, type Answers } from '@/lib/onboarding';
import { allocate, PLAN_CATEGORIES, type PlanCategory } from '@/lib/budgetPlan';

export type OnboardResult = {
  ok: boolean;
  error?: string;
  /** Which blanks were actually filled, as the database reports them. The
   *  screen says what changed rather than claiming everything saved. */
  wrote?: string[];
  /** How many of the three starting tasks were new. A couple who already had
   *  "לסגור אולם" on their list keeps the one they had. */
  tasks?: number;
};

/**
 * The short opening flow, saved, and the three tasks it ends with.
 *
 * Two writes, in this order and not the other, because the second one reads
 * the first: the tasks are dated off the wedding date, and a date the couple
 * has just given has to be on the row before the dates are worked out.
 *
 * Nothing here trusts the browser with a decision. What is written is bounded
 * and re-derived — the split comes from the same `allocate` the budget screen
 * runs, the task titles come from the content file, and the fields are
 * written by a function that refuses to overwrite anything a producer
 * already decided. A request body carrying a wedding date for somebody
 * else's event reaches a gate, not a column.
 */
export async function saveBasics(input: {
  clientId: string;
  /** Null is "we have not decided", which is a real answer and stays blank. */
  date?: string | null;
  guests?: number | null;
  region?: string;
  budget?: number | null;
  must?: string[];
}): Promise<OnboardResult> {
  if (!input.clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const account = await currentAccount();
  if (!account) return { ok: false, error: 'צריך להתחבר' };

  const sb = await supabaseServer();

  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(input.date ?? '')) ? String(input.date) : null;
  const guests = clampInt(input.guests, 1, 5000);
  const region = String(input.region ?? '').trim().slice(0, 80);
  const budget = clampInt(input.budget, 1, 100_000_000);
  /* Only the categories the planner knows, only three of them, in the order
     the content file lists them rather than the order they were clicked. */
  const must = PLAN_CATEGORIES.filter((k) => (input.must ?? []).includes(k)).slice(0, MAX_MUST);

  /* The split is computed here from the total and the priorities, the same
     way the budget screen computes it, so a plan opened later by the
     producer is the plan the couple agreed to and not a second one. */
  const plan = must.length > 0 || budget !== null
    ? {
      total: budget ?? 0,
      guests,
      must,
      nice: [] as PlanCategory[],
      splits: Object.fromEntries(
        allocate({ total: budget ?? 0, guests, must, nice: [] }).lines.map((l) => [l.key, l.pct]),
      ) as Record<PlanCategory, number>,
    }
    : null;

  const { data, error } = await sb.rpc('couple_sets_basics', {
    p_client: input.clientId,
    p_date: date,
    p_guests: guests,
    p_region: region || null,
    p_budget: budget,
    p_plan: plan,
  });

  if (error) {
    console.error('[onboarding] basics failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור. אפשר לנסות שוב.' };
  }

  const wrote = readWrote(data);
  const tasks = await seedTasks(sb, input.clientId, { date, guests, must });

  revalidatePath('/app/portal');
  revalidatePath(`/app/clients/${input.clientId}`);
  return { ok: true, wrote, tasks };
}

/**
 * Three tasks, dated off whatever date the event now has.
 *
 * Read back rather than taken from the answer: the function above writes a
 * date only into a blank, so the date the tasks are counted from is the one
 * on the row and not the one that was offered. A step already on the list by
 * title is skipped, which is what makes running this twice harmless.
 */
async function seedTasks(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  clientId: string,
  a: Answers & { date: string | null },
): Promise<number> {
  const { data: row } = await sb.from('clients')
    .select('event_date').eq('id', clientId).maybeSingle();
  const eventDate = (row?.event_date as string | null) ?? null;
  const today = todayInZone();
  const daysLeft = eventDate
    ? Math.round((Date.parse(`${eventDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
    : null;

  const wanted = startingTasks({ must: a.must }, daysLeft);

  const { data: existing } = await sb.from('tasks')
    .select('title').eq('client_id', clientId);
  const have = new Set((existing ?? []).map((t) => String(t.title)));

  const rows = wanted
    .map((t) => ({
      client_id: clientId,
      title: START_TITLES[t.key],
      due_on: t.inDays === null ? null : shiftDate(today, t.inDays),
      owner: 'client' as const,
      category: t.category,
    }))
    .filter((r) => !have.has(r.title));

  if (rows.length === 0) return 0;

  const { error } = await sb.from('tasks').insert(rows);
  if (error) {
    console.error('[onboarding] tasks failed', error);
    return 0;
  }
  return rows.length;
}

/* The titles, in the couple's own words rather than the producer's. These
   are not the twenty-eight step plan — that is the producer's and stays on
   the producer's screen. These three are the ones a couple can start today. */
const START_TITLES: Record<string, string> = {
  agreeDate: 'לסגור תאריך',
  shortlistVenues: 'לבחור שלושה אולמות לראות',
  bookVenue: 'לסגור אולם',
  guestList: 'לכתוב את רשימת האורחים הראשונה',
  sendInvites: 'לשלוח הזמנות',
  photographer: 'לסגור צלם',
  music: 'לסגור מוזיקה',
  budgetLines: 'לפרק את התקציב לסעיפים',
  board: 'לאסוף תמונות השראה',
};

function clampInt(v: unknown, lo: number, hi: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function readWrote(data: unknown): string[] {
  const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return Array.isArray(o.wrote) ? o.wrote.map(String) : [];
}
