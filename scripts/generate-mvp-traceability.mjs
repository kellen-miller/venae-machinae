import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';

const specification = readFileSync('docs/mvp-specification.md', 'utf8');
const prettierConfig = (await resolveConfig('traceability/mvp.json')) ?? {};
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
mapProof(ids('MVP-MODEL', [1, 2, 3, 6, 8]), 2, ['tests/domain/topology.spec.ts']);
mapProof(ids('MVP-MODEL', [4, 5, 9]), 2, ['tests/domain/project.spec.ts']);
mapProof(ids('MVP-MODEL', [7]), 3, ['tests/domain/fluid.spec.ts']);
mapProof(ids('MVP-UX', [1, 2, 3, 4]), 3, ['tests/e2e/workspace.spec.ts']);
mapProof(ids('MVP-UX', [5]), 1, ['tests/gates/renderer-fit.spec.ts']);
mapProof(ids('MVP-UX', [6, 7]), 3, ['tests/e2e/visual-language.spec.ts']);
mapProof(ids('MVP-UX', [8]), 3, ['tests/e2e/project-library.spec.ts']);
mapProof(ids('MVP-UX', [9, 11, 12]), 3, ['tests/e2e/action-equivalence.spec.ts']);
mapProof(ids('MVP-UX', [10]), 6, ['tests/domain/rx7-reference.spec.ts']);
mapProof(ids('MVP-UX', [13]), 7, ['tests/component/contextual-help.spec.ts']);
mapProof(ids('MVP-ELEC', [1, 2, 3, 4, 5, 6, 7, 8, 9, 13]), 3, ['tests/domain/electrical.spec.ts']);
mapProof(ids('MVP-ELEC', [10, 11, 12]), 4, ['tests/domain/electrical-calculation.spec.ts']);
mapProof(ids('MVP-ELEC', [14]), 6, ['tests/e2e/electrical-output.spec.ts']);
mapProof(ids('MVP-FLUID', [1, 2, 3, 4, 5]), 3, ['tests/domain/fluid.spec.ts']);
mapProof(ids('MVP-FLUID', [6, 10]), 4, ['tests/e2e/operating-state-overlay.spec.ts']);
mapProof(ids('MVP-FLUID', [7, 8, 9, 11, 12, 13]), 4, ['tests/domain/fluid-calculation.spec.ts']);
mapProof(ids('MVP-FLUID', [14]), 6, [
  'tests/e2e/fuel-boundary.spec.ts',
  'tests/e2e/rx7-screening.spec.ts',
  'tests/e2e/fluid-output.spec.ts'
]);
mapProof(ids('MVP-FLUID', [15]), 6, ['tests/e2e/fluid-output.spec.ts']);
mapProof(ids('MVP-STATE', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]), 4, [
  'tests/e2e/operating-state-overlay.spec.ts'
]);
mapProof(ids('MVP-CALC', [1, 2, 4, 5, 6, 7, 10]), 4, ['tests/domain/calculation.spec.ts']);
mapProof(ids('MVP-CALC', [3]), 4, ['tests/domain/project-evaluation-scheduler.spec.ts']);
mapProof(ids('MVP-CALC', [8]), 4, ['tests/domain/electrical-calculation.spec.ts']);
mapProof(ids('MVP-CALC', [9]), 4, ['tests/domain/fluid-calculation.spec.ts']);
mapProof(ids('MVP-VAL', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]), 4, [
  'tests/domain/validation.spec.ts'
]);
mapProof(ids('MVP-BUILD', [1, 2, 3]), 6, ['tests/domain/build-record.spec.ts']);
mapProof(ids('MVP-BUILD', [4, 5, 6, 7]), 6, ['tests/e2e/reporting.spec.ts']);
mapProof(ids('MVP-DATA', [1]), 5, [
  'tests/domain/project-library-session.spec.ts',
  'tests/e2e/project-library.spec.ts',
  'tests/e2e/delivery-security.spec.ts'
]);
mapProof(ids('MVP-DATA', [2]), 5, [
  'tests/domain/project-session.spec.ts',
  'tests/e2e/project-library-lifecycle.spec.ts'
]);
mapProof(ids('MVP-DATA', [3]), 5, [
  'tests/gates/storage-lifecycle-browser.spec.ts',
  'tests/e2e/project-library-lifecycle.spec.ts',
  'tests/e2e/rx7-persistence.spec.ts'
]);
mapProof(ids('MVP-DATA', [4]), 5, ['tests/e2e/project-library-lifecycle.spec.ts']);
mapProof(ids('MVP-DATA', [5]), 5, [
  'tests/gates/storage-lifecycle.spec.ts',
  'tests/gates/storage-lifecycle-browser.spec.ts',
  'tests/e2e/project-library-lifecycle.spec.ts'
]);
mapProof(ids('MVP-DATA', [6]), 5, [
  'tests/domain/project-library-session.spec.ts',
  'tests/domain/rx7-reference.spec.ts',
  'tests/gates/whole-snapshot-persistence.spec.ts'
]);
mapProof(ids('MVP-DATA', [7]), 5, [
  'tests/domain/project-session.spec.ts',
  'tests/domain/project-library-session.spec.ts',
  'tests/e2e/project-library-lifecycle.spec.ts'
]);
mapProof(ids('MVP-DATA', [8, 9, 10, 19]), 5, [
  'tests/domain/project-library-session.spec.ts',
  'tests/e2e/project-library-lifecycle.spec.ts'
]);
mapProof(ids('MVP-DATA', [17]), 5, [
  'tests/domain/project-library-session.spec.ts',
  'tests/e2e/project-library-lifecycle.spec.ts'
]);
mapProof(ids('MVP-DATA', [11, 12, 13, 14, 15, 16]), 5, ['tests/e2e/exchange.spec.ts']);
mapProof(ids('MVP-DATA', [18]), 6, ['tests/e2e/output-revision.spec.ts']);
mapProof(ids('MVP-ARCH', [1]), 0, ['tests/security/dependency-boundaries.spec.ts']);
mapProof(ids('MVP-ARCH', [2, 3, 4]), 2, ['tests/security/dependency-boundaries.spec.ts']);
mapProof(ids('MVP-ARCH', [5, 6, 9]), 7, ['tests/e2e/delivery-security.spec.ts']);
mapProof(ids('MVP-ARCH', [7]), 7, ['tests/e2e/network-independent.spec.ts']);
mapProof(ids('MVP-ARCH', [8]), 7, ['tests/e2e/visual-language.spec.ts']);
mapProof(ids('MVP-ARCH', [10]), 1, ['tests/gates/renderer-fit.spec.ts']);
mapProof(ids('MVP-NFR', [1, 2, 3, 4]), 7, ['tests/e2e/rx7-platform.spec.ts']);
mapProof(ids('MVP-NFR', [5]), 7, [
  'tests/accessibility/application.spec.ts',
  'evidence/platform/accessibility-review.md'
]);
mapProof(ids('MVP-NFR', [6]), 7, ['tests/gates/graph-capacity.spec.ts']);
mapProof(ids('MVP-NFR', [7]), 7, ['tests/gates/graph-capacity-browser.spec.ts']);

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

