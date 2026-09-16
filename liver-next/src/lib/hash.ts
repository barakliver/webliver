/**
 * One string to one number, the same way every time.
 *
 * FNV-1a, thirty-two bits. Not cryptography and not trying to be: what both
 * callers want is an order that is stable across two phones, across a reload
 * and across a deploy, and that nobody had to store anywhere. The card game
 * deals a wedding's deck from its token, and the bingo board lays a task in
 * the same square it was in yesterday, and neither can do that from
 * `Math.random()`.
 *
 * It lives here rather than in either of them because the second caller was
 * about to copy the first one's six lines, and a hash copied is a hash that
 * changes on one side: the day somebody "improves" one of them, every couple
 * mid-game gets a new deck order and every board reshuffles under a finger.
 */
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
