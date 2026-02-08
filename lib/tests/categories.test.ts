import { describe, it, expect } from 'vitest';
import {
  getVisibleCategories,
  getCategoryById,
  getCategoriesByGroup,
  calculateSpent,
  calculateAvailable,
} from '../src/categories.js';
import type { Category, Transaction } from '../src/types.js';

const sampleCategories: Category[] = [
  { id: '1', type: 'expense', name: 'Groceries', group: 'Immediate Obligations', assigned: 500, hidden: false },
  { id: '2', type: 'expense', name: 'Old Category', group: 'Immediate Obligations', assigned: 0, hidden: true },
  { id: '3', type: 'expense', name: 'Dining Out', group: 'Lifestyle', assigned: 200, hidden: false },
];

describe('categories', () => {
  it('should filter visible categories', () => {
    expect(getVisibleCategories(sampleCategories)).toHaveLength(2);
  });

  it('should find category by ID', () => {
    expect(getCategoryById(sampleCategories, '1')?.name).toBe('Groceries');
  });

  it('should group categories', () => {
    const groups = getCategoriesByGroup(sampleCategories);
    expect(groups.get('Immediate Obligations')).toHaveLength(2);
    expect(groups.get('Lifestyle')).toHaveLength(1);
  });

  it('should calculate spent', () => {
    const transactions: Transaction[] = [
      { id: '1', type: 'expense', accountId: 'a1', date: '2025-01-15', categoryId: '1', description: '', payee: '', transferPairId: '', amount: -100, notes: '', source: 'manual', createdAt: '' },
      { id: '2', type: 'expense', accountId: 'a1', date: '2025-01-16', categoryId: '1', description: '', payee: '', transferPairId: '', amount: -50, notes: '', source: 'manual', createdAt: '' },
      { id: '3', type: 'income', accountId: 'a1', date: '2025-01-17', categoryId: '1', description: '', payee: '', transferPairId: '', amount: 200, notes: '', source: 'manual', createdAt: '' },
    ];
    expect(calculateSpent('1', transactions)).toBe(-150);
  });

  it('should calculate available', () => {
    expect(calculateAvailable(500, -150)).toBe(350);
    expect(calculateAvailable(0, -100)).toBe(-100);
  });
});
