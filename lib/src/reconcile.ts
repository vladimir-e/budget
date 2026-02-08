import type { Account } from './types.js';
import type { DataStore } from './store.js';
import type { Result } from './result.js';
import { ok, err } from './result.js';
import { calculateWorkingBalance } from './accounts.js';

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Check if an account can be reconciled (discrepancy within threshold) */
export function canReconcile(discrepancy: number, threshold: number = 0): boolean {
  return Math.abs(discrepancy) <= threshold;
}

/** Mark an account as reconciled with current date */
export function markReconciled(account: Account): Account {
  return { ...account, reconciled: new Date().toISOString().split('T')[0] };
}

/** Clear reconciliation status */
export function clearReconciled(account: Account): Account {
  return { ...account, reconciled: '' };
}

/**
 * Detect account reconciliation state:
 * - 'reconciled': has a reconciled date
 * - 'balanced': no reconciled date, but reported balance matches working balance
 * - 'discrepancy': no reconciled date and balances differ
 */
export function getReconciliationState(
  account: Account,
  workingBalance: number,
): 'reconciled' | 'balanced' | 'discrepancy' {
  if (account.reconciled) return 'reconciled';
  if (account.balance === workingBalance) return 'balanced';
  return 'discrepancy';
}

// ---------------------------------------------------------------------------
// Reconciliation operations — pure functions: (DataStore, input) → Result<DataStore>
// ---------------------------------------------------------------------------

/** Reconcile an account: verify balance, set reconciled date, update stored balance */
export function reconcileAccount(
  store: DataStore,
  accountId: string,
  reportedBalance: number,
): Result<DataStore> {
  const index = store.accounts.findIndex((a) => a.id === accountId);
  if (index === -1) {
    return err(`Account not found: ${accountId}`);
  }

  const workingBalance = calculateWorkingBalance(accountId, store.transactions);
  const discrepancy = reportedBalance - workingBalance;

  if (discrepancy !== 0) {
    return err(
      `Balance discrepancy of ${discrepancy} exists. ` +
      `Reported: ${reportedBalance}, Working: ${workingBalance}. ` +
      `Create a balance adjustment first, or correct transactions.`,
    );
  }

  const accounts = [...store.accounts];
  accounts[index] = {
    ...accounts[index],
    balance: reportedBalance,
    reconciled: new Date().toISOString().split('T')[0],
  };

  return ok({ ...store, accounts });
}
