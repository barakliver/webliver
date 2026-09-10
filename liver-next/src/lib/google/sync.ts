import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { publicEnv } from '@/lib/env';
import { EVENT_ZONE } from '@/lib/clock';
import { ils } from '@/lib/money';
import { refreshAccess } from './oauth';
import {
  fingerprint, interpret, plan, toGoogleEvent,
  type GEvent, type Link, type SyncItem, type SyncKind,
} from '@/lib/gsync';

/**
 * One producer's two diaries, made the same.
 *
 * Runs with the service role, because it runs from the cron at a quarter
 * past the hour with nobody signed in, and every row it touches is one
 * producer's. Everything it decides is decided in gsync.ts; this file only
 * reads rows, calls Google, and writes what was decided.
 *
 * Pull first, then push: a change made on the phone since last time lands
 * here before this side's view of the world is written back over it.
 */

const API = 'https://www.googleapis.com/calendar/v3';

/** The events collection of one calendar, and one event in it. Built by
 *  joining rather than in a template, which is also what keeps the bidi
 *  checker from reading a path as a fraction. */
const eventsPath = (calendarId: string, eventId = '') =>
  ['/calendars', encodeURIComponent(calendarId), 'events', ...(eventId ? [encodeURIComponent(eventId)] : [])].join('/');

type Row = {
  producer_id: string; email: string; refresh_token: string; access_token: string;
  token_expires_at: string | null; calendar_id: string; sync_token: string | null;
};

export type SyncReport = { pulled: number; pushed: number; removed: number; error: string };

class GoogleError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function call<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) throw new GoogleError(res.status, text.slice(0, 300));
  return (text ? JSON.parse(text) : undefined) as T;
}

/** A live access token for the row, refreshed when it has under five
 *  minutes left. */
async function accessToken(sb: SupabaseClient, row: Row): Promise<string> {
  const left = row.token_expires_at ? new Date(row.token_expires_at).getTime() - Date.now() : 0;
  if (row.access_token && left > 5 * 60 * 1000) return row.access_token;
  const r = await refreshAccess(row.refresh_token);
  if ('error' in r) throw new GoogleError(401, r.error);
  await sb.from('google_calendars')
    .update({ access_token: r.accessToken, token_expires_at: r.expiresAt })
    .eq('producer_id', row.producer_id);
  return r.accessToken;
}

/** The calendar this platform writes to, created on first use and named
 *  after the producer's brand. */
export async function ensureCalendar(sb: SupabaseClient, row: Row, token: string, name: string): Promise<string> {
  if (row.calendar_id) return row.calendar_id;
  const made = await call<{ id: string }>(token, 'POST', '/calendars', { summary: name, timeZone: EVENT_ZONE });
  await sb.from('google_calendars').update({ calendar_id: made.id }).eq('producer_id', row.producer_id);
  return made.id;
}

/* ── what this side has ────────────────────────────────────────────────── */

async function itemsOf(sb: SupabaseClient, producerId: string): Promise<SyncItem[]> {
  const { data: clients } = await sb.from('clients')
    .select('id,display_name,event_date,venue').eq('producer_id', producerId).is('archived_at', null);
  const rows = clients ?? [];
  const ids = rows.map((c) => c.id);
  const nameOf = new Map(rows.map((c) => [c.id, c.display_name]));

  const [tasks, pays, entries] = await Promise.all([
    ids.length ? sb.from('tasks').select('id,client_id,title,due_on,done').in('client_id', ids).not('due_on', 'is', null).eq('done', false) : Promise.resolve({ data: [] }),
    ids.length ? sb.from('payments').select('id,client_id,title,amount,due_on,paid').in('client_id', ids).not('due_on', 'is', null).eq('paid', false) : Promise.resolve({ data: [] }),
    sb.from('diary_entries').select('id,client_id,title,on_date,at_time,duration_min,note').eq('producer_id', producerId),
  ]);

  const out: SyncItem[] = [];
  for (const c of rows) {
    if (!c.event_date) continue;
    out.push({ kind: 'event', id: c.id, title: c.display_name, date: c.event_date, time: '', durationMin: 0, detail: c.venue ?? '', href: `/app/clients/${c.id}` });
  }
  for (const t of (tasks.data ?? []) as { id: string; client_id: string; title: string; due_on: string }[]) {
    out.push({ kind: 'task', id: t.id, title: t.title, date: t.due_on, time: '', durationMin: 0, detail: nameOf.get(t.client_id) ?? '', href: `/app/clients/${t.client_id}?tab=tasks` });
  }
  for (const p of (pays.data ?? []) as { id: string; client_id: string; title: string; amount: number | null; due_on: string }[]) {
    const amount = p.amount ? ils(Number(p.amount)) : '';
    out.push({ kind: 'payment', id: p.id, title: p.title, date: p.due_on, time: '', durationMin: 0, detail: [nameOf.get(p.client_id) ?? '', amount].filter(Boolean).join(' · '), href: `/app/clients/${p.client_id}?tab=money` });
  }
  for (const e of (entries.data ?? []) as { id: string; client_id: string | null; title: string; on_date: string; at_time: string | null; duration_min: number; note: string }[]) {
    out.push({ kind: 'entry', id: e.id, title: e.title, date: e.on_date, time: e.at_time ? e.at_time.slice(0, 5) : '', durationMin: e.duration_min, detail: [e.client_id ? nameOf.get(e.client_id) ?? '' : '', e.note].filter(Boolean).join(' · '), href: e.client_id ? `/app/clients/${e.client_id}` : '/app/calendar' });
  }
  return out;
}

