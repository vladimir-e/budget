import { describe, it, expect } from 'vitest';
import {
  getTransferPair,
  isTransfer,
  createTransfer,
  syncTransferAmount,
  unlinkTransfer,
} from '../src/transfers.js';
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
  description: 'Test',
  payee: '',
  transferPairId: '',
  amount: -50,
  notes: '',
  source: 'manual',
  createdAt: '',
  ...overrides,
});

const baseStore: DataStore = {
  accounts: [makeAccount({ id: 'a1' }), makeAccount({ id: 'a2', name: 'Savings', type: 'savings' })],
  transactions: [],
  categories: [],
};

// ---------------------------------------------------------------------------
// Query function tests (existing)
// ---------------------------------------------------------------------------

describe('transfers — queries', () => {
  it('should find transfer pair', () => {
    const records = [
      makeTx({ id: 't1', type: 'transfer', transferPairId: 't2', amount: -100 }),
      makeTx({ id: 't2', type: 'transfer', transferPairId: 't1', amount: 100 }),
    ];
    const pair = getTransferPair(records, records[0]);
    expect(pair?.id).toBe('t2');
  });

  it('should return undefined for non-transfer', () => {
    const records = [makeTx({ id: '1' })];
    expect(getTransferPair(records, records[0])).toBeUndefined();
  });

  it('should identify transfers', () => {
    expect(isTransfer(makeTx({ type: 'transfer', transferPairId: 't2' }))).toBe(true);
    expect(isTransfer(makeTx({ type: 'expense' }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Transfer CRUD tests
// ---------------------------------------------------------------------------

describe('createTransfer', () => {
  it('should create two linked transactions', () => {
    const result = createTransfer(baseStore, {
      fromAccountId: 'a1',
      toAccountId: 'a2',
      amount: 500,
      date: '2025-01-15',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions).toHaveLength(2);

    const [outflow, inflow] = result.value.transactions;
    expect(outflow.type).toBe('transfer');
    expect(outflow.accountId).toBe('a1');
    expect(outflow.amount).toBe(-500);
    expect(outflow.transferPairId).toBe(inflow.id);

    expect(inflow.type).toBe('transfer');
    expect(inflow.accountId).toBe('a2');
    expect(inflow.amount).toBe(500);
    expect(inflow.transferPairId).toBe(outflow.id);
  });

  it('should use absolute amount regardless of sign', () => {
    const result = createTransfer(baseStore, {
      fromAccountId: 'a1',
      toAccountId: 'a2',
      amount: -500,
      date: '2025-01-15',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions[0].amount).toBe(-500);
    expect(result.value.transactions[1].amount).toBe(500);
  });

  it('should reject same account transfer', () => {
    const result = createTransfer(baseStore, {
      fromAccountId: 'a1',
      toAccountId: 'a1',
      amount: 100,
      date: '2025-01-15',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('same account');
  });

  it('should reject non-existent from account', () => {
    const result = createTransfer(baseStore, {
      fromAccountId: 'nonexistent',
      toAccountId: 'a2',
      amount: 100,
      date: '2025-01-15',
    });
    expect(result.ok).toBe(false);
  });

  it('should reject non-existent to account', () => {
    const result = createTransfer(baseStore, {
      fromAccountId: 'a1',
      toAccountId: 'nonexistent',
      amount: 100,
      date: '2025-01-15',
    });
    expect(result.ok).toBe(false);
  });

  it('should reject zero amount', () => {
    const result = createTransfer(baseStore, {
      fromAccountId: 'a1',
      toAccountId: 'a2',
      amount: 0,
      date: '2025-01-15',
    });
    expect(result.ok).toBe(false);
  });

  it('should reject invalid date', () => {
    const result = createTransfer(baseStore, {
      fromAccountId: 'a1',
      toAccountId: 'a2',
      amount: 100,
      date: 'bad-date',
    });
    expect(result.ok).toBe(false);
  });

  it('should auto-clear reconciled on both accounts', () => {
    const store: DataStore = {
      ...baseStore,
      accounts: [
        makeAccount({ id: 'a1', reconciled: '2025-01-01' }),
        makeAccount({ id: 'a2', reconciled: '2025-01-01' }),
      ],
    };
    const result = createTransfer(store, {
      fromAccountId: 'a1',
      toAccountId: 'a2',
      amount: 100,
      date: '2025-01-15',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].reconciled).toBe('');
    expect(result.value.accounts[1].reconciled).toBe('');
  });
});

describe('syncTransferAmount', () => {
  const transferStore: DataStore = {
    ...baseStore,
    transactions: [
      makeTx({ id: 't1', type: 'transfer', accountId: 'a1', transferPairId: 't2', amount: -100 }),
      makeTx({ id: 't2', type: 'transfer', accountId: 'a2', transferPairId: 't1', amount: 100 }),
    ],
  };

  it('should sync amount — update one side, other gets flipped', () => {
    const result = syncTransferAmount(transferStore, 't1', -200);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const t1 = result.value.transactions.find((t) => t.id === 't1');
    const t2 = result.value.transactions.find((t) => t.id === 't2');
    expect(t1?.amount).toBe(-200);
    expect(t2?.amount).toBe(200);
  });

  it('should return error for non-transfer', () => {
    const store: DataStore = {
      ...baseStore,
      transactions: [makeTx({ id: '1', transferPairId: '' })],
    };
    const result = syncTransferAmount(store, '1', -200);
    expect(result.ok).toBe(false);
  });

  it('should reject expense with stray transferPairId', () => {
    const store: DataStore = {
      ...baseStore,
      transactions: [
        makeTx({ id: '1', type: 'expense', accountId: 'a1', transferPairId: '2' }),
        makeTx({ id: '2', type: 'expense', accountId: 'a1' }),
      ],
    };
    const result = syncTransferAmount(store, '1', -200);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('not a transfer');
  });

  it('should reject when pair is not a transfer type', () => {
    const store: DataStore = {
      ...baseStore,
      transactions: [
        makeTx({ id: 't1', type: 'transfer', accountId: 'a1', transferPairId: '2' }),
        makeTx({ id: '2', type: 'expense', accountId: 'a1' }),
      ],
    };
    const result = syncTransferAmount(store, 't1', -200);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('corrupted');
  });

  it('should return error for non-existent transaction', () => {
    const result = syncTransferAmount(transferStore, '999', -200);
    expect(result.ok).toBe(false);
  });

  it('should auto-clear reconciled on both accounts', () => {
    const store: DataStore = {
      ...baseStore,
      accounts: [
        makeAccount({ id: 'a1', reconciled: '2025-01-01' }),
        makeAccount({ id: 'a2', reconciled: '2025-01-01' }),
      ],
      transactions: transferStore.transactions,
    };
    const result = syncTransferAmount(store, 't1', -200);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].reconciled).toBe('');
    expect(result.value.accounts[1].reconciled).toBe('');
  });
});

describe('unlinkTransfer', () => {
  const transferStore: DataStore = {
    ...baseStore,
    transactions: [
      makeTx({ id: 't1', type: 'transfer', accountId: 'a1', transferPairId: 't2', amount: -100 }),
      makeTx({ id: 't2', type: 'transfer', accountId: 'a2', transferPairId: 't1', amount: 100 }),
    ],
  };

  it('should unlink and delete paired transaction', () => {
    const result = unlinkTransfer(transferStore, 't1', 'expense');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions).toHaveLength(1);
    expect(result.value.transactions[0].id).toBe('t1');
    expect(result.value.transactions[0].type).toBe('expense');
    expect(result.value.transactions[0].transferPairId).toBe('');
  });

  it('should work when unlinking the other side', () => {
    const result = unlinkTransfer(transferStore, 't2', 'income');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions).toHaveLength(1);
    expect(result.value.transactions[0].id).toBe('t2');
    expect(result.value.transactions[0].type).toBe('income');
  });

  it('should return error for non-transfer', () => {
    const store: DataStore = {
      ...baseStore,
      transactions: [makeTx({ id: '1', transferPairId: '' })],
    };
    const result = unlinkTransfer(store, '1', 'expense');
    expect(result.ok).toBe(false);
  });

  it('should reject expense with stray transferPairId', () => {
    const store: DataStore = {
      ...baseStore,
      transactions: [
        makeTx({ id: '1', type: 'expense', accountId: 'a1', transferPairId: '2' }),
        makeTx({ id: '2', type: 'expense', accountId: 'a1' }),
      ],
    };
    const result = unlinkTransfer(store, '1', 'expense');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('not a transfer');
  });

  it('should return error for non-existent transaction', () => {
    const result = unlinkTransfer(transferStore, '999', 'expense');
    expect(result.ok).toBe(false);
  });

  it('should auto-clear reconciled on affected accounts', () => {
    const store: DataStore = {
      ...baseStore,
      accounts: [
        makeAccount({ id: 'a1', reconciled: '2025-01-01' }),
        makeAccount({ id: 'a2', reconciled: '2025-01-01' }),
      ],
      transactions: transferStore.transactions,
    };
    const result = unlinkTransfer(store, 't1', 'expense');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accounts[0].reconciled).toBe('');
    expect(result.value.accounts[1].reconciled).toBe('');
  });
});
