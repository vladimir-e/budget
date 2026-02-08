import { get, post, put, del } from './client.ts';
import type {
  Transaction,
  CreateTransactionInput,
  CreateTransferInput,
  UpdateTransactionInput,
  ImportResult,
  ImportTransactionInput,
} from './types.ts';

/** Filter options for listing transactions */
export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}

/** List transactions with optional filters */
export function listTransactions(filters?: TransactionFilters): Promise<Transaction[]> {
  const params = new URLSearchParams();
  if (filters?.accountId) params.set('accountId', filters.accountId);
  if (filters?.categoryId) params.set('categoryId', filters.categoryId);
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  const query = params.toString();
  return get<Transaction[]>(`/api/transactions${query ? `?${query}` : ''}`);
}

/** Get a single transaction by ID */
export function getTransaction(id: string): Promise<Transaction> {
  return get<Transaction>(`/api/transactions/${id}`);
}

/** Create a new transaction */
export function createTransaction(data: CreateTransactionInput): Promise<Transaction> {
  return post<Transaction>('/api/transactions', data);
}

/** Create a transfer between two accounts */
export function createTransfer(data: CreateTransferInput): Promise<Transaction[]> {
  return post<Transaction[]>('/api/transactions', data);
}

/** Update an existing transaction */
export function updateTransaction(id: string, data: UpdateTransactionInput): Promise<Transaction> {
  return put<Transaction>(`/api/transactions/${id}`, data);
}

/** Delete a transaction (cascades transfer pair) */
export function deleteTransaction(id: string): Promise<void> {
  return del(`/api/transactions/${id}`);
}

/** Bulk import transactions with deduplication */
export function importTransactions(data: ImportTransactionInput[]): Promise<ImportResult> {
  return post<ImportResult>('/api/transactions/import', data);
}
