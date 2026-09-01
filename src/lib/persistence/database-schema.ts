import { APPLICATION_VERSIONS } from '../version/version-registry';

import type { DBSchema } from 'idb';
import type { ProjectDocument } from './project-document';

export const PROJECT_LIBRARY_DATABASE_NAME = 'venae-machinae';
export const PROJECT_LIBRARY_DATABASE_VERSION = APPLICATION_VERSIONS.indexedDbStructure;

export interface StoredProject {
  projectId: string;
  revision: number;
  snapshot: ProjectDocument;
}

export interface StoredAsset {
  sha256: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface RecoveryCheckpoint {
  id: string;
  projectId: string;
  projectRevision: number;
  reason: string;
  createdAt: string;
  snapshot: ProjectDocument;
}

export interface ProjectLibraryDatabase extends DBSchema {
  projects: {
    key: string;
    value: StoredProject;
  };
  assets: {
    key: string;
    value: StoredAsset;
  };
  checkpoints: {
    key: string;
    value: RecoveryCheckpoint;
    indexes: { 'by-project': string };
  };
}
