import { existsSync, readFileSync } from 'node:fs';

import { z } from 'zod';

const gateRecordSchema = z.strictObject({
  schemaVersion: z.literal(1),
  gateId: z.string().regex(/^MVP-GATE-00[1-7]$/),
  recordId: z.string().min(1),
  recordedAt: z.iso.datetime({ offset: true }),
  supersedes: z.string().min(1).nullable(),
  environment: z.record(z.string(), z.unknown()),
  versions: z.record(z.string(), z.unknown()),
  fixtures: z.array(z.string().min(1)).min(1),
  command: z.string().min(1),
  rawArtifacts: z.array(z.string().min(1)).min(1),
  measurements: z.record(z.string(), z.unknown()),
  verdict: z.enum(['Pass', 'Fail', 'Unavailable']),
  boundedDecision: z.string().min(1)
});

const requestedGateIds = process.argv.slice(2);
if (requestedGateIds.length === 0) {
  throw new Error('Provide at least one gate ID to verify');
}

for (const gateId of requestedGateIds) {
  const indexPath = `evidence/gates/${gateId}.md`;
  if (!existsSync(indexPath)) throw new Error(`Missing canonical gate index ${indexPath}`);
  const index = readFileSync(indexPath, 'utf8');
  const machineRecordMatch = index.match(/^- Machine record: `([^`]+)`$/m);
  if (!machineRecordMatch) throw new Error(`${indexPath} does not name its machine record`);

  const machineRecordPath = machineRecordMatch[1];
  if (!existsSync(machineRecordPath))
    throw new Error(`Missing machine record ${machineRecordPath}`);
  const record = gateRecordSchema.parse(JSON.parse(readFileSync(machineRecordPath, 'utf8')));
  if (record.gateId !== gateId) throw new Error(`${machineRecordPath} belongs to ${record.gateId}`);
  if (!index.includes(`- Verdict: ${record.verdict}`)) {
    throw new Error(`${indexPath} verdict does not match ${machineRecordPath}`);
  }

  const narrativePath = machineRecordPath.replace(/\.json$/, '.md');
  if (!existsSync(narrativePath) || !readFileSync(narrativePath, 'utf8').includes(gateId)) {
    throw new Error(`Missing narrative record ${narrativePath}`);
  }

  for (const path of [...record.fixtures, ...record.rawArtifacts]) {
    if (!existsSync(path)) throw new Error(`${machineRecordPath} references missing ${path}`);
  }

  if (record.verdict !== 'Pass') {
    throw new Error(`${gateId} current verdict is ${record.verdict}`);
  }
}

console.log(`Gate evidence: ${requestedGateIds.length} current Pass record(s) verified`);
