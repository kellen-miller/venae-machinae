import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

import svelteConfig from './svelte.config.js';

const pureDomainFiles = [
  'src/lib/project/**/*.{js,ts}',
  'src/lib/topology/**/*.{js,ts}',
  'src/lib/electrical/**/*.{js,ts}',
  'src/lib/fluid/**/*.{js,ts}',
  'src/lib/evidence/**/*.{js,ts}',
  'src/lib/version/**/*.{js,ts}',
  'src/lib/operating-state/**/*.{js,ts}',
  'src/lib/calculation/**/*.{js,ts}',
  'src/lib/validation/**/*.{js,ts}',
  'src/lib/build/**/*.{js,ts}'
];

export default defineConfig(
  {
    ignores: [
      '.agent/**',
      '.svelte-kit/**',
      'build/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**'
    ]
  },
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig
      }
    }
  },
  {
    files: ['src/**/*.{js,svelte,ts}'],
    ignores: ['src/lib/renderer/xyflow/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@xyflow/svelte',
              message: 'Renderer-library imports belong only in src/lib/renderer/xyflow.'
            }
          ]
        }
      ]
    }
  },
  {
    files: pureDomainFiles,
    rules: {
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'indexedDB',
          'localStorage',
          'sessionStorage',
          'Worker',
          'BroadcastChannel',
          'WebSocket',
          'fetch',
          'crypto',
          'process',
          'Buffer',
          'setTimeout',
          'clearTimeout',
          'requestAnimationFrame',
          'structuredClone'
        ].map((name) => ({
          name,
          message: 'Pure domain modules cannot depend on browser, worker, or Node globals.'
        }))
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@xyflow/svelte',
              message: 'Renderer-library imports belong only in src/lib/renderer/xyflow.'
            }
          ],
          patterns: [
            {
              group: [
                '$app/*',
                '$env/*',
                '$lib/composition/*',
                '$lib/evaluation/*',
                '$lib/exchange/*',
                '$lib/persistence/*',
                '$lib/presentation/*',
                '$lib/renderer/*',
                '$lib/reporting/*',
                '$lib/session/*',
                '**/composition/**',
                '**/evaluation/**',
                '**/exchange/**',
                '**/persistence/**',
                '**/presentation/**',
                '**/renderer/**',
                '**/reporting/**',
                '**/session/**',
                '@sveltejs/*',
                'node:*',
                'svelte',
                'svelte/*'
              ],
              message:
                'Pure domain modules cannot depend on framework, browser-adapter, worker, renderer, or server code.'
            }
          ]
        }
      ]
    }
  },
  prettier
);
