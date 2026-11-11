import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070914",
        panel: "#111525",
        panel2: "#161b2d",
        line: "#242a42",
        brand: "#ef2f9a",
        lime: "#82e500",
        muted: "#969db4",
      },
    },
  },
  plugins: [],
};

export default config;
