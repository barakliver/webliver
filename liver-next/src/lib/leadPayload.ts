/**
 * Turning whatever a lead source sends into an enquiry.
 *
 * Every platform names the same six things differently, and several of them
 * name them differently from one form to the next, because the field names are
 * typed by whoever built the ad. Meta sends `full_name` on one form and
 * `שם מלא` on another. Google sends a list of column objects. Zapier sends
 * whatever the person wiring it up dragged in. A parser that insists on one
 * shape loses the leads that arrive in the others, and loses them silently.
 *
 * So the matching is deliberately loose in one direction only: keys are
 * matched forgivingly, values are never invented. A field that cannot be found
 * comes back empty and the enquiry is still saved, because a name and a phone
 * number with nothing else is a lead, and a producer can ask the rest.
 */

/** Keys are compared with punctuation, spacing and case removed, so
 *  `full_name`, `FULL NAME`, `fullName` and `Full-Name` are one key. */
const flatten = (key: string) => key.toLowerCase().replace(/[^a-z0-9֐-׿]/g, '');

const ALIASES = {
  name:   ['fullname', 'name', 'contactname', 'leadname', 'שם', 'שםמלא'],
  first:  ['firstname', 'givenname', 'שםפרטי'],
  last:   ['lastname', 'familyname', 'surname', 'שםמשפחה'],
  phone:  ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'tel', 'telephone', 'cell', 'טלפון', 'נייד'],
  email:  ['email', 'emailaddress', 'mail', 'אימייל', 'מייל', 'דואראלקטרוני'],
  date:   ['eventdate', 'date', 'weddingdate', 'preferreddate', 'תאריך', 'תאריךהאירוע'],
  guests: ['guestcount', 'guests', 'numberofguests', 'guestsestimate', 'attendees', 'אורחים', 'כמותאורחים', 'מספרמוזמנים'],
  loc: ['location', 'region', 'area', 'city', 'venue', 'event_location', 'מיקום', 'אזור', 'עיר', 'אולם'],
  msg: ['message', 'notes', 'note', 'comments', 'comment', 'details', 'freetext', 'הודעה', 'הערות', 'פרטים'],
  kind:   ['kind', 'eventtype', 'type', 'סוגאירוע', 'סוג'],
  source: ['source', 'platform', 'utmsource', 'channel', 'leadsource', 'מקור'],
  id:     ['externalid', 'leadid', 'leadgenid', 'id', 'entryid', 'submissionid'],
} as const;

type Bag = Record<string, string>;

/** Every string-ish leaf in the payload, keyed by its flattened name.
 *
 *  Nested, because Meta wraps a lead in entry[].changes[].value and Zapier
 *  wraps whatever it was given in a field of its own. Walking the whole tree
 *  finds the lead in all of them without a special case per sender, and the
 *  depth limit is there so a hostile payload cannot make this run forever.
 *  First writer wins: a value nearer the surface is the one somebody meant. */
function collect(node: unknown, into: Bag, depth = 0): Bag {
  if (depth > 8 || node === null || node === undefined) return into;

  if (Array.isArray(node)) {
    /* Both Meta and Google send their answers as a list of name/value pairs
       rather than as an object — Meta as {name, values: [...]}, Google as
       {column_id, string_value} — and several form builders copy one or the
       other. Read that shape as the object it stands for.

       An item that looks like a pair is never also walked into. It was, and
       the result was silent and wrong rather than merely missing: Meta's
       {name: 'full_name', values: ['נועה כהן']} was not recognised as a pair,
       so it was walked, and its own `name` key landed in the bag under `name`
       — which is one of the aliases for the person's name. Every Meta lead
       came in called "full_name", with no phone and no email. */
    for (const item of node) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        const key = o.column_id ?? o.name ?? o.key ?? o.field ?? o.label;
        if (typeof key === 'string') {
          const value = firstScalar(o.string_value ?? o.values ?? o.value ?? o.text);
          const k = flatten(key);
          if (k && value !== null && !(k in into)) into[k] = value;
          continue;
        }
      }
      collect(item, into, depth + 1);
    }
    return into;
  }

  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        const key = flatten(k);
        if (key && !(key in into)) into[key] = String(v).trim();
      } else {
        collect(v, into, depth + 1);
      }
    }
  }
  return into;
}

