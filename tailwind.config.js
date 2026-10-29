/** @type {import('tailwindcss').Config} */
export default {
  // relative: resolve globs from this file, not the working directory.
  content: { relative: true, files: ['./index.html', './src/**/*.{ts,tsx}'] },
  theme: {
    extend: {
      // VisionBoard palette tokens (the subset this app uses).
      colors: {
        em: { DEFAULT: '#1a7a4a', mid: '#2a9e62' },
        bg: { base: '#f8f4ec', raised: '#fdfaf3', overlay: '#f0eadd' },
        ink: { DEFAULT: '#1c1a17', mid: '#4a4540', muted: '#8a8278' },
        line: '#e2dccf',
        amber: '#d4700a',
        danger: { DEFAULT: '#e02424', dark: '#b91c1c' },
        cream: '#fdfaf3',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      borderRadius: { sm: '8px', md: '12px', lg: '16px' },
      boxShadow: {
        sm: '0 1px 0 rgba(255,255,255,.55) inset, 0 2px 8px rgba(28, 26, 23, 0.06)',
        md: '0 1px 0 rgba(255,255,255,.55) inset, 0 6px 22px rgba(28, 26, 23, 0.07)',
        lg: '0 1px 0 rgba(255,255,255,.6) inset, 0 18px 48px rgba(28, 26, 23, 0.10)',
      },
    },
  },
  plugins: [],
};
