import 'server-only';

import { headers } from 'next/headers';
import { TENANT_HEADER, TENANT_HOST_HEADER, type TenantIdentity } from '@/middleware';

export type { TenantIdentity };

/** The platform's own identity, used when no producer tenant owns the request. */
export const PLATFORM_IDENTITY: TenantIdentity = {
  id: 'platform',
  slug: 'liver',
  brand_name: 'LIver Productions',
  logo_url: null,
  color_ink: '#14130f',
  color_accent: '#a8874f',
  color_paper: '#f8f5ef',
  contact_email: null,
  contact_phone: null,
  contact_whatsapp: null,
  website_url: null,
  tier: 'agency',
};

/**
 * The producer whose domain served this request, or null on the platform host.
 * Set by the edge middleware; never trusted from the client.
 */
export async function getTenant(): Promise<TenantIdentity | null> {
  const raw = (await headers()).get(TENANT_HEADER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TenantIdentity;
  } catch {
    return null;
  }
}

/** Tenant identity with the platform as fallback — what the UI should render. */
export async function getBrand(): Promise<TenantIdentity> {
  return (await getTenant()) ?? PLATFORM_IDENTITY;
}

export async function getTenantHost(): Promise<string> {
  return (await headers()).get(TENANT_HOST_HEADER) ?? '';
}

/**
 * CSS custom properties for the active brand. Applied on a wrapper so every
 * component inherits the producer's palette without knowing about tenancy.
 */
export function brandStyle(brand: TenantIdentity): React.CSSProperties {
  return {
    '--ink': brand.color_ink,
    '--gold': brand.color_accent,
    '--paper': brand.color_paper,
  } as React.CSSProperties;
}

/** True when the request is served on the platform's own host. */
export async function isPlatformHost(): Promise<boolean> {
  return (await getTenant()) === null;
}
