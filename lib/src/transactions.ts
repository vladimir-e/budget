import type { Transaction } from './types.js';

// TODO: Implement full transaction CRUD and bulk import

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
