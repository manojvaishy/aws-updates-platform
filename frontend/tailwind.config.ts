import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Mobile-first: all base styles target mobile, use sm/md/lg/xl for larger screens
  theme: {
    // Override default screens to enforce mobile-first breakpoints
    screens: {
      sm: "640px",   // large phones / small tablets
      md: "768px",   // tablets
      lg: "1024px",  // laptops
      xl: "1280px",  // desktops
      "2xl": "1536px",
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Priority color tokens
        priority: {
          critical: "#ef4444", // red-500
          high: "#f97316",     // orange-500
          normal: "#6b7280",   // gray-500
        },
        brand: {
          DEFAULT: "#FF9900", // AWS orange
          dark: "#232F3E",    // AWS dark navy
        },
      },
      // Minimum tap target size for mobile (44x44px per accessibility guidelines)
      minHeight: {
        tap: "44px",
      },
      minWidth: {
        tap: "44px",
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom)", // iPhone notch support
      },
    },
  },
  plugins: [],
};

export default config;
