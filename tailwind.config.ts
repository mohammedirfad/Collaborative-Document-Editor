import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17212b",
        mist: "#eef2f7",
        cedar: "#0f766e",
        coral: "#d95b43",
        saffron: "#e8a321"
      },
      boxShadow: {
        soft: "0 16px 48px rgba(23, 33, 43, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
