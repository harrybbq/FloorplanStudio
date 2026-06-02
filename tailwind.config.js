/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // VisionBoard palette tokens, mirrored
        em: {
          DEFAULT: '#1a7a4a',
          mid: '#2a9e62',
          light: '#4dc485',
        },
        bg: {
          base: '#f8f4ec',
          raised: '#fdfaf3',
          overlay: '#f0eadd',
          deep: '#fdfaf3',
        },
        ink: {
          DEFAULT: '#1c1a17',
          mid: '#4a4540',
          muted: '#8a8278',
        },
        line: {
          DEFAULT: '#e2dccf',
          light: '#efe9dc',
        },
        gold: {
          DEFAULT: '#c8970a',
          light: '#e8b830',
        },
        amber: '#d4700a',
        cream: '#fdfaf3',
        brown: {
          DEFAULT: '#8b7355',
          light: '#b09a7a',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(28, 26, 23, 0.05)',
        sm: '0 1px 0 rgba(255,255,255,.55) inset, 0 2px 8px rgba(28, 26, 23, 0.06)',
        md: '0 1px 0 rgba(255,255,255,.55) inset, 0 6px 22px rgba(28, 26, 23, 0.07)',
        lg: '0 1px 0 rgba(255,255,255,.6) inset, 0 18px 48px rgba(28, 26, 23, 0.10)',
      },
    },
  },
  plugins: [],
};
