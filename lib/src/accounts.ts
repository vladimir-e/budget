import type { Account } from './types.js';

// TODO: Implement account CRUD operations

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
