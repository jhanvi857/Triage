/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Triage Refined Operational Palette
        canvas: "#F5F6F6",
        card: "#FFFFFF",
        ink: {
          DEFAULT: "#202525",
          primary: "#202525",
          muted: "#6F7777",
          subtle: "#9BA3A3",
        },
        border: {
          DEFAULT: "#E2E5E5",
          subtle: "#ECEEEE",
          dark: "#CAD1D1",
        },
        primary: {
          DEFAULT: "#087F83",
          hover: "#06686B",
          light: "#0AA1A6",
          soft: "#E6F2F3",
          border: "#B2DCDE",
        },
        teal: {
          DEFAULT: "#087F83",
          hover: "#06686B",
          light: "#0AA1A6",
          soft: "#E6F2F3",
          dark: "#055255",
        },
        success: {
          DEFAULT: "#2E7D5B",
          hover: "#25684B",
          soft: "#EAF3EE",
          border: "#B8DEC9",
        },
        warning: {
          DEFAULT: "#B7791F",
          hover: "#9B6414",
          soft: "#F8F3EA",
          border: "#E9D6B8",
        },
        danger: {
          DEFAULT: "#C94A4A",
          hover: "#A83838",
          soft: "#FAECEC",
          border: "#F0BEBE",
        },
      },
      fontFamily: {
        dispatch: ["'Barlow Condensed'", "'Oswald'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "'JetBrains Mono'", "monospace"],
        sans: ["'Inter'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
};
