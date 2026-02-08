import type { Account } from './types.js';

// TODO: Implement reconciliation logic

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
