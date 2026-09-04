import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { notFoundFor } from '@/content/ui';
import { currentLocale } from '@/lib/serverLocale';

/**
 * A workspace address that leads to no event.
 *
 * Five screens call `notFound()` when the id in the URL matches nothing the
 * signed-in person is allowed to see — a stale bookmark, an archived event, a
 * link pasted from an older message. Without this file all five landed on the
 * public notice, which offers the home page and our WhatsApp number: a
 * customer service desk, shown to somebody already standing inside the
 * building.
 *
 * It renders inside the workspace layout, so the menu and the brand are still
 * there and the one button is the list they came from.
 */
export default async function WorkspaceNotFound() {
  const c = notFoundFor(await currentLocale()).workspace;

  return (
    <div className="card measure text-center">
      <h1 className="font-display text-title font-semibold text-ink">{c.title}</h1>
      <p className="mt-3 text-[15.5px] text-ink-soft">{c.body}</p>
      <Link href="/app/clients" className="btn-primary mt-7 inline-flex items-center gap-2">
        <ArrowRight size={17} strokeWidth={1.5} aria-hidden />
        <span>{c.back}</span>
      </Link>
    </div>
  );
}
