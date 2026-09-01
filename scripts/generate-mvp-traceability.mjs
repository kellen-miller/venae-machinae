import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const specification = readFileSync('docs/mvp-specification.md', 'utf8');
const normativeIds = [...specification.matchAll(/^\| `(MVP-[A-Z]+-\d{3})`/gm)].map(
  (match) => match[1]
);

function ids(prefix, values) {
  return values.map((value) => `${prefix}-${String(value).padStart(3, '0')}`);
}

const proof = new Map();

function mapProof(requirementIds, milestone, proofPaths) {
  for (const id of requirementIds) {
    proof.set(id, { milestone, proofPaths });
  }
}

mapProof(ids('MVP-PROD', [1]), 7, ['tests/e2e/network-independent.spec.ts']);
mapProof(ids('MVP-PROD', [2, 4]), 2, ['tests/domain/project.spec.ts']);
mapProof(ids('MVP-PROD', [3]), 2, ['tests/e2e/projection-revision.spec.ts']);
mapProof(ids('MVP-PROD', [5]), 7, ['tests/content/prohibited-claims.spec.ts']);
mapProof(ids('MVP-MODEL', [1, 2, 3, 6, 8, 9]), 2, ['tests/domain/topology.spec.ts']);
mapProof(ids('MVP-MODEL', [4, 5]), 2, ['tests/domain/project.spec.ts']);
mapProof(ids('MVP-MODEL', [7]), 3, ['tests/domain/routing.spec.ts']);
mapProof(ids('MVP-UX', [1, 2, 3, 4, 5]), 3, ['tests/e2e/workspace.spec.ts']);
mapProof(ids('MVP-UX', [6, 7]), 3, ['tests/e2e/visual-language.spec.ts']);
mapProof(ids('MVP-UX', [8, 9, 10]), 3, ['tests/e2e/project-library.spec.ts']);
mapProof(ids('MVP-UX', [11, 12]), 3, ['tests/e2e/action-equivalence.spec.ts']);
mapProof(ids('MVP-UX', [13]), 7, ['tests/component/contextual-help.spec.ts']);
mapProof(ids('MVP-ELEC', [1, 2, 3, 4, 5, 6, 7, 8, 9, 13]), 3, ['tests/domain/electrical.spec.ts']);
mapProof(ids('MVP-ELEC', [10, 11, 12]), 4, ['tests/domain/electrical-calculation.spec.ts']);
mapProof(ids('MVP-ELEC', [14]), 6, ['tests/e2e/electrical-output.spec.ts']);
mapProof(ids('MVP-FLUID', [1, 2, 3, 4, 5]), 3, ['tests/domain/fluid.spec.ts']);
mapProof(ids('MVP-FLUID', [6, 7, 8, 9, 10, 11, 12, 13]), 4, [
  'tests/domain/fluid-calculation.spec.ts'
]);
mapProof(ids('MVP-FLUID', [14]), 6, [
  'tests/e2e/fuel-boundary.spec.ts',
  'tests/e2e/rx7-screening.spec.ts',
  'tests/e2e/fluid-output.spec.ts'
]);
mapProof(ids('MVP-FLUID', [15]), 6, ['tests/e2e/fluid-output.spec.ts']);
mapProof(ids('MVP-STATE', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]), 4, [
  'tests/e2e/operating-state-overlay.spec.ts'
]);
mapProof(ids('MVP-CALC', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 4, ['tests/domain/calculation.spec.ts']);
mapProof(ids('MVP-VAL', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]), 4, [
  'tests/domain/validation.spec.ts'
]);
mapProof(ids('MVP-BUILD', [1, 2, 3]), 6, ['tests/domain/build-record.spec.ts']);
mapProof(ids('MVP-BUILD', [4, 5, 6, 7]), 6, ['tests/e2e/reporting.spec.ts']);
mapProof(ids('MVP-DATA', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 17, 19]), 5, [
  'tests/e2e/project-library-lifecycle.spec.ts'
]);
mapProof(ids('MVP-DATA', [11, 12, 13, 14, 15, 16]), 5, ['tests/e2e/exchange.spec.ts']);
mapProof(ids('MVP-DATA', [18]), 6, ['tests/e2e/output-revision.spec.ts']);
mapProof(ids('MVP-ARCH', [1]), 0, ['tests/security/dependency-boundaries.spec.ts']);
mapProof(ids('MVP-ARCH', [2, 3, 4]), 2, ['tests/security/dependency-boundaries.spec.ts']);
mapProof(ids('MVP-ARCH', [5]), 7, ['tests/e2e/server-boundary.spec.ts']);
mapProof(ids('MVP-ARCH', [6, 7, 8, 9]), 7, ['tests/e2e/delivery-security.spec.ts']);
mapProof(ids('MVP-ARCH', [10]), 1, ['tests/gates/renderer-fit.spec.ts']);
mapProof(ids('MVP-NFR', [1, 2, 3, 4, 5]), 7, ['tests/e2e/platform-accessibility.spec.ts']);
mapProof(ids('MVP-NFR', [6, 7]), 1, ['tests/gates/graph-capacity.spec.ts']);

for (let number = 1; number <= 7; number += 1) {
  const id = `MVP-GATE-${String(number).padStart(3, '0')}`;
  mapProof([id], 1, [`evidence/gates/${id}.md`]);
}

