import type { Category, Transaction } from './types.js';
import type { DataStore } from './store.js';
import type { Result } from './result.js';
import { ok, err } from './result.js';
import { nextId } from './ids.js';
import { validateCategory } from './validators.js';

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// CRUD operations — pure functions: (DataStore, input) → Result<DataStore>
// ---------------------------------------------------------------------------

export interface CreateCategoryInput {
  name: string;
  type: Category['type'];
  group: string;
  assigned?: number;
}

/** Create a new category */
export function createCategory(store: DataStore, data: CreateCategoryInput): Result<DataStore> {
  const validation = validateCategory(data);
  if (!validation.valid) {
    return err(validation.errors.map((e) => `${e.field}: ${e.message}`).join('; '));
  }

  const id = nextId(store.categories);
  const category: Category = {
    id,
    type: data.type,
    name: data.name.trim(),
    group: data.group.trim(),
    assigned: data.assigned ?? 0,
    hidden: false,
  };

  return ok({ ...store, categories: [...store.categories, category] });
}

export interface UpdateCategoryInput {
  name?: string;
  type?: Category['type'];
  group?: string;
  assigned?: number;
}

/** Update an existing category */
export function updateCategory(store: DataStore, id: string, changes: UpdateCategoryInput): Result<DataStore> {
  const index = store.categories.findIndex((c) => c.id === id);
  if (index === -1) {
    return err(`Category not found: ${id}`);
  }

  const existing = store.categories[index];
  const merged = {
    ...existing,
    ...(changes.name !== undefined ? { name: changes.name } : {}),
    ...(changes.type !== undefined ? { type: changes.type } : {}),
    ...(changes.group !== undefined ? { group: changes.group } : {}),
    ...(changes.assigned !== undefined ? { assigned: changes.assigned } : {}),
  };

  const validation = validateCategory(merged);
  if (!validation.valid) {
    return err(validation.errors.map((e) => `${e.field}: ${e.message}`).join('; '));
  }

  const updated: Category = {
    ...existing,
    name: merged.name.trim(),
    type: merged.type,
    group: merged.group.trim(),
    assigned: merged.assigned,
  };

  const categories = [...store.categories];
  categories[index] = updated;
  return ok({ ...store, categories });
}

/** Soft-delete a category by setting hidden=true */
export function hideCategory(store: DataStore, id: string): Result<DataStore> {
  const index = store.categories.findIndex((c) => c.id === id);
  if (index === -1) {
    return err(`Category not found: ${id}`);
  }

  const categories = [...store.categories];
  categories[index] = { ...categories[index], hidden: true };
  return ok({ ...store, categories });
}

/** Unhide a category by setting hidden=false */
export function unhideCategory(store: DataStore, id: string): Result<DataStore> {
  const index = store.categories.findIndex((c) => c.id === id);
  if (index === -1) {
    return err(`Category not found: ${id}`);
  }

  const categories = [...store.categories];
  categories[index] = { ...categories[index], hidden: false };
  return ok({ ...store, categories });
}

/** Hard-delete a category — nullifies categoryId on ALL referencing transactions */
export function deleteCategory(store: DataStore, id: string): Result<DataStore> {
  const index = store.categories.findIndex((c) => c.id === id);
  if (index === -1) {
    return err(`Category not found: ${id}`);
  }

  const categories = store.categories.filter((c) => c.id !== id);

  // Nullify categoryId on all referencing transactions
  const transactions = store.transactions.map((t) =>
    t.categoryId === id ? { ...t, categoryId: '' } : t,
  );

  return ok({ ...store, categories, transactions });
}
