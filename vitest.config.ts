import { sveltekit } from '@sveltejs/kit/vite';
import svelteOptions from './svelte-options.js';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit(svelteOptions)],
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