async function linksOf(sb: SupabaseClient, producerId: string): Promise<Link[]> {
  const { data } = await sb.from('google_links').select('kind,item_id,google_event_id,fingerprint').eq('producer_id', producerId);
  return (data ?? []) as Link[];
}

/* ── pull: what the phone changed ───────────────────────────────────────── */

async function pull(sb: SupabaseClient, row: Row, token: string, calendarId: string): Promise<number> {
  const links = await linksOf(sb, row.producer_id);
  const byGoogle = new Map(links.map((l) => [l.google_event_id, l]));

  /* A task's or a wedding's current date, so a rename on the phone is not
     read as a move. Fetched once per changed event; they are few. */
  const dateOf = async (l: Link): Promise<string | null> => {
    if (l.kind === 'event') return (await sb.from('clients').select('event_date').eq('id', l.item_id).maybeSingle()).data?.event_date ?? null;
    if (l.kind === 'task') return (await sb.from('tasks').select('due_on').eq('id', l.item_id).maybeSingle()).data?.due_on ?? null;
    if (l.kind === 'payment') return (await sb.from('payments').select('due_on').eq('id', l.item_id).maybeSingle()).data?.due_on ?? null;
    return null;
  };

  let changed = 0;
  let pageToken: string | undefined;
  let syncToken = row.sync_token ?? undefined;
  let nextSync: string | undefined;

  for (let guard = 0; guard < 20; guard++) {
    const q = new URLSearchParams({ maxResults: '250', showDeleted: 'true' });
    if (pageToken) q.set('pageToken', pageToken);
    else if (syncToken) q.set('syncToken', syncToken);
    else q.set('timeMin', new Date(Date.now() - 30 * 86_400_000).toISOString());

    let page: { items?: GEvent[]; nextPageToken?: string; nextSyncToken?: string };
    try {
      page = await call(token, 'GET', `${eventsPath(calendarId)}?${q.toString()}`);
    } catch (e) {
      /* A 410 means the cursor is too old: start the listing over. */
      if (e instanceof GoogleError && e.status === 410 && syncToken) { syncToken = undefined; pageToken = undefined; continue; }
      throw e;
    }

    for (const ev of page.items ?? []) {
      const link = byGoogle.get(ev.id) ?? null;
      const current = link ? await dateOf(link) : null;
      const what = interpret(ev, () => link, () => current);
      switch (what.action) {
        case 'entry-upsert': {
          if (what.entryId) {
            await sb.from('diary_entries').update({ title: what.title, on_date: what.date, at_time: what.time || null, duration_min: what.durationMin, note: what.note }).eq('id', what.entryId);
          } else {
            const { data: made } = await sb.from('diary_entries')
              .insert({ producer_id: row.producer_id, title: what.title, on_date: what.date, at_time: what.time || null, duration_min: what.durationMin, note: what.note })
              .select('id').maybeSingle();
            if (made) {
              await sb.from('google_links').upsert({ producer_id: row.producer_id, kind: 'entry', item_id: made.id, google_event_id: ev.id, fingerprint: '' });
              byGoogle.set(ev.id, { kind: 'entry', item_id: made.id, google_event_id: ev.id, fingerprint: '' });
            }
          }
          /* Written from the phone's version, so the push below sees it as
             current rather than writing our copy straight back. */
          const fresh = { kind: 'entry' as SyncKind, id: what.entryId ?? '', title: what.title, date: what.date, time: what.time, durationMin: what.durationMin, detail: '', href: '' };
          if (what.entryId) await sb.from('google_links').update({ fingerprint: fingerprint({ ...fresh, detail: await entryDetail(sb, what.entryId) }) }).eq('producer_id', row.producer_id).eq('google_event_id', ev.id);
          changed++;
          break;
        }
        case 'entry-delete':
          await sb.from('diary_entries').delete().eq('id', what.entryId);
          await sb.from('google_links').delete().eq('producer_id', row.producer_id).eq('google_event_id', ev.id);
          changed++;
          break;
        case 'move': {
          const table = what.kind === 'event' ? 'clients' : what.kind === 'task' ? 'tasks' : 'payments';
          const column = what.kind === 'event' ? 'event_date' : 'due_on';
          const { error } = await sb.from(table).update({ [column]: what.date }).eq('id', what.itemId);
          if (!error) changed++;
          break;
        }
        case 'unlink':
          await sb.from('google_links').delete().eq('producer_id', row.producer_id).eq('google_event_id', ev.id);
          break;
        case 'ignore':
          break;
      }
    }

    if (page.nextPageToken) { pageToken = page.nextPageToken; continue; }
    nextSync = page.nextSyncToken;
    break;
  }

  if (nextSync) await sb.from('google_calendars').update({ sync_token: nextSync }).eq('producer_id', row.producer_id);
  return changed;
}

