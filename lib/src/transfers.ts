import type { Transaction } from './types.js';
import type { DataStore } from './store.js';
import type { Result } from './result.js';
import { ok, err } from './result.js';
import { nextId } from './ids.js';

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/** Find the paired transfer transaction */
export function getTransferPair(
  records: Transaction[],
  transaction: Transaction,
): Transaction | undefined {
  if (!transaction.transferPairId) return undefined;
  return records.find((t) => t.id === transaction.transferPairId);
}

/** Check if a transaction is part of a transfer pair */
export function isTransfer(transaction: Transaction): boolean {
  return transaction.type === 'transfer' && !!transaction.transferPairId;
}

// ---------------------------------------------------------------------------
// Transfer CRUD — pure functions: (DataStore, input) → Result<DataStore>
// ---------------------------------------------------------------------------

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  description?: string;
  notes?: string;
}

/** Create a transfer — two linked transactions with mutual transferPairId */
export function createTransfer(store: DataStore, data: CreateTransferInput): Result<DataStore> {
  if (!data.fromAccountId?.trim()) {
    return err('fromAccountId is required');
  }
  if (!data.toAccountId?.trim()) {
    return err('toAccountId is required');
  }
  if (data.fromAccountId === data.toAccountId) {
    return err('Cannot transfer to the same account');
  }
  if (!data.date?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    return err('Date must be in YYYY-MM-DD format');
  }
  if (typeof data.amount !== 'number' || data.amount === 0) {
    return err('Amount must be a non-zero number');
  }

  // Verify both accounts exist
  if (!store.accounts.some((a) => a.id === data.fromAccountId)) {
    return err(`Account not found: ${data.fromAccountId}`);
  }
  if (!store.accounts.some((a) => a.id === data.toAccountId)) {
    return err(`Account not found: ${data.toAccountId}`);
  }

  const absAmount = Math.abs(data.amount);
  const now = new Date().toISOString();

  // Generate two IDs — outflow first, then inflow
  const baseId = parseInt(nextId(store.transactions), 10);
  const outflowId = String(baseId);
  const inflowId = String(baseId + 1);

  const outflow: Transaction = {
    id: outflowId,
    type: 'transfer',
    accountId: data.fromAccountId,
    date: data.date,
    categoryId: '',
    description: data.description?.trim() ?? '',
    payee: '',
    transferPairId: inflowId,
    amount: -absAmount,
    notes: data.notes?.trim() ?? '',
    source: 'manual',
    createdAt: now,
  };

  const inflow: Transaction = {
    id: inflowId,
    type: 'transfer',
    accountId: data.toAccountId,
    date: data.date,
    categoryId: '',
    description: data.description?.trim() ?? '',
    payee: '',
    transferPairId: outflowId,
    amount: absAmount,
    notes: data.notes?.trim() ?? '',
    source: 'manual',
    createdAt: now,
  };

  // Auto-clear reconciled on both accounts
  const accounts = store.accounts.map((a) => {
    if ((a.id === data.fromAccountId || a.id === data.toAccountId) && a.reconciled) {
      return { ...a, reconciled: '' };
    }
    return a;
  });

  return ok({
    ...store,
    accounts,
    transactions: [...store.transactions, outflow, inflow],
  });
}

/** Sync transfer pair amount — when one side's amount changes, update the other (flip sign) */
export function syncTransferAmount(store: DataStore, id: string, newAmount: number): Result<DataStore> {
  const index = store.transactions.findIndex((t) => t.id === id);
  if (index === -1) {
    return err(`Transaction not found: ${id}`);
  }

  const transaction = store.transactions[index];
  if (!transaction.transferPairId) {
    return err(`Transaction ${id} is not a transfer`);
  }

  const pairIndex = store.transactions.findIndex((t) => t.id === transaction.transferPairId);
  if (pairIndex === -1) {
    return err(`Transfer pair not found: ${transaction.transferPairId}`);
  }

  const transactions = [...store.transactions];
  transactions[index] = { ...transactions[index], amount: newAmount };
  transactions[pairIndex] = { ...transactions[pairIndex], amount: -newAmount };

  // Auto-clear reconciled on both accounts
  const accounts = store.accounts.map((a) => {
    if ((a.id === transactions[index].accountId || a.id === transactions[pairIndex].accountId) && a.reconciled) {
      return { ...a, reconciled: '' };
    }
    return a;
  });

  return ok({ ...store, accounts, transactions });
}

/** Unlink a transfer — change type from transfer to another, delete the paired transaction */
export function unlinkTransfer(store: DataStore, id: string, newType: 'income' | 'expense'): Result<DataStore> {
  const index = store.transactions.findIndex((t) => t.id === id);
  if (index === -1) {
    return err(`Transaction not found: ${id}`);
  }

  const transaction = store.transactions[index];
  if (!transaction.transferPairId) {
    return err(`Transaction ${id} is not a transfer`);
  }

  const pairId = transaction.transferPairId;
  const pair = store.transactions.find((t) => t.id === pairId);

  // Remove the paired transaction and unlink this one
  let transactions = store.transactions.filter((t) => t.id !== pairId);
  const txIndex = transactions.findIndex((t) => t.id === id);
  transactions[txIndex] = {
    ...transactions[txIndex],
    type: newType,
    transferPairId: '',
  };

  // Auto-clear reconciled on affected accounts
  const affectedAccountIds = new Set([transaction.accountId]);
  if (pair) affectedAccountIds.add(pair.accountId);

  const accounts = store.accounts.map((a) => {
    if (affectedAccountIds.has(a.id) && a.reconciled) {
      return { ...a, reconciled: '' };
    }
    return a;
  });

  return ok({ ...store, accounts, transactions });
}
