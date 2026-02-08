import { get } from './client.ts';
import type { BudgetResponse } from './types.ts';

/** Get budget overview (all categories with assigned/spent/available) */
export function getBudget(month?: string): Promise<BudgetResponse> {
  const query = month ? `?month=${month}` : '';
  return get<BudgetResponse>(`/api/budget${query}`);
}