/** A value that may be a scalar or a one element list of one, which is how
 *  Meta writes every answer. Anything else is not a value we can use. */
function firstScalar(v: unknown): string | null {
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  if (Array.isArray(v)) {
    for (const item of v) {
      if (typeof item === 'string' || typeof item === 'number') return String(item).trim();
    }
  }
  return null;
}

/** The same rule as normalize_source() in 0023, written here so the prefix on
 *  an external id matches the source the row is stored under. Two spellings of
 *  one slug would be readable by nobody and groupable by nothing. */
export const slugSource = (raw: string): string =>
  raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'webhook';

const pick = (bag: Bag, names: readonly string[]): string => {
  for (const n of names) if (bag[n]) return bag[n];
  return '';
};

export type IngestedLead = {
  full_name: string;
  phone: string;
  email: string;
  kind: 'wedding' | 'corporate';
  event_date: string | null;
  guest_count: number | null;
  message: string;
  location: string;
  source: string;
  external_id: string | null;
};

/** A date in any of the orders people and platforms write them in, or null.
 *
 *  Ambiguity is resolved the Israeli way, day before month, because that is
 *  who fills in these forms — except where the first number cannot be a day,
 *  which settles it without guessing. An unparseable date is dropped rather
 *  than guessed at: a wedding on the wrong date is worse than a wedding with
 *  no date, and the original text still reaches the producer in the message. */
export function parseLooseDate(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (iso) return ymd(+iso[1], +iso[2], +iso[3]);

  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(text);
  if (dmy) {
    let [, a, b, y] = dmy;
    let year = Number(y);
    if (year < 100) year += 2000;
    let day = Number(a);
    let month = Number(b);
    if (day > 12 && month <= 12) { /* unambiguous, already right */ }
    else if (month > 12 && day <= 12) { [day, month] = [month, day]; }
    return ymd(year, month, day);
  }

  const stamp = Date.parse(text);
  if (!Number.isNaN(stamp)) {
    const d = new Date(stamp);
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}

function ymd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  /* Reject 31 February rather than let the database silently take a different
     day than the one on the form. */
  const back = new Date(`${iso}T00:00:00Z`);
  return back.getUTCDate() === d && back.getUTCMonth() + 1 === m ? iso : null;
}

/** "כ-250", "about 250 guests", "250-300" all mean roughly 250. Anything that
 *  yields no number at all comes back null, and the raw text is still in the
 *  message. */
export function parseLooseCount(raw: string): number | null {
  const m = /\d+/.exec(raw);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1500) : null;
}

const CORPORATE = /(corporate|business|company|conference|כנס|חברה|עסקי|ארגוני|אירועחברה)/i;

export function readLead(body: unknown, fallbackSource: string): IngestedLead {
  const bag = collect(body, {});

  const parts = [pick(bag, ALIASES.first), pick(bag, ALIASES.last)].filter(Boolean).join(' ');
  const name = pick(bag, ALIASES.name) || parts;

  const source = pick(bag, ALIASES.source) || fallbackSource;
  const rawId = pick(bag, ALIASES.id);

  const kindText = `${pick(bag, ALIASES.kind)} ${pick(bag, ALIASES.msg)}`.replace(/\s/g, '');

  return {
    full_name: name.slice(0, 120),
    phone: pick(bag, ALIASES.phone).slice(0, 40),
    email: pick(bag, ALIASES.email).toLowerCase().slice(0, 160),
    kind: CORPORATE.test(kindText) ? 'corporate' : 'wedding',
    event_date: parseLooseDate(pick(bag, ALIASES.date)),
    guest_count: parseLooseCount(pick(bag, ALIASES.guests)),
    message: pick(bag, ALIASES.msg).slice(0, 4000),
    location: pick(bag, ALIASES.loc).slice(0, 120),
    source,
    /* Namespaced by source, because two platforms numbering their leads from
       one would otherwise collide and the second platform's lead would be
       swallowed as a duplicate of the first's. */
    external_id: rawId ? `${slugSource(source)}:${rawId}`.slice(0, 200) : null,
  };
}
