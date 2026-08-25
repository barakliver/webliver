'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, CalendarDays, Ellipsis, Globe, HeartHandshake, LayoutGrid, Palette, ShieldCheck, Sparkles, Target, TrendingUp, Truck, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { appCopy } from '@/content/site';

export type NavItem = { href: string; label: string; icon: IconName };
export type IconName = 'overview' | 'leads' | 'clients' | 'calendar' | 'insights' | 'brand' | 'vendors' | 'sop' | 'site' | 'admin' | 'portal';

/* Real icons rather than emoji. The old app labelled every tab with one, and
   emoji cannot inherit colour or weight, render differently on every platform,
   and are announced by whatever name the screen reader happens to hold. */
const ICONS: Record<IconName, LucideIcon> = {
  overview: LayoutGrid,
  leads:    Target,
  clients:  HeartHandshake,
  calendar: CalendarDays,
  insights: TrendingUp,
  brand:    Palette,
  vendors:  Truck,
  sop:      BookOpen,
  site:     Globe,
  admin:    ShieldCheck,
  portal:   Sparkles,
};

/** Marks the current section. A nested route keeps its parent lit, so opening
 *  one event does not make the whole nav look like nowhere is selected. */
function isCurrent(pathname: string, href: string) {
  if (href === '/app') return pathname === '/app';
  return pathname === href || pathname.startsWith(href + '/');
}

export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    /* lg rather than sm. Seven labels, a brand name, a bell, an avatar and a
       sign-out button do not fit on a 700px window, and what happens there is
       not a graceful squeeze: the nav wins the space and the sign-out button
       leaves the screen. Below this width the bottom bar is the navigation,
       which is the better shape for that size anyway. */
    <nav aria-label="ניווט ראשי" className="hidden items-center gap-6 lg:flex">
      {items.map((i) => {
        const current = isCurrent(pathname, i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'relative py-1 text-[13.5px] tracking-[.06em] transition-colors duration-300',
              current ? 'text-ink' : 'text-ink-mute hover:text-ink',
            )}
          >
            {i.label}
            {/* The active mark is a gold rule under the word rather than a
                pill around it. It is the same mark the sidebar and the
                segmented control use, which is what makes the three read as
                one system instead of three components. */}
            <span
              aria-hidden
              className={cn(
                'absolute inset-x-0 -bottom-0.5 h-px transition-opacity duration-300',
                current ? 'bg-accent-line opacity-100' : 'opacity-0',
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}

/** The phone gets a bottom bar rather than a scrolling strip under the header:
 *  it is where a thumb already is, and it is the pattern the platform uses.
 *
 *  Four tabs and an overflow, rather than everything at once. Spreading eight
 *  destinations across a 390px screen gives each of them 48px and a truncated
 *  label, which is how a nav stops being read and starts being guessed at. The
 *  four that survive are the ones a producer opens daily; the rest are a tap
 *  further away and legible when they get there. */
const PRIMARY = 4;

export function MobileTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  /* A sheet that survives navigation is a sheet covering the page you just
     asked for. */
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (items.length < 2) return null;

  const overflow = items.length > PRIMARY ? items.slice(PRIMARY) : [];
  const tabs = overflow.length > 0 ? items.slice(0, PRIMARY) : items;
  const inOverflow = overflow.some((i) => isCurrent(pathname, i.href));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={appCopy.nav.close}
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-ink/25 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={appCopy.nav.moreTitle}
            className="glass-strong absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line p-4 shadow-dock"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink">{appCopy.nav.moreTitle}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={appCopy.nav.close}
                className="grid h-11 w-11 place-items-center rounded-full text-ink-mute transition-colors hover:text-ink"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <ul className="list-none space-y-1 p-0">
              {overflow.map((i) => {
                const Icon = ICONS[i.icon];
                const current = isCurrent(pathname, i.href);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={current ? 'page' : undefined}
                      className={cn(
                        'flex min-h-[52px] items-center gap-3 border-b border-line px-1 text-[15px]',
                        'transition-colors duration-300',
                        current ? 'text-ink' : 'text-ink-soft hover:text-ink',
                      )}
                    >
                      <Icon size={20} strokeWidth={1.5} aria-hidden />
                      {i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <nav
        aria-label="ניווט ראשי"
        className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line shadow-dock lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <ul className="mx-auto flex max-w-lg list-none items-stretch justify-around p-0">
          {tabs.map((i) => {
            const current = isCurrent(pathname, i.href);
            return (
              <li key={i.href} className="flex-1">
                <Link
                  href={i.href}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[56px] flex-col items-center justify-center gap-1.5 px-1 pt-2',
                    'text-[12px] tracking-[.04em] transition-colors duration-300',
                    current ? 'text-ink' : 'text-ink-mute',
                  )}
                >
                  {/* Labels, not icons. The handoff drops icons from the bar
                      entirely: five short Hebrew words read faster at this
                      size than five glyphs somebody has to learn, and the
                      gold rule does the work the filled pill used to. */}
                  <span className="max-w-full truncate">{i.label}</span>
                  {/* The active mark is a shape as well as a colour, so the
                      state survives greyscale and a low-contrast display. */}
                  <span
                    aria-hidden
                    className={cn(
                      'h-px w-7 transition-opacity duration-300',
                      current ? 'bg-accent-line opacity-100' : 'opacity-0',
                    )}
                  />
                </Link>
              </li>
            );
          })}

          {overflow.length > 0 && (
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-haspopup="dialog"
                className={cn(
                  'flex min-h-[56px] w-full flex-col items-center justify-center gap-1.5 px-1 pt-2',
                  'text-[12px] tracking-[.04em] transition-colors duration-300',
                  /* Lit when the open screen lives behind it, so the nav never
                     reports that you are nowhere. */
                  open || inOverflow ? 'text-ink' : 'text-ink-mute',
                )}
              >
                <Ellipsis size={21} strokeWidth={1.5} aria-hidden />
                <span className="max-w-full truncate">{appCopy.nav.more}</span>
                <span
                  aria-hidden
                  className={cn(
                    'h-[3px] w-6 rounded-full transition-opacity duration-200',
                    inOverflow ? 'bg-accent-bright opacity-100' : 'opacity-0',
                  )}
                />
              </button>
            </li>
          )}
        </ul>
      </nav>
    </>
  );
}
