import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from './locale.ts';
import type { PieceData } from '@/components/brand/Pieces';
import { readBrand, type WeddingBrand } from '@/content/brandKit';
import { appUiFor } from '@/content/appUi';
import { publicEnv, optional } from './env.ts';
import { pieceDataFor } from './brandData.ts';
import { safeRows, safeValue } from './safe.ts';
import { signBoardImages } from './board.ts';

export type BrandScreen = {
  brand: WeddingBrand | null;
  data: PieceData;
  images: string[];
  siteUrl: string;
  canAi: boolean;
};

/** Everything the studio and the print sheet draw from, for one event.
 *  Every read may fail on its own; the studio still renders with what came. */
export async function loadBrandScreen(
  sb: SupabaseClient,
  client: { id: string; display_name: string; event_date: string | null; venue: string | null; guest_token: string | null; guest_site_on: boolean | null; brand: unknown },
  locale: Locale,
): Promise<BrandScreen> {
  const [moments, tables, boardRows] = await Promise.all([
    safeRows<{ at_time: string; title: string; key_moment: boolean | null }>('brand schedule', sb.from('day_schedule')
      .select('at_time,title,key_moment').eq('client_id', client.id).order('at_time')),
    safeRows<{ name: string }>('brand tables', sb.from('tables_seating')
      .select('name').eq('client_id', client.id).order('created_at')),
    safeRows<{ id: string; client_id: string; category: string; caption: string; image_path: string }>('brand board', sb.from('moodboards')
      .select('id,client_id,category,caption,image_path').eq('client_id', client.id).order('created_at', { ascending: false }).limit(15)),
  ]);
  const board = await safeValue('brand board links', signBoardImages(sb, boardRows), []);
  const siteUrl = client.guest_token && client.guest_site_on ? `${publicEnv.siteUrl}/w/${client.guest_token}` : '';
  return {
    brand: readBrand(client.brand),
    data: pieceDataFor({
      displayName: client.display_name,
      eventDate: client.event_date,
      venue: client.venue,
      moments,
      tables,
      siteUrl,
      locale,
      dateTbd: appUiFor(locale).studio.on.dateTbd,
    }),
    images: board.map((b) => b.url),
    siteUrl,
    canAi: !!optional('ANTHROPIC_API_KEY'),
  };
}
