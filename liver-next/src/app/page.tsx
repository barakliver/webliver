import Link from 'next/link';
import { site } from '@/content/site';
import { Nav } from '@/components/marketing/Nav';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { Prose } from '@/components/marketing/Prose';
import { Journey } from '@/components/marketing/Journey';
import { BudgetSimulator } from '@/components/marketing/BudgetSimulator';
import { LeadForm } from '@/components/marketing/LeadForm';
import { Portfolio } from '@/components/marketing/Portfolio';
import { FabDock } from '@/components/marketing/FabDock';

export default function HomePage() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />

        <Section id="philosophy" title={site.philosophy.title}>
          <Prose lines={site.philosophy.body} />
        </Section>

        <Section title={site.value.title} className="pt-0">
          <Prose lines={site.value.body} />
        </Section>

        <Journey />

        <Section id="about" title={site.about.title}>
          <Prose lines={site.about.body} />
        </Section>

        <Section title={site.dayOf.title} className="pt-0">
          <Prose lines={site.dayOf.body} />
        </Section>

        <Section
          id="work"
          title="עבודות אחרונות"
          sub="שמונה רגעים מאירועים שהופקו בשנה האחרונה."
        >
          <Portfolio />
        </Section>

        <Section id="budget" title={site.budget.title} sub={site.budget.sub}>
          <BudgetSimulator />
        </Section>

        <Section title={site.academy.title}>
          <div className="card measure">
            <Prose lines={site.academy.body} className="max-w-none" />
            <Link href="#contact" className="btn-ghost mt-6">{site.academy.cta}</Link>
          </div>
        </Section>

        <Section id="contact" title={site.closing.title} sub={site.lead.sub}>
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <Prose lines={site.closing.body} />
            </div>
            <LeadForm />
          </div>
        </Section>

        <footer className="border-t border-line py-10">
          <div className="shell text-[13.5px] text-ink-mute">
            {site.brand} · {site.footer}
          </div>
        </footer>
      </main>
      <div className="h-24 sm:h-0" aria-hidden />
      <FabDock />
    </>
  );
}
