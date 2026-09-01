import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';

/**
 * What a crawler may read, and where the map is.
 *
 * The disallow list is not an SEO preference, it is a privacy one. A guest's
 * reply link and a supplier's signing link are addresses that carry their own
 * credential in the path, and the pages themselves already say `noindex`; this
 * stops a well behaved crawler ever fetching one. `/app` is behind sign in and
 * has nothing to rank, and `/auth` is a callback that would be followed into a
 * dead session.
 *
 * `/design` is the development-only component harness. It returns a 404 on a
 * production build, so this line is tidiness rather than protection.
 *
 * Nothing here is a security boundary. A crawler that ignores this file still
 * meets row level security on the other side, which is where the actual
 * enforcement is.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/app', '/api/', '/auth/', '/rsvp/', '/sign/', '/offline', '/design'],
    }],
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
    host: publicEnv.siteUrl,
  };
}
