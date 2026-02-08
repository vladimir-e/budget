import { describe, it, expect } from 'vitest';
import {
  getVisibleAccounts,
  getAccountById,
  calculateWorkingBalance,
  getBalanceDiscrepancy,
} from '../src/accounts.js';
import type { Account } from '../src/types.js';

const sampleAccounts: Account[] = [
  { id: '1', name: 'Checking', type: 'checking', currency: 'USD', institution: 'Chase', balance: 1000, hidden: false, reconciled: '', createdAt: '2025-01-01T00:00:00Z' },
  { id: '2', name: 'Old Account', type: 'savings', currency: 'USD', institution: 'BofA', balance: 0, hidden: true, reconciled: '', createdAt: '2025-01-01T00:00:00Z' },
];

describe('accounts', () => {
  it('should filter visible accounts', () => {
    const visible = getVisibleAccounts(sampleAccounts);
    expect(visible).toHaveLength(1);
    expect(visible[0].name).toBe('Checking');
  });

  it('should find account by ID', () => {
    expect(getAccountById(sampleAccounts, '1')?.name).toBe('Checking');
    expect(getAccountById(sampleAccounts, '999')).toBeUndefined();
  });

  it('should calculate working balance', () => {
    const transactions = [
      { accountId: '1', amount: 500 },
      { accountId: '1', amount: -200 },
      { accountId: '2', amount: 100 },
    ];
    expect(calculateWorkingBalance('1', transactions)).toBe(300);
  });

  it('should detect balance discrepancy', () => {
    expect(getBalanceDiscrepancy(1000, 900)).toBe(100);
    expect(getBalanceDiscrepancy(1000, 1000)).toBe(0);
  });
});
