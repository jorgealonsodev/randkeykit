/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./verify.html",
    "./src/**/*.{js,html}",
  ],
  // Classes referenced from JS-generated DOM but built via accent lookup must be
  // visible to the extractor. The card factory maps accent -> full static class
  // strings (see src/ui/card.js ACCENT_STYLES), so the extractor finds them.
  // Safelist below covers the few opacity-tint classes used dynamically.
  safelist: [
    "bg-primary/10",
    "bg-tertiary/10",
    "text-primary",
    "text-tertiary",
    "border-primary/30",
    "border-tertiary/30",
    "ring-primary/20",
    "ring-tertiary/20",
  ],
  theme: {
    extend: {
      colors: {
        // Material 3 inspired palette — primary blue
        primary: {
          DEFAULT: "#004ac6",
          hover: "#003fa6",
          container: "#d8e2ff",
          "on-container": "#001a41",
          on: "#ffffff",
        },
        // Tertiary green — entropy / secure cues
        tertiary: {
          DEFAULT: "#006242",
          container: "#9df6c5",
          "on-container": "#003921",
          on: "#ffffff",
        },
        background: {
          DEFAULT: "#f8f9ff",
          on: "#1a1b22",
        },
        surface: {
          DEFAULT: "#ffffff",
          variant: "#eef2ff",
          dim: "#e2e6f0",
          on: "#1a1b22",
          "on-variant": "#44474f",
        },
        outline: {
          DEFAULT: "#c3c8d4",
          variant: "#e2e6f0",
        },
        error: {
          DEFAULT: "#ba1a1a",
          container: "#ffdad6",
          on: "#ffffff",
        },
      },
      fontFamily: {
        display: ["Geist", "Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        none: "0px",
        sm: "0.125rem",
        DEFAULT: "0.125rem",
        md: "0.25rem",
        lg: "0.25rem",
        xl: "0.5rem",
        "2xl": "0.75rem",
        "3xl": "0.75rem",
        full: "9999px",
      },
      maxWidth: {
        container: "1200px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)",
        "card-hover": "0 4px 12px rgba(16,24,40,0.12), 0 2px 4px rgba(16,24,40,0.08)",
      },
    },
  },
  plugins: [],
};