async function entryDetail(sb: SupabaseClient, entryId: string): Promise<string> {
  const { data } = await sb.from('diary_entries').select('note,client_id,clients(display_name)').eq('id', entryId).maybeSingle();
  if (!data) return '';
  const rel = (data as { clients?: { display_name?: string } | { display_name?: string }[] | null }).clients;
  const name = Array.isArray(rel) ? rel[0]?.display_name : rel?.display_name;
  return [name ?? '', data.note].filter(Boolean).join(' · ');
}

/* ── push: what this side has ──────────────────────────────────────────── */

async function push(sb: SupabaseClient, row: Row, token: string, calendarId: string): Promise<{ pushed: number; removed: number }> {
  const [items, links] = await Promise.all([itemsOf(sb, row.producer_id), linksOf(sb, row.producer_id)]);
  const p = plan(items, links);
  const base = eventsPath(calendarId);
  let pushed = 0, removed = 0;

  for (const item of p.create) {
    const made = await call<{ id: string }>(token, 'POST', base, toGoogleEvent(item, EVENT_ZONE, publicEnv.siteUrl));
    await sb.from('google_links').upsert({ producer_id: row.producer_id, kind: item.kind, item_id: item.id, google_event_id: made.id, fingerprint: fingerprint(item), synced_at: new Date().toISOString() });
    pushed++;
  }
  for (const { item, eventId } of p.update) {
    try {
      await call(token, 'PATCH', eventsPath(calendarId, eventId), toGoogleEvent(item, EVENT_ZONE, publicEnv.siteUrl));
    } catch (e) {
      /* Deleted on the phone and not yet pulled: write a new twin. */
      if (e instanceof GoogleError && (e.status === 404 || e.status === 410)) {
        const made = await call<{ id: string }>(token, 'POST', base, toGoogleEvent(item, EVENT_ZONE, publicEnv.siteUrl));
        await sb.from('google_links').update({ google_event_id: made.id }).eq('producer_id', row.producer_id).eq('kind', item.kind).eq('item_id', item.id);
      } else throw e;
    }
    await sb.from('google_links').update({ fingerprint: fingerprint(item), synced_at: new Date().toISOString() }).eq('producer_id', row.producer_id).eq('kind', item.kind).eq('item_id', item.id);
    pushed++;
  }
  for (const link of p.remove) {
    try { await call(token, 'DELETE', eventsPath(calendarId, link.google_event_id)); }
    catch (e) { if (!(e instanceof GoogleError && (e.status === 404 || e.status === 410))) throw e; }
    await sb.from('google_links').delete().eq('producer_id', row.producer_id).eq('kind', link.kind).eq('item_id', link.item_id);
    removed++;
  }
  return { pushed, removed };
}

/* ── one producer, both directions ─────────────────────────────────────── */

export async function syncProducer(producerId: string, sb: SupabaseClient = supabaseAdmin()): Promise<SyncReport> {
  const out: SyncReport = { pulled: 0, pushed: 0, removed: 0, error: '' };
  const { data: row } = await sb.from('google_calendars')
    .select('producer_id,email,refresh_token,access_token,token_expires_at,calendar_id,sync_token')
    .eq('producer_id', producerId).maybeSingle();
  if (!row) { out.error = 'not connected'; return out; }

  try {
    const token = await accessToken(sb, row as Row);
    const { data: prod } = await sb.from('producers').select('brand_name').eq('id', producerId).maybeSingle();
    const calendarId = await ensureCalendar(sb, row as Row, token, prod?.brand_name || 'Liver');
    out.pulled = await pull(sb, { ...(row as Row), calendar_id: calendarId }, token, calendarId);
    const pushedNow = await push(sb, row as Row, token, calendarId);
    out.pushed = pushedNow.pushed;
    out.removed = pushedNow.removed;
    await sb.from('google_calendars').update({ last_sync_at: new Date().toISOString(), last_error: '' }).eq('producer_id', producerId);
  } catch (e) {
    const message = e instanceof GoogleError ? `google ${e.status}: ${e.message}` : (e instanceof Error ? e.message : String(e));
    out.error = message.slice(0, 300);
    console.error('[gsync] failed', { producerId, message: out.error });
    await sb.from('google_calendars').update({ last_sync_at: new Date().toISOString(), last_error: out.error }).eq('producer_id', producerId);
  }
  return out;
}

/** Every connected producer, for the cron. */
export async function syncAll(sb: SupabaseClient = supabaseAdmin()): Promise<{ producers: number; pulled: number; pushed: number; errors: string[] }> {
  const { data } = await sb.from('google_calendars').select('producer_id');
  const out = { producers: 0, pulled: 0, pushed: 0, errors: [] as string[] };
  for (const r of data ?? []) {
    const rep = await syncProducer(r.producer_id, sb);
    out.producers++;
    out.pulled += rep.pulled;
    out.pushed += rep.pushed + rep.removed;
    if (rep.error) out.errors.push(`gsync ${r.producer_id}: ${rep.error}`);
  }
  return out;
}
