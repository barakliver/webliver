import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { brandForHost } from '@/lib/branding';

export const dynamic = 'force-dynamic';

/**
 * The installed app carries the producer's name, not the platform's.
 *
 * A white-labelled workspace whose icon on the home screen says somebody
 * else's business is not white-labelled. The browser fetches this at install
 * time with the Host header set, which is the one moment the tenant is known
 * without a session, so the same host lookup the pages use decides what the
 * app is called.
 *
 * Everything else comes from the file on disk. Duplicating the icon list, the
 * shortcuts and the screenshots here would mean two manifests drifting apart,
 * and the one that broke would be the one nobody looks at.
 */
export async function GET() {
  const file = path.join(process.cwd(), 'public', 'manifest.json');

  let base: Record<string, unknown>;
  try {
    base = JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    /* Without the file there is nothing to brand. A 404 is the honest answer:
       the browser then falls back to the page title, which is worse than a
       manifest and much better than an install that half works. */
    console.error('[manifest] base unreadable', e);
    return new NextResponse('not found', { status: 404 });
  }

  try {
    const brand = await brandForHost();
    if (!brand.isPlatform && brand.name) {
      base.name = brand.tagline ? `${brand.name} · ${brand.tagline}` : brand.name;
      /* Twelve characters is roughly what a home screen shows before it
         truncates, and a truncated name is how two producers' apps end up
         looking identical. */
      base.short_name = brand.name.slice(0, 12);
      base.description = brand.tagline || base.description;
      base.theme_color = brand.accent.wash;
      base.background_color = brand.accent.wash;
    }
  } catch (e) {
    /* Branding is an improvement to the manifest, never a precondition for
       having one. */
    console.error('[manifest] branding failed', e);
  }

  return NextResponse.json(base, {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
