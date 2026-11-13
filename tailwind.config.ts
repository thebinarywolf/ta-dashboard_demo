import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-manrope)", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        sla: {
          ok: "#16a34a",
          warn: "#d97706",
          breach: "#dc2626",
        },
        brand: {
          blue: "#1e50cc",
          "blue-dark": "#173e9e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
