import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_SCHEMA,
  TRANSACTION_SCHEMA,
  CATEGORY_SCHEMA,
  ACCOUNT_FIELDS,
  TRANSACTION_FIELDS,
  CATEGORY_FIELDS,
  CURRENCY_PRECISION,
  getPrecision,
  fieldNames,
  serialize,
  deserialize,
  toIntegerAmount,
  fromIntegerAmount,
  schemaDefaults,
} from '../src/schema.js';
import type { Account, Transaction, Category } from '../src/types.js';

describe('schema', () => {
  // -------------------------------------------------------------------------
  // Field names
  // -------------------------------------------------------------------------

  describe('fieldNames', () => {
    it('should extract ordered field names from ACCOUNT_SCHEMA', () => {
      const names = fieldNames(ACCOUNT_SCHEMA);
      expect(names).toEqual([
        'id', 'name', 'type', 'currency', 'institution',
        'balance', 'hidden', 'reconciled', 'createdAt',
      ]);
    });

    it('should extract ordered field names from TRANSACTION_SCHEMA', () => {
      const names = fieldNames(TRANSACTION_SCHEMA);
      expect(names).toEqual([
        'id', 'type', 'accountId', 'date', 'categoryId', 'description',
        'payee', 'transferPairId', 'amount', 'notes', 'source', 'createdAt',
      ]);
    });

    it('should extract ordered field names from CATEGORY_SCHEMA', () => {
      const names = fieldNames(CATEGORY_SCHEMA);
      expect(names).toEqual(['id', 'type', 'name', 'group', 'assigned', 'hidden']);
    });
  });

  // -------------------------------------------------------------------------
  // Backward-compatible field arrays
  // -------------------------------------------------------------------------

  describe('backward-compatible FIELDS arrays', () => {
    it('ACCOUNT_FIELDS matches ACCOUNT_SCHEMA field names', () => {
      expect([...ACCOUNT_FIELDS]).toEqual(fieldNames(ACCOUNT_SCHEMA));
    });

    it('TRANSACTION_FIELDS matches TRANSACTION_SCHEMA field names', () => {
      expect([...TRANSACTION_FIELDS]).toEqual(fieldNames(TRANSACTION_SCHEMA));
    });

    it('CATEGORY_FIELDS matches CATEGORY_SCHEMA field names', () => {
      expect([...CATEGORY_FIELDS]).toEqual(fieldNames(CATEGORY_SCHEMA));
    });
  });

  // -------------------------------------------------------------------------
  // Currency precision
  // -------------------------------------------------------------------------

  describe('currency precision', () => {
    it('should return 2 for USD', () => {
      expect(getPrecision('USD')).toBe(2);
    });

    it('should return 0 for JPY', () => {
      expect(getPrecision('JPY')).toBe(0);
    });

    it('should return 8 for BTC', () => {
      expect(getPrecision('BTC')).toBe(8);
    });

    it('should default to 2 for unknown currencies', () => {
      expect(getPrecision('XYZ')).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Integer money conversion
  // -------------------------------------------------------------------------

  describe('toIntegerAmount', () => {
    it('should convert "10.50" with precision 2 to 1050', () => {
      expect(toIntegerAmount('10.50', 2)).toBe(1050);
    });

    it('should convert "100" with precision 2 to 10000', () => {
      expect(toIntegerAmount('100', 2)).toBe(10000);
    });

    it('should convert "1000" with precision 0 (JPY) to 1000', () => {
      expect(toIntegerAmount('1000', 0)).toBe(1000);
    });

    it('should convert "0.12345678" with precision 8 (BTC) to 12345678', () => {
      expect(toIntegerAmount('0.12345678', 8)).toBe(12345678);
    });

    it('should handle negative amounts', () => {
      expect(toIntegerAmount('-25.99', 2)).toBe(-2599);
    });

    it('should handle "0"', () => {
      expect(toIntegerAmount('0', 2)).toBe(0);
    });

    it('should handle empty string', () => {
      expect(toIntegerAmount('', 2)).toBe(0);
    });

    it('should handle invalid string', () => {
      expect(toIntegerAmount('not-a-number', 2)).toBe(0);
    });

    it('should not have floating-point drift for typical currency amounts', () => {
      // 0.1 + 0.2 !== 0.3 in float, but integer math is exact
      const a = toIntegerAmount('0.10', 2); // 10
      const b = toIntegerAmount('0.20', 2); // 20
      expect(a + b).toBe(30); // exact integer math
      expect(fromIntegerAmount(a + b, 2)).toBe('0.30');
    });
  });

  describe('fromIntegerAmount', () => {
    it('should convert 1050 with precision 2 to "10.50"', () => {
      expect(fromIntegerAmount(1050, 2)).toBe('10.50');
    });

    it('should convert 1000 with precision 0 (JPY) to "1000"', () => {
      expect(fromIntegerAmount(1000, 0)).toBe('1000');
    });

    it('should convert 12345678 with precision 8 (BTC) to "0.12345678"', () => {
      expect(fromIntegerAmount(12345678, 8)).toBe('0.12345678');
    });

    it('should convert 0 with precision 2 to "0.00"', () => {
      expect(fromIntegerAmount(0, 2)).toBe('0.00');
    });

    it('should handle negative amounts', () => {
      expect(fromIntegerAmount(-2599, 2)).toBe('-25.99');
    });
  });

  // -------------------------------------------------------------------------
  // Serialize / Deserialize
  // -------------------------------------------------------------------------

  describe('deserialize', () => {
    it('should deserialize a raw account record', () => {
      const raw: Record<string, string> = {
        id: '1',
        name: 'Checking',
        type: 'checking',
        currency: 'USD',
        institution: 'Chase',
        balance: '1500.75',
        hidden: 'false',
        reconciled: '2025-01-15',
        createdAt: '2025-01-01T00:00:00Z',
      };
      const account = deserialize<Account>(raw, ACCOUNT_SCHEMA, 2);
      expect(account.id).toBe('1');
      expect(account.name).toBe('Checking');
      expect(account.type).toBe('checking');
      expect(account.balance).toBe(150075); // integer money
      expect(account.hidden).toBe(false);
      expect(account.reconciled).toBe('2025-01-15');
    });

    it('should deserialize a raw transaction record', () => {
      const raw: Record<string, string> = {
        id: '1',
        type: 'expense',
        accountId: '1',
        date: '2025-01-15',
        categoryId: '6',
        description: 'Groceries',
        payee: 'Whole Foods',
        transferPairId: '',
        amount: '-52.30',
        notes: '',
        source: 'manual',
        createdAt: '2025-01-15T10:00:00Z',
      };
      const txn = deserialize<Transaction>(raw, TRANSACTION_SCHEMA, 2);
      expect(txn.amount).toBe(-5230); // integer money
      expect(txn.description).toBe('Groceries');
      expect(txn.transferPairId).toBe('');
    });

    it('should fill missing columns with defaults (schema migration)', () => {
      // Simulate an old CSV that's missing 'institution' and 'reconciled'
      const raw: Record<string, string> = {
        id: '1',
        name: 'Checking',
        type: 'checking',
        currency: 'USD',
        balance: '1000.00',
        hidden: 'false',
        createdAt: '2025-01-01T00:00:00Z',
      };
      const account = deserialize<Account>(raw, ACCOUNT_SCHEMA, 2);
      expect(account.institution).toBe('');    // string default
      expect(account.reconciled).toBe('');      // string default
    });

    it('should ignore extra columns in raw', () => {
      const raw: Record<string, string> = {
        id: '1',
        name: 'Checking',
        type: 'checking',
        currency: 'USD',
        institution: 'Chase',
        balance: '100.00',
        hidden: 'false',
        reconciled: '',
        createdAt: '2025-01-01',
        extraField: 'should be ignored',
        anotherExtra: '999',
      };
      const account = deserialize<Account>(raw, ACCOUNT_SCHEMA, 2);
      expect(account.id).toBe('1');
      expect((account as Record<string, unknown>)['extraField']).toBeUndefined();
    });

    it('should handle "0" correctly for numbers', () => {
      const raw: Record<string, string> = {
        id: '1',
        name: 'Test',
        type: 'checking',
        currency: 'USD',
        institution: '',
        balance: '0',
        hidden: 'false',
        reconciled: '',
        createdAt: '',
      };
      const account = deserialize<Account>(raw, ACCOUNT_SCHEMA, 2);
      expect(account.balance).toBe(0);
    });

    it('should handle "false" correctly for booleans', () => {
      const raw: Record<string, string> = {
        id: '1',
        type: 'expense',
        name: 'Test',
        group: 'Test',
        assigned: '0',
        hidden: 'false',
      };
      const cat = deserialize<Category>(raw, CATEGORY_SCHEMA, 2);
      expect(cat.hidden).toBe(false);
    });

    it('should handle "true" for booleans', () => {
      const raw: Record<string, string> = {
        id: '1',
        type: 'expense',
        name: 'Test',
        group: 'Test',
        assigned: '0',
        hidden: 'true',
      };
      const cat = deserialize<Category>(raw, CATEGORY_SCHEMA, 2);
      expect(cat.hidden).toBe(true);
    });

    it('should handle empty string for money fields', () => {
      const raw: Record<string, string> = {
        id: '1',
        type: 'expense',
        name: 'Test',
        group: 'Test',
        assigned: '',
        hidden: 'false',
      };
      const cat = deserialize<Category>(raw, CATEGORY_SCHEMA, 2);
      expect(cat.assigned).toBe(0);
    });
  });

  describe('serialize', () => {
    it('should serialize an account record', () => {
      const account: Account = {
        id: '1',
        name: 'Checking',
        type: 'checking',
        currency: 'USD',
        institution: 'Chase',
        balance: 150075,  // integer money: $1500.75
        hidden: false,
        reconciled: '2025-01-15',
        createdAt: '2025-01-01T00:00:00Z',
      };
      const raw = serialize(account, ACCOUNT_SCHEMA, 2);
      expect(raw['id']).toBe('1');
      expect(raw['balance']).toBe('1500.75');
      expect(raw['hidden']).toBe('false');
    });

    it('should serialize a transaction record', () => {
      const txn: Transaction = {
        id: '1',
        type: 'expense',
        accountId: '1',
        date: '2025-01-15',
        categoryId: '6',
        description: 'Groceries',
        payee: 'Whole Foods',
        transferPairId: '',
        amount: -5230,  // integer: -$52.30
        notes: '',
        source: 'manual',
        createdAt: '2025-01-15T10:00:00Z',
      };
      const raw = serialize(txn, TRANSACTION_SCHEMA, 2);
      expect(raw['amount']).toBe('-52.30');
    });

    it('should serialize JPY amounts with 0 decimals', () => {
      const account: Account = {
        id: '1',
        name: 'JPY Savings',
        type: 'savings',
        currency: 'JPY',
        institution: 'Test',
        balance: 15000,  // ¥15000
        hidden: false,
        reconciled: '',
        createdAt: '',
      };
      const raw = serialize(account, ACCOUNT_SCHEMA, 0);
      expect(raw['balance']).toBe('15000');
    });

    it('should serialize BTC amounts with 8 decimals', () => {
      const account: Account = {
        id: '1',
        name: 'BTC Wallet',
        type: 'crypto',
        currency: 'BTC',
        institution: '',
        balance: 12345678,  // 0.12345678 BTC
        hidden: false,
        reconciled: '',
        createdAt: '',
      };
      const raw = serialize(account, ACCOUNT_SCHEMA, 8);
      expect(raw['balance']).toBe('0.12345678');
    });
  });

  describe('round-trip serialize/deserialize', () => {
    it('should round-trip an account record', () => {
      const original: Account = {
        id: '1',
        name: 'Checking',
        type: 'checking',
        currency: 'USD',
        institution: 'Chase',
        balance: 150075,
        hidden: false,
        reconciled: '2025-01-15',
        createdAt: '2025-01-01T00:00:00Z',
      };
      const raw = serialize(original, ACCOUNT_SCHEMA, 2);
      const restored = deserialize<Account>(raw, ACCOUNT_SCHEMA, 2);
      expect(restored).toEqual(original);
    });

    it('should round-trip a category record', () => {
      const original: Category = {
        id: '5',
        type: 'expense',
        name: 'Groceries',
        group: 'Immediate Obligations',
        assigned: 50000, // $500.00
        hidden: false,
      };
      const raw = serialize(original, CATEGORY_SCHEMA, 2);
      const restored = deserialize<Category>(raw, CATEGORY_SCHEMA, 2);
      expect(restored).toEqual(original);
    });

    it('should round-trip with BTC precision', () => {
      const original: Account = {
        id: '1',
        name: 'BTC Wallet',
        type: 'crypto',
        currency: 'BTC',
        institution: '',
        balance: 12345678,
        hidden: false,
        reconciled: '',
        createdAt: '',
      };
      const raw = serialize(original, ACCOUNT_SCHEMA, 8);
      const restored = deserialize<Account>(raw, ACCOUNT_SCHEMA, 8);
      expect(restored).toEqual(original);
    });

    it('should round-trip with JPY precision (0 decimals)', () => {
      const original: Account = {
        id: '1',
        name: 'JPY Account',
        type: 'savings',
        currency: 'JPY',
        institution: 'Test Bank',
        balance: 150000,
        hidden: false,
        reconciled: '',
        createdAt: '',
      };
      const raw = serialize(original, ACCOUNT_SCHEMA, 0);
      const restored = deserialize<Account>(raw, ACCOUNT_SCHEMA, 0);
      expect(restored).toEqual(original);
    });
  });

  // -------------------------------------------------------------------------
  // Schema defaults
  // -------------------------------------------------------------------------

  describe('schemaDefaults', () => {
    it('should return defaults for all account fields', () => {
      const defaults = schemaDefaults(ACCOUNT_SCHEMA);
      expect(defaults['id']).toBe('');
      expect(defaults['balance']).toBe(0);
      expect(defaults['hidden']).toBe(false);
    });
  });
});
