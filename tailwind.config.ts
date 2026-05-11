import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        zelanda: {
          verde: {
            50:  "#eef3ef",
            100: "#dfe9e3",
            200: "#bcd0c4",
            300: "#92b29f",
            400: "#5d8669",
            500: "#4a6f55",
            600: "#3a5c44",
            700: "#2d4a35",
            800: "#1f3a26",
            900: "#142c1a",
          },
          ocre: {
            50:  "#faf3e6",
            100: "#f1e3c4",
            200: "#e3c896",
            300: "#d4b07a",
            400: "#c19658",
            500: "#a47a3e",
            600: "#86612a",
            700: "#6b4c1e",
            800: "#503816",
            900: "#3a280f",
          },
          beige: {
            50:  "#fbf7f0",
            100: "#f5ede0",
            200: "#ede0c8",
            300: "#e1cba0",
          },
        },
        estado: {
          aldia:    "#3a5c44",
          proxima:  "#c19658",
          vencida:  "#a8423a",
          neutro:   "#6b6b6b",
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        sans:  ['Calibri', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        suave: "0 1px 3px rgba(20, 44, 26, 0.06), 0 1px 2px rgba(20, 44, 26, 0.04)",
        card:  "0 4px 12px rgba(20, 44, 26, 0.08)",
      },
      minHeight: {
        touch: "44px",
      },
      minWidth: {
        touch: "44px",
      },
    },
  },
  plugins: [],
};

export default config;
