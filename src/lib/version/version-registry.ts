export const APPLICATION_VERSIONS = Object.freeze({
  application: '0.1.0',
  projectDocumentSchema: 7,
  indexedDbStructure: 1,
  formulaCatalog: 1,
  validationRuleCatalog: 1,
  primitiveCatalog: 1,
  exchangeFormat: 1
});

export type ApplicationVersions = typeof APPLICATION_VERSIONS;
