import type { OuraSummary } from './types';

const DB_NAME = 'openoura';
const DB_VERSION = 1;
const DATASET_STORE = 'datasets';
const CURRENT_DATASET_KEY = 'openoura:currentDatasetId';

export type StoredDataset = {
  id: string;
  savedAt: string;
  sourceName: string;
  sizeBytes: number;
  summary: OuraSummary;
};

export function getCurrentDatasetId() {
  return globalThis.localStorage?.getItem(CURRENT_DATASET_KEY) ?? '';
}

export function setCurrentDatasetId(id: string) {
  globalThis.localStorage?.setItem(CURRENT_DATASET_KEY, id);
}

export function clearCurrentDatasetId() {
  globalThis.localStorage?.removeItem(CURRENT_DATASET_KEY);
}

export async function loadLocalDataset(id: string) {
  const db = await openDatabase();
  try {
    return await requestToPromise<StoredDataset | undefined>(db.transaction(DATASET_STORE).objectStore(DATASET_STORE).get(id));
  } finally {
    db.close();
  }
}

export async function saveLocalDataset(dataset: StoredDataset) {
  const db = await openDatabase();
  try {
    await requestToPromise(db.transaction(DATASET_STORE, 'readwrite').objectStore(DATASET_STORE).put(dataset));
  } finally {
    db.close();
  }
}

export async function deleteLocalDataset(id: string) {
  const db = await openDatabase();
  try {
    await requestToPromise(db.transaction(DATASET_STORE, 'readwrite').objectStore(DATASET_STORE).delete(id));
  } finally {
    db.close();
  }
}

function openDatabase() {
  const indexedDB = globalThis.indexedDB;
  if (!indexedDB) {
    throw new Error('Browser storage is unavailable in this environment.');
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DATASET_STORE)) {
        db.createObjectStore(DATASET_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open browser storage.'));
  });
}

function requestToPromise<T = unknown>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Browser storage request failed.'));
  });
}
