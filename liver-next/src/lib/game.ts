/**
 * How the deck is dealt.
 *
 * Pure, so it can be tested without a browser — which matters here, because
 * the one rule in it is a rule about a bug nobody would ever see in testing
 * and every twelfth couple would hit in play.
 *
 * Three of the seventy-four cards are rule cards, and each one talks about
 * its neighbour: "כל אחד עונה על הקלף **הבא**", "מה ההורים היו עונים על
 * הקלף **הקודם**". A straight shuffle will eventually put two of them next to
 * each other, or put one of them first or last, and then the card points at
 * nothing and the couple is holding an instruction it cannot carry out. With
 * three rule cards in seventy-four that happens in roughly one game in
 * twelve — often enough to be somebody's first impression of the game.
 *
 * So the deal is not one shuffle. The seventy-one ordinary cards are shuffled
 * and the three rule cards are then placed into it at three distinct
 * interior positions, which makes both failures impossible rather than
 * unlikely: never first, never last, never two in a row.
 *
 * Both partners get the same order, from the same seed. That is not an
 * accident of implementation — it is what makes the rule cards mean anything.
 * "Answer the next card as your partner" is a game only if the two of you are
 * looking at the same next card. The two doors give each of them their own
 * *place* in the deck, not their own deck.
 */

/* Relative and with the extension, because this file is read by `node --test`
   as well as by the bundler, and node resolves neither the `@/` alias nor an
   extensionless path. Every lib with a test next to it imports this way. */
import { CARDS, type Card } from '../content/cards.ts';

/** A small, fast, seedable generator. Not cryptography — it deals cards. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The token as a number, so one wedding's deck is the same on both phones
 *  and on every reload, and two weddings do not share an order. */
export function seedFrom(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * One wedding's order of play.
 *
 * `cards` is a parameter rather than a closed-over import so the test can
 * deal a tiny deck and check the placement rule directly.
 */
export function dealDeck(token: string, cards: readonly Card[] = CARDS): Card[] {
  const rand = mulberry32(seedFrom(token));
  const rules = cards.filter((c) => c.kind === 'rule');
  const rest = shuffled(cards.filter((c) => c.kind !== 'rule'), rand);

  /* Nothing to place into: hand back what there is rather than inventing a
     position inside an empty array. */
  if (rest.length < rules.length + 1) return [...rest, ...rules];

  /* Distinct insertion points in 1 … rest.length - 1. The lower bound keeps a
     rule card off the front, the upper bound keeps one off the back, and
     distinctness is all that is needed to keep two apart: inserting at two
     different original indices always leaves at least one ordinary card
     between them. */
  const slots = new Set<number>();
  const span = rest.length - 1;
  while (slots.size < rules.length) slots.add(1 + Math.floor(rand() * span));

  /* Widened back to Card on purpose: `rest` narrowed to the two non-rule
     shapes when it was filtered, and the rule cards are about to go into it. */
  const out: Card[] = [...rest];
  /* Back to front, so an earlier insertion does not move a later index. */
  const placed = [...slots].sort((x, y) => y - x);
  const order = shuffled(rules, rand);
  placed.forEach((at, i) => out.splice(at, 0, order[i]));
  return out;
}

/** How far through, as a percentage, for the thin line under the card. */
export const progressOf = (seen: number, total: number): number =>
  total <= 0 ? 0 : Math.min(100, Math.round((seen / total) * 100));
