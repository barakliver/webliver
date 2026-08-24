import type { Config } from "tailwindcss";

/**
 * Event & wedding production platform — light Apple-luxury theme.
 * Every value here is lifted from the design prototype; see README.md.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Heebo",
          "Assistant",
          "sans-serif",
        ],
      },
      colors: {
        ink: {
          DEFAULT: "#0F172A",
          muted: "#475569",
          faint: "#64748B",
          placeholder: "#94A3B8",
        },
        line: {
          DEFAULT: "#E2E8F0",
          soft: "rgba(226,232,240,0.6)",
          strong: "rgba(226,232,240,0.95)",
        },
        canvas: "#F1F5F9",
        gold: {
          DEFAULT: "#B08D57",
          light: "#D8BC8A",
          tint: "rgba(176,141,87,0.14)",
        },
        /* White-label accent — override at runtime via --accent */
        accent: "var(--accent, #B08D57)",
      },
      backgroundImage: {
        canvas:
          "radial-gradient(120% 80% at 80% 0%, #FFFFFF 0%, #F8FAFC 45%, #EEF2F7 100%)",
        "hero-scrim":
          "linear-gradient(180deg, rgba(15,23,42,0.42) 0%, rgba(15,23,42,0.05) 38%, rgba(255,255,255,0.75) 82%, #FFFFFF 100%)",
        "progress-ink": "linear-gradient(90deg, #0F172A, #475569)",
      },
      borderRadius: {
        control: "14px",
        button: "16px",
        "card-sm": "20px",
        kpi: "22px",
        card: "24px",
        panel: "26px",
        sheet: "30px",
        screen: "44px",
        bezel: "54px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04)",
        solid: "0 14px 34px -22px rgba(15,23,42,0.3)",
        cta: "0 12px 26px -14px rgba(15,23,42,0.7)",
        "cta-web": "0 12px 24px -14px rgba(15,23,42,0.7)",
        fab: "0 18px 36px -18px rgba(15,23,42,0.75)",
        "fab-sm": "0 14px 30px -18px rgba(15,23,42,0.45)",
        dock: "0 22px 45px -22px rgba(15,23,42,0.45)",
        "login-card": "0 26px 60px -34px rgba(15,23,42,0.35)",
        "dark-card": "0 24px 50px -30px rgba(15,23,42,0.9)",
        sheet: "0 -20px 50px -30px rgba(15,23,42,0.6)",
        bezel:
          "0 40px 80px -40px rgba(15,23,42,0.5), 0 0 0 1px rgba(15,23,42,0.6)",
        "otp-focus": "0 0 0 3px rgba(15,23,42,0.08)",
        tab: "0 1px 3px rgba(15,23,42,0.12)",
      },
      backdropBlur: {
        glass: "24px",
        dock: "22px",
        login: "28px",
        sheet: "30px",
      },
      letterSpacing: {
        display: "-0.035em",
        metric: "-0.04em",
        title: "-0.03em",
        tight: "-0.02em",
        snug: "-0.01em",
        kicker: "0.12em",
        "kicker-wide": "0.14em",
      },
      spacing: {
        "safe-b": "env(safe-area-inset-bottom)",
        dock: "26px",
        fab: "92px",
      },
      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        rise: "rise 0.45s ease both",
        "rise-slow": "rise 0.5s ease both",
        "rise-fast": "rise 0.28s ease both",
      },
      transitionDuration: { control: "200ms", surface: "250ms" },
    },
  },
  plugins: [
    /* Glass surface utilities — the three card variants from the design. */
    function ({ addUtilities }: any) {
      addUtilities({
        ".surface-glass": {
          background: "rgba(255,255,255,0.78)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(226,232,240,0.6)",
          boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        },
        ".surface-solid": {
          background: "#fff",
          border: "1px solid rgba(241,245,249,1)",
          boxShadow: "0 14px 34px -22px rgba(15,23,42,0.3)",
        },
        ".surface-outline": {
          background: "rgba(255,255,255,0.45)",
          border: "1px solid #E2E8F0",
          boxShadow: "none",
        },
        ".pb-home-indicator": {
          paddingBottom: "max(26px, env(safe-area-inset-bottom))",
        },
        /* Wrap any mixed number or currency string in RTL context. */
        ".ltr-num": {
          direction: "ltr",
          unicodeBidi: "isolate",
          whiteSpace: "nowrap",
        },
      });
    },
  ],
};

export default config;
