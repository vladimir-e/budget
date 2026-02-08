import { describe, it, expect } from 'vitest';
import {
  getVisibleCategories,
  getCategoryById,
  getCategoriesByGroup,
  calculateSpent,
  calculateAvailable,
  createCategory,
  updateCategory,
  hideCategory,
  deleteCategory,
} from '../src/categories.js';
import type { Category, Transaction } from '../src/types.js';
import type { DataStore } from '../src/store.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCat = (overrides: Partial<Category> = {}): Category => ({
  id: '1',
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
  categoryId: '1',
  description: '',
  payee: '',
  transferPairId: '',
  amount: -100,
  notes: '',
  source: 'manual',
  createdAt: '',
  ...overrides,
});

const emptyStore: DataStore = { accounts: [], transactions: [], categories: [] };

// ---------------------------------------------------------------------------
// Query function tests (existing)
// ---------------------------------------------------------------------------

const sampleCategories: Category[] = [
  makeCat({ id: '1', name: 'Groceries', group: 'Immediate Obligations' }),
  makeCat({ id: '2', name: 'Old Category', group: 'Immediate Obligations', assigned: 0, hidden: true }),
  makeCat({ id: '3', name: 'Dining Out', group: 'Lifestyle', assigned: 200 }),
];

describe('categories — queries', () => {
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
      makeTx({ id: '1', categoryId: '1', amount: -100 }),
      makeTx({ id: '2', categoryId: '1', amount: -50 }),
      makeTx({ id: '3', type: 'income', categoryId: '1', amount: 200 }),
    ];
    expect(calculateSpent('1', transactions)).toBe(-150);
  });

  it('should calculate available', () => {
    expect(calculateAvailable(500, -150)).toBe(350);
    expect(calculateAvailable(0, -100)).toBe(-100);
  });
});

// ---------------------------------------------------------------------------
// CRUD tests
// ---------------------------------------------------------------------------

describe('createCategory', () => {
  it('should create a category', () => {
    const result = createCategory(emptyStore, {
      name: 'Groceries',
      type: 'expense',
      group: 'Immediate Obligations',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categories).toHaveLength(1);
    expect(result.value.categories[0].name).toBe('Groceries');
    expect(result.value.categories[0].assigned).toBe(0);
    expect(result.value.categories[0].hidden).toBe(false);
  });

  it('should auto-increment ID', () => {
    const store: DataStore = { ...emptyStore, categories: [makeCat({ id: '3' })] };
    const result = createCategory(store, {
      name: 'New',
      type: 'expense',
      group: 'Lifestyle',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categories[1].id).toBe('4');
  });

  it('should accept optional assigned amount', () => {
    const result = createCategory(emptyStore, {
      name: 'Groceries',
      type: 'expense',
      group: 'Immediate Obligations',
      assigned: 500,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categories[0].assigned).toBe(500);
  });

  it('should reject empty name', () => {
    const result = createCategory(emptyStore, {
      name: '',
      type: 'expense',
      group: 'Immediate Obligations',
    });
    expect(result.ok).toBe(false);
  });

  it('should reject invalid type', () => {
    const result = createCategory(emptyStore, {
      name: 'Test',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: 'invalid' as any,
      group: 'Test',
    });
    expect(result.ok).toBe(false);
  });
});

describe('updateCategory', () => {
  const store: DataStore = { ...emptyStore, categories: [makeCat({ id: '1' })] };

  it('should update name', () => {
    const result = updateCategory(store, '1', { name: 'Food & Groceries' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categories[0].name).toBe('Food & Groceries');
  });

  it('should update assigned amount', () => {
    const result = updateCategory(store, '1', { assigned: 1000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categories[0].assigned).toBe(1000);
  });

  it('should return error for non-existent category', () => {
    const result = updateCategory(store, '999', { name: 'No' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Category not found');
  });

  it('should reject invalid update', () => {
    const result = updateCategory(store, '1', { name: '' });
    expect(result.ok).toBe(false);
  });

  it('should preserve unchanged fields', () => {
    const result = updateCategory(store, '1', { assigned: 750 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categories[0].name).toBe('Groceries');
    expect(result.value.categories[0].group).toBe('Immediate Obligations');
  });
});

describe('hideCategory', () => {
  const store: DataStore = { ...emptyStore, categories: [makeCat({ id: '1' })] };

  it('should set hidden to true', () => {
    const result = hideCategory(store, '1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categories[0].hidden).toBe(true);
  });

  it('should return error for non-existent category', () => {
    const result = hideCategory(store, '999');
    expect(result.ok).toBe(false);
  });
});

describe('deleteCategory', () => {
  it('should delete a category', () => {
    const store: DataStore = { ...emptyStore, categories: [makeCat({ id: '1' })] };
    const result = deleteCategory(store, '1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categories).toHaveLength(0);
  });

  it('should nullify categoryId on referencing transactions', () => {
    const store: DataStore = {
      ...emptyStore,
      categories: [makeCat({ id: '1' })],
      transactions: [
        makeTx({ id: 't1', categoryId: '1' }),
        makeTx({ id: 't2', categoryId: '1' }),
        makeTx({ id: 't3', categoryId: '2' }), // different category
      ],
    };
    const result = deleteCategory(store, '1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transactions[0].categoryId).toBe('');
    expect(result.value.transactions[1].categoryId).toBe('');
    expect(result.value.transactions[2].categoryId).toBe('2'); // untouched
  });

  it('should return error for non-existent category', () => {
    const result = deleteCategory(emptyStore, '999');
    expect(result.ok).toBe(false);
  });

  it('should handle deletion with no referencing transactions', () => {
    const store: DataStore = {
      ...emptyStore,
      categories: [makeCat({ id: '1' })],
      transactions: [makeTx({ id: 't1', categoryId: '2' })], // different category
    };
    const result = deleteCategory(store, '1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categories).toHaveLength(0);
    expect(result.value.transactions[0].categoryId).toBe('2'); // untouched
  });
});
