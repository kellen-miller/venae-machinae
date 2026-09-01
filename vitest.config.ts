import { sveltekit } from '@sveltejs/kit/vite';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    conditions: ['browser']
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, 'tests/**/*-browser.spec.ts'],
    setupFiles: ['./vitest.setup.ts']
  }
});
