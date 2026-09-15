'use server';

import { supabasePublic } from '@/lib/supabase/public';

/**
 * The couple's notebook.
 *
 * Both of these run on the server and both go through the anon client, which
 * is the same standing an unsigned visitor already has. The credential is the
 * game's token, checked inside the database by `game_client` — there is no
 * session here to check, on purpose, because a wedding is two people with one
 * account between them and a notebook only one of them could open would not
 * be a notebook.
 *
 * Nothing in this file names a client id. The token is the only handle the
 * browser is ever given, so a browser cannot ask about an event it was not
 * sent the link to, and a shut game answers neither of these.
 */

export type NoteRow = { card_id: number; body: string };
export type NotesResult = { ok: true; notes: NoteRow[] } | { ok: false; error: string };
export type SaveResult = { ok: true; count: number } | { ok: false; error: string };

const TROUBLE = 'לא הצלחנו להגיע למחברת כרגע. נסו שוב עוד רגע.';

function sideOf(raw: unknown): 'a' | 'b' | null {
  return raw === 'a' || raw === 'b' ? raw : null;
}

/** One side's notes, in deck-number order. */
export async function loadGameNotes(token: string, side: string): Promise<NotesResult> {
  const which = sideOf(side);
  if (!/^[a-f0-9]{32}$/.test(token) || !which) return { ok: false, error: TROUBLE };
  try {
    const { data, error } = await supabasePublic()
      .rpc('game_notes_of', { p_token: token, p_side: which });
    if (error) { console.error('[game notes] read failed', error); return { ok: false, error: TROUBLE }; }
    const rows = (data ?? []) as { card_id: number; body: string }[];
    return { ok: true, notes: rows.map((r) => ({ card_id: Number(r.card_id), body: String(r.body) })) };
  } catch (e) {
    console.error('[game notes] read threw', e);
    return { ok: false, error: TROUBLE };
  }
}

/**
 * Write one note, or clear it.
 *
 * An empty body is a delete rather than a stored blank, which is decided in
 * the database so both sides of this cannot disagree about what "never mind"
 * means. Returns how many notes the notebook now holds, so the screen can
 * show the count without reading the whole thing back.
 */
export async function saveGameNote(
  token: string, side: string, cardId: number, body: string,
): Promise<SaveResult> {
  const which = sideOf(side);
  if (!/^[a-f0-9]{32}$/.test(token) || !which) return { ok: false, error: TROUBLE };
  if (!Number.isInteger(cardId) || cardId < 1 || cardId > 500) return { ok: false, error: TROUBLE };
  try {
    const { data, error } = await supabasePublic().rpc('game_note_write', {
      p_token: token, p_side: which, p_card: cardId, p_body: String(body ?? '').slice(0, 600),
    });
    if (error) { console.error('[game notes] write failed', error); return { ok: false, error: TROUBLE }; }
    return { ok: true, count: Number(data ?? 0) };
  } catch (e) {
    console.error('[game notes] write threw', e);
    return { ok: false, error: TROUBLE };
  }
}
