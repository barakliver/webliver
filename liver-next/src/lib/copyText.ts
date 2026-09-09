/**
 * Sentences with holes in them, filled at the call site.
 *
 * Every block of copy that reaches a client component travels through the
 * provider, and a function cannot be serialised across that boundary. So a
 * sentence that used to be `(n) => ...` is now a template with `{n}` in it,
 * or a pair of them for one and many, and these two lines do the filling.
 * Pure, so the tests can import them without a bundler.
 */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole);
}

/** One or many. English and Hebrew both split at one, which is the whole
 *  reason the shape is two sentences rather than a rule. */
export function count(c: { one: string; many: string }, n: number): string {
  return n === 1 ? c.one : fill(c.many, { n });
}
