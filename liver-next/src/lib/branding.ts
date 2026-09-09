import 'server-only';
import { headers } from 'next/headers';
import { supabaseServer } from '@/lib/supabase/server';
import { supabasePublic } from '@/lib/supabase/public';
import { accentByKey, accentVars, type Accent } from '@/content/brand';
import { site } from '@/content/site';
import type { Account } from '@/lib/auth';

/**
 * Whose business is this screen inside?
 *
 * Three answers, in order of how sure we are:
 *
 *   a signed-in producer   their own, whatever host they came in on
 *   a signed-in couple     the producer running their event
 *   nobody signed in       whoever owns the host, if the host is a tenant
 *
 * The order matters. A producer who opens the app from the platform's own
 * address is still inside their own business, and a couple who opens it from
 * anywhere is inside their producer's. Host is the last resort rather than the
 * first, because it is the only one of the three that a person can get wrong
 * by clicking an old bookmark.
 */

export type Brand = {
  name: string;
  tagline: string;
  logoUrl: string | null;
  whatsapp: string;
  bookingUrl: string;
  accent: Accent;
  /** True when this is the platform's own identity rather than a producer's.
   *  The one thing a white-labelled screen must never do is show both. */
  isPlatform: boolean;
};

const PLATFORM: Brand = {
  name: site.brand,
  tagline: '',
  logoUrl: null,
  whatsapp: '',
  bookingUrl: '',
  accent: accentByKey('slate'),
  isPlatform: true,
};

type Row = {
  brand?: string | null;
  tagline?: string | null;
  accent?: string | null;
  logo_url?: string | null;
  whatsapp?: string | null;
  booking_url?: string | null;
};

const shape = (r: Row): Brand => ({
  name: r.brand || site.brand,
  tagline: r.tagline || '',
  logoUrl: r.logo_url || null,
  whatsapp: r.whatsapp || '',
  bookingUrl: r.booking_url || '',
  accent: accentByKey(r.accent),
  isPlatform: false,
});

/** The header the middleware set, and only that: a value arriving from outside
 *  was stripped there, so anything present here was decided by the host. */
async function hostTenant(): Promise<string | null> {
  const h = await headers();
  return h.get('x-liver-tenant');
}

export async function brandFor(account: Account | null): Promise<Brand> {
  if (account?.producer) {
    return {
      name: account.producer.brandName || site.brand,
      tagline: account.producer.tagline,
      logoUrl: account.producer.logoUrl,
      whatsapp: account.producer.whatsapp,
      bookingUrl: '',
      accent: accentByKey(account.producer.accent),
      isPlatform: !account.producer.brandName,
    };
  }

  if (account) {
    /* A couple. The function is the only way they can learn this, since the
       producers table is not theirs to read. */
    const sb = await supabaseServer();
    const { data } = await sb.rpc('my_workspace_brand');
    const row = Array.isArray(data) ? data[0] : data;
    if (row) return shape(row as Row);
    return PLATFORM;
  }

  return brandForHost();
}

/**
 * Branding for a visitor who has not signed in.
 *
 * Uses the session-free client on purpose. Reading cookies here would opt the
 * public pages out of static rendering, and the answer does not depend on who
 * is asking — only on which host they asked.
 */
export async function brandForHost(): Promise<Brand> {
  const tenant = await hostTenant();
  if (!tenant) return PLATFORM;

  try {
    const sb = supabasePublic();
    const { data, error } = await sb.rpc('producer_by_host', { p_host: tenant });
    if (error) {
      console.error('[brand] host lookup failed', error);
      return PLATFORM;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return row ? shape(row as Row) : PLATFORM;
  } catch (e) {
    /* An unreachable database must not take the page down with it. An
       unbranded page is a smaller failure than no page. */
    console.error('[brand] host lookup threw', e);
    return PLATFORM;
  }
}

/** The custom properties that repaint the accent, as a style attribute. */
export const brandStyle = (b: Brand) => accentVars(b.accent) as React.CSSProperties;
