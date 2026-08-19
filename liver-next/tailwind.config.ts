import type { Config } from 'tailwindcss';

/* Apple-grade system: generous whitespace, soft light-blue ambience,
   frosted glass, hairline borders, restrained elevation. */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:    { DEFAULT: '#0b1220', soft: '#3c4657', mute: '#6b7686' },
        haze:   { 50: '#f7fafd', 100: '#eef4fb', 200: '#dfeaf7', 300: '#cadcf1' },
        azure:  { 50: '#f0f7ff', 100: '#e0efff', 300: '#9cc9f5', 500: '#3d84c6', 600: '#2f6ba6' },
        line:   { DEFAULT: 'rgba(11,18,32,0.08)', strong: 'rgba(11,18,32,0.14)' },
      },
      fontFamily: {
        sans: ['var(--font-heebo)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-assistant)', 'var(--font-heebo)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['clamp(2.6rem,6.5vw,5rem)', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        'display':    ['clamp(2rem,4.2vw,3.2rem)', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
        'title':      ['clamp(1.4rem,2.4vw,2rem)', { lineHeight: '1.3',  letterSpacing: '-0.01em' }],
      },
      boxShadow: {
        soft:  '0 1px 2px rgba(11,18,32,0.04), 0 8px 24px -12px rgba(11,18,32,0.10)',
        lift:  '0 2px 4px rgba(11,18,32,0.04), 0 18px 44px -18px rgba(11,18,32,0.18)',
        dock:  '0 8px 32px -8px rgba(11,18,32,0.24)',
      },
      backdropBlur: { xl: '24px' },
      borderRadius: { xl2: '1.25rem', '4xl': '2rem' },
      maxWidth: { content: '72rem', prose2: '46rem' },
      keyframes: {
        rise:  { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'none' } },
        drift: { '0%,100%': { transform: 'scale(1.06) translate3d(0,0,0)' }, '50%': { transform: 'scale(1.12) translate3d(-1.5%,-1%,0)' } },
        sheet: { '0%': { opacity: '0', transform: 'translateY(18px) scale(.99)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        rise: 'rise .7s cubic-bezier(.16,1,.3,1) both',
        drift: 'drift 42s ease-in-out infinite',
        sheet: 'sheet .35s cubic-bezier(.16,1,.3,1) both',
      },
    },
  },
  plugins: [],
};
export default config;
