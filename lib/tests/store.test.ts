import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadStore, persistStore } from '../src/store.js';
import type { DataStore } from '../src/store.js';

describe('store', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pfs-store-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // loadStore
  // -------------------------------------------------------------------------

  describe('loadStore', () => {
    it('should load from a data directory with CSV files', async () => {
      await writeFile(join(tempDir, 'accounts.csv'),
        'id,name,type,currency,institution,balance,hidden,reconciled,createdAt\n' +
        '1,Checking,checking,USD,Chase,1500.75,false,,2025-01-01\n',
      );
      await writeFile(join(tempDir, 'transactions.csv'),
        'id,type,accountId,date,categoryId,description,payee,transferPairId,amount,notes,source,createdAt\n' +
        '1,expense,1,2025-01-15,6,Groceries,Whole Foods,,-52.30,,manual,2025-01-15\n',
      );
      await writeFile(join(tempDir, 'categories.csv'),
        'id,name,group,assigned,hidden\n' +
        '6,Groceries,Immediate Obligations,500.00,false\n',
      );

      const store = await loadStore(tempDir);

      expect(store.accounts).toHaveLength(1);
      expect(store.accounts[0].name).toBe('Checking');
      expect(store.accounts[0].balance).toBe(150075); // integer money

      expect(store.transactions).toHaveLength(1);
      expect(store.transactions[0].amount).toBe(-5230); // integer money
      expect(store.transactions[0].description).toBe('Groceries');

      expect(store.categories).toHaveLength(1);
      expect(store.categories[0].assigned).toBe(50000); // integer money
    });

    it('should return empty arrays for empty data directory', async () => {
      const store = await loadStore(tempDir);
      expect(store.accounts).toEqual([]);
      expect(store.transactions).toEqual([]);
      expect(store.categories).toEqual([]);
    });

    it('should return empty arrays for missing files', async () => {
      // Only accounts.csv exists
      await writeFile(join(tempDir, 'accounts.csv'),
        'id,name,type,currency,institution,balance,hidden,reconciled,createdAt\n',
      );
      const store = await loadStore(tempDir);
      expect(store.accounts).toEqual([]);
      expect(store.transactions).toEqual([]);
      expect(store.categories).toEqual([]);
    });

    it('should handle multi-currency accounts', async () => {
      await writeFile(join(tempDir, 'accounts.csv'),
        'id,name,type,currency,institution,balance,hidden,reconciled,createdAt\n' +
        '1,USD Account,checking,USD,,1500.75,false,,\n' +
        '2,JPY Account,savings,JPY,,15000,false,,\n' +
        '3,BTC Wallet,crypto,BTC,,0.12345678,false,,\n',
      );
      await writeFile(join(tempDir, 'transactions.csv'),
        'id,type,accountId,date,categoryId,description,payee,transferPairId,amount,notes,source,createdAt\n',
      );
      await writeFile(join(tempDir, 'categories.csv'),
        'id,name,group,assigned,hidden\n',
      );

      const store = await loadStore(tempDir);
      expect(store.accounts[0].balance).toBe(150075);       // USD: ×100
      expect(store.accounts[1].balance).toBe(15000);         // JPY: ×1
      expect(store.accounts[2].balance).toBe(12345678);      // BTC: ×10^8
    });

    it('should handle dangling references without crashing', async () => {
      await writeFile(join(tempDir, 'accounts.csv'),
        'id,name,type,currency,institution,balance,hidden,reconciled,createdAt\n',
      );
      await writeFile(join(tempDir, 'transactions.csv'),
        'id,type,accountId,date,categoryId,description,payee,transferPairId,amount,notes,source,createdAt\n' +
        '1,expense,999,2025-01-15,888,Orphaned,,,-10.00,,manual,\n',
      );
      await writeFile(join(tempDir, 'categories.csv'),
        'id,name,group,assigned,hidden\n',
      );

      const store = await loadStore(tempDir);
      expect(store.transactions).toHaveLength(1);
      expect(store.transactions[0].accountId).toBe('999');  // dangling but no crash
      expect(store.transactions[0].categoryId).toBe('888');
    });
  });

  // -------------------------------------------------------------------------
  // persistStore
  // -------------------------------------------------------------------------

  describe('persistStore', () => {
    it('should persist and reload a store', async () => {
      const store: DataStore = {
        accounts: [
          {
            id: '1', name: 'Checking', type: 'checking', currency: 'USD',
            institution: 'Chase', balance: 150075, hidden: false,
            reconciled: '2025-01-15', createdAt: '2025-01-01',
          },
        ],
        transactions: [
          {
            id: '1', type: 'expense', accountId: '1', date: '2025-01-15',
            categoryId: '1', description: 'Test', payee: '', transferPairId: '',
            amount: -5230, notes: '', source: 'manual', createdAt: '2025-01-15',
          },
        ],
        categories: [
          { id: '1', name: 'Groceries', group: 'Needs', assigned: 50000, hidden: false },
        ],
      };

      await persistStore(store, tempDir);
      const reloaded = await loadStore(tempDir);

      expect(reloaded).toEqual(store);
    });

    it('should persist empty store', async () => {
      const store: DataStore = { accounts: [], transactions: [], categories: [] };
      await persistStore(store, tempDir);
      const reloaded = await loadStore(tempDir);
      expect(reloaded).toEqual(store);
    });

    it('should persist multi-currency data correctly', async () => {
      const store: DataStore = {
        accounts: [
          {
            id: '1', name: 'USD', type: 'checking', currency: 'USD',
            institution: '', balance: 150075, hidden: false, reconciled: '', createdAt: '',
          },
          {
            id: '2', name: 'JPY', type: 'savings', currency: 'JPY',
            institution: '', balance: 15000, hidden: false, reconciled: '', createdAt: '',
          },
        ],
        transactions: [
          {
            id: '1', type: 'expense', accountId: '1', date: '2025-01-15',
            categoryId: '', description: 'USD txn', payee: '', transferPairId: '',
            amount: -5230, notes: '', source: '', createdAt: '',
          },
          {
            id: '2', type: 'expense', accountId: '2', date: '2025-01-15',
            categoryId: '', description: 'JPY txn', payee: '', transferPairId: '',
            amount: -1500, notes: '', source: '', createdAt: '',
          },
        ],
        categories: [],
      };

      await persistStore(store, tempDir);
      const reloaded = await loadStore(tempDir);
      expect(reloaded).toEqual(store);
    });
  });
});
