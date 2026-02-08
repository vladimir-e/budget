import { describe, it, expect } from 'vitest';
import {
  getVisibleAccounts,
  getAccountById,
  calculateWorkingBalance,
  getBalanceDiscrepancy,
  createAccount,
  updateAccount,
  hideAccount,
  deleteAccount,
} from '../src/accounts.js';
import type { Account, Transaction } from '../src/types.js';
import type { DataStore } from '../src/store.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: '1',
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
  description: 'Test',
  payee: '',
  transferPairId: '',
  amount: -50,
  notes: '',
  source: 'manual',
  createdAt: '',
  ...overrides,
});

const emptyStore: DataStore = { accounts: [], transactions: [], categories: [] };

const storeWith = (overrides: Partial<DataStore> = {}): DataStore => ({
  ...emptyStore,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Query function tests (existing)
// ---------------------------------------------------------------------------

const sampleAccounts: Account[] = [
  makeAccount({ id: '1', name: 'Checking' }),
  makeAccount({ id: '2', name: 'Old Account', type: 'savings', institution: 'BofA', balance: 0, hidden: true }),
];

describe('accounts — queries', () => {
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

// ---------------------------------------------------------------------------
// CRUD tests
// ---------------------------------------------------------------------------

describe('createAccount', () => {
  it('should create a new account', () => {
    const result = createAccount(emptyStore, {
      name: 'Savings',
      type: 'savings',
      currency: 'USD',
      institution: 'Chase',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts).toHaveLength(1);
    expect(result.value.accounts[0].name).toBe('Savings');
    expect(result.value.accounts[0].id).toBe('1');
    expect(result.value.accounts[0].hidden).toBe(false);
    expect(result.value.accounts[0].reconciled).toBe('');
  });

  it('should auto-increment ID', () => {
    const store = storeWith({ accounts: [makeAccount({ id: '5' })] });
    const result = createAccount(store, {
      name: 'New',
      type: 'checking',
      currency: 'EUR',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[1].id).toBe('6');
  });

  it('should reject invalid input', () => {
    const result = createAccount(emptyStore, {
      name: '',
      type: 'checking',
      currency: 'USD',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Name is required');
  });

  it('should reject invalid type', () => {
    const result = createAccount(emptyStore, {
      name: 'Test',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: 'invalid' as any,
      currency: 'USD',
    });
    expect(result.ok).toBe(false);
  });

  it('should uppercase currency', () => {
    const result = createAccount(emptyStore, {
      name: 'Test',
      type: 'checking',
      currency: 'usd',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].currency).toBe('USD');
  });

  it('should default balance to 0', () => {
    const result = createAccount(emptyStore, {
      name: 'Test',
      type: 'checking',
      currency: 'USD',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].balance).toBe(0);
  });

  it('should accept explicit balance', () => {
    const result = createAccount(emptyStore, {
      name: 'Test',
      type: 'checking',
      currency: 'USD',
      balance: 500,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].balance).toBe(500);
  });
});

describe('updateAccount', () => {
  const store = storeWith({ accounts: [makeAccount({ id: '1', name: 'Checking' })] });

  it('should update name', () => {
    const result = updateAccount(store, '1', { name: 'Main Checking' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].name).toBe('Main Checking');
  });

  it('should update type', () => {
    const result = updateAccount(store, '1', { type: 'savings' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].type).toBe('savings');
  });

  it('should return error for non-existent account', () => {
    const result = updateAccount(store, '999', { name: 'No' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Account not found');
  });

  it('should reject invalid update', () => {
    const result = updateAccount(store, '1', { name: '' });
    expect(result.ok).toBe(false);
  });

  it('should preserve unchanged fields', () => {
    const result = updateAccount(store, '1', { balance: 2000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].name).toBe('Checking');
    expect(result.value.accounts[0].balance).toBe(2000);
  });
});

describe('hideAccount', () => {
  const store = storeWith({ accounts: [makeAccount({ id: '1', hidden: false })] });

  it('should set hidden to true', () => {
    const result = hideAccount(store, '1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].hidden).toBe(true);
  });

  it('should return error for non-existent account', () => {
    const result = hideAccount(store, '999');
    expect(result.ok).toBe(false);
  });
});

describe('deleteAccount', () => {
  it('should delete an account with no transactions', () => {
    const store = storeWith({ accounts: [makeAccount({ id: '1' })] });
    const result = deleteAccount(store, '1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts).toHaveLength(0);
  });

  it('should block deletion when transactions reference the account', () => {
    const store = storeWith({
      accounts: [makeAccount({ id: '1' })],
      transactions: [makeTx({ accountId: '1' })],
    });
    const result = deleteAccount(store, '1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('has associated transactions');
  });

  it('should return error for non-existent account', () => {
    const result = deleteAccount(emptyStore, '999');
    expect(result.ok).toBe(false);
  });
});
