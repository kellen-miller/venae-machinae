import { spawnSync } from 'node:child_process';

const options = process.argv.slice(2).filter((argument) => argument !== '--');
const supportedOptions = new Set(['--ci-smoke', '--local-smoke']);
const unknownOptions = options.filter((option) => !supportedOptions.has(option));
if (unknownOptions.length > 0) {
  throw new Error(`Unknown capacity gate option(s): ${unknownOptions.join(', ')}`);
}

function run(command, args) {
  const result = spawnSync(command, args, { env: process.env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('pnpm', [
  'exec',
  'vitest',
  'run',
  '--config',
  'vitest.config.ts',
  'tests/gates/graph-capacity.spec.ts'
]);
run('pnpm', [
  'exec',
  'playwright',
  'test',
  'tests/gates/graph-capacity-browser.spec.ts',
  '--project=chromium'
]);

if (!options.includes('--ci-smoke') && !options.includes('--local-smoke')) {
  run('node', ['scripts/check-gate-evidence.mjs', 'MVP-GATE-002']);
}
