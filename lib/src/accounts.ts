import type { Account } from './types.js';
import type { DataStore } from './store.js';
import type { Result } from './result.js';
import { ok, err } from './result.js';
import { nextId } from './ids.js';
import { validateAccount } from './validators.js';

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/** Get all accounts */
export function getAccounts(_records: Account[]): Account[] {
  return _records;
}

/** Get visible accounts (not hidden) */
export function getVisibleAccounts(records: Account[]): Account[] {
  return records.filter((a) => !a.hidden);
}

/** Find account by ID */
export function getAccountById(records: Account[], id: string): Account | undefined {
  return records.find((a) => a.id === id);
}

/** Calculate working balance from transactions (sum of all transaction amounts for an account) */
export function calculateWorkingBalance(
  accountId: string,
  transactions: { accountId: string; amount: number }[],
): number {
  return transactions
    .filter((t) => t.accountId === accountId)
    .reduce((sum, t) => sum + t.amount, 0);
}

/** Detect discrepancy between reported balance and working balance */
export function getBalanceDiscrepancy(reportedBalance: number, workingBalance: number): number {
  return reportedBalance - workingBalance;
}

// ---------------------------------------------------------------------------
// CRUD operations — pure functions: (DataStore, input) → Result<DataStore>
// ---------------------------------------------------------------------------

export interface CreateAccountInput {
  name: string;
  type: Account['type'];
  currency: string;
  institution?: string;
  balance?: number;
}

/** Create a new account */
export function createAccount(store: DataStore, data: CreateAccountInput): Result<DataStore> {
  const validation = validateAccount(data);
  if (!validation.valid) {
    return err(validation.errors.map((e) => `${e.field}: ${e.message}`).join('; '));
  }

  const id = nextId(store.accounts);
  const account: Account = {
    id,
    name: data.name.trim(),
    type: data.type,
    currency: data.currency.trim().toUpperCase(),
    institution: data.institution?.trim() ?? '',
    balance: data.balance ?? 0,
    hidden: false,
    reconciled: '',
    createdAt: new Date().toISOString(),
  };

  return ok({ ...store, accounts: [...store.accounts, account] });
}

export interface UpdateAccountInput {
  name?: string;
  type?: Account['type'];
  currency?: string;
  institution?: string;
  balance?: number;
}

/** Update an existing account (ID is immutable) */
export function updateAccount(store: DataStore, id: string, changes: UpdateAccountInput): Result<DataStore> {
  const index = store.accounts.findIndex((a) => a.id === id);
  if (index === -1) {
    return err(`Account not found: ${id}`);
  }

  const existing = store.accounts[index];
  const merged = {
    ...existing,
    ...(changes.name !== undefined ? { name: changes.name } : {}),
    ...(changes.type !== undefined ? { type: changes.type } : {}),
    ...(changes.currency !== undefined ? { currency: changes.currency } : {}),
    ...(changes.institution !== undefined ? { institution: changes.institution } : {}),
    ...(changes.balance !== undefined ? { balance: changes.balance } : {}),
  };

  const validation = validateAccount(merged);
  if (!validation.valid) {
    return err(validation.errors.map((e) => `${e.field}: ${e.message}`).join('; '));
  }

  const updated: Account = {
    ...existing,
    name: merged.name.trim(),
    type: merged.type,
    currency: merged.currency.trim().toUpperCase(),
    institution: merged.institution.trim(),
    balance: merged.balance,
  };

  const accounts = [...store.accounts];
  accounts[index] = updated;
  return ok({ ...store, accounts });
}

/** Soft-delete an account by setting hidden=true */
export function hideAccount(store: DataStore, id: string): Result<DataStore> {
  const index = store.accounts.findIndex((a) => a.id === id);
  if (index === -1) {
    return err(`Account not found: ${id}`);
  }

  const accounts = [...store.accounts];
  accounts[index] = { ...accounts[index], hidden: true };
  return ok({ ...store, accounts });
}

/** Hard-delete an account — BLOCKED if any transactions reference it */
export function deleteAccount(store: DataStore, id: string): Result<DataStore> {
  const index = store.accounts.findIndex((a) => a.id === id);
  if (index === -1) {
    return err(`Account not found: ${id}`);
  }

  const hasTransactions = store.transactions.some((t) => t.accountId === id);
  if (hasTransactions) {
    return err(`Cannot delete account ${id}: has associated transactions`);
  }

  const accounts = store.accounts.filter((a) => a.id !== id);
  return ok({ ...store, accounts });
}
