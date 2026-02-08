import { get, post, put, del } from './client.ts';
import type {
  Account,
  AccountDetail,
  CreateAccountInput,
  UpdateAccountInput,
} from './types.ts';

/** List all visible accounts with working balances */
export function listAccounts(): Promise<Account[]> {
  return get<Account[]>('/api/accounts');
}

/** Get a single account with balance and discrepancy info */
export function getAccount(id: string): Promise<AccountDetail> {
  return get<AccountDetail>(`/api/accounts/${id}`);
}

/** Create a new account */
export function createAccount(data: CreateAccountInput): Promise<Account> {
  return post<Account>('/api/accounts', data);
}

/** Update an existing account */
export function updateAccount(id: string, data: UpdateAccountInput): Promise<Account> {
  return put<Account>(`/api/accounts/${id}`, data);
}

/** Hide an account (soft delete) */
export function hideAccount(id: string): Promise<void> {
  return del(`/api/accounts/${id}?mode=hide`);
}

/** Delete an account permanently (blocked if it has transactions) */
export function deleteAccount(id: string): Promise<void> {
  return del(`/api/accounts/${id}?mode=hard`);
}

/** Reconcile an account with a reported balance */
export function reconcileAccount(id: string, reportedBalance: number): Promise<Account> {
  return post<Account>(`/api/accounts/${id}/reconcile`, { reportedBalance });
}
