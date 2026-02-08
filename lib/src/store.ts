/**
 * DataStore — in-memory representation of all CSV data.
 *
 * Pure core: (DataStore, input) → Result<DataStore>
 * I/O shell: loadStore(dataDir) → DataStore, persistStore(DataStore, dataDir) → void
 */

import { join } from 'node:path';
import { access } from 'node:fs/promises';
import type { Account, Transaction, Category } from './types.js';
import { ACCOUNT_SCHEMA, TRANSACTION_SCHEMA, CATEGORY_SCHEMA, getPrecision } from './schema.js';
import { readCSVFile, writeCSVFile } from './storage.js';

// ---------------------------------------------------------------------------
// DataStore type
// ---------------------------------------------------------------------------

export interface DataStore {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
}

// ---------------------------------------------------------------------------
// File names
// ---------------------------------------------------------------------------

const ACCOUNTS_FILE = 'accounts.csv';
const TRANSACTIONS_FILE = 'transactions.csv';
const CATEGORIES_FILE = 'categories.csv';

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

/**
 * Load a DataStore from a data directory.
 * Reads accounts.csv, transactions.csv, and categories.csv.
 *
 * - Missing files return empty arrays (no crash).
 * - Dangling references are left as-is (treat as uncategorized / non-transfer).
 */
export async function loadStore(dataDir: string): Promise<DataStore> {
  const accountsPath = join(dataDir, ACCOUNTS_FILE);
  const transactionsPath = join(dataDir, TRANSACTIONS_FILE);
  const categoriesPath = join(dataDir, CATEGORIES_FILE);

  // Read accounts first — we need their currencies for transaction precision
  const accounts = await safeReadCSV<Account>(
    accountsPath,
    ACCOUNT_SCHEMA,
    {
      getPrecisionForRecord: (raw) => getPrecision(raw['currency'] || 'USD'),
    },
  );

  // Build account currency lookup for transactions
  const accountCurrencyMap = new Map<string, string>();
  for (const a of accounts) {
    accountCurrencyMap.set(a.id, a.currency || 'USD');
  }

  const transactions = await safeReadCSV<Transaction>(
    transactionsPath,
    TRANSACTION_SCHEMA,
    {
      getPrecisionForRecord: (raw) => {
        const currency = accountCurrencyMap.get(raw['accountId'] || '') || 'USD';
        return getPrecision(currency);
      },
    },
  );

  // Categories use default precision (2)
  const categories = await safeReadCSV<Category>(
    categoriesPath,
    CATEGORY_SCHEMA,
    { precision: 2 },
  );

  return { accounts, transactions, categories };
}

// ---------------------------------------------------------------------------
// Persist
// ---------------------------------------------------------------------------

/**
 * Persist a DataStore to a data directory.
 * Writes all three CSV files atomically.
 *
 * Multi-file strategy: write all temp files first, rename in sequence.
 * (The atomic write in storage.ts handles per-file atomicity.)
 */
export async function persistStore(store: DataStore, dataDir: string): Promise<void> {
  const accountsPath = join(dataDir, ACCOUNTS_FILE);
  const transactionsPath = join(dataDir, TRANSACTIONS_FILE);
  const categoriesPath = join(dataDir, CATEGORIES_FILE);

  await writeCSVFile(
    accountsPath,
    ACCOUNT_SCHEMA,
    store.accounts,
    {
      getPrecisionForRecord: (record) => getPrecision(String(record['currency'] || 'USD')),
    },
  );

  // Build account currency lookup for transactions
  const accountCurrencyMap = new Map<string, string>();
  for (const a of store.accounts) {
    accountCurrencyMap.set(a.id, a.currency || 'USD');
  }

  await writeCSVFile(
    transactionsPath,
    TRANSACTION_SCHEMA,
    store.transactions,
    {
      getPrecisionForRecord: (record) => {
        const currency = accountCurrencyMap.get(String(record['accountId'] || '')) || 'USD';
        return getPrecision(currency);
      },
    },
  );

  await writeCSVFile(
    categoriesPath,
    CATEGORY_SCHEMA,
    store.categories,
    { precision: 2 },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a CSV file, returning empty array if the file doesn't exist */
async function safeReadCSV<T>(
  filePath: string,
  schema: Parameters<typeof readCSVFile<T>>[1],
  options?: Parameters<typeof readCSVFile<T>>[2],
): Promise<T[]> {
  try {
    await access(filePath);
    return await readCSVFile<T>(filePath, schema, options);
  } catch {
    return [];
  }
}
