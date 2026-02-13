/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Backgrounds
        page: 'rgb(var(--color-page) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        elevated: 'rgb(var(--color-elevated) / <alpha-value>)',
        hover: 'rgb(var(--color-hover) / <alpha-value>)',
        // Borders
        edge: 'rgb(var(--color-edge) / <alpha-value>)',
        'edge-strong': 'rgb(var(--color-edge-strong) / <alpha-value>)',
        'edge-accent': 'rgb(var(--color-edge-accent) / <alpha-value>)',
        // Text
        heading: 'rgb(var(--color-heading) / <alpha-value>)',
        body: 'rgb(var(--color-body) / <alpha-value>)',
        label: 'rgb(var(--color-label) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        dim: 'rgb(var(--color-dim) / <alpha-value>)',
        faint: 'rgb(var(--color-faint) / <alpha-value>)',
        // Semantic
        positive: 'rgb(var(--color-positive) / <alpha-value>)',
        negative: 'rgb(var(--color-negative) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-text': 'rgb(var(--color-accent-text) / <alpha-value>)',
        // Special surfaces (opacity baked into the variable)
        'positive-surface': 'var(--surface-positive)',
        'negative-surface': 'var(--surface-negative)',
        'accent-surface': 'var(--surface-accent)',
      },
    },
  },
  plugins: [],
};
