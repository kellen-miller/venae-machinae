import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';

const packageMetadata = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
);

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    csp: {
      directives: {
        'base-uri': ['self'],
        'connect-src': ['self'],
        'default-src': ['self'],
        'font-src': ['self'],
        'frame-ancestors': ['none'],
        'img-src': ['self', 'blob:', 'data:'],
        'object-src': ['none'],
        'script-src': ['self'],
        'style-src': ['self'],
        'worker-src': ['self', 'blob:']
      }
    },
    version: {
      name: packageMetadata.version
    }
  }
};

export default config;
