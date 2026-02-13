import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { atomicWriteFile, readCSVFile, writeCSVFile, appendCSVRecords } from '../src/storage.js';
import { ACCOUNT_SCHEMA, CATEGORY_SCHEMA } from '../src/schema.js';
import type { Account, Category } from '../src/types.js';

describe('storage', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pfs-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // atomicWriteFile
  // -------------------------------------------------------------------------

  describe('atomicWriteFile', () => {
    it('should write content to a file', async () => {
      const filePath = join(tempDir, 'test.txt');
      await atomicWriteFile(filePath, 'hello world');
      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('hello world');
    });

    it('should overwrite existing file', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'old content');
      await atomicWriteFile(filePath, 'new content');
      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('new content');
    });

    it('should not leave temp files on success', async () => {
      const filePath = join(tempDir, 'test.txt');
      await atomicWriteFile(filePath, 'content');
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(tempDir);
      expect(files).toEqual(['test.txt']);
    });
  });

  // -------------------------------------------------------------------------
  // readCSVFile / writeCSVFile round-trip
  // -------------------------------------------------------------------------

  describe('readCSVFile + writeCSVFile', () => {
    it('should round-trip account records', async () => {
      const filePath = join(tempDir, 'accounts.csv');
      const accounts: Account[] = [
        {
          id: '1', name: 'Checking', type: 'checking', currency: 'USD',
          institution: 'Chase', balance: 150075, hidden: false,
          reconciled: '2025-01-15', createdAt: '2025-01-01',
        },
        {
          id: '2', name: 'Savings', type: 'savings', currency: 'USD',
          institution: 'BofA', balance: 500000, hidden: false,
          reconciled: '', createdAt: '2025-01-01',
        },
      ];

      await writeCSVFile(filePath, ACCOUNT_SCHEMA, accounts, { precision: 2 });
      const loaded = await readCSVFile<Account>(filePath, ACCOUNT_SCHEMA, { precision: 2 });
      expect(loaded).toEqual(accounts);
    });

    it('should round-trip category records', async () => {
      const filePath = join(tempDir, 'categories.csv');
      const categories: Category[] = [
        { id: '1', name: 'Groceries', group: 'Immediate Obligations', assigned: 50000, hidden: false },
        { id: '2', name: 'Dining Out', group: 'Lifestyle', assigned: 15000, hidden: true },
      ];

      await writeCSVFile(filePath, CATEGORY_SCHEMA, categories, { precision: 2 });
      const loaded = await readCSVFile<Category>(filePath, CATEGORY_SCHEMA, { precision: 2 });
      expect(loaded).toEqual(categories);
    });

    it('should handle empty records', async () => {
      const filePath = join(tempDir, 'empty.csv');
      await writeCSVFile(filePath, ACCOUNT_SCHEMA, [], { precision: 2 });
      const loaded = await readCSVFile<Account>(filePath, ACCOUNT_SCHEMA, { precision: 2 });
      expect(loaded).toEqual([]);
    });

    it('should handle per-record precision', async () => {
      const filePath = join(tempDir, 'accounts.csv');
      const accounts: Account[] = [
        {
          id: '1', name: 'USD Account', type: 'checking', currency: 'USD',
          institution: '', balance: 150075, hidden: false, reconciled: '', createdAt: '',
        },
        {
          id: '2', name: 'JPY Account', type: 'savings', currency: 'JPY',
          institution: '', balance: 15000, hidden: false, reconciled: '', createdAt: '',
        },
      ];

      const getPrecisionForWrite = (record: Record<string, unknown>) => {
        const currency = String(record['currency'] || 'USD');
        return currency === 'JPY' ? 0 : 2;
      };

      await writeCSVFile(filePath, ACCOUNT_SCHEMA, accounts, {
        getPrecisionForRecord: getPrecisionForWrite,
      });

      // Verify the CSV content has correct decimal formatting
      const csvContent = await readFile(filePath, 'utf-8');
      expect(csvContent).toContain('1500.75');  // USD: 2 decimals
      expect(csvContent).toContain('15000');     // JPY: 0 decimals

      const getPrecisionForRead = (raw: Record<string, string>) => {
        return raw['currency'] === 'JPY' ? 0 : 2;
      };

      const loaded = await readCSVFile<Account>(filePath, ACCOUNT_SCHEMA, {
        getPrecisionForRecord: getPrecisionForRead,
      });
      expect(loaded).toEqual(accounts);
    });
  });

  // -------------------------------------------------------------------------
  // Schema migration on read
  // -------------------------------------------------------------------------

  describe('schema migration', () => {
    it('should fill missing columns with defaults on read', async () => {
      const filePath = join(tempDir, 'old-accounts.csv');
      // Old CSV missing 'institution' and 'reconciled' columns
      await writeFile(filePath, 'id,name,type,currency,balance,hidden,createdAt\n1,Checking,checking,USD,1000.00,false,2025-01-01\n');

      const loaded = await readCSVFile<Account>(filePath, ACCOUNT_SCHEMA, { precision: 2 });
      expect(loaded).toHaveLength(1);
      expect(loaded[0].institution).toBe('');    // default for missing string
      expect(loaded[0].reconciled).toBe('');      // default for missing string
      expect(loaded[0].balance).toBe(100000);     // parsed correctly
    });

    it('should ignore extra columns on read', async () => {
      const filePath = join(tempDir, 'extra-cols.csv');
      await writeFile(filePath, 'id,name,type,currency,institution,balance,hidden,reconciled,createdAt,extraCol\n1,Test,checking,USD,Chase,500.00,false,,2025-01-01,extra-value\n');

      const loaded = await readCSVFile<Account>(filePath, ACCOUNT_SCHEMA, { precision: 2 });
      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe('Test');
      expect((loaded[0] as Record<string, unknown>)['extraCol']).toBeUndefined();
    });

    it('should write ALL schema columns on write (auto-migration)', async () => {
      const filePath = join(tempDir, 'migrated.csv');
      const accounts: Account[] = [{
        id: '1', name: 'Test', type: 'checking', currency: 'USD',
        institution: '', balance: 0, hidden: false, reconciled: '', createdAt: '',
      }];

      await writeCSVFile(filePath, ACCOUNT_SCHEMA, accounts, { precision: 2 });
      const content = await readFile(filePath, 'utf-8');
      const headerLine = content.split('\n')[0];
      expect(headerLine).toBe('id,name,type,currency,institution,balance,hidden,reconciled,createdAt');
    });

    it('should migration round-trip: read old CSV, write new format, re-read', async () => {
      const filePath = join(tempDir, 'migrate-roundtrip.csv');
      // Old CSV missing 'reconciled'
      await writeFile(filePath, 'id,name,type,currency,institution,balance,hidden,createdAt\n1,Test,checking,USD,Chase,100.00,false,2025-01-01\n');

      // Read with migration
      const accounts = await readCSVFile<Account>(filePath, ACCOUNT_SCHEMA, { precision: 2 });
      expect(accounts[0].reconciled).toBe('');

      // Write back (now includes all columns)
      await writeCSVFile(filePath, ACCOUNT_SCHEMA, accounts, { precision: 2 });

      // Re-read should be identical
      const reloaded = await readCSVFile<Account>(filePath, ACCOUNT_SCHEMA, { precision: 2 });
      expect(reloaded).toEqual(accounts);
    });
  });

  // -------------------------------------------------------------------------
  // appendCSVRecords
  // -------------------------------------------------------------------------

  describe('appendCSVRecords', () => {
    it('should append records to an existing file', async () => {
      const filePath = join(tempDir, 'categories.csv');
      const initial: Category[] = [
        { id: '1', name: 'Groceries', group: 'Needs', assigned: 50000, hidden: false },
      ];
      await writeCSVFile(filePath, CATEGORY_SCHEMA, initial, { precision: 2 });

      const newRecords: Category[] = [
        { id: '2', name: 'Dining', group: 'Wants', assigned: 15000, hidden: false },
      ];
      await appendCSVRecords(filePath, CATEGORY_SCHEMA, newRecords, { precision: 2 });

      const loaded = await readCSVFile<Category>(filePath, CATEGORY_SCHEMA, { precision: 2 });
      expect(loaded).toHaveLength(2);
      expect(loaded[0].name).toBe('Groceries');
      expect(loaded[1].name).toBe('Dining');
    });

    it('should create file with headers when appending to non-existent file', async () => {
      const filePath = join(tempDir, 'new-file.csv');
      const records: Category[] = [
        { id: '1', name: 'Test', group: 'G', assigned: 0, hidden: false },
      ];
      await appendCSVRecords(filePath, CATEGORY_SCHEMA, records, { precision: 2 });

      const loaded = await readCSVFile<Category>(filePath, CATEGORY_SCHEMA, { precision: 2 });
      expect(loaded).toEqual(records);
    });

    it('should do nothing when appending empty records', async () => {
      const filePath = join(tempDir, 'categories.csv');
      const initial: Category[] = [
        { id: '1', name: 'Groceries', group: 'Needs', assigned: 50000, hidden: false },
      ];
      await writeCSVFile(filePath, CATEGORY_SCHEMA, initial, { precision: 2 });

      await appendCSVRecords(filePath, CATEGORY_SCHEMA, [], { precision: 2 });

      const loaded = await readCSVFile<Category>(filePath, CATEGORY_SCHEMA, { precision: 2 });
      expect(loaded).toEqual(initial);
    });
  });
});
