/**
 * The two pieces of conversation bookkeeping that every assistant here needs.
 *
 * Pure and in their own file so they can be tested, which is the whole reason
 * they are not left inline in the widget: both were written three times, once
 * per assistant, and the second of them is the kind of thing that is wrong for
 * months without anybody noticing — an answer arriving in pieces has to replace
 * the bubble it is being written into, and appending instead produces a
 * conversation where the assistant says the same sentence forty times, each one
 * a word longer.
 */

export type Turn = { role: 'user' | 'assistant'; content: string };

/**
 * The last `max` turns, which is what the route will read anyway.
 *
 * Capped in the browser as well as on the server so the two agree about what
 * the conversation is. A browser that sends more than the route reads is
 * paying to upload a history that is then silently cut from the other end,
 * and the assistant answers a conversation the person cannot see.
 */
export function capTurns(turns: readonly Turn[], max: number): Turn[] {
  return max > 0 ? turns.slice(-max) : [];
}

/**
 * The answer as it arrives.
 *
 * The bubble is created by the first words rather than waiting empty for them:
 * an empty rectangle sitting under "רגע" reads as something broken rather than
 * as something starting. Every delta after that replaces the same bubble.
 */
export function withAnswer(turns: readonly Turn[], content: string): Turn[] {
  const next = [...turns];
  const last = next[next.length - 1];
  if (last?.role === 'assistant') next[next.length - 1] = { role: 'assistant', content };
  else next.push({ role: 'assistant', content });
  return next;
}
