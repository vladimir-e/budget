import { describe, it, expect } from 'vitest';
import { getTransferPair, isTransfer } from '../src/transfers.js';
import type { Transaction } from '../src/types.js';

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: '1',
  type: 'expense',
  accountId: 'a1',
  date: '2025-01-15',
  categoryId: '',
  description: 'Test',
  payee: '',
  transferPairId: '',
  amount: -50,
  notes: '',
  source: 'manual',
  createdAt: '',
  ...overrides,
});

describe('transfers', () => {
  it('should find transfer pair', () => {
    const records = [
      tx({ id: 't1', type: 'transfer', transferPairId: 't2', amount: -100 }),
      tx({ id: 't2', type: 'transfer', transferPairId: 't1', amount: 100 }),
    ];
    const pair = getTransferPair(records, records[0]);
    expect(pair?.id).toBe('t2');
  });

  it('should return undefined for non-transfer', () => {
    const records = [tx({ id: '1' })];
    expect(getTransferPair(records, records[0])).toBeUndefined();
  });

  it('should identify transfers', () => {
    expect(isTransfer(tx({ type: 'transfer', transferPairId: 't2' }))).toBe(true);
    expect(isTransfer(tx({ type: 'expense' }))).toBe(false);
  });
});
