import { readFileSync } from 'node:fs';

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
