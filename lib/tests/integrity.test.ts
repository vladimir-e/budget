/**
 * Data integrity test suite — ensures referential integrity, corruption
 * resistance, and correct cascading/blocking behavior across all CRUD
 * operations.
 */

import { describe, it, expect } from 'vitest';
import { createAccount } from '../src/accounts.js';
import { createTransaction, deleteTransaction, bulkImportTransactions } from '../src/transactions.js';
import { createCategory, deleteCategory, updateCategory } from '../src/categories.js';
import { createTransfer, unlinkTransfer } from '../src/transfers.js';
import { reconcileAccount, createBalanceAdjustment } from '../src/reconcile.js';
import { deleteAccount, hideAccount, updateAccount } from '../src/accounts.js';
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
  balance: 0,
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

const makeCat = (overrides: Partial<Category> = {}): Category => ({
  id: 'c1',
  type: 'expense',
  name: 'Groceries',
  group: 'Immediate Obligations',
  assigned: 500,
  hidden: false,
  ...overrides,
});

const emptyStore: DataStore = { accounts: [], transactions: [], categories: [] };

// ---------------------------------------------------------------------------
// Integration: end-to-end workflow
// ---------------------------------------------------------------------------

describe('integration — end-to-end workflow', () => {
  it('create account → add transactions → categorize → reconcile → delete category → verify nullification', () => {
    // 1. Create account
    let result = createAccount(emptyStore, {
      name: 'Checking',
      type: 'checking',
      currency: 'USD',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    let store = result.value;
    const accountId = store.accounts[0].id;

    // 2. Create category
    result = createCategory(store, {
      name: 'Groceries',
      type: 'expense',
      group: 'Immediate Obligations',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    store = result.value;
    const categoryId = store.categories[0].id;

    // 3. Add transactions
    let txResult = createTransaction(store, {
      type: 'expense',
      accountId,
      date: '2025-01-15',
      categoryId,
      amount: -100,
      description: 'Groceries',
    });
    expect(txResult.ok).toBe(true);
    if (!txResult.ok) return;
    store = txResult.value;

    txResult = createTransaction(store, {
      type: 'income',
      accountId,
      date: '2025-01-10',
      amount: 500,
      description: 'Salary',
    });
    expect(txResult.ok).toBe(true);
    if (!txResult.ok) return;
    store = txResult.value;

    expect(store.transactions).toHaveLength(2);

    // 4. Reconcile (working balance = -100 + 500 = 400)
    const reconcileResult = reconcileAccount(store, accountId, 400);
    expect(reconcileResult.ok).toBe(true);
    if (!reconcileResult.ok) return;
    store = reconcileResult.value;
    expect(store.accounts[0].reconciled).toBeTruthy();

    // 5. Delete category → verify transactions nullified
    const deleteResult = deleteCategory(store, categoryId);
    expect(deleteResult.ok).toBe(true);
    if (!deleteResult.ok) return;
    store = deleteResult.value;
    expect(store.categories).toHaveLength(0);
    // The grocery transaction should now be uncategorized
    const groceryTx = store.transactions.find((t) => t.description === 'Groceries');
    expect(groceryTx?.categoryId).toBe('');
    // The salary transaction was already uncategorized
    const salaryTx = store.transactions.find((t) => t.description === 'Salary');
    expect(salaryTx?.categoryId).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Referential integrity: every cascade/block/nullify scenario
// ---------------------------------------------------------------------------

describe('referential integrity', () => {
  it('should block account deletion when transactions exist', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1' })],
      transactions: [makeTx({ accountId: 'a1' })],
      categories: [],
    };
    const result = deleteAccount(store, 'a1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('associated transactions');
  });

  it('should cascade delete transfer pair on transaction delete', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1' }), makeAccount({ id: 'a2' })],
      transactions: [
        makeTx({ id: 't1', type: 'transfer', accountId: 'a1', transferPairId: 't2', amount: -100 }),
        makeTx({ id: 't2', type: 'transfer', accountId: 'a2', transferPairId: 't1', amount: 100 }),
        makeTx({ id: 't3', type: 'expense', accountId: 'a1', amount: -50 }),
      ],
      categories: [],
    };
    const result = deleteTransaction(store, 't1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // t1 and t2 deleted, t3 remains
    expect(result.value.transactions).toHaveLength(1);
    expect(result.value.transactions[0].id).toBe('t3');
  });

  it('should nullify category references on category delete', () => {
    const store: DataStore = {
      accounts: [],
      transactions: [
        makeTx({ id: '1', categoryId: 'c1' }),
        makeTx({ id: '2', categoryId: 'c1' }),
        makeTx({ id: '3', categoryId: 'c2' }),
      ],
      categories: [makeCat({ id: 'c1' }), makeCat({ id: 'c2', name: 'Dining' })],
    };
    const result = deleteCategory(store, 'c1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions[0].categoryId).toBe('');
    expect(result.value.transactions[1].categoryId).toBe('');
    expect(result.value.transactions[2].categoryId).toBe('c2');
    expect(result.value.categories).toHaveLength(1);
    expect(result.value.categories[0].id).toBe('c2');
  });

  it('should prevent transaction creation with non-existent account', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1' })],
      transactions: [],
      categories: [],
    };
    const result = createTransaction(store, {
      type: 'expense',
      accountId: 'nonexistent',
      date: '2025-01-15',
      amount: -50,
    });
    expect(result.ok).toBe(false);
  });

  it('should prevent transaction creation with non-existent category', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1' })],
      transactions: [],
      categories: [],
    };
    const result = createTransaction(store, {
      type: 'expense',
      accountId: 'a1',
      date: '2025-01-15',
      categoryId: 'nonexistent',
      amount: -50,
    });
    expect(result.ok).toBe(false);
  });

  it('should prevent transfer creation with non-existent accounts', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1' })],
      transactions: [],
      categories: [],
    };
    const result = createTransfer(store, {
      fromAccountId: 'a1',
      toAccountId: 'nonexistent',
      amount: 100,
      date: '2025-01-15',
    });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Corruption resistance: dangling references never crash
// ---------------------------------------------------------------------------

describe('corruption resistance', () => {
  it('should handle dangling accountId in transactions gracefully', () => {
    // Transaction references account that doesn't exist in store
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1' })],
      transactions: [makeTx({ id: '1', accountId: 'nonexistent' })],
      categories: [],
    };
    // Should be able to delete without crash
    const result = deleteTransaction(store, '1');
    expect(result.ok).toBe(true);
  });

  it('should handle dangling categoryId in transactions gracefully', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1' })],
      transactions: [makeTx({ id: '1', accountId: 'a1', categoryId: 'nonexistent' })],
      categories: [],
    };
    // Deleting a transaction with a dangling categoryId should not crash
    const result = deleteTransaction(store, '1');
    expect(result.ok).toBe(true);
  });

  it('should handle dangling transferPairId gracefully', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1' })],
      transactions: [makeTx({ id: 't1', type: 'transfer', accountId: 'a1', transferPairId: 'nonexistent' })],
      categories: [],
    };
    // Delete should work — the dangling pair reference just means the pair doesn't exist
    const result = deleteTransaction(store, 't1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions).toHaveLength(0);
  });

  it('should handle bulk import with dangling category references', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1' })],
      transactions: [],
      categories: [],
    };
    const result = bulkImportTransactions(store, {
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

// ---------------------------------------------------------------------------
// Auto-clear reconciliation on mutation
// ---------------------------------------------------------------------------

describe('auto-clear reconciliation', () => {
  const reconciledStore: DataStore = {
    accounts: [
      makeAccount({ id: 'a1', reconciled: '2025-01-01', balance: 400 }),
      makeAccount({ id: 'a2', reconciled: '2025-01-01', balance: 0 }),
    ],
    transactions: [
      makeTx({ id: '1', accountId: 'a1', amount: 400 }),
    ],
    categories: [makeCat({ id: 'c1' })],
  };

  it('should clear reconciled when creating a transaction', () => {
    const result = createTransaction(reconciledStore, {
      type: 'expense',
      accountId: 'a1',
      date: '2025-02-01',
      amount: -50,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].reconciled).toBe('');
    // a2 should remain reconciled (not affected)
    expect(result.value.accounts[1].reconciled).toBe('2025-01-01');
  });

  it('should clear reconciled when deleting a transaction', () => {
    const result = deleteTransaction(reconciledStore, '1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].reconciled).toBe('');
  });

  it('should clear reconciled when creating a transfer', () => {
    const result = createTransfer(reconciledStore, {
      fromAccountId: 'a1',
      toAccountId: 'a2',
      amount: 100,
      date: '2025-02-01',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].reconciled).toBe('');
    expect(result.value.accounts[1].reconciled).toBe('');
  });

  it('should clear reconciled when unlinking a transfer', () => {
    // First create a transfer
    const transferResult = createTransfer(reconciledStore, {
      fromAccountId: 'a1',
      toAccountId: 'a2',
      amount: 100,
      date: '2025-02-01',
    });
    expect(transferResult.ok).toBe(true);
    if (!transferResult.ok) return;

    // Re-reconcile both accounts for the test
    let store = transferResult.value;
    store = {
      ...store,
      accounts: store.accounts.map((a) => ({ ...a, reconciled: '2025-02-01' })),
    };

    // Now unlink — should clear reconciled
    const outflowId = store.transactions[store.transactions.length - 2].id;
    const unlinkResult = unlinkTransfer(store, outflowId, 'expense');
    expect(unlinkResult.ok).toBe(true);
    if (!unlinkResult.ok) return;
    expect(unlinkResult.value.accounts[0].reconciled).toBe('');
    expect(unlinkResult.value.accounts[1].reconciled).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

describe('bulk operations', () => {
  it('should import many transactions with dedup', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1' })],
      transactions: [],
      categories: [],
    };

    // Generate 100 transactions
    const inputTxns = Array.from({ length: 100 }, (_, i) => ({
      type: 'expense' as const,
      date: `2025-01-${String(Math.floor(i / 5) + 1).padStart(2, '0')}`,
      amount: -(i + 1) * 10,
      description: `Transaction ${i}`,
    }));

    const result = bulkImportTransactions(store, {
      accountId: 'a1',
      transactions: inputTxns,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions).toHaveLength(100);

    // Import again — all should be deduped
    const result2 = bulkImportTransactions(result.value, {
      accountId: 'a1',
      transactions: inputTxns,
    });
    expect(result2.ok).toBe(true);
    if (!result2.ok) return;
    expect(result2.value.transactions).toHaveLength(100); // no new ones
  });

  it('should delete category with many referencing transactions', () => {
    const store: DataStore = {
      accounts: [makeAccount({ id: 'a1' })],
      transactions: Array.from({ length: 50 }, (_, i) => makeTx({
        id: String(i + 1),
        accountId: 'a1',
        categoryId: 'c1',
        amount: -(i + 1),
      })),
      categories: [makeCat({ id: 'c1' })],
    };

    const result = deleteCategory(store, 'c1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categories).toHaveLength(0);
    // All 50 transactions should now be uncategorized
    for (const tx of result.value.transactions) {
      expect(tx.categoryId).toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// Immutability: operations never mutate original store
// ---------------------------------------------------------------------------

describe('immutability', () => {
  it('should not mutate original store on account creation', () => {
    const original: DataStore = { accounts: [], transactions: [], categories: [] };
    const result = createAccount(original, { name: 'Test', type: 'checking', currency: 'USD' });
    expect(result.ok).toBe(true);
    expect(original.accounts).toHaveLength(0);
  });

  it('should not mutate original store on transaction creation', () => {
    const original: DataStore = {
      accounts: [makeAccount({ id: 'a1' })],
      transactions: [],
      categories: [],
    };
    const result = createTransaction(original, {
      type: 'expense',
      accountId: 'a1',
      date: '2025-01-15',
      amount: -50,
    });
    expect(result.ok).toBe(true);
    expect(original.transactions).toHaveLength(0);
  });

  it('should not mutate original store on category deletion', () => {
    const original: DataStore = {
      accounts: [],
      transactions: [makeTx({ id: '1', categoryId: 'c1' })],
      categories: [makeCat({ id: 'c1' })],
    };
    const result = deleteCategory(original, 'c1');
    expect(result.ok).toBe(true);
    expect(original.categories).toHaveLength(1);
    expect(original.transactions[0].categoryId).toBe('c1');
  });

  it('should not mutate original store on transfer creation', () => {
    const original: DataStore = {
      accounts: [makeAccount({ id: 'a1' }), makeAccount({ id: 'a2' })],
      transactions: [],
      categories: [],
    };
    const result = createTransfer(original, {
      fromAccountId: 'a1',
      toAccountId: 'a2',
      amount: 100,
      date: '2025-01-15',
    });
    expect(result.ok).toBe(true);
    expect(original.transactions).toHaveLength(0);
  });
});
