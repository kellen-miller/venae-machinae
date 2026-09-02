import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const roots = ['src'];
const extensions = new Set(['.html', '.js', '.json', '.svelte', '.ts']);
const prohibited = [
  /\b(?:project|vehicle|design|candidate|installation)\s+(?:is|looks|appears)\s+(?:safe|ready|suitable|correct|complete|healthy|certified)\b/i,
  /\bproject health\b/i,
  /\bsafety score\b/i,
  /\breadiness score\b/i
];
const findings = [];

function scan(path) {
  if (!existsSync(path)) return;
  if (statSync(path).isDirectory()) {
    for (const child of readdirSync(path)) scan(join(path, child));
    return;
  }

  if (!extensions.has(extname(path))) return;
  const contents = readFileSync(path, 'utf8');
  for (const pattern of prohibited) {
    if (pattern.test(contents)) findings.push(`${path}: ${pattern}`);
  }
}

for (const root of roots) scan(root);
if (findings.length) throw new Error(`Prohibited aggregate claims:\n${findings.join('\n')}`);
console.log('Prohibited aggregate claims: 0');
