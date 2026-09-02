import { readFileSync } from 'node:fs';

const packageMetadata = JSON.parse(readFileSync('package.json', 'utf8'));
const selected = {
  ...packageMetadata.dependencies,
  ...packageMetadata.devDependencies
};
const prohibited = [
  'react',
  'react-dom',
  '@xyflow/react',
  'tailwindcss',
  'dexie',
  'mathjs',
  'svelte-konva',
  'konva'
];
const present = prohibited.filter((name) => name in selected);

if (present.length) throw new Error(`Prohibited direct dependencies: ${present.join(', ')}`);
if (packageMetadata.packageManager !== 'pnpm@11.25.0') {
  throw new Error(`Unexpected package manager pin ${packageMetadata.packageManager}`);
}

for (const [name, version] of Object.entries(selected)) {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`${name} is not pinned to an exact version: ${version}`);
  }
}

console.log(`Direct dependencies: ${Object.keys(selected).length} exact pins; prohibited: 0`);
