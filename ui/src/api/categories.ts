import { get, post, put, del } from './client.ts';
import type {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
} from './types.ts';

/** List all categories */
export function listCategories(): Promise<Category[]> {
  return get<Category[]>('/api/categories');
}

/** Get a single category by ID */
export function getCategory(id: string): Promise<Category> {
  return get<Category>(`/api/categories/${id}`);
}

/** Create a new category */
export function createCategory(data: CreateCategoryInput): Promise<Category> {
  return post<Category>('/api/categories', data);
}

/** Update an existing category */
export function updateCategory(id: string, data: UpdateCategoryInput): Promise<Category> {
  return put<Category>(`/api/categories/${id}`, data);
}

/** Hide a category (soft delete) */
export function hideCategory(id: string): Promise<void> {
  return del(`/api/categories/${id}?mode=hide`);
}

/** Delete a category permanently (nullifies referencing transactions) */
export function deleteCategory(id: string): Promise<void> {
  return del(`/api/categories/${id}?mode=hard`);
}

/** Unhide a previously hidden category */
export function unhideCategory(id: string): Promise<Category> {
  return post<Category>(`/api/categories/${id}/unhide`, {});
}
