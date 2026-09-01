import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const specification = readFileSync('docs/mvp-specification.md', 'utf8');
const normativeIds = [...specification.matchAll(/^\| `(MVP-[A-Z]+-\d{3})`/gm)].map(
  (match) => match[1]
);
const trace = JSON.parse(readFileSync('traceability/mvp.json', 'utf8'));
const mappings = trace.requirements ?? [];
const mappedIds = mappings.map((entry) => entry.id);

function duplicateCount(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.values()]
    .filter((count) => count > 1)
    .reduce((sum, count) => sum + count - 1, 0);
}

const normativeSet = new Set(normativeIds);
const mappedSet = new Set(mappedIds);
const missing = [...normativeSet].filter((id) => !mappedSet.has(id));
const extra = [...mappedSet].filter((id) => !normativeSet.has(id));
const duplicate = duplicateCount(normativeIds) + duplicateCount(mappedIds);

for (const entry of mappings) {
  if (!['planned', 'partial', 'implemented'].includes(entry.status)) {
    throw new Error(`${entry.id} has invalid status ${entry.status}`);
  }

  if (!Array.isArray(entry.workPaths) || entry.workPaths.length === 0) {
    throw new Error(`${entry.id} has no work paths`);
  }

  if (!Array.isArray(entry.proofPaths) || entry.proofPaths.length === 0) {
    throw new Error(`${entry.id} has no proof paths`);
  }

  if (entry.status !== 'planned') {
    for (const path of [...entry.workPaths, ...entry.proofPaths]) {
      if (!existsSync(path)) throw new Error(`${entry.id} maps missing path ${path}`);
    }

    for (const path of entry.proofPaths) {
      if (statSync(path).isFile() && !readFileSync(path, 'utf8').includes(entry.id)) {
        throw new Error(`${entry.id} is absent from proof ${path}`);
      }
    }
  }
}

const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.svelte',
  '.ts',
  '.yaml',
  '.yml'
]);
const taggedRoots = ['src', 'tests', 'evidence'];
const taggedFiles = [];

function collectTextFiles(path) {
  if (!existsSync(path)) return;
  const entry = statSync(path);
  if (entry.isDirectory()) {
    for (const child of readdirSync(path)) collectTextFiles(join(path, child));
    return;
  }

  if (textExtensions.has(extname(path))) taggedFiles.push(path);
}

for (const root of taggedRoots) collectTextFiles(root);

const orphaned = new Set();
for (const path of taggedFiles) {
  const contents = readFileSync(path, 'utf8');
  for (const match of contents.matchAll(/MVP-[A-Z]+-\d{3}/g)) {
    if (!mappedSet.has(match[0])) orphaned.add(match[0]);
  }
}

if (missing.length || extra.length || duplicate || orphaned.size) {
  throw new Error(
    `Trace mismatch: missing=${missing.join(',') || 'none'} extra=${extra.join(',') || 'none'} duplicate=${duplicate} orphaned=${[...orphaned].join(',') || 'none'}`
  );
}

console.log(
  `${normativeIds.length} normative IDs; ${mappings.length} mappings; 0 missing; 0 extra; 0 duplicate; 0 orphaned tags`
);
