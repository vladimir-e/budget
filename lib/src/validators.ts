import { ACCOUNT_TYPES, TRANSACTION_TYPES } from './types.js';
import type { Account, Transaction, Category } from './types.js';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** Validate an account record */
export function validateAccount(data: Partial<Account>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.name?.trim()) {
    errors.push({ field: 'name', message: 'Name is required' });
  }
  if (!data.type || !ACCOUNT_TYPES.includes(data.type)) {
    errors.push({ field: 'type', message: `Type must be one of: ${ACCOUNT_TYPES.join(', ')}` });
  }
  if (!data.currency?.trim()) {
    errors.push({ field: 'currency', message: 'Currency is required' });
  }
  if (data.balance !== undefined && typeof data.balance !== 'number') {
    errors.push({ field: 'balance', message: 'Balance must be a number' });
  }

  return { valid: errors.length === 0, errors };
}

/** Validate a transaction record */
export function validateTransaction(data: Partial<Transaction>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.type || !TRANSACTION_TYPES.includes(data.type)) {
    errors.push({ field: 'type', message: `Type must be one of: ${TRANSACTION_TYPES.join(', ')}` });
  }
  if (!data.accountId?.trim()) {
    errors.push({ field: 'accountId', message: 'Account ID is required' });
  }
  if (!data.date?.trim()) {
    errors.push({ field: 'date', message: 'Date is required' });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push({ field: 'date', message: 'Date must be in YYYY-MM-DD format' });
  }
  if (data.amount === undefined || typeof data.amount !== 'number') {
    errors.push({ field: 'amount', message: 'Amount must be a number' });
  }

  return { valid: errors.length === 0, errors };
}

/** Validate a category record */
export function validateCategory(data: Partial<Category>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.name?.trim()) {
    errors.push({ field: 'name', message: 'Name is required' });
  }
  if (!data.group?.trim()) {
    errors.push({ field: 'group', message: 'Group is required' });
  }

  return { valid: errors.length === 0, errors };
}
