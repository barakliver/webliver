import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { brandFor } from '@/lib/branding';
import { currentAccount } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * The installed app carries the producer's name and icon, not the platform's.
 *
 * A white-labelled workspace whose icon on the home screen says somebody
 * else's business is not white-labelled. The link in the document head asks
 * for this with credentials, so the request arrives with the session cookie
 * and the same lookup the shell uses decides whose app this is: a signed-in
 * producer's own, a couple's producer's, or the host's tenant when nobody is
 * signed in.
 *
 * Everything else comes from the file on disk. Duplicating the shortcuts and
 * the screenshots here would mean two manifests drifting apart, and the one
 * that broke would be the one nobody looks at.
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
    const brand = await brandFor(await currentAccount());
    if (!brand.isPlatform && brand.name) {
      base.name = brand.tagline ? `${brand.name} · ${brand.tagline}` : brand.name;
      /* Twelve characters is roughly what a home screen shows before it
         truncates, and a truncated name is how two producers' apps end up
         looking identical. */
      base.short_name = brand.name.slice(0, 12);
      base.description = brand.tagline || base.description;
      base.theme_color = brand.accent.wash;
      base.background_color = brand.accent.wash;

      /* The producer's own icon, when they uploaded one. Offered as both the
         plain and the maskable icon: the rule on the branding screen asks for
         a square with no empty margin, which is what a maskable icon needs. A
         producer without one keeps the platform's icons rather than none,
         because an install with no icon is the browser's grey letter. */
      if (brand.iconUrl) {
        base.icons = [
          { src: brand.iconUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: brand.iconUrl, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ];
        /* The screenshots are the platform's own screens. On a tenant's app
           they would show another business's name in the install sheet. */
        delete base.screenshots;
      }
    }
  } catch (e) {
    /* Branding is an improvement to the manifest, never a precondition for
       having one. */
    console.error('[manifest] branding failed', e);
  }

  return NextResponse.json(base, {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      /* Private, because it now depends on who is asking. */
      'cache-control': 'private, max-age=300',
    },
  });
}
