import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ["'Lilita One'", 'cursive'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "wallet-open": {
          "0%": { transform: "scale(1) rotateY(0deg)" },
          "25%": { transform: "scale(1.1) rotateY(-10deg)" },
          "50%": { transform: "scale(1.2) rotateY(0deg)" },
          "75%": { transform: "scale(1.1) rotateY(10deg)" },
          "100%": { transform: "scale(1) rotateY(0deg)" },
        },
        "clap": {
          "0%, 100%": { transform: "rotate(0deg) scale(1)" },
          "25%": { transform: "rotate(-15deg) scale(1.1)" },
          "50%": { transform: "rotate(0deg) scale(1.2)" },
          "75%": { transform: "rotate(15deg) scale(1.1)" },
        },
        "play-pulse": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.3)", opacity: "0.8" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "crown-bounce": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "25%": { transform: "translateY(-4px) rotate(-5deg)" },
          "50%": { transform: "translateY(-6px) rotate(0deg)" },
          "75%": { transform: "translateY(-4px) rotate(5deg)" },
        },
        "shield-pulse": {
          "0%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(59, 130, 246, 0.4)" },
          "50%": { transform: "scale(1.15)", boxShadow: "0 0 0 6px rgba(59, 130, 246, 0)" },
          "100%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(59, 130, 246, 0)" },
        },
        "user-wave": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "20%": { transform: "rotate(10deg)" },
          "40%": { transform: "rotate(-10deg)" },
          "60%": { transform: "rotate(10deg)" },
          "80%": { transform: "rotate(-10deg)" },
        },
        "users-gather": {
          "0%": { transform: "scale(1)" },
          "25%": { transform: "scale(1.1) translateX(-2px)" },
          "50%": { transform: "scale(1.2)" },
          "75%": { transform: "scale(1.1) translateX(2px)" },
          "100%": { transform: "scale(1)" },
        },
        "book-flip": {
          "0%": { transform: "rotateY(0deg) scale(1)" },
          "50%": { transform: "rotateY(180deg) scale(1.1)" },
          "100%": { transform: "rotateY(360deg) scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "wallet-open": "wallet-open 0.6s ease-in-out 3",
        "clap": "clap 0.5s ease-in-out 4",
        "play-pulse": "play-pulse 0.8s ease-in-out 3",
        "crown-bounce": "crown-bounce 0.6s ease-in-out 3",
        "shield-pulse": "shield-pulse 0.8s ease-in-out 3",
        "user-wave": "user-wave 0.6s ease-in-out 3",
        "users-gather": "users-gather 0.6s ease-in-out 3",
        "book-flip": "book-flip 0.8s ease-in-out 3",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
