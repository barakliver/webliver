/**
 * The two names in an event's name.
 *
 * An event is called what the couple is called - "נועה ואיתי", "Noa & Itay" -
 * and a payment wants to know which of the two paid. There is no column of
 * partner names to read, and adding one would be a second place to type the
 * same two words, so this reads them out of the one that exists.
 *
 * Hebrew writes "and" as a letter stuck to the front of the next word, which is
 * the whole difficulty: a ו at the start of a token is the conjunction unless
 * it is the first token. The rule is read left to right and stops at the first
 * such token, so "נועה כהן ואיתי לוי" is "נועה כהן" and "איתי לוי". The one
 * way it is wrong is a second name that really starts with ו and is written
 * alone, "דני ורד", and the screen it feeds takes any name typed over it, so
 * the cost of being wrong is one dropdown option that needs correcting.
 *
 * Anything that is not clearly two names returns none, and the caller offers
 * "joint" alone. A name guessed from "משפחת לוי" would be worse than no name.
 */
export function coupleNames(display: string): string[] {
  const text = display.replace(/\s+/g, ' ').trim();
  if (text === '') return [];

  /* A conjunction written as its own word. */
  const apart = text.split(/ (?:&|\+|and|ו) /i);
  if (apart.length === 2 && apart[0] && apart[1]) return [apart[0].trim(), apart[1].trim()];

  /* Hebrew's conjunction, attached to the second name. */
  const tokens = text.split(' ');
  const i = tokens.findIndex((t, k) => k >= 1 && t.length >= 3 && t.startsWith('ו'));
  if (i >= 1) {
    const first = tokens.slice(0, i).join(' ');
    const second = [tokens[i].slice(1), ...tokens.slice(i + 1)].join(' ');
    if (first && second) return [first, second];
  }
  return [];
}
