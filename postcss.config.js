import { fileURLToPath } from 'node:url';

export default {
  plugins: {
    // Explicit path so the build works no matter which directory Vite is started from.
    tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.js', import.meta.url)) },
    autoprefixer: {},
  },
};
