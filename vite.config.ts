import { sveltekit } from '@sveltejs/kit/vite';
import svelteOptions from './svelte-options.js';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit(svelteOptions)],
  server: {
    host: 'localhost',
    port: 4173,
    strictPort: true
  },
  preview: {
    host: 'localhost',
    port: 4173,
    strictPort: true
  }
});
