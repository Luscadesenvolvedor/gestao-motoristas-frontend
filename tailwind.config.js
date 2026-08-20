/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  corePlugins: { preflight: false }, // evita reset que afetaria páginas existentes
  theme: {
    extend: {
      colors: {
        background: 'var(--tw-bg)',
        foreground: 'var(--tw-fg)',
        card:       'var(--tw-card)',
        border:     'var(--tw-border)',
        secondary:  'var(--tw-secondary)',
        muted:      'var(--tw-muted)',
      },
      textColor: {
        foreground:         'var(--tw-fg)',
        'muted-foreground': 'var(--tw-muted-fg)',
      },
    },
  },
  plugins: [],
};
