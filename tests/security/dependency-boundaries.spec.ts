import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('MVP-ARCH-001 dependency boundary', () => {
  it('uses one exact SvelteKit adapter-node stack without React', () => {
    const packageMetadata = JSON.parse(readFileSync('package.json', 'utf8'));
    const packages = {
      ...packageMetadata.dependencies,
      ...packageMetadata.devDependencies
    };

    expect(packages.svelte).toBe('5.57.0');
    expect(packages['@sveltejs/kit']).toBe('2.70.3');
    expect(packages['@sveltejs/adapter-node']).toBe('5.5.7');
    expect(packages.react).toBeUndefined();
    expect(packages['react-dom']).toBeUndefined();
    expect(packages['@xyflow/react']).toBeUndefined();
  });
});

describe('MVP-ARCH-002 browser-local project authority', () => {
  it('keeps server routes delivery-only and opens project authority in the browser', () => {
    const serverRoutes = readdirSync('src/routes', { recursive: true })
      .map(String)
      .filter((path) => path.endsWith('+server.ts'))
      .sort();

    expect(serverRoutes).toEqual(['health/+server.ts', 'version/+server.ts']);
    for (const route of serverRoutes) {
      expect(readFileSync(join('src/routes', route), 'utf8')).not.toMatch(
        /Project|IndexedDB|indexedDB|calculation|validation|exchange/
      );
    }

    const composition = readFileSync('src/lib/composition/create-browser-application.ts', 'utf8');
    expect(composition).toContain('openProjectLibrary()');
    expect(composition).not.toMatch(/fetch\(|form action|remote function/);
  });
});

describe('MVP-ARCH-003 dependency direction', () => {
  it('keeps domain code pure and browser effects in owned adapters', () => {
    const pureDirectories = [
      'project',
      'topology',
      'electrical',
      'fluid',
      'evidence',
      'version',
      'operating-state',
      'calculation',
      'validation',
      'build'
    ];
    const pureSources = pureDirectories.flatMap((directory) => {
      const path = join('src/lib', directory);
      if (!existsSync(path)) return [];
      return readdirSync(path, { recursive: true })
        .map(String)
        .filter((file) => file.endsWith('.ts'))
        .map((file) => readFileSync(join(path, file), 'utf8'));
    });

    expect(pureSources.join('\n')).not.toMatch(
      /(?:from|import)\s*\(?['"](?:svelte|@sveltejs\/|node:|\$app\/|\$env\/)/
    );
    expect(pureSources.join('\n')).not.toMatch(
      /(?:from|import)\s*\(?['"][^'"]*(?:composition|evaluation|exchange|persistence|presentation|renderer|reporting|session)\//
    );
    expect(pureSources.join('\n')).not.toMatch(
      /\b(?:window|document|navigator|indexedDB|Worker|BroadcastChannel|process|Buffer)\b/
    );

    const sessionSources = readdirSync('src/lib/session')
      .filter((file) => file.endsWith('.ts'))
      .map((file) => readFileSync(join('src/lib/session', file), 'utf8'))
      .join('\n');
    expect(sessionSources).not.toMatch(/from ['"]\.\.\/(?:persistence|evaluation|renderer)\//);
  });

  it('has one composition root and one Project Session mutation executor', () => {
    expect(readdirSync('src/lib/composition').sort()).toEqual(['create-browser-application.ts']);
    const session = readFileSync('src/lib/session/project-session.svelte.ts', 'utf8');
    expect(session.match(/applyProjectAction\(/g)).toHaveLength(2);
    expect(session).toContain('function execute(action: ProjectAction)');
  });
});

describe('MVP-ARCH-004 typed runtime boundaries', () => {
  it('owns validation, decimal, worker, locking, and renderer boundaries explicitly', () => {
    expect(readFileSync('src/lib/persistence/project-document.ts', 'utf8')).toContain(
      'projectDocumentSchema'
    );
    expect(readFileSync('src/lib/evaluation/protocol.ts', 'utf8')).toContain('workerRequestSchema');
    expect(readFileSync('src/lib/calculation/quantity.ts', 'utf8')).toContain('Decimal');
    expect(readFileSync('src/lib/persistence/project-lease.ts', 'utf8')).toContain(
      'navigator.locks.request'
    );
    expect(readFileSync('src/lib/renderer/projection.ts', 'utf8')).toContain(
      'export type RendererProjection'
    );
    expect(
      readdirSync('src/lib/project')
        .map((file) => readFileSync(join('src/lib/project', file), 'utf8'))
        .join('\n')
    ).not.toContain('Renderer');
  });
});

describe('MVP-HANDOFF-002 pinned CI acceptance', () => {
  it('runs each production browser in an isolated Playwright lifecycle', () => {
    const packageMetadata = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageMetadata.scripts['test:e2e']).toBe(
      'playwright test tests/e2e --project=chromium && playwright test tests/e2e --project=firefox && playwright test tests/e2e --project=webkit'
    );
  });

  it('runs the complete final repository gate and every non-capacity evidence gate', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    for (const command of [
      'pnpm install --frozen-lockfile',
      'pnpm format:check',
      'pnpm lint',
      'pnpm check',
      'pnpm test:unit',
      'pnpm test:property',
      'pnpm test:migration',
      'pnpm test:component',
      'pnpm test:exchange',
      'pnpm build',
      'pnpm test:e2e',
      'pnpm test:security',
      'pnpm test:accessibility',
      'pnpm test:visual',
      'pnpm bundle:check',
      'pnpm gate:numeric',
      'pnpm gate:persistence',
      'pnpm gate:storage-lifecycle',
      'pnpm gate:worker',
      'pnpm gate:exchange',
      'pnpm gate:renderer',
      'pnpm traceability',
      'pnpm verify'
    ]) {
      expect(workflow).toContain(command);
    }
    expect(workflow).not.toContain('pnpm gate:capacity');
    expect(workflow).not.toContain('pnpm gate:all');
  });
});
