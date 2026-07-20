import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        tint: 'var(--tint)',
        'tint-2': 'var(--tint-2)',
        border: 'var(--border)',
        'border-2': 'var(--border-2)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        'ink-4': 'var(--ink-4)',
        brand: 'var(--brand)',
        'brand-2': 'var(--brand-2)',
        'brand-3': 'var(--brand-3)',
        moss: 'var(--moss)',
        'moss-2': 'var(--moss-2)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        serif: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
      },
      boxShadow: {
        '1': 'var(--shadow-1)',
        '2': 'var(--shadow-2)',
        '3': 'var(--shadow-3)',
      },
      transitionTimingFunction: {
        'brand-out':    'cubic-bezier(0.23, 1, 0.32, 1)',
        'brand-in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        'drawer':       'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
