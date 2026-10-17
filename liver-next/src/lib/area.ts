/**
 * Which part of the product a path belongs to.
 *
 * The colour of the short bar over a page title is decided by this and by
 * nothing else, so two screens that are one thing to the person using them
 * (the calendar and the inbox, the crew and their evenings) carry one colour.
 * The names are the ones `globals.css` writes `--area-rgb` for; a path that
 * is nobody's gets the default, which is the rubine, so a new screen is
 * coloured on the day it is made rather than blank until somebody remembers.
 *
 * Pure, so it can be tested and so a server component can ask it too.
 */
export type Area = 'events' | 'leads' | 'inbox' | 'calendar' | 'vendors' | 'crew' | 'brand' | 'insights' | 'admin' | 'money';

const BY_SEGMENT: Record<string, Area> = {
  clients: 'events',
  leads: 'leads',
  inbox: 'inbox',
  calendar: 'calendar',
  vendors: 'vendors',
  crew: 'crew',
  shifts: 'crew',
  brand: 'brand',
  store: 'brand',
  site: 'brand',
  insights: 'insights',
  admin: 'admin',
  money: 'money',
};

export function areaOf(pathname: string): Area | 'events' {
  const segment = pathname.split('?')[0].split('/').filter(Boolean)[1] ?? '';
  return BY_SEGMENT[segment] ?? 'events';
}