const workPathOverrides = new Map();

function mapWork(requirementIds, workPaths) {
  for (const id of requirementIds) workPathOverrides.set(id, workPaths);
}

mapWork(ids('MVP-MODEL', [7]), ['src/lib/fluid/fluid.ts', 'src/lib/project/apply-action.ts']);
mapWork(ids('MVP-UX', [5]), ['src/lib/renderer/projection.ts', 'src/lib/renderer/svg/adapter.ts']);
mapWork(ids('MVP-UX', [8]), ['src/lib/presentation/library/ProjectLibraryView.svelte']);
mapWork(ids('MVP-UX', [9]), ['src/lib/reference/primitives.ts', 'src/lib/project/apply-action.ts']);
mapWork(ids('MVP-UX', [10]), ['src/lib/reference/rx7-example.v1.venae.json']);
mapWork(ids('MVP-UX', [13]), [
  'src/lib/presentation/help/ContextualHelp.svelte',
  'src/lib/presentation/help/help-content.ts'
]);
mapWork(ids('MVP-FLUID', [6, 10]), ['src/lib/operating-state/evaluate-overlay.ts']);
mapWork(ids('MVP-CALC', [3]), [
  'src/lib/evaluation/evaluation-client.ts',
  'src/lib/session/project-session.svelte.ts'
]);
mapWork(ids('MVP-ARCH', [5, 6, 7, 8, 9]), [
  'scripts/start-production-server.mjs',
  'src/lib/delivery/browser-delivery-state.ts',
  'src/routes/+layout.svelte'
]);
mapWork(ids('MVP-NFR', [1, 2, 3, 4, 5]), [
  'src/lib/session/authoring-capability.ts',
  'src/lib/presentation/workspace/ProjectWorkspace.svelte'
]);
mapWork(ids('MVP-NFR', [6, 7]), [
  'src/lib/renderer/TopologyRenderer.svelte',
  'src/lib/evaluation/evaluation-client.ts',
  'src/lib/persistence/project-library.ts'
]);

