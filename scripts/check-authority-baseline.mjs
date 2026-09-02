import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const specificationCommit = '63340c128589054307c04a3eeea47e453592f625';
const authorityCommits = [
  ['wiring vocabulary', '086e59f3331228300d38accbef182cd8d93dda60'],
  ['fluid vocabulary', '11d5338e3a3b545b45c69f113b728eeb988444bf'],
  ['Operating State vocabulary', '062c1f1b38e5926aa8bb3a5ba357b9e48493ac95'],
  ['persistence vocabulary', '80644232a74ab9f6686d335b9edb9299f376bfaf'],
  ['validation vocabulary', '149be4d282cfbd14194c3b043c448695146c4ae8'],
  ['application architecture', '53b00d1c96bb86fb888e4f320e73b18f0548c0cf'],
  ['MVP specification', specificationCommit]
];

const normativeFiles = [
  'CONTEXT.md',
  'docs/mvp-specification.md',
  'docs/adr/0001-local-first-sveltekit-architecture.md'
];

for (const [name, commit] of authorityCommits) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', commit, 'HEAD'], { stdio: 'ignore' });
  } catch {
    throw new Error(`HEAD does not contain the required ${name} commit ${commit}`);
  }
}

for (const path of normativeFiles) {
  readFileSync(path, 'utf8');
}

const adr = readFileSync('docs/adr/0001-local-first-sveltekit-architecture.md', 'utf8');
if (!/^- Status: Accepted$/m.test(adr)) {
  throw new Error('ADR 0001 is not Accepted');
}

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const evidence = `# Authority baseline\n\nMVP-HANDOFF-001\n\n- Verified HEAD: \`${head}\`\n- Required specification commit: \`${specificationCommit}\`\n- ADR 0001 status: \`Accepted\`\n- Normative files: \`${normativeFiles.join('`, `')}\`\n- Authority commits:\n${authorityCommits.map(([name, commit]) => `  - ${name}: \`${commit}\``).join('\n')}\n\nCommand: \`pnpm authority:check\`\nResult: Pass\n`;

const evidencePath = 'evidence/traceability/authority-baseline.md';
mkdirSync('evidence/traceability', { recursive: true });

let current;
try {
  current = readFileSync(evidencePath, 'utf8');
} catch {
  current = undefined;
}

if (current !== evidence) {
  writeFileSync(evidencePath, evidence);
}

console.log(`Authority baseline: ${authorityCommits.length} commits; ADR Accepted; Pass`);
