import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { Account, Transaction, Category, BudgetResponse } from '../api/types.ts';
import { listAccounts } from '../api/accounts.ts';
import { listTransactions, type TransactionFilters } from '../api/transactions.ts';
import { listCategories } from '../api/categories.ts';
import { getBudget } from '../api/budget.ts';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface AppState {
  // Data
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budget: BudgetResponse | null;

  // Selection
  selectedAccountId: string | null;
  selectedMonth: string; // YYYY-MM

  // Loading & error
  loading: boolean;
  error: string | null;
}

interface AppActions {
  /** Select an account to filter transactions (null = all accounts) */
  selectAccount: (id: string | null) => void;

  /** Change the budget month */
  selectMonth: (month: string) => void;

  /** Refetch all data (call after any mutation) */
  refresh: () => Promise<void>;

  /** Refetch only accounts */
  refreshAccounts: () => Promise<void>;

  /** Refetch only transactions (respects current filters) */
  refreshTransactions: () => Promise<void>;

  /** Refetch only categories */
  refreshCategories: () => Promise<void>;

  /** Refetch only budget (respects current month) */
  refreshBudget: () => Promise<void>;
}

type AppContextValue = AppState & AppActions;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AppContext = createContext<AppContextValue | null>(null);

/** Get the current month as YYYY-MM */
function currentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budget, setBudget] = useState<BudgetResponse | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs to access current selection values in stable callbacks
  const selectedAccountIdRef = useRef(selectedAccountId);
  selectedAccountIdRef.current = selectedAccountId;
  const selectedMonthRef = useRef(selectedMonth);
  selectedMonthRef.current = selectedMonth;

  // Track whether initial load is complete
  const initialLoadDone = useRef(false);

  // ---- Stable fetch helpers (use refs, never change identity) -------------

  const refreshAccounts = useCallback(async () => {
    const data = await listAccounts();
    setAccounts(data);
  }, []);

  const refreshTransactions = useCallback(async () => {
    const filters: TransactionFilters = {};
    if (selectedAccountIdRef.current) filters.accountId = selectedAccountIdRef.current;
    const data = await listTransactions(filters);
    setTransactions(data);
  }, []);

  const refreshCategories = useCallback(async () => {
    const data = await listCategories();
    setCategories(data);
  }, []);

  const refreshBudget = useCallback(async () => {
    const data = await getBudget(selectedMonthRef.current);
    setBudget(data);
  }, []);

  // ---- Full refresh -------------------------------------------------------

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await Promise.all([
        refreshAccounts(),
        refreshTransactions(),
        refreshCategories(),
        refreshBudget(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [refreshAccounts, refreshTransactions, refreshCategories, refreshBudget]);

  // ---- Initial load -------------------------------------------------------

  useEffect(() => {
    refresh().then(() => {
      initialLoadDone.current = true;
    });
  }, [refresh]);

  // ---- Selection changes trigger refetches --------------------------------

  const selectAccount = useCallback((id: string | null) => {
    setSelectedAccountId(id);
  }, []);

  // When selectedAccountId changes, refetch transactions
  useEffect(() => {
    if (!initialLoadDone.current) return;
    refreshTransactions().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load transactions'),
    );
  }, [selectedAccountId, refreshTransactions]);

  const selectMonth = useCallback((month: string) => {
    setSelectedMonth(month);
  }, []);

  // When selectedMonth changes, refetch budget
  useEffect(() => {
    if (!initialLoadDone.current) return;
    refreshBudget().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load budget'),
    );
  }, [selectedMonth, refreshBudget]);

  // ---- Context value ------------------------------------------------------

  const value: AppContextValue = {
    accounts,
    transactions,
    categories,
    budget,
    selectedAccountId,
    selectedMonth,
    loading,
    error,
    selectAccount,
    selectMonth,
    refresh,
    refreshAccounts,
    refreshTransactions,
    refreshCategories,
    refreshBudget,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Access the app state and actions. Must be used within <AppProvider>. */
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}
