import { describe, it, expect } from 'vitest';
import {
  getTransactionById,
  getTransactionsByAccount,
  getTransactionsByDateRange,
  deduplicationKey,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  bulkImportTransactions,
} from '../src/transactions.js';
import type { Account, Transaction, Category } from '../src/types.js';
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

const makeCat = (overrides: Partial<Category> = {}): Category => ({
  id: 'c1',
  type: 'expense',
  name: 'Groceries',
  group: 'Immediate Obligations',
  assigned: 500,
  hidden: false,
  ...overrides,
});

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
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

const baseStore: DataStore = {
  accounts: [makeAccount({ id: 'a1' }), makeAccount({ id: 'a2', name: 'Savings', type: 'savings' })],
  transactions: [],
  categories: [makeCat({ id: 'c1' })],
};

// ---------------------------------------------------------------------------
// Query function tests (existing)
// ---------------------------------------------------------------------------

describe('transactions — queries', () => {
  const records = [
    makeTx({ id: '1', accountId: 'a1', date: '2025-01-10' }),
    makeTx({ id: '2', accountId: 'a2', date: '2025-01-15' }),
    makeTx({ id: '3', accountId: 'a1', date: '2025-02-01' }),
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

// ---------------------------------------------------------------------------
// CRUD tests
// ---------------------------------------------------------------------------

describe('createTransaction', () => {
  it('should create a transaction', () => {
    const result = createTransaction(baseStore, {
      type: 'expense',
      accountId: 'a1',
      date: '2025-01-15',
      categoryId: 'c1',
      amount: -100,
      description: 'Groceries',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions).toHaveLength(1);
    expect(result.value.transactions[0].amount).toBe(-100);
    expect(result.value.transactions[0].source).toBe('manual');
  });

  it('should allow uncategorized (empty categoryId)', () => {
    const result = createTransaction(baseStore, {
      type: 'expense',
      accountId: 'a1',
      date: '2025-01-15',
      amount: -50,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions[0].categoryId).toBe('');
  });

  it('should reject non-existent account', () => {
    const result = createTransaction(baseStore, {
      type: 'expense',
      accountId: 'nonexistent',
      date: '2025-01-15',
      amount: -50,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Account not found');
  });

  it('should reject non-existent category', () => {
    const result = createTransaction(baseStore, {
      type: 'expense',
      accountId: 'a1',
      date: '2025-01-15',
      categoryId: 'nonexistent',
      amount: -50,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Category not found');
  });

  it('should reject invalid date format', () => {
    const result = createTransaction(baseStore, {
      type: 'expense',
      accountId: 'a1',
      date: 'not-a-date',
      amount: -50,
    });
    expect(result.ok).toBe(false);
  });

  it('should auto-clear reconciled status on affected account', () => {
    const store: DataStore = {
      ...baseStore,
      accounts: [makeAccount({ id: 'a1', reconciled: '2025-01-01' })],
    };
    const result = createTransaction(store, {
      type: 'expense',
      accountId: 'a1',
      date: '2025-01-15',
      amount: -50,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].reconciled).toBe('');
  });
});

describe('updateTransaction', () => {
  const storeWithTx: DataStore = {
    ...baseStore,
    transactions: [makeTx({ id: '1', accountId: 'a1', amount: -50 })],
  };

  it('should update amount', () => {
    const result = updateTransaction(storeWithTx, '1', { amount: -100 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions[0].amount).toBe(-100);
  });

  it('should update accountId', () => {
    const result = updateTransaction(storeWithTx, '1', { accountId: 'a2' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions[0].accountId).toBe('a2');
  });

  it('should reject non-existent transaction', () => {
    const result = updateTransaction(storeWithTx, '999', { amount: -100 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Transaction not found');
  });

  it('should reject non-existent new accountId', () => {
    const result = updateTransaction(storeWithTx, '1', { accountId: 'nonexistent' });
    expect(result.ok).toBe(false);
  });

  it('should reject non-existent new categoryId', () => {
    const result = updateTransaction(storeWithTx, '1', { categoryId: 'nonexistent' });
    expect(result.ok).toBe(false);
  });

  it('should allow setting categoryId to empty (uncategorized)', () => {
    const result = updateTransaction(storeWithTx, '1', { categoryId: '' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions[0].categoryId).toBe('');
  });

  it('should auto-clear reconciled on affected account', () => {
    const store: DataStore = {
      ...baseStore,
      accounts: [makeAccount({ id: 'a1', reconciled: '2025-01-01' }), makeAccount({ id: 'a2' })],
      transactions: [makeTx({ id: '1', accountId: 'a1' })],
    };
    const result = updateTransaction(store, '1', { amount: -200 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].reconciled).toBe('');
  });

  it('should auto-clear reconciled on both old and new account when moving', () => {
    const store: DataStore = {
      ...baseStore,
      accounts: [
        makeAccount({ id: 'a1', reconciled: '2025-01-01' }),
        makeAccount({ id: 'a2', reconciled: '2025-01-01' }),
      ],
      transactions: [makeTx({ id: '1', accountId: 'a1' })],
    };
    const result = updateTransaction(store, '1', { accountId: 'a2' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].reconciled).toBe('');
    expect(result.value.accounts[1].reconciled).toBe('');
  });
});

describe('deleteTransaction', () => {
  it('should delete a simple transaction', () => {
    const store: DataStore = {
      ...baseStore,
      transactions: [makeTx({ id: '1', accountId: 'a1' })],
    };
    const result = deleteTransaction(store, '1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions).toHaveLength(0);
  });

  it('should cascade delete transfer pair', () => {
    const store: DataStore = {
      ...baseStore,
      transactions: [
        makeTx({ id: 't1', type: 'transfer', accountId: 'a1', transferPairId: 't2', amount: -100 }),
        makeTx({ id: 't2', type: 'transfer', accountId: 'a2', transferPairId: 't1', amount: 100 }),
      ],
    };
    const result = deleteTransaction(store, 't1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions).toHaveLength(0);
  });

  it('should return error for non-existent transaction', () => {
    const result = deleteTransaction(baseStore, '999');
    expect(result.ok).toBe(false);
  });

  it('should auto-clear reconciled on affected account', () => {
    const store: DataStore = {
      ...baseStore,
      accounts: [makeAccount({ id: 'a1', reconciled: '2025-01-01' })],
      transactions: [makeTx({ id: '1', accountId: 'a1' })],
    };
    const result = deleteTransaction(store, '1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].reconciled).toBe('');
  });
});

describe('bulkImportTransactions', () => {
  it('should import multiple transactions', () => {
    const result = bulkImportTransactions(baseStore, {
      accountId: 'a1',
      transactions: [
        { type: 'expense', date: '2025-01-15', amount: -50, description: 'Test 1' },
        { type: 'expense', date: '2025-01-16', amount: -75, description: 'Test 2' },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions).toHaveLength(2);
  });

  it('should deduplicate by date|accountId|amount|description', () => {
    const storeWithExisting: DataStore = {
      ...baseStore,
      transactions: [makeTx({ id: '1', accountId: 'a1', date: '2025-01-15', amount: -50, description: 'Test' })],
    };
    const result = bulkImportTransactions(storeWithExisting, {
      accountId: 'a1',
      transactions: [
        { type: 'expense', date: '2025-01-15', amount: -50, description: 'Test' }, // dup
        { type: 'expense', date: '2025-01-16', amount: -75, description: 'New' }, // new
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions).toHaveLength(2); // existing + 1 new
  });

  it('should skip transactions before reconciled date', () => {
    const store: DataStore = {
      ...baseStore,
      accounts: [makeAccount({ id: 'a1', reconciled: '2025-01-10' })],
    };
    const result = bulkImportTransactions(store, {
      accountId: 'a1',
      transactions: [
        { type: 'expense', date: '2025-01-05', amount: -50, description: 'Before' }, // before reconciled
        { type: 'expense', date: '2025-01-15', amount: -75, description: 'After' }, // after
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions).toHaveLength(1);
    expect(result.value.transactions[0].description).toBe('After');
  });

  it('should reject non-existent account', () => {
    const result = bulkImportTransactions(baseStore, {
      accountId: 'nonexistent',
      transactions: [{ type: 'expense', date: '2025-01-15', amount: -50 }],
    });
    expect(result.ok).toBe(false);
  });

  it('should skip invalid rows silently', () => {
    const result = bulkImportTransactions(baseStore, {
      accountId: 'a1',
      transactions: [
        { type: 'expense', date: 'bad-date', amount: -50 }, // invalid
        { type: 'expense', date: '2025-01-15', amount: -75, description: 'Good' }, // valid
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions).toHaveLength(1);
  });

  it('should return unchanged store when nothing to import', () => {
    const storeWithTx: DataStore = {
      ...baseStore,
      transactions: [makeTx({ id: '1', accountId: 'a1', date: '2025-01-15', amount: -50, description: 'Test' })],
    };
    const result = bulkImportTransactions(storeWithTx, {
      accountId: 'a1',
      transactions: [
        { type: 'expense', date: '2025-01-15', amount: -50, description: 'Test' }, // all dupes
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(storeWithTx); // same reference — nothing changed
  });

  it('should set source to import by default', () => {
    const result = bulkImportTransactions(baseStore, {
      accountId: 'a1',
      transactions: [{ type: 'expense', date: '2025-01-15', amount: -50 }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions[0].source).toBe('import');
  });

  it('should handle dangling categoryId by uncategorizing', () => {
    const result = bulkImportTransactions(baseStore, {
      accountId: 'a1',
      transactions: [
        { type: 'expense', date: '2025-01-15', amount: -50, categoryId: 'nonexistent' },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions[0].categoryId).toBe('');
  });
});
