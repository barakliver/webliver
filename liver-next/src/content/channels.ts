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

/**
 * A channel that was delivering and has gone quiet.
 *
 * This exists for one day in particular. Every producer's channel address is
 * pasted by hand into Meta or Google, once, and it is the only string in this
 * product that lives outside it. When the business changes domain those
 * pasted addresses point at the old one, and unlike every other link here
 * they are POSTs from delivery infrastructure that is not obliged to follow a
 * redirect — so a rename can stop the leads without stopping anything a
 * person can see.
 *
 * And that failure is invisible by construction: a channel that has stopped
 * delivering looks exactly like a week in which nobody enquired. The money
 * spent on those ads is spent either way.
 *
 * So the product says it. Not as an accusation — it cannot know whether the
 * campaign is simply paused, and most quiet weeks are quiet weeks — but as
 * the question a producer would want asked on their behalf.
 *
 * Only for a channel that has delivered before. A channel that has never
 * received anything is a channel somebody has not finished wiring up, which
 * the row already says in its own words, and saying it twice reads as an
 * error rather than as a beginning.
 */
export const QUIET_AFTER_DAYS = 21;

export function quietDays(
  channel: Pick<LeadChannel, 'enabled' | 'last_lead_at'>,
  now = new Date(),
): number | null {
  if (!channel.enabled || !channel.last_lead_at) return null;
  const last = new Date(channel.last_lead_at);
  if (Number.isNaN(last.getTime())) return null;
  const days = Math.floor((now.getTime() - last.getTime()) / 86_400_000);
  return days >= QUIET_AFTER_DAYS ? days : null;
}
