/**
 * Store manager — manages the in-memory DataStore lifecycle.
 *
 * Loads once at startup, holds in memory, persists after mutations.
 * All route handlers use getStore() for reads and mutate() for writes.
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStore, persistStore } from '@pfs/lib/store';
import type { DataStore } from '@pfs/lib';
import type { Result } from '@pfs/lib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = resolve(__dirname, '../../data');

let store: DataStore | null = null;
let dataDir: string = process.env.DATA_DIR ?? DEFAULT_DATA_DIR;

/** Initialize the store — call once at startup */
export async function initStore(dir?: string): Promise<void> {
  if (dir) dataDir = dir;
  store = await loadStore(dataDir);
}

/** Get the current store (throws if not initialized) */
export function getStore(): DataStore {
  if (!store) throw new Error('Store not initialized — call initStore() first');
  return store;
}

/**
 * Apply a mutation and persist. Returns the Result from the mutation function.
 * On success, the in-memory store is updated and persisted to disk.
 * On failure, nothing changes.
 */
export async function mutate(
  fn: (store: DataStore) => Result<DataStore>,
): Promise<Result<DataStore>> {
  const current = getStore();
  const result = fn(current);
  if (result.ok) {
    store = result.value;
    await persistStore(store, dataDir);
  }
  return result;
}
