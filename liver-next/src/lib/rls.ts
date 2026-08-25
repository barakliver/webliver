import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Which half of the policy said no.
 *
 * Row level security answers every refusal the same way: 42501, one sentence,
 * no reason. That one sentence became "אין לך הרשאה לפעולה הזאת" on screen for
 * the person who owns the workspace, whose producer is approved and whose
 * profile is super_admin — and there was no way, from the app or from the log,
 * to tell which of the policy's conditions was actually false.
 *
 * So ask the database the same questions the policy asks, in the same request,
 * with the same session. Every one of these is an existing function that the
 * policy itself calls, so the answers are not a model of the rule: they are
 * the rule, evaluated as the caller.
 *
 *     whoami()               who the database thinks is asking, or null
 *     owns_producer(pid)     is this workspace theirs
 *     is_approved_producer() may they write at all
 *     is_super_admin()       are they the root account
 *
 * No migration is needed for this: all four already exist and are callable.
 */

type Answer = boolean | string | null;

export type Refusal = {
  /** What the caller should be told, in words they can act on. */
  message: string;
  /** The same finding for the log, and for the root admin's own screen. */
  detail: string;
  uid: Answer;
  owns: Answer;
  approved: Answer;
  root: Answer;
};

/** A refusal that is really an expired session. Kept as its own sentence
 *  because it is the one a producer can fix without calling anybody. */
export const SESSION_LOST = 'ההתחברות פגה. צאו והתחברו שוב, והפעולה תעבוד.';

const NOT_OWNER =
  'החשבון שמחובר אינו הבעלים של מרחב ההפקה. צאו והתחברו שוב עם הכתובת שפתחה את המרחב.';
const NOT_APPROVED = 'מרחב ההפקה עדיין ממתין לאישור, ולכן אי אפשר לפתוח אירוע.';
const UNKNOWN = 'אין לך הרשאה לפעולה הזאת';

/* eslint-disable @typescript-eslint/no-explicit-any */
async function ask(sb: SupabaseClient<any, any, any>, fn: string, args?: Record<string, unknown>): Promise<Answer> {
  const { data, error } = await sb.rpc(fn, args ?? {});
  /* A missing function is its own answer, and a different one from false.
     Collapsing the two printed `null` for a database that predates the
     function and read as a lost session: the wrong diagnosis dressed as a
     finding. */
  if (error) return `unavailable: ${error.message}`;
  return (data ?? null) as Answer;
}

export async function explainRefusal(
  sb: SupabaseClient<any, any, any>,
  producerId: string | null,
): Promise<Refusal> {
  const [uid, owns, approved, root] = await Promise.all([
    ask(sb, 'whoami'),
    producerId ? ask(sb, 'owns_producer', { pid: producerId }) : null,
    ask(sb, 'is_approved_producer'),
    ask(sb, 'is_super_admin'),
  ]);

  const message =
    uid === null ? SESSION_LOST
    : owns === false ? NOT_OWNER
    : approved === false ? NOT_APPROVED
    : UNKNOWN;

  const detail = `uid=${uid ?? 'null'} owns=${owns} approved=${approved} root=${root}`;
  return { message, detail, uid, owns, approved, root };
}
