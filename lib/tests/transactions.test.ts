import { describe, it, expect } from 'vitest';
import {
  getTransactionById,
  getTransactionsByAccount,
  getTransactionsByDateRange,
  deduplicationKey,
} from '../src/transactions.js';
import type { Transaction } from '../src/types.js';

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: '1',
  type: 'expense',
  accountId: 'a1',
  date: '2025-01-15',
  categoryId: 'c1',
  description: 'Test',
  payee: 'Store',
  transferPairId: '',
  amount: -50,
  notes: '',
  source: 'manual',
  createdAt: '2025-01-15T00:00:00Z',
  ...overrides,
});

describe('transactions', () => {
  const records = [
    tx({ id: '1', accountId: 'a1', date: '2025-01-10' }),
    tx({ id: '2', accountId: 'a2', date: '2025-01-15' }),
    tx({ id: '3', accountId: 'a1', date: '2025-02-01' }),
  ];

  it('should find by ID', () => {
    expect(getTransactionById(records, '2')?.accountId).toBe('a2');
    expect(getTransactionById(records, '999')).toBeUndefined();
  });

  it('should filter by account', () => {
    expect(getTransactionsByAccount(records, 'a1')).toHaveLength(2);
  });

  it('should filter by date range', () => {
    const result = getTransactionsByDateRange(records, '2025-01-01', '2025-01-31');
    expect(result).toHaveLength(2);
  });

  it('should generate deduplication key', () => {
    const key = deduplicationKey({ date: '2025-01-15', accountId: 'a1', amount: -50, description: 'Test' });
    expect(key).toBe('2025-01-15|a1|-50|Test');
  });
});
