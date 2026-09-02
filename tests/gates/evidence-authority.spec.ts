import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const specification = readFileSync('docs/mvp-specification.md', 'utf8');
const packageManifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
};
const capacityRunner = readFileSync('scripts/run-capacity-gate.mjs', 'utf8');
const capacityBrowserSpec = readFileSync('tests/gates/graph-capacity-browser.spec.ts', 'utf8');

function requirementRow(id: string): string {
  const row = specification.split('\n').find((line) => line.startsWith(`| \`${id}\` |`));
  if (!row) throw new Error(`Missing requirement row ${id}`);
  return row;
}

function currentGateRecord(gateId: string): Record<string, unknown> {
  const index = readFileSync(`evidence/gates/${gateId}.md`, 'utf8');
  const path = index.match(/^- Machine record: `([^`]+)`$/m)?.[1];
  if (!path) throw new Error(`Missing machine record in ${gateId}`);
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function gateRecordChain(gateId: string): readonly Record<string, unknown>[] {
  const records = [currentGateRecord(gateId)];
  const visited = new Set<string>();
  while (typeof records.at(-1)?.supersedes === 'string') {
    const recordId = records.at(-1)!.supersedes as string;
    if (visited.has(recordId)) throw new Error(`${gateId} evidence supersession has a cycle`);
    visited.add(recordId);
    const path = `evidence/gates/${recordId}.json`;
    if (!existsSync(path)) throw new Error(`${gateId} supersedes missing record ${recordId}`);
    records.push(JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>);
  }

  return records;
}

describe('approved gate evidence authority amendment', () => {
  it('keeps local delivery secure without claiming cross-device support', () => {
    const architecture = requirementRow('MVP-ARCH-008');
    const responsive = requirementRow('MVP-NFR-001');
    const browsers = requirementRow('MVP-NFR-004');

    expect(architecture).toContain('Cross-device access');
    expect(architecture).toContain('plain-HTTP LAN editing');
    expect(architecture).toContain('unsupported');
    expect(responsive).toContain('responsive tablet presentation');
    expect(responsive).toContain('supported production desktop browsers');
    expect(browsers).toContain('Chromium, Firefox, and WebKit');
    expect(`${architecture}\n${responsive}\n${browsers}`).not.toMatch(
      /real device|real-device|iPadOS|trusted HTTPS/i
    );
  });

  it('makes capacity authoritative only in its recorded current environment', () => {
    const capacity = requirementRow('MVP-NFR-006');
    const thresholds = requirementRow('MVP-NFR-007');
    const gate = requirementRow('MVP-GATE-002');

    expect(capacity).toContain('reproducible recorded current local environment');
    expect(capacity).toContain('MUST NOT establish a minimum hardware claim');
    expect(thresholds).toContain('recorded environment');
    expect(gate).toContain('recorded current local environment');
    expect(`${capacity}\n${thresholds}\n${gate}`).not.toContain('2020-era');
    expect(packageManifest.scripts['gate:capacity:local']).toBe(
      'node scripts/run-capacity-gate.mjs'
    );
    expect(capacityRunner).toContain('CAPACITY_EVIDENCE_SCOPE:');
    expect(capacityRunner).toContain("'authoritative-current-local'");
    expect(capacityRunner).not.toContain('--local-smoke');
    expect(capacityBrowserSpec).toContain("'authoritative-current-local'");
    expect(capacityBrowserSpec).not.toMatch(
      /CAPACITY_HARDWARE_RECORD|authoritative recorded-hardware|non-authoritative modern-host/
    );
  });

  it('uses automated production-browser lifecycle evidence for Gate 6', () => {
    expect(requirementRow('MVP-GATE-006')).toContain(
      'production-build Chromium, Firefox, and WebKit'
    );
    expect(packageManifest.scripts['gate:storage-lifecycle']).toBe(
      'pnpm gate:storage-lifecycle:automated && node scripts/check-gate-evidence.mjs MVP-GATE-006'
    );
    expect(existsSync('scripts/check-manual-evidence.mjs')).toBe(false);

    const retiredProcedures = [
      'evidence/gates/MVP-GATE-002-recorded-hardware.md',
      'evidence/gates/MVP-GATE-006-real-device-safari.md',
      'evidence/platform/trusted-https-origin.md'
    ].map((path) => readFileSync(path, 'utf8'));
    for (const procedure of retiredProcedures) {
      expect(procedure).toContain('Status: Historical — superseded');
      expect(procedure).not.toContain('Required unblock');
    }
    expect(JSON.parse(readFileSync('evidence/gates/manual-evidence.json', 'utf8'))).toMatchObject({
      status: 'superseded',
      records: []
    });
  });

  it.each([
    ['MVP-GATE-002', 'MVP-GATE-002-baseline'],
    ['MVP-GATE-006', 'MVP-GATE-006-baseline']
  ])(
    '%s has an authoritative Pass record superseding its historical blocker',
    (gateId, baseline) => {
      const chain = gateRecordChain(gateId);
      expect(chain[0]).toMatchObject({ gateId, verdict: 'Pass' });
      expect(chain.map((record) => record.recordId)).toContain(baseline);
    }
  );
});
