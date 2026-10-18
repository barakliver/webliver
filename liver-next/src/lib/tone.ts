/**
 * The card's four tones as the class strings a screen needs, written out in
 * full because Tailwind reads class names as text and a name built from a
 * variable is a class that never reaches the stylesheet.
 *
 * `fill` is a swatch with its label on it, `soft` is the second line on that
 * swatch (the label at 90% and not less: 80% over the boho measures 4.2),
 * `wash` is a ground that sits under ink, and `dot` is the same colour as a
 * mark beside words, which is the only way a tone sits next to text without
 * being asked to carry it.
 */
export type Tone = 'camel' | 'boho' | 'rubine' | 'tamarind';

export const TONE_ORDER: readonly Tone[] = ['camel', 'boho', 'rubine', 'tamarind'];

export const TONE: Record<Tone, { fill: string; soft: string; wash: string; dot: string; bar: string }> = {
  camel:    { fill: 'bg-tone-camel text-tone-camel-on',       soft: 'text-tone-camel-on/90',    wash: 'bg-tone-camel-wash text-tone-camel-ink',       dot: 'bg-tone-camel',    bar: 'bg-tone-camel' },
  boho:     { fill: 'bg-tone-boho text-tone-boho-on',         soft: 'text-tone-boho-on/90',     wash: 'bg-tone-boho-wash text-tone-boho-ink',         dot: 'bg-tone-boho',     bar: 'bg-tone-boho' },
  rubine:   { fill: 'bg-tone-rubine text-tone-rubine-on',     soft: 'text-tone-rubine-on/90',   wash: 'bg-tone-rubine-wash text-tone-rubine-ink',     dot: 'bg-tone-rubine',   bar: 'bg-tone-rubine' },
  tamarind: { fill: 'bg-tone-tamarind text-tone-tamarind-on', soft: 'text-tone-tamarind-on/90', wash: 'bg-tone-tamarind-wash text-tone-tamarind-ink', dot: 'bg-tone-tamarind', bar: 'bg-tone-tamarind' },
};

/** The nth tone, round and round, for a list that has no tone of its own. */
export const toneAt = (i: number): Tone => TONE_ORDER[((i % 4) + 4) % 4];
