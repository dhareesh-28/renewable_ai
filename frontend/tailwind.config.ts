import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        raised: 'var(--color-raised)',
        hairline: 'var(--color-hairline)',
        ink: 'var(--color-ink)',
        muted: 'var(--color-muted)',
        moss: {
          DEFAULT: 'var(--color-moss)',
          text: 'var(--color-moss-text)',
        },
        brass: {
          rule: 'var(--color-brass-rule)',
          text: 'var(--color-brass-text)',
        },
        solar: 'var(--color-solar)',
        battery: 'var(--color-battery)',
        grid: 'var(--color-grid)',
        load: 'var(--color-load)',
        fault: 'var(--color-fault)',
        forecast: 'var(--color-forecast)',
      },
      fontFamily: {
        serif: ['"Bodoni Moda Variable"', '"Bodoni Moda"', 'Georgia', 'serif'],
        sans: ['"Inter Variable"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        wordmark: ['clamp(120px, 18vw, 280px)', { lineHeight: '0.85', letterSpacing: '-0.02em' }],
        display: ['88px', { lineHeight: '0.95', letterSpacing: '-0.015em' }],
        h1: ['64px', { lineHeight: '1.05', letterSpacing: '-0.01em' }],
        h2: ['44px', { lineHeight: '1.1', letterSpacing: '-0.005em' }],
        h3: ['28px', { lineHeight: '1.2' }],
        body: ['15px', { lineHeight: '1.6' }],
        ui: ['13px', { lineHeight: '1.4' }],
        caption: ['12px', { lineHeight: '1.4' }],
      },
      letterSpacing: {
        label: '0.14em',
      },
      borderRadius: {
        frame: '16px',
        control: '6px',
        image: '2px',
        pill: '9999px',
      },
      maxWidth: {
        container: '1320px',
      },
      transitionTimingFunction: {
        luxury: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        luxury: '800ms',
      },
    },
  },
  plugins: [],
} satisfies Config;

