import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { projectDocumentToSnapshot } from '../../src/lib/persistence/project-document';
import {
  captureOutputRevision,
  createCsvTables,
  createExportAllZip,
  createPrintableReport,
  createValidationReport
} from '../../src/lib/reporting/generate-output';
import { generateRx7CapacityProject } from '../fixtures/rx7-capacity-project';

const prohibitedClaims = [
  /\b(?:project|vehicle|design|candidate|installation)\s+(?:is|looks|appears)\s+(?:safe|ready|suitable|correct|complete|healthy|certified)\b/i,
  /\bproject health\b/i,
  /\bsafety score\b/i,
  /\breadiness score\b/i
];

function collectProductSource(path: string): string[] {
  if (statSync(path).isDirectory()) {
    return readdirSync(path).flatMap((child) => collectProductSource(join(path, child)));
  }

  return ['.html', '.js', '.json', '.svelte', '.ts'].includes(extname(path))
    ? [readFileSync(path, 'utf8')]
    : [];
}

describe('MVP-PROD-005 scoped product claims', () => {
  it('rejects prohibited aggregate claims across UI and generated RX-7 output', () => {
    const snapshot = projectDocumentToSnapshot(generateRx7CapacityProject(1));
    const output = captureOutputRevision(snapshot, {
      source: 'durable',
      generatedAt: '2026-09-02T06:00:00Z',
      view: 'bom',
      operatingStateId: null,
      domainFilter: 'all',
      systemFilterId: null,
      overlayChannels: [],
      legend: ['Known and Unknown evidence remain explicit.'],
      pagination: 'Complete bounded project report'
    });
    const productSurfaces = [
      ...collectProductSource('src'),
      JSON.stringify(createPrintableReport(output)),
      ...Object.values(createCsvTables(output)),
      JSON.stringify(createValidationReport(output, { includeResolved: true })),
      JSON.stringify(output.document),
      new TextDecoder().decode(createExportAllZip(output))
    ];

    for (const surface of productSurfaces) {
      for (const claim of prohibitedClaims) expect(surface).not.toMatch(claim);
    }
  });
});
