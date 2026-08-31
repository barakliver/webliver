import Link from 'next/link';
import { a11yFor, privacyFor, termsFor } from '@/content/ui';
import type { Locale } from '@/lib/locale';

/**
 * The three documents, on every public page.
 *
 * It was written inline on the home page, which meant the shop carried none of
 * them: no accessibility statement, no privacy policy, no terms. The
 * accessibility rule is explicit that the statement has to be reachable from
 * anywhere, and a menu button alone does not meet it.
 *
 * The brand line is passed in rather than imported, because the copy on this
 * site can be overridden from the database and a footer that read the constant
 * would be the one line on the page still showing last month's wording.
 */
export function SiteFooter({ brand, note, locale }: {
  brand: string; note: string; locale: Locale;
}) {
  const a11y = a11yFor(locale);
  const privacy = privacyFor(locale);
  const terms = termsFor(locale);

  return (
    <footer className="border-t border-line py-10">
      <div className="shell flex flex-wrap items-center gap-x-3 gap-y-2 text-[13.5px] text-ink-mute">
        <span>{brand} · {note}</span>
        <span aria-hidden>·</span>
        <Link href="/accessibility" className="underline underline-offset-4 transition-colors hover:text-accent">
          {a11y.statement}
        </Link>
        <span aria-hidden>·</span>
        <Link href="/privacy" className="underline underline-offset-4 transition-colors hover:text-accent">
          {privacy.title}
        </Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="underline underline-offset-4 transition-colors hover:text-accent">
          {terms.title}
        </Link>
      </div>
    </footer>
  );
}
