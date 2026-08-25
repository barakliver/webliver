import type { Config } from 'tailwindcss';

/* ── Liver Productions design system · Lux ─────────────────────────────────
   Warm near-black on ivory, structured by hairlines rather than by cards.

   The change from the slate version is not a repaint, it is a change of
   construction. There are no cards, no glass, no shadows on content and no
   radii on content. What separates one thing from the next is a 1px line, and
   what marks something as active is a gold rule. Buttons are square. Only
   avatars and the small circular controls stay round.

   Colour names still say what a colour is for rather than what it looks like,
   and the accent is still split by job, because the split is what keeps a
   decorative tone out of a sentence.

   Every value is a custom property so a producer's own accent replaces it at
   runtime. The defaults are on :root in globals.css; the shortlist a producer
   chooses from is src/content/brand.ts, and every entry of it is measured by

       npm run contrast

   which fails the build rather than shipping a tone somebody cannot read.
   Three tones were darkened on the way in from the handoff because it said so:
   the handoff's gold reads 2.89:1 against ivory and its faint ink 2.64:1, both
   under the bar for the text they were being used for.

   Type is Frank Ruhl Libre over Heebo. Frank carries every heading, every
   large number and every currency value, at weight 300 and never bold. Most of
   the celebrated display pairings ship no Hebrew glyphs at all, which rules
   them out before taste comes into it; both of these carry Hebrew. */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Text, darkest first. Warm near-black rather than blue-black: the
           whole palette sits on ivory, and a cool ink on a warm ground reads
           as a mistake rather than as a choice. */
        ink: {
          DEFAULT: 'var(--ink, #1A1613)',
          /* body copy, 5.59:1 */
          soft:    'var(--ink-soft, #6B6259)',
          /* large text and UI marks only, 3.89:1 — never small copy */
          mid:     'var(--ink-mid, #8A7A66)',
          /* kickers, meta, inactive nav. The handoff's #A79881 reads 2.64:1
             at the 11px it is used at; this is the same hue at 4.53:1. */
          mute:    'var(--ink-mute, #726858)',
        },

        /* The ground and the two steps around it. No white anywhere. */
        surface: {
          DEFAULT: 'var(--surface, #FAF7F2)',
          /* the producer dashboard sits a shade brighter */
          100:     'var(--surface-100, #FFFDF9)',
          /* the page behind the artboards */
          200:     'var(--surface-200, #EDEAE4)',
        },
        /* Kept as a name because a hundred components ask for it. On this
           palette a "card" is the ground with a line above it, not a box. */
        card: 'var(--surface-100, #FFFDF9)',

        /* The one dark ground: Bride Mode, the bar result panel, the site CTA
           band. Gold reads 6.32:1 on it, so gold is a text colour there. */
        dark: 'var(--dark, #0E0C0A)',

        /* Hairlines. These are the structure, so they have real names. */
        line: {
          DEFAULT: 'var(--line, rgba(26,22,19,.09))',
          strong:  'var(--line-strong, rgba(26,22,19,.16))',
          /* The edge of a control, not the gap between two rows. 3:1. */
          control: 'var(--line-control, rgba(26,22,19,.48))',
        },

        /* The accent, split by job, and every one of them a producer's own.
           `accent` is safe for words at any size. `bright` is for large serif
           numerals, 24px and up, where 3:1 is the bar. `line` is decoration
           and never carries meaning on its own. `wash` is a background only
           ever sat on by `accent`. */
        accent: {
          DEFAULT: 'var(--accent, #846941)',
          bright:  'var(--accent-bright, #A18150)',
          line:    'var(--accent-line, #B08D57)',
          wash:    'var(--accent-wash, rgba(176,141,87,.12))',
          /* on the dark ground only */
          light:   'var(--accent-light, #D8BC8A)',
        },

        /* State, deliberately nowhere near the accent. On a gold system a gold
           "good" is unreadable as good, so good is green, waiting is amber and
           wrong is red, each measured against this ivory rather than against
           the white it was measured on before. */
        ok:   { DEFAULT: '#3D6B4A', wash: '#E8EFE7' },
        warn: { DEFAULT: '#8A5A17', wash: '#F5EEDF' },
        bad:  { DEFAULT: '#96322A', wash: '#F5E7E3' },
      },
      fontFamily: {
        sans:    ['var(--font-heebo)', 'system-ui', 'sans-serif'],
        display: ['var(--font-frank)', 'Georgia', 'serif'],
      },
      fontSize: {
        /* Positive tracking on the serif, which is the opposite of the tight
           display type the slate version used. At weight 300 the letters need
           the air or they close up. */
        'display-xl': ['clamp(42px,7.4vw,104px)', { lineHeight: '1.04', letterSpacing: '.01em' }],
        'display':    ['clamp(30px,5vw,46px)',    { lineHeight: '1.12', letterSpacing: '.015em' }],
        'title':      ['clamp(22px,2.4vw,32px)',  { lineHeight: '1.2',  letterSpacing: '.02em' }],
        /* The numbers the screens are built around. */
        'metric':     ['62px', { lineHeight: '1',   letterSpacing: '.01em' }],
        'metric-sm':  ['42px', { lineHeight: '1.05', letterSpacing: '.01em' }],
      },
      boxShadow: {
        /* Content carries no shadow at all on this palette. What is left is
           the two places the handoff keeps one: under a device shell and under
           the contact button, both of which are objects rather than surfaces.
           `soft` and `lift` stay defined and stay none, so the hundred
           components that ask for them go flat instead of failing. */
        soft: 'none',
        lift: 'none',
        dock: '0 -1px 0 var(--line, rgba(26,22,19,.09))',
        fab:  '0 18px 36px -18px rgba(26,22,19,.55)',
      },
      backdropBlur: { xl: '22px', '2xl': '34px' },
      /* Square. The two names survive because they are used in a hundred
         places, and both now resolve to nothing. */
      borderRadius: { xl2: '0px', '4xl': '0px' },
      maxWidth: { content: '70rem', prose2: '44rem' },
      spacing: { safe: 'env(safe-area-inset-bottom, 0px)' },
      transitionTimingFunction: { out: 'cubic-bezier(.16,1,.3,1)' },
      transitionDuration: { veil: '650ms', slow: '900ms', stage: '1000ms' },
      keyframes: {
        rise:  { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'none' } },
        sheet: { '0%': { opacity: '0', transform: 'translateY(16px) scale(.99)' }, '100%': { opacity: '1', transform: 'none' } },
        /* The ambient backdrop arrives over its own still rather than cutting
           to it, so the swap is not a flash on a page whose first impression
           is the point. */
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        /* The screen entry the handoff calls `veil`: a longer, softer arrival
           than the slate version's rise. */
        veil:  { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'none' } },
        /* Ambient marks: a thin circle on the hero, a gold glow on the dark
           band. Decorative and slow enough not to be noticed working. */
        shimmer: { '0%,100%': { opacity: '.25' }, '50%': { opacity: '.6' } },
        floatSlow: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
      },
      animation: {
        rise:  'rise .5s cubic-bezier(.16,1,.3,1) both',
        sheet: 'sheet .28s cubic-bezier(.16,1,.3,1) both',
        veil:  'veil .65s cubic-bezier(.16,1,.3,1) both',
        shimmer: 'shimmer 7s ease-in-out infinite',
        floatSlow: 'floatSlow 9s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
