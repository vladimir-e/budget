import type { Category, Transaction } from './types.js';

// TODO: Implement full category CRUD

/** Get all categories */
export function getCategories(records: Category[]): Category[] {
  return records;
}

/** Get visible categories (not hidden) */
export function getVisibleCategories(records: Category[]): Category[] {
  return records.filter((c) => !c.hidden);
}

/** Find category by ID */
export function getCategoryById(records: Category[], id: string): Category | undefined {
  return records.find((c) => c.id === id);
}

/** Get categories grouped by their group field */
export function getCategoriesByGroup(records: Category[]): Map<string, Category[]> {
  const groups = new Map<string, Category[]>();
  for (const cat of records) {
    const group = groups.get(cat.group) ?? [];
    group.push(cat);
    groups.set(cat.group, group);
  }
  return groups;
}

/** Calculate spent amount for a category (sum of expense transactions) */
export function calculateSpent(categoryId: string, transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.categoryId === categoryId && t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
}

/** Calculate available = assigned + spent (spent is negative, so this subtracts) */
export function calculateAvailable(assigned: number, spent: number): number {
  return assigned + spent;
}
