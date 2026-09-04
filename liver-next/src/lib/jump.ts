/**
 * What the quick search should offer, decided away from the screen.
 *
 * The palette itself is keyboard handling, focus and a list. This is the part
 * that has opinions: which events matter with an empty box, and how a typed
 * line is split between the name of an event and the name of a section inside
 * it. Both were wrong in ways that only show up on real data — thirty events,
 * most of them finished — so they are pulled out here where they can be
 * checked against that data rather than against a screenshot.
 *
 * The sections are handed in rather than imported. They live next to the tab
 * strip that draws them, which is a component; reaching for them from here
 * would make this module unloadable outside the bundler, and the whole point
 * of it being separate is that it can be run on its own.
 */

export type JumpEvent = { id: string; name: string; date: string | null };

/**
 * Everything else the search can reach.
 *
 * Leads and suppliers have no screen of their own, so a hit on one is an
 * anchor on the list that holds it. That is why `href` is carried rather than
 * built here: the shape of the address is a fact about those screens, and a
 * second copy of it here would be a second place to be wrong the day either
 * gets a page of its own.
 */
export type JumpRecord = {
  kind: 'lead' | 'vendor';
  id: string;
  name: string;
  /** The one line of context that tells two similar names apart: a phone
   *  number on a lead, a category on a supplier. */
  note?: string;
  href: string;
};
export type JumpSection<T extends string = string> = { tab: T; label: string };

/** Words in any order, each contained in the name. "נועה אית" finds
 *  "נועה ואיתי"; so does "איתי נועה". */
export const matchesWords = (words: string[], text: string) => {
  const hay = text.toLowerCase();
  return words.every((w) => hay.includes(w));
};

/**
 * Upcoming first, then the ones with no date yet, then the past with the most
 * recent first.
 *
 * The layout sends events by date ascending, which is right for a list you
 * scroll and wrong for the six the palette can show: it opens on last
 * spring's weddings, the one set of events nobody is looking for.
 */
export function byRelevance(events: JumpEvent[], now = Date.now()): JumpEvent[] {
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  const rank = (e: JumpEvent) => (!e.date ? 1 : new Date(e.date).getTime() >= midnight ? 0 : 2);
  return [...events].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (!a.date || !b.date) return 0;
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    /* Among the finished ones, last week before last year. */
    return ra === 2 ? db - da : da - db;
  });
}

/**
 * Splitting a typed line into the name of an event and the name of a section.
 *
 * A word only becomes a section when it names no event. A couple called
 * "מסמכים" would otherwise lose their own name to the documents tab, which is
 * the kind of thing that happens once and is never reported, because it looks
 * like the search simply not finding anybody.
 */
export function splitQuery<T extends string>(
  query: string,
  events: JumpEvent[],
  sections: readonly JumpSection<T>[],
): { words: string[]; nameWords: string[]; section: T | null } {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const nameWords: string[] = [];
  let section: T | null = null;

  for (const w of words) {
    const namesAnEvent = events.some((e) => e.name.toLowerCase().includes(w));
    /* One letter is not a section: it would name most of them. */
    const hit = !namesAnEvent && w.length >= 2
      ? sections.find((s) => s.label.toLowerCase().includes(w))
      : undefined;
    if (hit && section === null) section = hit.tab; else nameWords.push(w);
  }

  return { words, nameWords, section };
}
