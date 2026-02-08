import type { Account, Transaction } from './types.js';
import type { DataStore } from './store.js';
import type { Result } from './result.js';
import { ok, err } from './result.js';
import { nextId } from './ids.js';
import { validateTransaction } from './validators.js';

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/** Get all transactions */
export function getTransactions(records: Transaction[]): Transaction[] {
  return records;
}

/** Find transaction by ID */
export function getTransactionById(records: Transaction[], id: string): Transaction | undefined {
  return records.find((t) => t.id === id);
}

/** Filter transactions by account ID */
export function getTransactionsByAccount(records: Transaction[], accountId: string): Transaction[] {
  return records.filter((t) => t.accountId === accountId);
}

/** Filter transactions by category ID */
export function getTransactionsByCategory(
  records: Transaction[],
  categoryId: string,
): Transaction[] {
  return records.filter((t) => t.categoryId === categoryId);
}

/** Filter transactions by date range (inclusive) */
export function getTransactionsByDateRange(
  records: Transaction[],
  startDate: string,
  endDate: string,
): Transaction[] {
  return records.filter((t) => t.date >= startDate && t.date <= endDate);
}

/** Generate a deduplication key for a transaction */
export function deduplicationKey(t: Pick<Transaction, 'date' | 'accountId' | 'amount' | 'description'>): string {
  return `${t.date}|${t.accountId}|${t.amount}|${t.description}`;
}

// ---------------------------------------------------------------------------
// CRUD operations — pure functions: (DataStore, input) → Result<DataStore>
// ---------------------------------------------------------------------------

export interface CreateTransactionInput {
  type: Transaction['type'];
  accountId: string;
  date: string;
  categoryId?: string;
  description?: string;
  payee?: string;
  amount: number;
  notes?: string;
  source?: string;
}

/** Create a new transaction */
export function createTransaction(store: DataStore, data: CreateTransactionInput): Result<DataStore> {
  const validation = validateTransaction(data);
  if (!validation.valid) {
    return err(validation.errors.map((e) => `${e.field}: ${e.message}`).join('; '));
  }

  // Verify accountId exists
  if (!store.accounts.some((a) => a.id === data.accountId)) {
    return err(`Account not found: ${data.accountId}`);
  }

  // Verify categoryId exists (empty string = uncategorized, which is valid)
  const categoryId = data.categoryId ?? '';
  if (categoryId && !store.categories.some((c) => c.id === categoryId)) {
    return err(`Category not found: ${categoryId}`);
  }

  const id = nextId(store.transactions);
  const transaction: Transaction = {
    id,
    type: data.type,
    accountId: data.accountId,
    date: data.date,
    categoryId,
    description: data.description?.trim() ?? '',
    payee: data.payee?.trim() ?? '',
    transferPairId: '',
    amount: data.amount,
    notes: data.notes?.trim() ?? '',
    source: data.source ?? 'manual',
    createdAt: new Date().toISOString(),
  };

  // Auto-clear reconciled on the affected account
  const accounts = clearReconciledForAccount(store.accounts, data.accountId);

  return ok({ ...store, accounts, transactions: [...store.transactions, transaction] });
}

export interface UpdateTransactionInput {
  type?: Transaction['type'];
  accountId?: string;
  date?: string;
  categoryId?: string;
  description?: string;
  payee?: string;
  amount?: number;
  notes?: string;
}

/** Update an existing transaction */
export function updateTransaction(store: DataStore, id: string, changes: UpdateTransactionInput): Result<DataStore> {
  const index = store.transactions.findIndex((t) => t.id === id);
  if (index === -1) {
    return err(`Transaction not found: ${id}`);
  }

  const existing = store.transactions[index];

  // Block transfer-unsafe fields — use syncTransferAmount / unlinkTransfer instead
  if (existing.transferPairId) {
    if (changes.type !== undefined) {
      return err('Cannot change type on a transfer transaction — use unlinkTransfer to convert');
    }
    if (changes.amount !== undefined) {
      return err('Cannot change amount on a transfer transaction — use syncTransferAmount to keep pair in sync');
    }
    if (changes.accountId !== undefined) {
      return err('Cannot change accountId on a transfer transaction — use unlinkTransfer first');
    }
  }

  const merged: Partial<Transaction> = {
    ...existing,
    ...(changes.type !== undefined ? { type: changes.type } : {}),
    ...(changes.accountId !== undefined ? { accountId: changes.accountId } : {}),
    ...(changes.date !== undefined ? { date: changes.date } : {}),
    ...(changes.categoryId !== undefined ? { categoryId: changes.categoryId } : {}),
    ...(changes.description !== undefined ? { description: changes.description } : {}),
    ...(changes.payee !== undefined ? { payee: changes.payee } : {}),
    ...(changes.amount !== undefined ? { amount: changes.amount } : {}),
    ...(changes.notes !== undefined ? { notes: changes.notes } : {}),
  };

  const validation = validateTransaction(merged);
  if (!validation.valid) {
    return err(validation.errors.map((e) => `${e.field}: ${e.message}`).join('; '));
  }

  // Verify new accountId exists if changed
  if (changes.accountId !== undefined && !store.accounts.some((a) => a.id === changes.accountId)) {
    return err(`Account not found: ${changes.accountId}`);
  }

  // Verify new categoryId exists if changed (empty = uncategorized, valid)
  if (changes.categoryId !== undefined && changes.categoryId !== '' &&
      !store.categories.some((c) => c.id === changes.categoryId)) {
    return err(`Category not found: ${changes.categoryId}`);
  }

  const updated: Transaction = {
    ...existing,
    type: merged.type!,
    accountId: merged.accountId!,
    date: merged.date!,
    categoryId: merged.categoryId!,
    description: (merged.description ?? '').trim(),
    payee: (merged.payee ?? '').trim(),
    amount: merged.amount!,
    notes: (merged.notes ?? '').trim(),
  };

  const transactions = [...store.transactions];
  transactions[index] = updated;

  // Auto-clear reconciled on affected accounts
  let accounts = store.accounts;
  accounts = clearReconciledForAccount(accounts, existing.accountId);
  if (changes.accountId !== undefined && changes.accountId !== existing.accountId) {
    accounts = clearReconciledForAccount(accounts, changes.accountId);
  }

  return ok({ ...store, accounts, transactions });
}

