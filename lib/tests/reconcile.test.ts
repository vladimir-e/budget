import { describe, it, expect } from 'vitest';
import { canReconcile, markReconciled, clearReconciled } from '../src/reconcile.js';
import type { Account } from '../src/types.js';

const sampleAccount: Account = {
  id: '1',
  name: 'Checking',
  type: 'checking',
  currency: 'USD',
  institution: 'Chase',
  balance: 1000,
  hidden: false,
  reconciled: '',
  createdAt: '2025-01-01T00:00:00Z',
};

describe('reconcile', () => {
  it('should allow reconcile when discrepancy is zero', () => {
    expect(canReconcile(0)).toBe(true);
  });

  it('should allow reconcile within threshold', () => {
    expect(canReconcile(0.5, 1)).toBe(true);
    expect(canReconcile(-0.5, 1)).toBe(true);
  });

  it('should deny reconcile beyond threshold', () => {
    expect(canReconcile(100)).toBe(false);
    expect(canReconcile(2, 1)).toBe(false);
  });

  it('should mark account as reconciled', () => {
    const reconciled = markReconciled(sampleAccount);
    expect(reconciled.reconciled).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Should not mutate original
    expect(sampleAccount.reconciled).toBe('');
  });

  it('should clear reconciled status', () => {
    const reconciled = markReconciled(sampleAccount);
    const cleared = clearReconciled(reconciled);
    expect(cleared.reconciled).toBe('');
  });
});
