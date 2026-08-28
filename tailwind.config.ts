import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#070914",
        panel: "#111525",
        panel2: "#161b2d",
        line: "#242a42",
        brand: "#ef2f9a",
        lime: "#82e500",
        violet: "#6d5dfc",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(239,47,154,.18), 0 18px 50px rgba(0,0,0,.35)",
      },
    },
  },
  plugins: [],
};

export default config;
