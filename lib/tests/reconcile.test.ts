import { describe, it, expect } from 'vitest';
import {
  canReconcile,
  markReconciled,
  clearReconciled,
  getReconciliationState,
  reconcileAccount,
  createBalanceAdjustment,
} from '../src/reconcile.js';
import type { Account, Transaction } from '../src/types.js';
import type { DataStore } from '../src/store.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'a1',
  name: 'Checking',
  type: 'checking',
  currency: 'USD',
  institution: 'Chase',
  balance: 1000,
  hidden: false,
  reconciled: '',
  createdAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: '1',
  type: 'expense',
  accountId: 'a1',
  date: '2025-01-15',
  categoryId: '',
  description: '',
  payee: '',
  transferPairId: '',
  amount: -50,
  notes: '',
  source: 'manual',
  createdAt: '',
  ...overrides,
});

const emptyStore: DataStore = { accounts: [], transactions: [], categories: [] };

// ---------------------------------------------------------------------------
// Query helper tests (existing)
// ---------------------------------------------------------------------------

describe('reconcile — helpers', () => {
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
    const account = makeAccount();
    const reconciled = markReconciled(account);
    expect(reconciled.reconciled).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(account.reconciled).toBe(''); // original unchanged
  });

  it('should clear reconciled status', () => {
    const reconciled = markReconciled(makeAccount());
    const cleared = clearReconciled(reconciled);
    expect(cleared.reconciled).toBe('');
  });
});

describe('getReconciliationState', () => {
  it('should return reconciled when account has reconciled date', () => {
    const account = makeAccount({ reconciled: '2025-01-01' });
    expect(getReconciliationState(account, 500)).toBe('reconciled');
  });

  it('should return balanced when balances match', () => {
    const account = makeAccount({ balance: 500 });
    expect(getReconciliationState(account, 500)).toBe('balanced');
  });

  it('should return discrepancy when balances differ', () => {
    const account = makeAccount({ balance: 1000 });
    expect(getReconciliationState(account, 500)).toBe('discrepancy');
  });
});

// ---------------------------------------------------------------------------
// Reconciliation operation tests
// ---------------------------------------------------------------------------

describe('reconcileAccount', () => {
  it('should reconcile when working balance matches reported', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1', balance: 0 })],
      transactions: [
        makeTx({ id: '1', accountId: 'a1', amount: 500 }),
        makeTx({ id: '2', accountId: 'a1', amount: -200 }),
      ],
      categories: [],
    };

    // Working balance = 500 + (-200) = 300
    const result = reconcileAccount(store, 'a1', 300);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].reconciled).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.value.accounts[0].balance).toBe(300);
  });

  it('should reject when discrepancy exists', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1' })],
      transactions: [makeTx({ id: '1', accountId: 'a1', amount: 300 })],
      categories: [],
    };

    // Working balance = 300, reported = 500
    const result = reconcileAccount(store, 'a1', 500);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('discrepancy');
  });

  it('should return error for non-existent account', () => {
    const result = reconcileAccount(emptyStore, 'nonexistent', 0);
    expect(result.ok).toBe(false);
  });

  it('should reconcile account with zero balance and no transactions', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1', balance: 0 })],
      transactions: [],
      categories: [],
    };
    const result = reconcileAccount(store, 'a1', 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].reconciled).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('createBalanceAdjustment', () => {
  it('should create income adjustment for positive discrepancy', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1' })],
      transactions: [makeTx({ id: '1', accountId: 'a1', amount: 300 })],
      categories: [],
    };

    // Working balance = 300, reported = 500 → discrepancy = 200
    const result = createBalanceAdjustment(store, 'a1', 500);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions).toHaveLength(2);
    const adjustment = result.value.transactions[1];
    expect(adjustment.type).toBe('income');
    expect(adjustment.amount).toBe(200);
    expect(adjustment.description).toBe('Balance adjustment');
    expect(adjustment.source).toBe('reconciliation');
  });

  it('should create expense adjustment for negative discrepancy', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1' })],
      transactions: [makeTx({ id: '1', accountId: 'a1', amount: 500 })],
      categories: [],
    };

    // Working balance = 500, reported = 300 → discrepancy = -200
    const result = createBalanceAdjustment(store, 'a1', 300);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const adjustment = result.value.transactions[1];
    expect(adjustment.type).toBe('expense');
    expect(adjustment.amount).toBe(-200);
  });

  it('should reject when no discrepancy exists', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1' })],
      transactions: [makeTx({ id: '1', accountId: 'a1', amount: 500 })],
      categories: [],
    };

    const result = createBalanceAdjustment(store, 'a1', 500);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('No discrepancy');
  });

  it('should return error for non-existent account', () => {
    const result = createBalanceAdjustment(emptyStore, 'nonexistent', 500);
    expect(result.ok).toBe(false);
  });
});
