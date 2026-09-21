/* ── What a lead channel can be ────────────────────────────────────────────
   A plain module, for the reason `liveSources.ts` spells out: the list is read
   by a server action deciding what to store and by a browser component drawing
   a select, and data both sides read belongs in a module that claims neither.

   These are the platforms, not the producer's names for them. A producer runs
   two Instagram accounts and calls them "אינסטגרם ראשי" and "הקמפיין של דנה";
   both are `instagram`, and the funnel report adds them up because that is the
   question being asked of it. The name is theirs, the kind is ours.

   `other` exists so that a channel is never blocked on this list being
   complete. Whatever arrives next year is a lead a producer can already
   receive today.                                                             */

export const CHANNEL_KINDS = [
  'instagram', 'facebook', 'google_ads', 'tiktok', 'website', 'whatsapp', 'referral', 'other',
] as const;

export type ChannelKind = (typeof CHANNEL_KINDS)[number];

export const isChannelKind = (v: string): v is ChannelKind =>
  (CHANNEL_KINDS as readonly string[]).includes(v);

/** One channel as the screens read it. The token is the secret in the URL and
 *  is only ever sent to the producer who owns the row. */
export type LeadChannel = {
  id: string;
  label: string;
  source: string;
  token: string;
  enabled: boolean;
  last_lead_at: string | null;
  lead_count: number;
};

/** The URL a producer pastes into Meta, Google or Zapier.
 *
 *  Absolute on purpose: this is copied out of the browser into somebody else's
 *  console, where a path relative to anything means nothing. */
export const channelUrl = (origin: string, token: string): string =>
  `${origin.replace(/\/+$/, '')}/api/leads/webhook?c=${encodeURIComponent(token)}`;
