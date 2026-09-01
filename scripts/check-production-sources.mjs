import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

const violations = [];
const genericSegments = new Set(['common', 'helper', 'helpers', 'util', 'utils']);
const rendererCandidates = ['canvas', 'svg', 'xyflow'].filter((name) =>
  existsSync(`src/lib/renderer/${name}`)
);

if (existsSync('src/service-worker.ts') || existsSync('src/service-worker.js')) {
  violations.push('service worker source exists');
}

if (existsSync('src/routes/__gates')) violations.push('temporary gate routes remain');
if (rendererCandidates.length > 1) {
  violations.push(`multiple renderer adapters remain: ${rendererCandidates.join(', ')}`);
}

function inspect(path) {
  if (!existsSync(path)) return;
  if (statSync(path).isDirectory()) {
    const normalized = relative('src', path).split(sep);
    if (normalized.some((segment) => genericSegments.has(segment))) {
      violations.push(`${path}: generic package/directory name`);
    }

    for (const child of readdirSync(path)) inspect(join(path, child));
    return;
  }

  if (!['.js', '.mjs', '.svelte', '.ts'].includes(extname(path))) return;
  const contents = readFileSync(path, 'utf8');
  if (contents.includes('@xyflow/svelte') && !path.startsWith('src/lib/renderer/xyflow/')) {
    violations.push(`${path}: renderer dependency escaped the xyflow adapter`);
  }
}

inspect('src');
if (violations.length) throw new Error(`Production source violations:\n${violations.join('\n')}`);
console.log('Production source scan: Pass');
