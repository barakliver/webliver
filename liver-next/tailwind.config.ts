import type { Config } from 'tailwindcss';

/* ── Liver Productions design system ───────────────────────────────────────
   The palette is the one specified in the brief. The UI/UX skill, asked
   independently for "wedding production, premium editorial", returned
   premium black with a gold accent and landed within a shade of it — so the
   two agree and this is the single source.

   Warm rather than neutral on purpose: the greys carry a little of the gold,
   which is what separates a chosen neutral from an inherited one.

   Type is Frank Ruhl Libre over Heebo. The skill's own recommendation for
   this category, Cormorant / Montserrat, ships no Hebrew glyphs at all;
   both faces here do. See design-system/liver-productions/MASTER.md.  */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* text and ground */
        ink:   { DEFAULT: '#171512', soft: '#655D54', mute: '#8B8177' },
        ivory: { DEFAULT: '#F7F4EE', 100: '#FBF9F5', 200: '#F1ECE3' },
        card:  '#FFFFFF',
        line:  { DEFAULT: '#E4DDD3', strong: '#D6CCBE' },

        /* gold, split by job: champagne decorates, bronze is safe for text.
           Champagne on ivory measures about 3.4:1, under the 4.5:1 needed for
           body copy, so it is never used for words. */
        champagne: '#A6763A',
        bronze:    { DEFAULT: '#7C5527', soft: '#946A38', wash: '#F5EEE3' },

        /* state, kept away from the accent so "gold" never means "good" */
        ok:   { DEFAULT: '#3F5B46', wash: '#E7EFE7' },
        warn: { DEFAULT: '#8A5A17', wash: '#F7EDDC' },
        bad:  { DEFAULT: '#8C2F2F', wash: '#F6E7E4' },
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
        /* two stops each: a hairline to seat the edge, a wide soft one for lift */
        soft: '0 1px 2px rgba(23,21,18,0.04), 0 8px 24px -14px rgba(23,21,18,0.14)',
        lift: '0 2px 4px rgba(23,21,18,0.04), 0 20px 48px -20px rgba(23,21,18,0.22)',
        dock: '0 -1px 0 rgba(23,21,18,0.06), 0 -8px 32px -12px rgba(23,21,18,0.16)',
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
