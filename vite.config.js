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
    // The slowest tests (the break-even search, the preview smoke test) take 4–5 s with the
    // whole suite running on the Windows laptop, right at Vitest's 5 s default.
    testTimeout: 20000,
    // One worker per test file by default ran the Windows laptop out of memory (workers aborted
    // with exit code 134). Four at a time runs the whole suite reliably and about as fast.
    maxWorkers: 4,
  },
});
