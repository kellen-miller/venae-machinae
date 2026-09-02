import { describe, expect, it } from 'vitest';

import { projectDocumentSchema } from '../../src/lib/persistence/project-document';
import {
  generateRx7CapacityProject,
  RX7_CAPACITY_ASSETS,
  RX7_CAPACITY_COUNTS
} from '../fixtures/rx7-capacity-project';

describe('MVP-GATE-003 MVP-GATE-004 MVP-GATE-005 RX-7 capacity envelope', () => {
  it.each([1, 2, 5] as const)('validates a complete deterministic %sx variant', (scale) => {
    const project = projectDocumentSchema.parse(generateRx7CapacityProject(scale));

    expect(project.topology.components).toHaveLength(RX7_CAPACITY_COUNTS[scale].components);
    expect(project.topology.components.flatMap((component) => component.ports)).toHaveLength(
      RX7_CAPACITY_COUNTS[scale].ports
    );
    expect(project.topology.connections).toHaveLength(RX7_CAPACITY_COUNTS[scale].connections);
    expect(project.results).toHaveLength(13 * scale);
    expect(project.evidence).toHaveLength(12 * scale);
    expect(project.operatingStates).toHaveLength(5 * scale);
    expect(project.build.installations).toHaveLength(2 * scale);
    expect(project.topology.routes).toHaveLength(32 * scale);
    expect(project.topology.segments).toHaveLength(33 * scale);
    expect(project.partDefinitions.every((definition) => definition.provenance.length > 0)).toBe(
      true
    );
    expect(project.vehicleBackground).not.toBeNull();
    expect(project.assetHashes).toEqual([RX7_CAPACITY_ASSETS[0]?.sha256]);
  });

  it('is byte-deterministic for every scale', () => {
    for (const scale of [1, 2, 5] as const) {
      expect(JSON.stringify(generateRx7CapacityProject(scale))).toBe(
        JSON.stringify(generateRx7CapacityProject(scale))
      );
    }
  });
});
