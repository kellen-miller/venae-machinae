import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
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
