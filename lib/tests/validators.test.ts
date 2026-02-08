import { describe, it, expect } from 'vitest';
import { validateAccount, validateTransaction, validateCategory } from '../src/validators.js';

describe('validators', () => {
  describe('validateAccount', () => {
    it('should pass valid account', () => {
      const result = validateAccount({
        name: 'Chase Checking',
        type: 'checking',
        currency: 'USD',
        balance: 1000,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail with missing name', () => {
      const result = validateAccount({ type: 'checking', currency: 'USD' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({ field: 'name', message: 'Name is required' });
    });

    it('should fail with invalid type', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = validateAccount({ name: 'Test', type: 'invalid' as any, currency: 'USD' });
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('type');
    });
  });

  describe('validateTransaction', () => {
    it('should pass valid transaction', () => {
      const result = validateTransaction({
        type: 'expense',
        accountId: '1',
        date: '2025-01-15',
        amount: -50,
      });
      expect(result.valid).toBe(true);
    });

    it('should fail with invalid date format', () => {
      const result = validateTransaction({
        type: 'expense',
        accountId: '1',
        date: '01/15/2025',
        amount: -50,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'date',
        message: 'Date must be in YYYY-MM-DD format',
      });
    });
  });

  describe('validateCategory', () => {
    it('should pass valid category', () => {
      const result = validateCategory({
        name: 'Groceries',
        type: 'expense',
        group: 'Immediate Obligations',
      });
      expect(result.valid).toBe(true);
    });

    it('should fail with missing fields', () => {
      const result = validateCategory({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });
});
