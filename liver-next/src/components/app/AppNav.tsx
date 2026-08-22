'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, CalendarDays, Globe, HeartHandshake, LayoutGrid, ShieldCheck, Sparkles, Target, Truck, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NavItem = { href: string; label: string; icon: IconName };
export type IconName = 'overview' | 'leads' | 'clients' | 'calendar' | 'vendors' | 'sop' | 'site' | 'admin' | 'portal';

/* Real icons rather than emoji. The old app labelled every tab with one, and
   emoji cannot inherit colour or weight, render differently on every platform,
   and are announced by whatever name the screen reader happens to hold. */
const ICONS: Record<IconName, LucideIcon> = {
  overview: LayoutGrid,
  leads:    Target,
  clients:  HeartHandshake,
  calendar: CalendarDays,
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
    /* lg rather than sm. Six pills, a brand name, a bell, an avatar and a
       sign-out button do not fit on a 700px window, and what happens there is
       not a graceful squeeze: the nav wins the space and the sign-out button
       leaves the screen. Below this width the bottom bar is the navigation,
       which is the better shape for that size anyway. */
    <nav aria-label="ניווט ראשי" className="hidden items-center gap-1 lg:flex">
      {items.map((i) => {
        const Icon = ICONS[i.icon];
        const current = isCurrent(pathname, i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-[40px] items-center gap-2 rounded-full px-3.5 text-[14.5px]',
              'transition duration-200 ease-out',
              current ? 'bg-ink text-surface' : 'text-ink-soft hover:bg-surface-200 hover:text-ink',
            )}
          >
            <Icon size={16} strokeWidth={1.9} aria-hidden />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The phone gets a bottom bar rather than a scrolling strip under the header:
 *  it is where a thumb already is, and it is the pattern the platform uses. */
export function MobileTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  if (items.length < 2) return null;
  return (
    <nav
      aria-label="ניווט ראשי"
      className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line shadow-dock lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="mx-auto flex max-w-lg list-none items-stretch justify-around p-0">
        {items.map((i) => {
          const Icon = ICONS[i.icon];
          const current = isCurrent(pathname, i.href);
          return (
            <li key={i.href} className="flex-1">
              <Link
                href={i.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 pt-2',
                  'text-[11px] font-medium transition-colors duration-200',
                  current ? 'text-ink' : 'text-ink-mute',
                )}
              >
                <Icon size={21} strokeWidth={current ? 2.1 : 1.7} aria-hidden />
                <span className="max-w-full truncate">{i.label}</span>
                {/* The active mark is a shape as well as a colour, so the state
                    survives greyscale and low-contrast displays. */}
                <span
                  aria-hidden
                  className={cn(
                    'h-[3px] w-6 rounded-full transition-opacity duration-200',
                    current ? 'bg-accent-bright opacity-100' : 'opacity-0',
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