mapProof(ids('MVP-ACC', [1, 2, 3, 4]), 6, ['tests/e2e/rx7-construction.spec.ts']);
mapProof(ids('MVP-ACC', [5]), 6, ['tests/e2e/rx7-states.spec.ts']);
mapProof(ids('MVP-ACC', [6]), 6, ['tests/e2e/rx7-calculations.spec.ts']);
mapProof(ids('MVP-ACC', [7]), 6, ['tests/e2e/rx7-screening.spec.ts']);
mapProof(ids('MVP-ACC', [8]), 6, ['tests/e2e/rx7-validation.spec.ts']);
mapProof(ids('MVP-ACC', [9]), 6, ['tests/e2e/rx7-views-output.spec.ts']);
mapProof(ids('MVP-ACC', [10]), 6, ['tests/e2e/rx7-as-built.spec.ts']);
mapProof(ids('MVP-ACC', [11]), 6, ['tests/e2e/rx7-persistence.spec.ts']);
mapProof(ids('MVP-ACC', [12]), 6, ['tests/e2e/rx7-exchange.spec.ts']);
mapProof(ids('MVP-ACC', [13]), 6, ['tests/e2e/rx7-library-backup.spec.ts']);
mapProof(ids('MVP-ACC', [14]), 6, ['tests/e2e/rx7-output.spec.ts']);
mapProof(ids('MVP-ACC', [15]), 7, ['tests/e2e/rx7-platform.spec.ts']);
mapProof(ids('MVP-ACC', [16]), 7, ['tests/e2e/rx7-network-server-loss.spec.ts']);
mapProof(ids('MVP-ACC', [17]), 7, ['evidence/platform/acceptance-matrix.md']);
mapProof(ids('MVP-ACC', [18]), 8, ['tests/e2e/rx7-round-trip.spec.ts']);
mapProof(ids('MVP-HANDOFF', [1]), 0, ['evidence/traceability/authority-baseline.md']);
mapProof(ids('MVP-HANDOFF', [2]), 8, ['evidence/traceability/mvp-trace.json']);

const familyWorkPaths = {
  PROD: ['src/lib/project/project.ts', 'src/lib/session/project-session.svelte.ts'],
  MODEL: ['src/lib/project/apply-action.ts', 'src/lib/topology/topology.ts'],
  UX: ['src/lib/presentation/workspace/ProjectWorkspace.svelte', 'src/lib/renderer/projection.ts'],
  ELEC: ['src/lib/electrical/electrical.ts'],
  FLUID: ['src/lib/fluid/fluid.ts'],
  STATE: ['src/lib/operating-state/evaluate-overlay.ts'],
  CALC: ['src/lib/calculation/evaluate-calculation.ts'],
  VAL: ['src/lib/validation/evaluate-validation.ts'],
  BUILD: ['src/lib/build/build-record.ts', 'src/lib/reporting/generate-output.ts'],
  DATA: ['src/lib/persistence/project-library.ts', 'src/lib/exchange/stage-exchange.ts'],
  ARCH: ['src/lib/composition/create-browser-application.ts'],
  NFR: ['src/lib/presentation/workspace/ProjectWorkspace.svelte'],
  GATE: ['evidence/gates'],
  ACC: ['src/lib/reference/rx7-example.v1.venae.json'],
  HANDOFF: ['scripts/check-authority-baseline.mjs', 'scripts/check-mvp-traceability.mjs']
};

function commandFor(proofPaths) {
  const first = proofPaths[0];
  if (first.startsWith('tests/e2e/')) return 'pnpm test:e2e';
  if (first.startsWith('tests/component/')) return 'pnpm test:component';
  if (first.startsWith('tests/gates/')) return 'pnpm gate:all';
  if (first.startsWith('tests/security/')) return 'pnpm test:security';
  if (first.startsWith('tests/content/')) return 'pnpm test:unit';
  if (first.startsWith('tests/domain/')) return 'pnpm test:unit';
  if (first.includes('authority-baseline')) return 'pnpm authority:check';
  if (first.includes('mvp-trace')) return 'pnpm traceability';
  return 'manual evidence review';
}

const requirements = normativeIds.map((id) => {
  const mapping = proof.get(id);
  if (!mapping) throw new Error(`No plan mapping for ${id}`);

  const family = id.split('-')[1];
  const workPaths = familyWorkPaths[family];
  if (!workPaths) throw new Error(`No work-path mapping for ${id}`);

  return {
    id,
    milestone: mapping.milestone,
    status: 'planned',
    workPaths,
    proofPaths: mapping.proofPaths,
    command: commandFor(mapping.proofPaths)
  };
});

if (requirements.length !== 163 || proof.size !== 163) {
  throw new Error(
    `Expected 163 mappings, got ${requirements.length} from spec and ${proof.size} from plan`
  );
}

mkdirSync('traceability', { recursive: true });
writeFileSync(
  'traceability/mvp.json',
  `${JSON.stringify(
    {
      schemaVersion: 1,
      normativeSource: 'docs/mvp-specification.md',
      generatedBy: 'scripts/generate-mvp-traceability.mjs',
      requirements
    },
    null,
    2
  )}\n`
);

console.log(`Generated ${requirements.length} planned MVP mappings`);
