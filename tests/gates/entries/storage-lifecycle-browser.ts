import { PROJECT_LIBRARY_DATABASE_NAME } from '../../../src/lib/persistence/database-schema';
import { openProjectLibrary } from '../../../src/lib/persistence/project-library';
import {
  acquireProjectLease,
  requestProjectTakeover
} from '../../../src/lib/persistence/project-lease';
import { readBrowserStorageStatus } from '../../../src/lib/persistence/storage-lifecycle';
import { generateCapacityProject } from '../../fixtures/capacity-project';

import type { ProjectLease } from '../../../src/lib/persistence/project-lease';

let heldLease: ProjectLease | null = null;
let takeoverRequests = 0;
let upgradeBlocker: IDBDatabase | null = null;
let upgradedDatabase: IDBDatabase | null = null;
let upgradeState: 'idle' | 'pending' | 'blocked' | 'completed' | 'failed' = 'idle';

export function readActualStorageStatus() {
  return readBrowserStorageStatus();
}

export async function holdProjectLease(projectId: string) {
  const outcome = await acquireProjectLease(projectId);
  if (outcome.acquired) {
    heldLease = outcome.lease;
    heldLease.onTakeoverRequested(() => {
      takeoverRequests += 1;
    });
  }
  return { acquired: outcome.acquired, reason: outcome.acquired ? null : outcome.reason };
}

export function sendTakeoverRequest(projectId: string) {
  return requestProjectTakeover(projectId);
}

export function takeoverRequestCount() {
  return takeoverRequests;
}

export async function releaseProjectLease() {
  if (!heldLease) return false;
  await heldLease.release();
  heldLease = null;
  return true;
}

export async function heldLockModes() {
  const snapshot = await navigator.locks.query();
  return snapshot.held?.map((lock) => ({ name: lock.name, mode: lock.mode })) ?? [];
}

export function openUpgradeBlocker(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`${PROJECT_LIBRARY_DATABASE_NAME}-upgrade-gate`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('baseline');
    request.onsuccess = () => {
      upgradeBlocker = request.result;
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export function beginBlockedUpgrade(): void {
  upgradeState = 'pending';
  const request = indexedDB.open(`${PROJECT_LIBRARY_DATABASE_NAME}-upgrade-gate`, 2);
  request.onblocked = () => {
    upgradeState = 'blocked';
  };
  request.onupgradeneeded = () => request.result.createObjectStore('promoted');
  request.onsuccess = () => {
    upgradedDatabase = request.result;
    upgradeState = 'completed';
  };
  request.onerror = () => {
    upgradeState = 'failed';
  };
}

export function readUpgradeState() {
  return upgradeState;
}

export function releaseUpgradeBlocker(): void {
  upgradeBlocker?.close();
  upgradeBlocker = null;
}

export function closeUpgradedDatabase(): void {
  upgradedDatabase?.close();
  upgradedDatabase = null;
}

export async function storeLifecycleSnapshot() {
  const snapshot = generateCapacityProject(1);
  const library = await openProjectLibrary();
  const outcome = await library.saveProject({
    projectId: snapshot.project.id,
    expectedRevision: null,
    snapshot,
    newAssets: []
  });
  library.close();
  return { saved: outcome.saved, projectId: snapshot.project.id };
}

export async function recoverLifecycleSnapshot(projectId: string) {
  const library = await openProjectLibrary();
  const recovered = await library.loadProject(projectId);
  library.close();
  return {
    recovered: recovered?.project.id === projectId,
    revision: recovered?.project.revision ?? null
  };
}