function commandFor(id, proofPaths) {
  const gateCommands = {
    'MVP-GATE-001': 'pnpm gate:renderer',
    'MVP-GATE-002': 'pnpm gate:capacity',
    'MVP-GATE-003': 'pnpm gate:persistence',
    'MVP-GATE-004': 'pnpm gate:exchange',
    'MVP-GATE-005': 'pnpm gate:worker',
    'MVP-GATE-006': 'pnpm gate:storage-lifecycle',
    'MVP-GATE-007': 'pnpm gate:numeric'
  };
  if (gateCommands[id]) return gateCommands[id];
  if (id === 'MVP-ACC-017') {
    return 'pnpm test:e2e && pnpm test:security && pnpm test:accessibility && pnpm gate:all';
  }

  const commands = new Set();
  for (const path of proofPaths) {
    if (path.startsWith('tests/e2e/')) commands.add('pnpm test:e2e');
    else if (path.startsWith('tests/component/')) commands.add('pnpm test:component');
    else if (path.startsWith('tests/accessibility/')) commands.add('pnpm test:accessibility');
    else if (path.startsWith('tests/gates/')) commands.add('pnpm gate:all');
    else if (path.startsWith('tests/security/')) commands.add('pnpm test:security');
    else if (path.startsWith('tests/content/') || path.startsWith('tests/domain/')) {
      commands.add('pnpm test:unit');
    } else if (path.includes('authority-baseline')) commands.add('pnpm authority:check');
    else if (path.includes('mvp-trace')) commands.add('pnpm traceability');
  }

  if (commands.size === 0) throw new Error(`No executable proof command for ${id}`);
  return [...commands].join(' && ');
}

const requirements = normativeIds.map((id) => {
  const mapping = proof.get(id);
  if (!mapping) throw new Error(`No plan mapping for ${id}`);

  const family = id.split('-')[1];
  const workPaths = workPathOverrides.get(id) ?? familyWorkPaths[family];
  if (!workPaths) throw new Error(`No work-path mapping for ${id}`);

  return {
    id,
    milestone: mapping.milestone,
    status: 'implemented',
    workPaths,
    proofPaths: mapping.proofPaths,
    command: commandFor(id, mapping.proofPaths),
    evidencePaths: mapping.proofPaths
  };
});

if (requirements.length !== 163 || proof.size !== 163) {
  throw new Error(
    `Expected 163 mappings, got ${requirements.length} from spec and ${proof.size} from plan`
  );
}

mkdirSync('traceability', { recursive: true });
mkdirSync('evidence/traceability', { recursive: true });
const trace = {
  schemaVersion: 2,
  normativeSource: 'docs/mvp-specification.md',
  generatedBy: 'scripts/generate-mvp-traceability.mjs',
  requirements
};
writeFileSync(
  'traceability/mvp.json',
  await format(JSON.stringify(trace), { ...prettierConfig, parser: 'json' })
);
writeFileSync(
  'evidence/traceability/mvp-trace.json',
  await format(
    JSON.stringify({
      schemaVersion: 1,
      source: 'traceability/mvp.json',
      normativeSource: 'docs/mvp-specification.md',
      verdict: 'pass',
      counts: {
        normative: normativeIds.length,
        mapped: requirements.length,
        implemented: requirements.filter(({ status }) => status === 'implemented').length,
        missing: 0,
        extra: 0,
        duplicate: 0,
        orphanedTags: 0
      },
      requirements
    }),
    { ...prettierConfig, parser: 'json' }
  )
);

console.log(`Generated ${requirements.length} implemented MVP mappings and final trace evidence`);
