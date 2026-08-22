import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';

/* ── Who is on this platform, and who they belong to ───────────────────────
   The admin screen approved producers and showed nothing else, which answers
   one question out of the three the root account actually has: who is waiting,
   who is working, and whose event is whose.

   Every read here goes through the same policies as everywhere else. The root
   account sees all of it because is_super_admin() is written into those
   policies, not because this file asks for anything special.               */

export type ProducerRow = {
  id: string;
  profileId: string | null;
  brandName: string;
  contactName: string;
  email: string;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  createdAt: string;
  /** Events they are working on now, archived ones excluded. */
  liveClients: number;
  totalClients: number;
  isRoot: boolean;
};

export type ClientRow = {
  id: string;
  name: string;
  kind: string;
  eventDate: string | null;
  archived: boolean;
  producerId: string | null;
  producerName: string;
  /** Up to three, each its own login to this workspace. */
  emails: { address: string; joined: boolean }[];
};

export type Directory = { producers: ProducerRow[]; clients: ClientRow[] };

export async function getDirectory(rootEmail: string): Promise<Directory> {
  const sb = await supabaseServer();

  const [producersQ, clientsQ, emailsQ] = await Promise.all([
    sb.from('producers')
      .select('id,owner_id,brand_name,contact_name,contact_email,status,created_at')
      .order('created_at', { ascending: false }),
    sb.from('clients')
      .select('id,display_name,kind,event_date,archived_at,producer_id')
      .order('event_date', { ascending: true, nullsFirst: false }),
    sb.from('client_authorized_emails').select('client_id,email,profile_id'),
  ]);

  const clients = clientsQ.data ?? [];
  const emails = emailsQ.data ?? [];

  /* Counted here rather than asked of the database per row: the whole list is
     already in memory, and a count query per producer is how an admin screen
     becomes slow the month somebody signs up ten of them. */
  const live = new Map<string, number>();
  const total = new Map<string, number>();
  for (const c of clients) {
    if (!c.producer_id) continue;
    total.set(c.producer_id, (total.get(c.producer_id) ?? 0) + 1);
    if (!c.archived_at) live.set(c.producer_id, (live.get(c.producer_id) ?? 0) + 1);
  }

  const producers: ProducerRow[] = (producersQ.data ?? []).map((p) => ({
    id: p.id,
    profileId: p.owner_id,
    brandName: p.brand_name || '',
    contactName: p.contact_name || '',
    email: p.contact_email || '',
    status: p.status,
    createdAt: p.created_at,
    liveClients: live.get(p.id) ?? 0,
    totalClients: total.get(p.id) ?? 0,
    /* The root account is not something to approve, suspend or reject. It is
       the thing doing the approving, and offering those buttons against it is
       an invitation to lock yourself out of your own platform. */
    isRoot: (p.contact_email || '').toLowerCase() === rootEmail.toLowerCase(),
  }));

  const nameOf = new Map(producers.map((p) => [p.id, p.brandName || p.contactName || p.email]));

  const byClient = new Map<string, { address: string; joined: boolean }[]>();
  for (const e of emails) {
    const list = byClient.get(e.client_id) ?? [];
    /* joined is the difference between "we sent an invitation" and "they are
       using it", which is the only part of an invitation worth reporting. */
    list.push({ address: e.email, joined: !!e.profile_id });
    byClient.set(e.client_id, list);
  }

  return {
    producers,
    clients: clients.map((c) => ({
      id: c.id,
      name: c.display_name,
      kind: c.kind,
      eventDate: c.event_date,
      archived: !!c.archived_at,
      producerId: c.producer_id,
      producerName: c.producer_id ? (nameOf.get(c.producer_id) ?? '') : '',
      emails: byClient.get(c.id) ?? [],
    })),
  };
}
