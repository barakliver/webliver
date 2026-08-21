import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';

/* ── What actually needs a person ──────────────────────────────────────────
   The brief is explicit: "three things need your decision this week", not
   "42 open tasks". A large raw count is pressure, not information — it tells
   you that you are behind without telling you on what, and the only action it
   offers is to feel bad.

   So this returns *items*, each one a specific thing with a specific place to
   go, and the number on screen is however many of those there are. When there
   are none the screen says so, which is a real answer rather than four zeros.  */

export type Urgency = 'now' | 'soon';

export type AttentionItem = {
  id: string;
  kind: 'lead' | 'task' | 'payment' | 'gap';
  title: string;
  detail: string;
  href: string;
  urgency: Urgency;
  /** Sorts within a group. Lower is more urgent. */
  rank: number;
};

export type Overview = {
  items: AttentionItem[];
  next: { name: string; date: string; days: number; href: string } | null;
  money: { paid: number; owed: number; overdue: number };
  counts: { clients: number };
};

const DAY = 86_400_000;

function daysUntil(iso: string, today: number) {
  return Math.ceil((new Date(iso + 'T00:00:00').getTime() - today) / DAY);
}

function heDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('he-IL', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export async function getOverview(): Promise<Overview> {
  const sb = await supabaseServer();
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const today = new Date(todayIso + 'T00:00:00').getTime();
  const weekIso = new Date(today + 7 * DAY).toISOString().slice(0, 10);

  /* Every read goes through row level security as the signed-in person, so
     none of these need a producer filter of their own. */
  const [leadsQ, tasksQ, paysQ, clientsQ] = await Promise.all([
    sb.from('leads')
      .select('id,full_name,kind,event_date,created_at')
      .eq('status', 'new')
      .order('created_at', { ascending: true })
      .limit(20),
    sb.from('tasks')
      .select('id,client_id,title,due_on,owner')
      .eq('done', false)
      .eq('owner', 'producer')
      .not('due_on', 'is', null)
      .lte('due_on', weekIso)
      .order('due_on', { ascending: true })
      .limit(20),
    sb.from('payments')
      .select('id,client_id,title,amount,due_on,paid')
      .order('due_on', { ascending: true }),
    sb.from('clients')
      .select('id,display_name,event_date,venue,guest_estimate')
      .order('event_date', { ascending: true }),
  ]);

  const clients = clientsQ.data ?? [];
  const nameOf = new Map(clients.map((c) => [c.id, c.display_name]));
  const items: AttentionItem[] = [];

  /* A new lead is a decision by definition: somebody asked and nobody has
     answered. Age is the urgency — a week-old unanswered enquiry is worse
     than a fresh one, not better. */
  for (const l of leadsQ.data ?? []) {
    const age = Math.floor((now.getTime() - new Date(l.created_at).getTime()) / DAY);
    items.push({
      id: `lead-${l.id}`,
      kind: 'lead',
      title: l.full_name,
      detail: age <= 0 ? 'פנייה חדשה, הגיעה היום'
            : age === 1 ? 'פנייה חדשה, מאתמול'
            : `פנייה חדשה, מלפני ${age} ימים`,
      href: '/app/leads',
      urgency: age >= 2 ? 'now' : 'soon',
      rank: -age,
    });
  }

  /* Only tasks the producer owns. A couple's task is not the producer's
     decision, and putting it here would be the "42 open tasks" mistake in a
     nicer font. */
  for (const t of tasksQ.data ?? []) {
    const d = daysUntil(t.due_on!, today);
    items.push({
      id: `task-${t.id}`,
      kind: 'task',
      title: t.title,
      detail: d < 0 ? `${nameOf.get(t.client_id) ?? ''} · באיחור ${-d} ימים`
            : d === 0 ? `${nameOf.get(t.client_id) ?? ''} · להיום`
            : `${nameOf.get(t.client_id) ?? ''} · בעוד ${d} ימים`,
      href: `/app/clients/${t.client_id}`,
      urgency: d <= 0 ? 'now' : 'soon',
      rank: d,
    });
  }

  const pays = paysQ.data ?? [];
  let paid = 0, owed = 0, overdue = 0;
  for (const p of pays) {
    const amt = Number(p.amount) || 0;
    if (p.paid) { paid += amt; continue; }
    owed += amt;
    if (p.due_on && daysUntil(p.due_on, today) < 0) {
      overdue += amt;
      items.push({
        id: `pay-${p.id}`,
        kind: 'payment',
        title: p.title,
        detail: `${nameOf.get(p.client_id) ?? ''} · תשלום באיחור מאז ${heDate(p.due_on)}`,
        href: `/app/clients/${p.client_id}`,
        urgency: 'now',
        rank: daysUntil(p.due_on, today),
      });
    }
  }

  /* A structural gap only counts as urgent when the date is close enough for
     it to matter. An event eight months out with no venue is a plan; the same
     gap five weeks out is a problem. */
  for (const c of clients) {
    if (!c.event_date) continue;
    const d = daysUntil(c.event_date, today);
    if (d < 0 || d > 45) continue;
    const missing: string[] = [];
    if (!c.venue) missing.push('מקום');
    if (!c.guest_estimate) missing.push('כמות אורחים');
    if (missing.length) {
      items.push({
        id: `gap-${c.id}`,
        kind: 'gap',
        title: c.display_name,
        detail: `בעוד ${d} ימים ועדיין חסר: ${missing.join(', ')}`,
        href: `/app/clients/${c.id}`,
        urgency: d <= 21 ? 'now' : 'soon',
        rank: d,
      });
    }
  }

  items.sort((a, b) =>
    a.urgency === b.urgency ? a.rank - b.rank : a.urgency === 'now' ? -1 : 1);

  const upcoming = clients.filter((c) => c.event_date && daysUntil(c.event_date, today) >= 0)[0];

  return {
    items,
    next: upcoming
      ? {
          name: upcoming.display_name,
          date: heDate(upcoming.event_date!),
          days: daysUntil(upcoming.event_date!, today),
          href: `/app/clients/${upcoming.id}`,
        }
      : null,
    money: { paid, owed, overdue },
    counts: { clients: clients.length },
  };
}
