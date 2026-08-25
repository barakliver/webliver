import type { Config } from 'tailwindcss';

/* ── Liver Productions design system ───────────────────────────────────────
   Slate blue on a cool near-white, with the restraint of a system utility
   rather than the warmth of a stationery set.

   It replaced an ivory and bronze palette that was well built and was not what
   was asked for. What carried across is the structure: names that say what a
   colour is for rather than what it looks like, an accent split by job, and
   state colours kept away from the accent so the accent never accidentally
   means "good".

   Cool rather than neutral on purpose. Every grey here carries a little of the
   blue, which is the difference between a neutral that was chosen and one that
   was inherited from a framework's defaults.

   Every pairing below is measured, not judged by eye:

       node scripts/check-contrast.mjs

   which fails if any of them drops under its target. Two tones were darkened
   on the way in because they did.

   Type is Frank Ruhl Libre over Heebo. Most of the celebrated display and body
   pairings ship no Hebrew glyphs at all, which rules them out before taste
   comes into it; both of these do. */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* text, darkest first. Never pure black: a blue black sits on a cool
           ground without the hard edge that pure black cuts against it. */
        ink: { DEFAULT: '#0E1620', soft: '#47566A', mute: '#5B697C' },

        /* the ground and the two steps above it */
        surface: { DEFAULT: '#F3F6FA', 100: '#F9FBFD', 200: '#E7ECF3' },
        card: '#FFFFFF',
        line: { DEFAULT: '#DBE2EC', strong: '#C4CEDB' },

        /* The accent, split by job. `accent` is safe for words; `bright`
           measures 3.34:1 on the ground, under the 4.5:1 that body copy needs,
           so it decorates and never speaks. `soft` is for borders and rings,
           where 3:1 is the bar. `wash` is a background and is only ever sat on
           by `accent` itself. */
        accent: {
          DEFAULT: '#2E5F8C',
          soft:    '#4A80B0',
          bright:  '#4C8BC4',
          wash:    '#E9F0F8',
        },

        /* State, deliberately nowhere near the accent. On a blue system a
           blue "success" is unreadable as success, so good is green, waiting
           is amber and wrong is red, and each has a wash its own text passes
           against. */
        ok:   { DEFAULT: '#2F6B4F', wash: '#E3EFE8' },
        warn: { DEFAULT: '#8A5A17', wash: '#F7EDDC' },
        bad:  { DEFAULT: '#9A2B2B', wash: '#F8E8E7' },
      },
      fontFamily: {
        sans:    ['var(--font-heebo)', 'system-ui', 'sans-serif'],
        display: ['var(--font-frank)', 'Georgia', 'serif'],
      },
      fontSize: {
        'display-xl': ['clamp(2.4rem,6vw,4.4rem)',   { lineHeight: '1.1',  letterSpacing: '-0.02em' }],
        'display':    ['clamp(1.9rem,4vw,2.9rem)',   { lineHeight: '1.18', letterSpacing: '-0.015em' }],
        'title':      ['clamp(1.3rem,2.2vw,1.75rem)',{ lineHeight: '1.3',  letterSpacing: '-0.01em' }],
      },
      boxShadow: {
        /* Two stops each: a hairline to seat the edge, a wide soft one for
           lift. Tinted with the ink rather than with black, so a shadow on a
           cool ground reads as depth instead of as grime. */
        soft: '0 1px 2px rgba(14,22,32,0.05), 0 8px 24px -14px rgba(14,22,32,0.16)',
        lift: '0 2px 4px rgba(14,22,32,0.05), 0 20px 48px -20px rgba(14,22,32,0.24)',
        dock: '0 -1px 0 rgba(14,22,32,0.07), 0 -8px 32px -12px rgba(14,22,32,0.18)',
      },
      backdropBlur: { xl: '22px', '2xl': '34px' },
      borderRadius: { xl2: '1.15rem', '4xl': '1.75rem' },
      maxWidth: { content: '70rem', prose2: '44rem' },
      spacing: { safe: 'env(safe-area-inset-bottom, 0px)' },
      transitionTimingFunction: { out: 'cubic-bezier(.16,1,.3,1)' },
      keyframes: {
        rise:  { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'none' } },
        sheet: { '0%': { opacity: '0', transform: 'translateY(16px) scale(.99)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        /* 160-350ms, per the brief; only the page-load rise runs longer */
        rise:  'rise .5s cubic-bezier(.16,1,.3,1) both',
        sheet: 'sheet .28s cubic-bezier(.16,1,.3,1) both',
      },
    },
  },
  plugins: [],
};
export default config;
