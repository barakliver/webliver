import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';

/**
 * The public pages, listed once.
 *
 * Only pages a stranger can open and would want to land on. The sign in screen
 * is deliberately absent: it is a door, not a destination, and a search result
 * that drops somebody on it answers no question they asked.
 *
 * Hand written rather than walked off the filesystem. There are six of them,
 * a directory walk would also collect `/app` and the token routes, and the day
 * a seventh public page is added is a day somebody is editing this file anyway.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = publicEnv.siteUrl;
  const now = new Date();

  return [
    { url: `${url}/`,              lastModified: now, changeFrequency: 'weekly',  priority: 1 },
    { url: `${url}/store`,         lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${url}/install`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${url}/accessibility`, lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${url}/privacy`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${url}/terms`,         lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
  ];
}
