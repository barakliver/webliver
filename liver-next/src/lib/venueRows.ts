import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { safeRows, safeValue } from '@/lib/safe';
import { signPrepImages } from '@/lib/prep';
import { readFlags, type Venue } from '@/lib/venues';

/**
 * The halls, ready to compare.
 *
 * Split from `lib/venues.ts` on purpose: that module is the arithmetic, it is
 * imported by the browser, and a `server-only` line in it would have taken the
 * screen down. This is the half that talks to the database, and the two are
 * kept apart for the same reason the load-trouble line was split from the
 * store it reads.
 *
 * One loader for both sides. The producer opens this as a tab on the event
 * file and the couple meets it as a panel in their own area, looking at the
 * same rows — a second copy of this is where the two screens would drift.
 */

type Row = {
  id: string; client_id: string;
  venue_name: string; location: string; contact: string; phone: string;
  toured_on: string | null; notes: string;
  plate_price: string | number; is_vat_included: boolean;
  bar_cost: string | number; bar_type: 'flat' | 'per_person';
  sound_lighting_cost: string | number; ancillary_fees: string | number;
  service_percent: string | number; service_flat: string | number;
  contingency_percent: string | number;
  pros_cons: unknown; quote_path: string; is_selected: boolean;
};

/* Postgres numerics arrive as strings through PostgREST, which is correct of
   it — a numeric(12,2) does not fit a double without a promise nobody can
   keep. Every one of them is turned into a number here, once, rather than in
   the six places the screen does arithmetic on it. */
const num = (v: string | number | null | undefined): number => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
};

export type VenueData = { venues: Venue[]; quoteUrls: Record<string, string> };

export async function loadVenues(
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  sb: SupabaseClient<any, any, any>,
  clientIds: string[],
): Promise<Map<string, VenueData>> {
  const byClient = new Map<string, VenueData>();
  if (clientIds.length === 0) return byClient;
  clientIds.forEach((id) => byClient.set(id, { venues: [], quoteUrls: {} }));

  const rows = await safeRows<Row>('venues', sb.from('venue_comparisons')
    .select('id,client_id,venue_name,location,contact,phone,toured_on,notes,plate_price,'
      + 'is_vat_included,bar_cost,bar_type,sound_lighting_cost,ancillary_fees,'
      + 'service_percent,service_flat,contingency_percent,pros_cons,quote_path,is_selected')
    .in('client_id', clientIds).order('sort').order('created_at'));

  /* The quotes are in the private bucket and stay there, so what the screen
     gets is signed links. One call for every hall on the page. */
  const paths = rows.map((r) => r.quote_path).filter(Boolean);
  const signed = await safeValue('venue quotes', signPrepImages(sb, paths), new Map<string, string>());

  for (const r of rows) {
    const bucket = byClient.get(r.client_id);
    if (!bucket) continue;
    bucket.venues.push({
      id: r.id,
      venueName: r.venue_name,
      location: r.location,
      contact: r.contact,
      phone: r.phone,
      touredOn: r.toured_on,
      notes: r.notes,
      platePrice: num(r.plate_price),
      isVatIncluded: r.is_vat_included,
      barCost: num(r.bar_cost),
      barType: r.bar_type === 'per_person' ? 'per_person' : 'flat',
      soundLightingCost: num(r.sound_lighting_cost),
      ancillaryFees: num(r.ancillary_fees),
      servicePercent: num(r.service_percent),
      serviceFlat: num(r.service_flat),
      contingencyPercent: num(r.contingency_percent),
      prosCons: readFlags(r.pros_cons),
      quotePath: r.quote_path,
      isSelected: r.is_selected,
    });
    if (r.quote_path && signed.get(r.quote_path)) {
      bucket.quoteUrls[r.quote_path] = signed.get(r.quote_path) as string;
    }
  }

  return byClient;
}

const EMPTY: VenueData = { venues: [], quoteUrls: {} };

/** One event's halls, with the empty shape for an event that has toured
 *  none — so a caller never has to decide what a missing key means. */
export const venuesOf = (all: Map<string, VenueData>, id: string): VenueData => all.get(id) ?? EMPTY;
