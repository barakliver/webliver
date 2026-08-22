import { notFound, redirect } from 'next/navigation';
import { getSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import type {
  BudgetItemRow,
  GuestRow,
  MoodboardRow,
  ReceiptRow,
  SeatingTableRow,
} from '@/lib/supabase/database.types';
import type { TimelineEntry } from '@/lib/domain/timeline';
import BrideMode from '@/components/BrideMode';
import RsvpSeatingEngine from '@/components/RsvpSeatingEngine';
import AlcoholEstimator from '@/components/AlcoholEstimator';
import ReceiptScanner from '@/components/ReceiptScanner';
import TimelinePdfExporter from '@/components/TimelinePdfExporter';

export const dynamic = 'force-dynamic';

/**
 * The client workspace. Every panel is server-rendered with its first page of
 * data, then each component subscribes to Realtime for live updates.
 */
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/workspace/${clientId}`);

  const supabase = await getSupabaseServerClient();

  // RLS scopes every one of these to workspaces the caller may see, so a
  // missing client row means "no access" and "not found" alike.
  const [client, moodboards, guests, tables, budget, receipts, settings] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
    supabase.from('moodboards').select('*').eq('client_id', clientId).order('position', { ascending: false }),
    supabase.from('guests_rsvp').select('*').eq('client_id', clientId),
    supabase.from('tables_seating').select('*').eq('client_id', clientId),
    supabase.from('budget_items').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    supabase.from('receipts').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    supabase.from('event_settings').select('*').eq('client_id', clientId).maybeSingle(),
  ]);

  if (!client.data) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const season = seasonForDate(client.data.event_date);

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 16px 90px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 className="serif" style={{ fontSize: 28 }}>
          {client.data.display_name}
        </h1>
        <p className="muted small">
          {client.data.event_date
            ? new Date(client.data.event_date).toLocaleDateString('he-IL', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : 'טרם נקבע תאריך'}
          {client.data.venue ? ` · ${client.data.venue}` : ''}
        </p>
      </header>

      <div className="stack" style={{ gap: 40 }}>
        <BrideMode clientId={clientId} initialItems={(moodboards.data ?? []) as MoodboardRow[]} />

        <RsvpSeatingEngine
          clientId={clientId}
          initialGuests={(guests.data ?? []) as GuestRow[]}
          initialTables={(tables.data ?? []) as SeatingTableRow[]}
          siteUrl={siteUrl}
        />

        <AlcoholEstimator
          initialGuests={client.data.guest_count ?? undefined}
          initialSeason={season}
        />

        <ReceiptScanner
          clientId={clientId}
          initialBudget={(budget.data ?? []) as BudgetItemRow[]}
          initialReceipts={(receipts.data ?? []) as ReceiptRow[]}
        />

        <TimelinePdfExporter
          clientId={clientId}
          eventName={client.data.display_name}
          eventDate={client.data.event_date}
          venue={settings.data?.venue_name ?? client.data.venue}
          entries={DEFAULT_TIMELINE}
          calendarToken={settings.data?.calendar_token ?? null}
          siteUrl={siteUrl}
        />
      </div>
    </main>
  );
}

function seasonForDate(date: string | null): 'summer' | 'winter' | 'shoulder' {
  if (!date) return 'shoulder';
  const month = new Date(date).getMonth() + 1;
  if (month >= 6 && month <= 9) return 'summer';
  if (month === 12 || month <= 2) return 'winter';
  return 'shoulder';
}

/**
 * Seed timeline, matching the stages the existing event file already ships.
 * Replace with the workspace's stored timeline once it moves into Supabase.
 */
const DEFAULT_TIMELINE: TimelineEntry[] = [
  { time: '09:45', title: 'התחלת שיער ואיפור', audiences: ['couple'], owner: 'מאפרת' },
  { time: '12:00', title: 'הקמת במה, סאונד ותאורה', audiences: ['crew'], owner: 'צוות טכני' },
  { time: '13:00', title: 'צלם מגיע', audiences: ['photo', 'couple'], owner: 'צלם ראשי' },
  { time: '15:30', title: 'צילומי חוץ', audiences: ['photo', 'couple'] },
  { time: '17:00', title: 'בדיקת סאונד סופית', audiences: ['crew'] },
  { time: '18:00', title: 'צילומי משפחות', audiences: ['photo', 'couple'] },
  { time: '19:30', title: 'קבלת פנים', audiences: ['all'] },
  { time: '21:00', title: 'חופה', audiences: ['all'] },
  { time: '21:45', title: 'פתיחת רחבה', audiences: ['all'] },
  { time: '23:30', title: 'פירוק ציוד', audiences: ['crew'], owner: 'צוות טכני' },
];
