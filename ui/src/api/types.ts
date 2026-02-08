/** Account types supported by the system */
export type AccountType = 'cash' | 'checking' | 'credit_card' | 'loan' | 'savings' | 'asset' | 'crypto';

/** Transaction types */
export type TransactionType = 'income' | 'expense' | 'transfer';

/** Category types */
export type CategoryType = 'income' | 'expense';

/** Account as returned by the API (includes computed workingBalance) */
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
  workingBalance: number;
}

/** Account detail (includes discrepancy info) */
export interface AccountDetail extends Account {
  discrepancy: number;
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
  type: CategoryType;
  name: string;
  group: string;
  assigned: number;
  hidden: boolean;
}

/** Budget category (category with computed spending data) */
export interface BudgetCategory extends Category {
  spent: number;
  available: number;
}

/** Budget response from GET /api/budget */
export interface BudgetResponse {
  categories: BudgetCategory[];
  totals: {
    assigned: number;
    spent: number;
    available: number;
  };
}

/** Import result from POST /api/transactions/import */
export interface ImportResult {
  imported: number;
  total: number;
}

/** API error response */
export interface ApiError {
  error: string;
}

/** Input types for creating/updating records */
export interface CreateAccountInput {
  name: string;
  type: AccountType;
  currency: string;
  institution?: string;
}

export interface UpdateAccountInput {
  name?: string;
  type?: AccountType;
  currency?: string;
  institution?: string;
}

export interface CreateTransactionInput {
  type: TransactionType;
  accountId: string;
  date: string;
  amount: number;
  description?: string;
  payee?: string;
  categoryId?: string;
  notes?: string;
}

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  date: string;
  amount: number;
  description?: string;
  notes?: string;
}

export interface UpdateTransactionInput {
  type?: TransactionType;
  accountId?: string;
  date?: string;
  amount?: number;
  description?: string;
  payee?: string;
  categoryId?: string;
  notes?: string;
}

export interface CreateCategoryInput {
  type: CategoryType;
  name: string;
  group: string;
  assigned?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  group?: string;
  assigned?: number;
}

export interface ImportTransactionInput {
  accountId: string;
  date: string;
  amount: number;
  description?: string;
  payee?: string;
}
