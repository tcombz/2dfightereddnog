import { defineConfig } from 'vitest/config';

/** A stamp for this build (UTC month-day hour-minute): shown on the TV and phones, and put in the
 * phones' join address so a phone never opens an old copy of the page from its cache. */
const BUILD = new Date().toISOString().slice(5, 16).replace(/[-:T]/g, '');

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  define: { __BUILD__: JSON.stringify(BUILD) },
  test: { include: ['tests/**/*.test.ts'] },
});
