/** Account types supported by the system */
export type AccountType = 'cash' | 'checking' | 'credit_card' | 'loan' | 'savings' | 'asset' | 'crypto';

/** Transaction types */
export type TransactionType = 'income' | 'expense' | 'transfer';

/** Account record */
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  institution: string;
  balance: number;
  hidden: boolean;
  reconciled: string;
  createdAt: string;
}

/** Transaction record */
export interface Transaction {
  id: string;
  type: TransactionType;
  accountId: string;
  date: string;
  categoryId: string;
  description: string;
  payee: string;
  transferPairId: string;
  amount: number;
  notes: string;
  source: string;
  createdAt: string;
}

/** Category record */
export interface Category {
  id: string;
  name: string;
  group: string;
  assigned: number;
  hidden: boolean;
}

/** Valid account types */
export const ACCOUNT_TYPES: readonly AccountType[] = [
  'cash', 'checking', 'credit_card', 'loan', 'savings', 'asset', 'crypto',
] as const;

/** Valid transaction types */
export const TRANSACTION_TYPES: readonly TransactionType[] = [
  'income', 'expense', 'transfer',
] as const;

