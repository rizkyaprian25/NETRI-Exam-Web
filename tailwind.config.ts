import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--netri-color-bg)',
        surface: 'var(--netri-color-surface)',
        'surface-raised': 'var(--netri-color-surface-raised)',
        border: 'var(--netri-color-border)',
        'text-primary': 'var(--netri-color-text-primary)',
        'text-secondary': 'var(--netri-color-text-secondary)',
        brand: 'var(--netri-color-brand)',
        'brand-surface': 'var(--netri-color-brand-surface)',
        success: 'var(--netri-color-state-success)',
        warning: 'var(--netri-color-state-warning)',
        danger: 'var(--netri-color-state-danger)',
      },
      borderRadius: {
        sm: 'var(--netri-radius-sm)',
        md: 'var(--netri-radius-md)',
        lg: 'var(--netri-radius-lg)',
        full: 'var(--netri-radius-full)',
      },
    },
  },
  plugins: [],
};

export default config;
