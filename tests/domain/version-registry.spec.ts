import { describe, expect, it } from 'vitest';

import { APPLICATION_VERSIONS } from '../../src/lib/version/version-registry';

describe('application version registry', () => {
  it('publishes independent version identities', () => {
    expect(APPLICATION_VERSIONS).toEqual({
      application: '0.1.0',
      projectDocumentSchema: 5,
      indexedDbStructure: 1,
      formulaCatalog: 1,
      validationRuleCatalog: 1,
      primitiveCatalog: 1,
      exchangeFormat: 1
    });
  });
});