/** Delete a transaction — cascade deletes transfer pair if it exists */
export function deleteTransaction(store: DataStore, id: string): Result<DataStore> {
  const transaction = store.transactions.find((t) => t.id === id);
  if (!transaction) {
    return err(`Transaction not found: ${id}`);
  }

  let idsToDelete = new Set([id]);

  // Cascade: delete transfer pair
  if (transaction.transferPairId) {
    idsToDelete.add(transaction.transferPairId);
  }

  const transactions = store.transactions.filter((t) => !idsToDelete.has(t.id));

  // Auto-clear reconciled on affected accounts
  const affectedAccountIds = new Set<string>();
  for (const tid of idsToDelete) {
    const t = store.transactions.find((tx) => tx.id === tid);
    if (t) affectedAccountIds.add(t.accountId);
  }

  let accounts = store.accounts;
  for (const accountId of affectedAccountIds) {
    accounts = clearReconciledForAccount(accounts, accountId);
  }

  return ok({ ...store, accounts, transactions });
}

export interface BulkImportInput {
  accountId: string;
  transactions: Omit<CreateTransactionInput, 'accountId'>[];
}

/** Bulk import transactions with deduplication */
export function bulkImportTransactions(store: DataStore, data: BulkImportInput): Result<DataStore> {
  // Verify account exists
  const account = store.accounts.find((a) => a.id === data.accountId);
  if (!account) {
    return err(`Account not found: ${data.accountId}`);
  }

  // Build dedup set from existing transactions for this account
  const existingKeys = new Set(
    store.transactions
      .filter((t) => t.accountId === data.accountId)
      .map((t) => deduplicationKey(t)),
  );

  // Find the reconciled date — skip transactions before it
  const reconciledDate = account.reconciled;

  const newTransactions: Transaction[] = [];
  let nextIdValue = parseInt(nextId(store.transactions), 10);

  for (const input of data.transactions) {
    // Skip if before reconciled date
    if (reconciledDate && input.date < reconciledDate) {
      continue;
    }

    const fullInput = { ...input, accountId: data.accountId };

    // Validate
    const validation = validateTransaction(fullInput);
    if (!validation.valid) {
      continue; // Skip invalid rows during bulk import
    }

    // Verify categoryId if provided
    const categoryId = input.categoryId ?? '';
    if (categoryId && !store.categories.some((c) => c.id === categoryId)) {
      // Skip — dangling category reference on import is silently uncategorized
    }

    // Dedup check
    const key = deduplicationKey({ date: input.date, accountId: data.accountId, amount: input.amount, description: input.description ?? '' });
    if (existingKeys.has(key)) {
      continue;
    }

    const transaction: Transaction = {
      id: String(nextIdValue++),
      type: input.type,
      accountId: data.accountId,
      date: input.date,
      categoryId: categoryId && store.categories.some((c) => c.id === categoryId) ? categoryId : '',
      description: input.description?.trim() ?? '',
      payee: input.payee?.trim() ?? '',
      transferPairId: '',
      amount: input.amount,
      notes: input.notes?.trim() ?? '',
      source: input.source ?? 'import',
      createdAt: new Date().toISOString(),
    };

    newTransactions.push(transaction);
    existingKeys.add(key);
  }

  if (newTransactions.length === 0) {
    return ok(store); // Nothing to import
  }

  // Auto-clear reconciled on affected account
  const accounts = clearReconciledForAccount(store.accounts, data.accountId);

  return ok({
    ...store,
    accounts,
    transactions: [...store.transactions, ...newTransactions],
  });
}

// ---------------------------------------------------------------------------
// Helper: auto-clear reconciled status
// ---------------------------------------------------------------------------

function clearReconciledForAccount(accounts: Account[], accountId: string): Account[] {
  return accounts.map((a) =>
    a.id === accountId && a.reconciled ? { ...a, reconciled: '' } : a,
  );
}

