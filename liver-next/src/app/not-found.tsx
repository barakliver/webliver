import Link from 'next/link';
import { Home, MessageCircle, LogIn } from 'lucide-react';
import { notFoundFor } from '@/content/ui';
import { currentLocale } from '@/lib/serverLocale';
import { publicEnv } from '@/lib/env';

/**
 * The page that is not there.
 *
 * There was no such page: an address that matched nothing fell through to the
 * framework's own black-and-white notice, in English, on a Hebrew site, with
 * no way back to anything. On a wedding platform that is worse than it sounds,
 * because almost nobody arrives here by typing badly. They arrive from a link
 * in a message that lost its last characters, from an invitation forwarded
 * twice, or from an address that was right last season. The person is looking
 * for their own wedding and the site has just told them, in a foreign
 * language, that nothing exists.
 *
 * So this says the address led nowhere, says nothing is lost, and offers the
 * three doors somebody standing here actually wanted: the front page, a
 * person, and their own area. The note underneath is the one piece of
 * information that resolves most of these on the spot — links to an event are
 * personal and they expire, so the fix is to ask the sender for a fresh one
 * rather than to keep pressing.
 *
 * It renders inside the root layout, so it is in the reader's language, in the
 * right direction, and in the site's own type.
 */
export const metadata = { robots: { index: false, follow: false } };

export default async function NotFound() {
  const locale = await currentLocale();
  const c = notFoundFor(locale);

  return (
    <main id="main" className="shell flex min-h-[70vh] flex-col justify-center py-16">
      <div className="measure">
        <p className="font-mono text-[13px] tracking-[.2em] text-ink-mute" dir="ltr">{c.code}</p>

        <h1 className="mt-4 font-display text-display font-semibold leading-tight text-ink">
          {c.title}
        </h1>

        <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">{c.body}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn-primary inline-flex items-center gap-2">
            <Home size={17} strokeWidth={1.5} aria-hidden />
            <span>{c.home}</span>
          </Link>

          <a
            href={`https://wa.me/${publicEnv.whatsapp}`}
            className="btn-ghost inline-flex items-center gap-2"
            target="_blank" rel="noopener noreferrer"
          >
            <MessageCircle size={17} strokeWidth={1.5} aria-hidden />
            <span>{c.contact}</span>
          </a>

          <Link href="/login" className="btn-ghost inline-flex items-center gap-2">
            <LogIn size={17} strokeWidth={1.5} aria-hidden />
            <span>{c.signIn}</span>
          </Link>
        </div>

        {/* The sentence that solves most of these without anybody being
            written to: an expired link looks exactly like a broken one. */}
        <p className="mt-10 border-t border-line pt-5 text-[13.5px] leading-relaxed text-ink-mute">
          {c.help}
        </p>
      </div>
    </main>
  );
}
