'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { noteFailure, saidFor } from '@/lib/flash';
import { currentLocale } from '@/lib/serverLocale';

/* The couple owns this panel too, and a couple may be reading English — so a
   failure here speaks the language the screen is in rather than the one the
   producer's console is written in. */
const said = async () => saidFor(await currentLocale());

/**
 * The faces and the looks.
 *
 * Every one of these writes to a table fenced by `can_read_client`, so the
 * database decides who may touch which event and these functions do not try to
 * decide it again. What they do is the part the database cannot: refuse a name
 * that is only whitespace, keep an uploaded picture inside its own event's
 * folder, and give the screen a sentence rather than a Postgres error.
 *
 * The picture is uploaded by the browser straight into storage, as everything
 * else on an event is, and only the path reaches here. The path is checked
 * against the event it claims to belong to — a client that could name any path
 * could attach somebody else's photograph to its own roster and then share it
 * through a link.
 */

export type PrepResult = { ok: boolean; error?: string };

const MISSING = 'חסרים פרטים';
const NO_SESSION = 'צריך להתחבר';
const FAILED = 'לא הצלחנו לשמור. אפשר לנסות שוב.';

const LOOKS = ['hair', 'makeup', 'outfit', 'other'] as const;
type Look = (typeof LOOKS)[number];

/** Inside this event's own folder, and nowhere else. The storage policy says
 *  the same thing; saying it here too means a mistake is a sentence on the
 *  screen rather than a refusal with no explanation. */
function ownPath(clientId: string, path: string): boolean {
  return path.startsWith(`${clientId}/`) && !path.includes('..');
}

export async function addVip(_prev: PrepResult | null, form: FormData): Promise<PrepResult> {
  const clientId = String(form.get('client_id') ?? '');
  const name = String(form.get('name') ?? '').trim();
  const relation = String(form.get('relation') ?? '').trim();
  const note = String(form.get('note') ?? '').trim();
  const photo = String(form.get('photo_url') ?? '').trim();

  if (!clientId) return { ok: false, error: MISSING };
  if (name.length < 1) return { ok: false, error: 'נא לכתוב שם' };
  if (photo && !ownPath(clientId, photo)) return { ok: false, error: 'התמונה לא נשמרה במקום הנכון' };

  const account = await currentAccount();
  if (!account) return { ok: false, error: NO_SESSION };

  const sb = await supabaseServer();
  /* At the end of the list. Somebody adding a third grandmother means her to
     come after the first two, not before them. */
  const { data: last } = await sb.from('event_vips')
    .select('sort').eq('client_id', clientId).order('sort', { ascending: false }).limit(1).maybeSingle();

  const { error } = await sb.from('event_vips').insert({
    client_id: clientId,
    name: name.slice(0, 80),
    relation: relation.slice(0, 60),
    note: note.slice(0, 400),
    photo_url: photo || null,
    sort: (last?.sort ?? 0) + 1,
  });
  if (error) {
    console.error('[prep] vip insert failed', error);
    return { ok: false, error: FAILED };
  }

  touch(clientId);
  return { ok: true };
}

export async function removeVip(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  const { error } = await sb.from('event_vips').delete().eq('id', id);
  if (error) {
    console.error('[prep] vip delete failed', error);
    await noteFailure((await said()).notRemoved);
  }
  touch(clientId);
}

export async function addLook(_prev: PrepResult | null, form: FormData): Promise<PrepResult> {
  const clientId = String(form.get('client_id') ?? '');
  const raw = String(form.get('category') ?? '');
  const category: Look = (LOOKS as readonly string[]).includes(raw) ? (raw as Look) : 'other';
  const image = String(form.get('image_url') ?? '').trim();
  const note = String(form.get('note') ?? '').trim();

  if (!clientId || !image) return { ok: false, error: MISSING };
  if (!ownPath(clientId, image)) return { ok: false, error: 'התמונה לא נשמרה במקום הנכון' };

  const account = await currentAccount();
  if (!account) return { ok: false, error: NO_SESSION };

  const sb = await supabaseServer();
  const { error } = await sb.from('event_looks').insert({
    client_id: clientId, category, image_url: image, note: note.slice(0, 400),
  });
  if (error) {
    console.error('[prep] look insert failed', error);
    return { ok: false, error: FAILED };
  }

  touch(clientId);
  return { ok: true };
}

export async function removeLook(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  const { error } = await sb.from('event_looks').delete().eq('id', id);
  if (error) {
    console.error('[prep] look delete failed', error);
    await noteFailure((await said()).notRemoved);
  }
  touch(clientId);
}

/**
 * A link for one supplier.
 *
 * Scoped, because a photographer has no business in somebody's makeup
 * references and a stylist has none in a family roster — and a link that
 * opens everything is the link that gets forwarded to a third person.
 *
 * The token is not generated here. The database mints it on insert and freezes
 * it on update, so a token this code could choose is a token a request body
 * could choose.
 */
export async function mintShare(form: FormData): Promise<void> {
  const clientId = String(form.get('client_id') ?? '');
  const scope = String(form.get('scope') ?? 'all');
  const label = String(form.get('label') ?? '').trim().slice(0, 60);
  if (!clientId || !['all', 'faces', 'looks'].includes(scope)) return;

  const sb = await supabaseServer();
  /* Ninety days. Long enough to outlast the planning and short enough that a
     link pasted into a supplier's group chat stops working before the next
     wedding season. */
  const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await sb.from('event_prep_shares')
    .insert({ client_id: clientId, scope, label, token: 'set-by-the-database', expires_at: expires });
  if (error) {
    console.error('[prep] share failed', error);
    await noteFailure((await said()).linkNotMade);
  }
  touch(clientId);
}

export async function revokeShare(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  const { error } = await sb.from('event_prep_shares')
    .update({ revoked_at: new Date().toISOString() }).eq('id', id);
  /* The one here that is not a convenience. A link that would not revoke and
     says nothing reads as "the button did not register", when what is true is
     that somebody's family photographs are still reachable by that address. */
  if (error) {
    console.error('[prep] revoke failed', error);
    await noteFailure((await said()).linkNotRevoked);
  }
  touch(clientId);
}

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
}
