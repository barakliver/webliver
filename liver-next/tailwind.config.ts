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

   Type is Heebo, and only Heebo. That is what the design source sets, on
   headings, figures, kickers and body alike; the brief that came with it says
   in as many words that where it and the README disagree, the source file
   wins.

   What shipped before this was Frank Ruhl Libre over Heebo, a serif on every
   heading and every large number, from the warm Lux direction. The palette
   here was already correct and the screens still did not look like the
   design, and the face is why.

   Display sizes are tracked tight, which is the opposite of what the serif
   wanted: -0.035em on a headline, -0.04em on a metric. A kicker is the one
   thing tracked open.
*/
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Text, darkest first. Warm near-black rather than blue-black: the
           whole palette sits on ivory, and a cool ink on a warm ground reads
           as a mistake rather than as a choice.

           Every solid tone is `rgb(var(--x-rgb) / <alpha-value>)` rather than
           `var(--x)`. The indirection buys one thing and it is not tidiness:
           Tailwind can only apply an opacity modifier to a custom property
           holding bare channels. Written the other way, `border-accent/40`
           and `bg-ink/25` compile to no declaration at all, which is how a
           modal backdrop can stop dimming without anybody noticing. */
        ink: {
          DEFAULT: 'rgb(var(--ink-rgb, 15 23 42) / <alpha-value>)',
          /* body copy, 5.59:1 */
          soft:    'rgb(var(--ink-soft-rgb, 71 85 105) / <alpha-value>)',
          /* large text and UI marks only, 3.89:1 — never small copy */
          mid:     'rgb(var(--ink-mid-rgb, 100 116 139) / <alpha-value>)',
          /* kickers, meta, inactive nav. The handoff's #A79881 reads 2.64:1
             at the 11px it is used at; this is the same hue at 4.53:1. */
          mute:    'rgb(var(--ink-mute-rgb, 90 104 125) / <alpha-value>)',
        },

        /* The ground and the two steps around it. No white anywhere. */
        surface: {
          DEFAULT: 'rgb(var(--surface-rgb, 241 245 249) / <alpha-value>)',
          /* the producer dashboard sits a shade brighter */
          100:     'rgb(var(--surface-100-rgb, 248 250 252) / <alpha-value>)',
          /* the page behind the artboards */
          200:     'rgb(var(--surface-200-rgb, 226 232 240) / <alpha-value>)',
        },
        /* Kept as a name because a hundred components ask for it. On this
           palette a "card" is the ground with a line above it, not a box. */
        card: 'rgb(var(--surface-100-rgb, 255 253 249) / <alpha-value>)',

        /* The one dark ground: Bride Mode, the bar result panel, the site CTA
           band. Gold reads 6.32:1 on it, so gold is a text colour there. */
        dark: 'rgb(var(--dark-rgb, 15 23 42) / <alpha-value>)',

        /* Hairlines. These are the structure, so they have real names. */
        line: {
          DEFAULT: 'var(--line, rgba(15,23,42,.10))',
          strong:  'var(--line-strong, rgba(15,23,42,.18))',
          /* The edge of a glass panel. Lighter than a separator on purpose:
             here the fill and the shadow carry the surface and the border only
             finishes it, which is the whole difference between this design and
             the hairline one it replaced. */
          soft:    'var(--line-soft, rgba(226,232,240,.6))',
          /* The edge of a control, not the gap between two rows. 3:1. */
          control: 'var(--line-control, rgba(15,23,42,.60))',
        },

        /* The accent, split by job, and every one of them a producer's own.
           `accent` is safe for words at any size. `bright` is for large serif
           numerals, 24px and up, where 3:1 is the bar. `line` is decoration
           and never carries meaning on its own. `wash` is a background only
           ever sat on by `accent`. */
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb, 130 104 64) / <alpha-value>)',
          bright:  'rgb(var(--accent-bright-rgb, 158 127 78) / <alpha-value>)',
          line:    'rgb(var(--accent-line-rgb, 176 141 87) / <alpha-value>)',
          /* Translucent by definition, so it stays whole and takes no
             opacity modifier. `bg-accent-wash/60` would compile to nothing. */
          wash:    'var(--accent-wash, rgba(176,141,87,.07))',
          /* on the dark ground only */
          light:   'rgb(var(--accent-light-rgb, 216 188 138) / <alpha-value>)',
        },

        /* State, deliberately nowhere near the accent. On a gold system a gold
           "good" is unreadable as good, so good is green, waiting is amber and
           wrong is red, each measured against this ivory rather than against
           the white it was measured on before. */
        ok:   { DEFAULT: '#3D6B4A', wash: '#E8EFE7' },
        warn: { DEFAULT: '#8A5A17', wash: '#F5EEDF' },
        bad:  { DEFAULT: '#96322A', wash: '#F5E7E3' },
      },
      /* One family. `display` is kept as a name because a hundred components
         ask for it, and it now resolves to the same face as the body, which is
         what the design source does. Keeping the name means the day a display
         face is chosen deliberately, it is one line here. */
      fontFamily: {
        sans:    ['var(--font-heebo)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['var(--font-heebo)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        /* Tracked tight, from the design source: -0.035em on a headline and
           -0.04em on a metric. The previous values were positive, because a
           serif at weight 300 closes up without air. This face is the other
           way round: at these sizes Heebo needs the letters pulled together or
           a headline reads as a row of separate words. */
        'display-xl': ['clamp(42px,7.4vw,104px)', { lineHeight: '1.04', letterSpacing: '-.035em' }],
        'display':    ['clamp(30px,5vw,46px)',    { lineHeight: '1.1',  letterSpacing: '-.035em' }],
        'title':      ['clamp(22px,2.4vw,32px)',  { lineHeight: '1.2',  letterSpacing: '-.03em' }],
        /* The numbers the screens are built around. */
        'metric':     ['62px', { lineHeight: '1',    letterSpacing: '-.04em' }],
        'metric-sm':  ['42px', { lineHeight: '1.05', letterSpacing: '-.04em' }],
      },
      letterSpacing: {
        /* A kicker is the one thing tracked open rather than tight. */
        kicker: '.12em',
        'kicker-wide': '.14em',
      },
      boxShadow: {
        /* Content carries no shadow at all on this palette. What is left is
           the two places the handoff keeps one: under a device shell and under
           the contact button, both of which are objects rather than surfaces.
           `soft` and `lift` stay defined and stay none. Nothing asks for
           them any more, and that is the point: while they were scattered
           over the content they read as elevation in the source and rendered
           as nothing, so four cards lost their hover state without anybody
           writing a line that said so. They stay here as a landing place, in
           case one comes back. */
        /* Surfaces carry a shadow again, and it is the design source's own:
           barely there at rest, and a real lift only on the things that float.
           The Lux direction had removed every one of them, which is why the
           screens read as a flat document rather than as the stack of panels
           that was designed. */
        soft: '0 1px 2px rgba(15,23,42,.04)',
        lift: '0 14px 34px -22px rgba(15,23,42,.30)',
        cta:  '0 12px 26px -14px rgba(15,23,42,.70)',
        /* Chrome that floats over arbitrary content rather than over the
           page's own ground: a dropdown, the concierge panel. A hairline
           alone cannot say "above" on a ground this light. */
        pop:  '0 12px 28px -12px rgba(15,23,42,.45)',
        dock: '0 -1px 0 var(--line, rgba(15,23,42,.10))',
        fab:  '0 18px 36px -18px rgba(15,23,42,.55)',
      },
      backdropBlur: { xl: '22px', '2xl': '34px' },
      /* Rounded, and rounded through these two names rather than at a
         hundred call sites. The Lux direction called for square; the design
         this palette comes from is pills and rounded cards, and that is the
         one being built. Changing the token changes every surface at once,
         which is the point of having had one. */
      /* The design source's own scale, by the name of the thing each value is
         for. `xl2` and `4xl` stay as the two aliases a hundred components
         already ask for, mapped onto it. */
      borderRadius: {
        control: '14px', button: '16px', 'card-sm': '20px', kpi: '22px',
        card: '24px', panel: '26px', sheet: '30px',
        xl2: '14px', '4xl': '24px',
      },
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
