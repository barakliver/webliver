/**
 * One shape for everything this app says when something goes wrong.
 *
 * The logs were `console.error('[auth] ...', someObject)` in forty places,
 * which is readable by a person watching a terminal and close to useless
 * afterwards: the fields differ per call site, so nothing can be counted, and
 * `journalctl | grep` is the only tool that works on them. The question a
 * production failure actually raises — how many people hit this, on which
 * screen, since which release — could not be asked.
 *
 * So one line of JSON per event, with the same keys every time. Still one line
 * on a terminal, still greppable, and now countable.
 *
 * What is deliberately absent is as much the point as what is present. No
 * couple's name, no venue, no guest, no email address, no token, no body of
 * any message. A log that carries the details of somebody's wedding is a
 * second copy of the database with none of its protections, kept somewhere
 * nobody thinks of as a database, and read by whoever can reach the server.
 * The correlation id is what replaces all of that: it appears in the log and
 * on the screen the person is looking at, so a report of "it broke" and the
 * line that explains why can be joined without either one carrying anything
 * private.
 */

/** The release this is running, so a spike can be pinned to a deploy. Set by
 *  the build; unknown is honest rather than empty. */
const RELEASE = process.env.NEXT_PUBLIC_RELEASE || 'unknown';

/**
 * The fields a log line may carry, listed rather than filtered.
 *
 * This started as a filter that dropped anything which was not a string, a
 * number or a boolean, and its own test took it apart in one line: a venue is
 * a string and a private note is a string, so both went straight through while
 * the comment above them promised they could not. There is no way to describe
 * what is private in general, and every attempt is a denylist that is wrong
 * about the next field somebody adds.
 *
 * So the safe fields are named here and nothing else is written. Needing a new
 * one means adding it to this list, which is the moment somebody has to look
 * at it and decide — which is the whole point.
 */
export const SAFE_FIELDS = [
  /** The screen or route, as a path with no ids in it. */
  'at',
  /** producer, client, super_admin, or anon. Never who. */
  'role',
  /** The id shown to the person, so the two ends can be joined. */
  'ref',
  /** What was being attempted, in a word: 'convert-lead', 'send-code'. */
  'doing',
  /** How it went, as one of a handful of words. */
  'status',
  /** Why it was refused, as a code rather than a sentence. */
  'reason',
  /** An HTTP status, or the provider's own numeric code. */
  'code',
  /** A kind or category that is already a fixed set in this app. */
  'kind',
  /** How many of something, when the number is the finding. */
  'count',
  /** How long it took, in milliseconds. */
  'ms',
] as const;

export type LogFields = Partial<Record<(typeof SAFE_FIELDS)[number], string | number | boolean>>;

/**
 * A short id for one failure, shown to the person and written to the log.
 *
 * Not a UUID: this gets read aloud over WhatsApp by somebody whose screen
 * says something went wrong, and thirty-six characters of hexadecimal does
 * not survive that trip. Eight is enough to find one line in a day of them.
 */
export function correlationId(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

const ALLOWED: ReadonlySet<string> = new Set(SAFE_FIELDS);

/* Only the named fields, and only as scalars. The type already says this, but
   the type is gone at runtime and these calls sit in catch blocks where what
   arrives is whatever the caller had to hand — which is how a whole row ends
   up being passed to something that only meant to record that it failed. */
function safely(fields: LogFields): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(fields as Record<string, unknown>)) {
    if (!ALLOWED.has(k)) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}

function emit(level: 'error' | 'warn' | 'info', tag: string, message: string, fields: LogFields) {
  const line = JSON.stringify({
    /* `time` rather than `at`, because `at` is the route and the two collided:
       the spread put the path where the timestamp had been and the line lost
       its clock without saying so. */
    level, tag, message, release: RELEASE, time: new Date().toISOString(),
    ...safely(fields),
  });
  /* The console is the transport on purpose. systemd already collects it,
     rotates it and timestamps it; adding a logging library here would be a
     dependency, a buffer that can lose the last lines on a crash, and a second
     place for the server to run out of memory on a machine with one gigabyte. */
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/** Something failed and somebody noticed. Returns the reference to show them. */
export function logFailure(tag: string, message: string, fields: LogFields = {}): string {
  const ref = typeof fields.ref === 'string' && fields.ref ? fields.ref : correlationId();
  emit('error', tag, message, { ...fields, ref });
  return ref;
}

/** Something is wrong but the request survived it. */
export function logWarning(tag: string, message: string, fields: LogFields = {}): void {
  emit('warn', tag, message, fields);
}

/** Something worth counting happened. Not a trace: if it would be written
 *  once per request, it does not belong here. */
export function logEvent(tag: string, message: string, fields: LogFields = {}): void {
  emit('info', tag, message, fields);
}
