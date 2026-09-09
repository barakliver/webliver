import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { safeRows } from '@/lib/safe';
import type { Vehicle } from '@/components/app/VehiclesPanel';

/** The cars for one or more workspaces, in the couple's order. One query for
 *  every id, the way the rest of the portal reads. */
export async function loadVehicles(
  sb: SupabaseClient<any, any, any>,
  clientIds: string[],
): Promise<Map<string, Vehicle[]>> {
  const byClient = new Map<string, Vehicle[]>();
  if (clientIds.length === 0) return byClient;
  clientIds.forEach((id) => byClient.set(id, []));

  const rows = await safeRows<Vehicle & { client_id: string }>('vehicles', sb.from('event_vehicles')
    .select('id,client_id,name,driver,phone,seats,riders,leg,note')
    .in('client_id', clientIds).order('sort').order('created_at'));

  for (const r of rows) {
    byClient.get(r.client_id)?.push({
      id: r.id, name: r.name, driver: r.driver, phone: r.phone,
      seats: r.seats, riders: r.riders, leg: r.leg, note: r.note,
    });
  }
  return byClient;
}

export const vehiclesOf = (all: Map<string, Vehicle[]>, id: string): Vehicle[] => all.get(id) ?? [];
