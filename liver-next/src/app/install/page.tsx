import Link from 'next/link';
import type { Metadata } from 'next';
import { Smartphone, Monitor, CircleHelp } from 'lucide-react';
import { getSiteCopy } from '@/lib/siteCopy';
import { supabasePublic } from '@/lib/supabase/public';
import { brandForHost } from '@/lib/branding';
import { installFor } from '@/content/ui';
import { currentLocale } from '@/lib/serverLocale';
import { YourDevice } from '@/components/YourDevice';

export async function generateMetadata(): Promise<Metadata> {
  const c = installFor(await currentLocale());
  return { title: c.title, alternates: { canonical: '/install' } };
}

/**
 * How to put this on a phone.
 *
 * Public on purpose. It is linked from an invitation email, and the person
 * reading it has not signed in yet and may never sign in on the device they
 * are holding. Putting it behind the door would be asking somebody to log in
 * so they can be told how to log in more easily.
 *
 * Three lists rather than one clever set of instructions that detects the
 * device. Detection is wrong often enough to matter here: an iPhone opening
 * this from inside Instagram reports a browser that cannot install anything,
 * and the honest fix for that is a sentence, which is the last thing on the
 * page.
 */
function Steps({ icon: Icon, title, steps, device }: {
  icon: typeof Smartphone; title: string; steps: readonly string[];
  /** Which device this guide is for, so the page can say which one is yours. */
  device: 'ios' | 'android' | 'desktop';
}) {
  return (
    <section className="card" data-device={device}>
      <h2 className="head-panel inline-flex items-center gap-2">
        <Icon size={18} aria-hidden strokeWidth={1.5} />
        {title}
      </h2>
      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={step} className="reveal flex gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-wash text-meta font-medium tabular-nums text-accent">
              {i + 1}
            </span>
            <span className="text-lead leading-relaxed text-ink">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default async function InstallPage() {
  const locale = await currentLocale();
  const c = installFor(locale);
  const site = await getSiteCopy(supabasePublic(), locale);
  /* Read from an invitation email, possibly on a tenant's domain: the name at
     the head of the page is whoever invited them. */
  const host = await brandForHost();

  return (
    <main id="main" className="shell py-10 sm:py-16">
      <div className="mx-auto max-w-prose2">
        <Link href="/" className="text-body text-ink-mute transition hover:text-ink">
          {host.isPlatform ? site.brand : host.name}
        </Link>

        <h1 className="mt-5 font-display text-title font-light text-ink">{c.title}</h1>
        <p className="mt-2 text-lead leading-relaxed text-ink-soft">{c.sub}</p>

        <ul className="mt-5 space-y-1.5 text-body text-ink-soft">
          {c.whyLines.map((l) => (
            <li key={l} className="flex gap-2">
              <span aria-hidden className="text-accent">·</span>
              {l}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-4">
          <YourDevice label={c.yourDevice} />
          <Steps icon={Smartphone} title={c.iphone} steps={c.iphoneSteps} device="ios" />
          <Steps icon={Smartphone} title={c.android} steps={c.androidSteps} device="android" />
          <Steps icon={Monitor} title={c.desktop} steps={c.desktopSteps} device="desktop" />
        </div>

        <section className="card mt-6">
          <h2 className="head-sub inline-flex items-center gap-2">
            <CircleHelp size={17} aria-hidden strokeWidth={1.5} />
            {c.troubleTitle}
          </h2>
          <ul className="mt-3 space-y-2 text-body leading-relaxed text-ink-soft">
            {c.troubleLines.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </section>

        <Link href="/app" className="btn-primary mt-8">{c.backToApp}</Link>
      </div>
    </main>
  );
}
