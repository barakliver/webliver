import Link from 'next/link';
import { getSiteCopy } from '@/lib/siteCopy';
import { supabasePublic } from '@/lib/supabase/public';
import { privacyFor } from '@/content/ui';
import { publicEnv } from '@/lib/env';
import { currentLocale, dateFormat } from '@/lib/serverLocale';

/* Generated rather than exported flat, because the title of this page is one
   of the strings that changes with the language. */
export async function generateMetadata() {
  const c = privacyFor(await currentLocale());
  return { title: c.title, description: c.sub, alternates: { canonical: '/privacy' } };
}

/**
 * What is held, and about whom.
 *
 * Written from the schema rather than from a template. A policy that lists
 * categories nobody collects, and omits the guest list of somebody's wedding,
 * is worse than none: it reads as compliance theatre and it is wrong about the
 * one thing that actually matters here.
 *
 * It exists on its own address because three separate things need to link to
 * it — the footer, the sign-in screen, and Google's consent screen, which
 * refuses to publish an application without one.
 */
export default async function Page() {
  const locale = await currentLocale();
  const c = privacyFor(locale);
  const site = await getSiteCopy(supabasePublic(), locale);
  const updated = dateFormat(locale).format(new Date('2026-08-27'));

  return (
    <main id="main" className="shell max-w-prose2 py-16 sm:py-24">
      <p className="eyebrow">{site.brand}</p>
      <h1 className="mt-4 font-display text-display font-light text-ink">{c.title}</h1>
      <p className="measure mt-4 text-[16.5px] leading-relaxed text-ink-soft">{c.sub}</p>

      <hr className="rule-gold my-10" />

      {/* The short version first, because almost nobody reads past it and the
          four lines below are the four things somebody actually wants to know. */}
      <Section title={c.shortTitle}>
        <ul className="list-none space-y-0 p-0">
          {c.short.map((line) => (
            <li key={line} className="border-b border-line py-3 last:border-0">{line}</li>
          ))}
        </ul>
      </Section>

      <Section title={c.whoTitle}><p>{c.who}</p></Section>

      <Section title={c.whatTitle}>
        <dl className="space-y-0">
          {c.what.map(([term, body]) => (
            <div key={term} className="border-b border-line py-3 last:border-0">
              <dt className="text-ink">{term}</dt>
              <dd className="mt-1 text-ink-soft">{body}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={c.whoSeesTitle}>
        <ul className="list-none space-y-0 p-0">
          {c.whoSees.map((line) => (
            <li key={line} className="border-b border-line py-3 last:border-0">{line}</li>
          ))}
        </ul>
      </Section>

      <Section title={c.cookiesTitle}><p>{c.cookies}</p></Section>

      <Section title={c.thirdTitle}>
        <dl className="space-y-0">
          {c.third.map(([name, body]) => (
            <div key={name} className="border-b border-line py-3 last:border-0">
              <dt className="text-ink" dir="ltr" style={{ unicodeBidi: 'isolate' }}>{name}</dt>
              <dd className="mt-1 text-ink-soft">{body}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4">{c.thirdNote}</p>
      </Section>

      <Section title={c.securityTitle}>
        <ul className="list-none space-y-0 p-0">
          {c.security.map((line) => (
            <li key={line} className="border-b border-line py-3 last:border-0">{line}</li>
          ))}
        </ul>
      </Section>

      <Section title={c.keepTitle}><p>{c.keep}</p></Section>

      <Section title={c.rightsTitle}>
        <ul className="list-none space-y-0 p-0">
          {c.rights.map((line) => (
            <li key={line} className="border-b border-line py-3 last:border-0">{line}</li>
          ))}
        </ul>
        <p className="mt-4">{c.rightsHow}</p>
      </Section>

      <Section title={c.kidsTitle}><p>{c.kids}</p></Section>
      <Section title={c.changesTitle}><p>{c.changes}</p></Section>

      <Section title={c.contactTitle}>
        <p>{c.contact}</p>
        <p className="mt-3">
          <a
            href={`mailto:${publicEnv.contactEmail}`}
            dir="ltr"
            className="text-accent underline underline-offset-4"
          >
            {publicEnv.contactEmail}
          </a>
        </p>
      </Section>

      <hr className="rule-gold my-10" />

      <p className="text-[13.5px] text-ink-mute">
        {c.updated}{' '}
        <span dir="ltr" style={{ unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}>{updated}</span>
      </p>

      <p className="mt-8">
        <Link href="/" className="btn-ghost">{c.back}</Link>
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="font-display text-title font-light text-ink">{title}</h2>
      <div className="measure mt-4 text-[15.5px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}
