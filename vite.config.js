import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes the built site work from any sub-path (GitHub Pages, an
// internal file share, a public domain) with no rebuild or config change.
export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    include: ['tests/**/*.test.{js,jsx}'],
    environment: 'node',
  },
});
