import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import type { Account, Transaction, Category, AccountDetail } from '../api/types.ts';
import {
  getAccount,
  reconcileAccount as apiReconcile,
  createAccount as apiCreateAcct,
  updateAccount as apiUpdateAcct,
  hideAccount as apiHideAcct,
  deleteAccount as apiDeleteAcct,
} from '../api/accounts.ts';
import type { AccountType, CreateAccountInput } from '../api/types.ts';
import {
  createTransaction as apiCreateTxn,
  updateTransaction as apiUpdateTxn,
  deleteTransaction as apiDeleteTxn,
  createTransfer as apiCreateTransfer,
} from '../api/transactions.ts';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const TYPE_ORDER: Account['type'][] = [
  'cash', 'checking', 'credit_card', 'savings', 'asset', 'crypto', 'loan',
];

const TYPE_LABELS: Record<Account['type'], string> = {
  cash: 'Cash',
  checking: 'Checking',
  credit_card: 'Credit',
  savings: 'Savings',
  asset: 'Investment',
  crypto: 'Crypto',
  loan: 'Loan',
};

type SortField = 'date' | 'account' | 'category' | 'description' | 'amount';
type SortDir = 'asc' | 'desc';

function formatAmount(amount: number): string {
  const value = amount / 100;
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatAmountAbs(amount: number): string {
  const value = Math.abs(amount) / 100;
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function accountReconState(acct: Account): 'reconciled' | 'balanced' | 'discrepancy' {
  if (acct.reconciled) return 'reconciled';
  if (acct.workingBalance === acct.balance) return 'balanced';
  return 'discrepancy';
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function TransactionsScreen() {
  const {
    accounts, transactions, categories,
    selectedAccountId, selectAccount,
    loading, error,
    refresh, refreshAccounts, refreshTransactions,
  } = useApp();

  // --- Local filter/sort state ---
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showAddForm, setShowAddForm] = useState(false);
  const [accountDetail, setAccountDetail] = useState<AccountDetail | null>(null);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Account management state
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Fetch account detail when selected account changes
  useEffect(() => {
    if (!selectedAccountId) {
      setAccountDetail(null);
      return;
    }
    let cancelled = false;
    getAccount(selectedAccountId).then((d) => {
      if (!cancelled) setAccountDetail(d);
    }).catch(() => {
      if (!cancelled) setAccountDetail(null);
    });
    return () => { cancelled = true; };
  }, [selectedAccountId, accounts]);

  // --- Lookups ---
  const accountMap = useMemo(() => {
    const m = new Map<string, Account>();
    accounts.forEach((a) => m.set(a.id, a));
    return m;
  }, [accounts]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const selectedAccount = selectedAccountId ? accountMap.get(selectedAccountId) ?? null : null;

  // --- Filter & sort transactions ---
  const filteredTransactions = useMemo(() => {
    let list = [...transactions];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) =>
        t.description.toLowerCase().includes(q) ||
        t.payee.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q)
      );
    }

    if (categoryFilter) {
      if (categoryFilter === '__uncategorized__') {
        list = list.filter((t) => !t.categoryId);
      } else {
        list = list.filter((t) => t.categoryId === categoryFilter);
      }
    }

    if (startDate) {
      list = list.filter((t) => t.date >= startDate);
    }
    if (endDate) {
      list = list.filter((t) => t.date <= endDate);
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date': cmp = a.date.localeCompare(b.date); break;
        case 'account': {
          const an = accountMap.get(a.accountId)?.name ?? '';
          const bn = accountMap.get(b.accountId)?.name ?? '';
          cmp = an.localeCompare(bn);
          break;
        }
        case 'category': {
          const ac = categoryMap.get(a.categoryId)?.name ?? '';
          const bc = categoryMap.get(b.categoryId)?.name ?? '';
          cmp = ac.localeCompare(bc);
          break;
        }
        case 'description': cmp = a.description.localeCompare(b.description); break;
        case 'amount': cmp = a.amount - b.amount; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [transactions, searchQuery, categoryFilter, startDate, endDate, sortField, sortDir, accountMap, categoryMap]);

  // --- Sort toggle handler ---
  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDir(field === 'amount' ? 'desc' : 'asc');
      return field;
    });
  }, []);

  // --- Inline edit handlers ---
  const startEdit = useCallback((txnId: string, field: string, currentValue: string) => {
    setEditingId(txnId);
    setEditField(field);
    setEditValue(currentValue);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditField(null);
    setEditValue('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editField) return;
    try {
      const update: Record<string, unknown> = {};
      if (editField === 'amount') {
        const parsed = Math.round(parseFloat(editValue) * 100);
        if (isNaN(parsed)) { cancelEdit(); return; }
        update.amount = parsed;
      } else if (editField === 'categoryId') {
        update.categoryId = editValue;
      } else {
        update[editField] = editValue;
      }
      await apiUpdateTxn(editingId, update);
      cancelEdit();
      await Promise.all([refreshTransactions(), refreshAccounts()]);
    } catch {
      cancelEdit();
    }
  }, [editingId, editField, editValue, cancelEdit, refreshTransactions, refreshAccounts]);

  // --- Delete handler ---
  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiDeleteTxn(id);
      await Promise.all([refreshTransactions(), refreshAccounts()]);
    } catch { /* ignore */ }
  }, [refreshTransactions, refreshAccounts]);

  // --- Reconcile handler ---
  const handleReconcile = useCallback(async (reportedBalance: number) => {
    if (!selectedAccountId) return;
    try {
      await apiReconcile(selectedAccountId, reportedBalance);
      await refreshAccounts();
      // Re-fetch detail
      const d = await getAccount(selectedAccountId);
      setAccountDetail(d);
    } catch { /* ignore */ }
  }, [selectedAccountId, refreshAccounts]);

  // --- Account management handlers ---
  const handleSaveAccount = useCallback(async (data: CreateAccountInput, id?: string) => {
    try {
      if (id) {
        await apiUpdateAcct(id, data);
      } else {
        await apiCreateAcct(data);
      }
      await refreshAccounts();
    } catch { /* ignore */ }
  }, [refreshAccounts]);

  const handleHideAccount = useCallback(async (id: string) => {
    try {
      await apiHideAcct(id);
      if (selectedAccountId === id) selectAccount(null);
      await refreshAccounts();
    } catch { /* ignore */ }
  }, [refreshAccounts, selectedAccountId, selectAccount]);

  const handleDeleteAccount = useCallback(async (id: string) => {
    try {
      await apiDeleteAcct(id);
      if (selectedAccountId === id) selectAccount(null);
      await refreshAccounts();
    } catch { /* ignore - API returns 409 if has transactions */ }
  }, [refreshAccounts, selectedAccountId, selectAccount]);

  // --- Account sidebar grouping ---
  const groupedAccounts = useMemo(() => {
    const groups: { type: Account['type']; label: string; accounts: Account[]; total: number }[] = [];
    for (const type of TYPE_ORDER) {
      const accts = accounts.filter((a) => a.type === type);
      if (accts.length === 0) continue;
      const total = accts.reduce((s, a) => s + a.workingBalance, 0);
      groups.push({ type, label: TYPE_LABELS[type], accounts: accts, total });
    }
    return groups;
  }, [accounts]);

  const netWorth = useMemo(() => accounts.reduce((s, a) => s + a.workingBalance, 0), [accounts]);

  // --- Category options for filter dropdown ---
  const categoryOptions = useMemo(() => {
    const visible = categories.filter((c) => !c.hidden);
    visible.sort((a, b) => a.name.localeCompare(b.name));
    return visible;
  }, [categories]);

  return (
    <div className="flex gap-3 items-start">
      {/* === Account Sidebar === */}
      <AccountSidebar
        groupedAccounts={groupedAccounts}
        netWorth={netWorth}
        selectedAccountId={selectedAccountId}
        selectAccount={selectAccount}
        loading={loading}
        error={error}
        onAddAccount={() => { setEditingAccount(null); setShowAccountForm(true); }}
        onEditAccount={(a) => { setEditingAccount(a); setShowAccountForm(true); }}
        onHideAccount={handleHideAccount}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* === Main Content === */}
      <div className="flex-1 min-w-0">
        {/* Account header + balance bar */}
        <AccountHeader
          selectedAccount={selectedAccount}
          accountDetail={accountDetail}
          transactionCount={filteredTransactions.length}
          onAdd={() => setShowAddForm(true)}
          onReconcile={handleReconcile}
        />

        {/* Filters */}
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          categoryOptions={categoryOptions}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />

        {/* Transaction table */}
        <div className="bg-slate-900 rounded-lg border border-slate-800">
          {loading && <p className="text-sm text-slate-500 p-4">Loading...</p>}
          {error && <p className="text-sm text-red-400 p-4">{error}</p>}

          {!loading && filteredTransactions.length === 0 && (
            <p className="text-sm text-slate-500 p-4">No transactions.</p>
          )}

          {filteredTransactions.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-700">
                  <SortHeader field="date" label="Date" current={sortField} dir={sortDir} onToggle={toggleSort} />
                  {!selectedAccountId && (
                    <SortHeader field="account" label="Account" current={sortField} dir={sortDir} onToggle={toggleSort} />
                  )}
                  <SortHeader field="category" label="Category" current={sortField} dir={sortDir} onToggle={toggleSort} />
                  <SortHeader field="description" label="Description" current={sortField} dir={sortDir} onToggle={toggleSort} />
                  <SortHeader field="amount" label="Amount" current={sortField} dir={sortDir} onToggle={toggleSort} className="text-right" />
                  <th className="pb-2 px-3 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((t) => (
                  <TransactionRow
                    key={t.id}
                    txn={t}
                    accountMap={accountMap}
                    categoryMap={categoryMap}
                    showAccount={!selectedAccountId}
                    editingId={editingId}
                    editField={editField}
                    editValue={editValue}
                    onStartEdit={startEdit}
                    onEditChange={setEditValue}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                    onDelete={handleDelete}
                    categoryOptions={categoryOptions}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add transaction modal */}
      {showAddForm && (
        <AddTransactionModal
          accounts={accounts}
          categories={categoryOptions}
          selectedAccountId={selectedAccountId}
          onClose={() => setShowAddForm(false)}
          onSaved={async () => {
            setShowAddForm(false);
            await refresh();
          }}
        />
      )}

      {/* Account form modal (add/edit) */}
      {showAccountForm && (
        <AccountFormModal
          account={editingAccount}
          onClose={() => { setShowAccountForm(false); setEditingAccount(null); }}
          onSave={async (data) => {
            await handleSaveAccount(data, editingAccount?.id);
            setShowAccountForm(false);
            setEditingAccount(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Sidebar
// ---------------------------------------------------------------------------

function AccountSidebar({
  groupedAccounts,
  netWorth,
  selectedAccountId,
  selectAccount,
  loading,
  error,
  onAddAccount,
  onEditAccount,
  onHideAccount,
  onDeleteAccount,
}: {
  groupedAccounts: { type: Account['type']; label: string; accounts: Account[]; total: number }[];
  netWorth: number;
  selectedAccountId: string | null;
  selectAccount: (id: string | null) => void;
  loading: boolean;
  error: string | null;
  onAddAccount: () => void;
  onEditAccount: (a: Account) => void;
  onHideAccount: (id: string) => void;
  onDeleteAccount: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menuAccountId, setMenuAccountId] = useState<string | null>(null);

  const toggle = (type: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  // Close menu when clicking elsewhere
  useEffect(() => {
    if (!menuAccountId) return;
    const handler = () => setMenuAccountId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuAccountId]);

  return (
    <aside className="w-56 shrink-0">
      <div className="bg-slate-900 rounded-lg border border-slate-800 py-2">
        {loading && <p className="text-xs text-slate-500 px-3 py-1">Loading...</p>}
        {error && <p className="text-xs text-red-400 px-3 py-1">{error}</p>}

        {/* All Accounts */}
        <button
          onClick={() => selectAccount(null)}
          className={`w-full text-left text-sm px-3 py-1.5 flex justify-between items-center ${
            selectedAccountId === null
              ? 'bg-slate-800 text-slate-100'
              : 'text-slate-300 hover:bg-slate-800/50'
          }`}
        >
          <span className="font-medium">All Accounts</span>
          <span className={`tabular-nums text-xs font-medium ${netWorth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatAmount(netWorth)}
          </span>
        </button>

        {/* Grouped accounts */}
        {groupedAccounts.map((group) => (
          <div key={group.type}>
            {/* Group header */}
            <button
              onClick={() => toggle(group.type)}
              className="w-full text-left px-3 py-1 mt-1 flex justify-between items-center text-slate-500 hover:text-slate-300"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
                <span className="text-[8px]">{collapsed.has(group.type) ? '\u25B8' : '\u25BE'}</span>
                {group.label}
              </span>
              <span className={`tabular-nums text-[10px] font-medium ${group.total >= 0 ? 'text-slate-400' : 'text-red-400'}`}>
                {formatAmount(group.total)}
              </span>
            </button>

            {/* Account items */}
            {!collapsed.has(group.type) && group.accounts.map((a) => {
              const state = accountReconState(a);
              return (
                <div key={a.id} className="relative group/acct">
                  <button
                    onClick={() => selectAccount(a.id)}
                    className={`w-full text-left text-sm pl-4 pr-3 py-1 flex items-center gap-1.5 ${
                      selectedAccountId === a.id
                        ? 'bg-blue-900/30 text-blue-300'
                        : 'text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Reconciliation indicator */}
                    <span className="w-3 text-center shrink-0">
                      {state === 'reconciled' && <span className="text-green-400 text-xs">&#10003;</span>}
                      {state === 'balanced' && <span className="text-slate-600 text-xs">&#10003;</span>}
                      {state === 'discrepancy' && <span className="text-amber-400 text-[8px]">&#9679;</span>}
                    </span>
                    <span className="truncate flex-1">{a.name}</span>
                    <span className={`tabular-nums text-xs ml-1 shrink-0 ${
                      a.workingBalance >= 0 ? 'text-slate-400' : 'text-red-400'
                    }`}>
                      {formatAmount(a.workingBalance)}
                    </span>
                  </button>

                  {/* Context menu trigger */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuAccountId(menuAccountId === a.id ? null : a.id); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 opacity-0 group-hover/acct:opacity-100 transition-opacity text-xs px-1"
                    title="Account settings"
                  >
                    &#9881;
                  </button>

                  {/* Context menu dropdown */}
                  {menuAccountId === a.id && (
                    <div className="absolute right-0 top-full z-30 bg-slate-800 border border-slate-700 rounded shadow-lg py-1 min-w-[120px]">
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuAccountId(null); onEditAccount(a); }}
                        className="w-full text-left text-xs px-3 py-1.5 text-slate-300 hover:bg-slate-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuAccountId(null); onHideAccount(a.id); }}
                        className="w-full text-left text-xs px-3 py-1.5 text-slate-300 hover:bg-slate-700"
                      >
                        Hide
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuAccountId(null); onDeleteAccount(a.id); }}
                        className="w-full text-left text-xs px-3 py-1.5 text-red-400 hover:bg-slate-700"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Add Account button */}
        <button
          onClick={onAddAccount}
          className="w-full text-left text-xs px-3 py-1.5 mt-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
        >
          + Add Account
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Account Header + Balance Bar
// ---------------------------------------------------------------------------

function AccountHeader({
  selectedAccount,
  accountDetail,
  transactionCount,
  onAdd,
  onReconcile,
}: {
  selectedAccount: Account | null;
  accountDetail: AccountDetail | null;
  transactionCount: number;
  onAdd: () => void;
  onReconcile: (balance: number) => void;
}) {
  const [showReconcileInput, setShowReconcileInput] = useState(false);
  const [reconcileValue, setReconcileValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showReconcileInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showReconcileInput]);

  const handleReconcileSubmit = () => {
    const val = Math.round(parseFloat(reconcileValue) * 100);
    if (isNaN(val)) return;
    onReconcile(val);
    setShowReconcileInput(false);
    setReconcileValue('');
  };

  return (
    <div className="mb-3">
      {/* Top row: account name + add button + count */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-100">
            {selectedAccount ? selectedAccount.name : 'All Accounts'}
          </h2>
          <button
            onClick={onAdd}
            className="text-xs font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-slate-700"
          >
            + Add
          </button>
        </div>
        <span className="text-xs text-slate-500">{formatCount(transactionCount)} transactions</span>
      </div>

      {/* Balance bar — only when a specific account is selected */}
      {selectedAccount && accountDetail && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 px-4 py-2 mb-3 flex items-center gap-4 text-xs">
          <span className="text-slate-500 uppercase font-semibold tracking-wide">Balance</span>

          <div className="flex items-center gap-1">
            <span className="text-slate-500">Reported</span>
            <span className="tabular-nums font-semibold text-slate-200 bg-slate-800 px-2 py-0.5 rounded">
              {formatAmount(selectedAccount.balance)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-500">Actual</span>
            <span className={`tabular-nums font-semibold ${selectedAccount.workingBalance >= 0 ? 'text-slate-200' : 'text-red-400'}`}>
              {formatAmount(selectedAccount.workingBalance)}
            </span>
          </div>

          {accountDetail.discrepancy !== 0 && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Off by</span>
              <span className="tabular-nums font-semibold text-amber-400">
                {formatAmountAbs(accountDetail.discrepancy)}
              </span>
            </div>
          )}

          {/* Reconcile button / input */}
          {showReconcileInput ? (
            <div className="flex items-center gap-1 ml-auto">
              <input
                ref={inputRef}
                type="text"
                placeholder="Statement balance"
                value={reconcileValue}
                onChange={(e) => setReconcileValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleReconcileSubmit();
                  if (e.key === 'Escape') { setShowReconcileInput(false); setReconcileValue(''); }
                }}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-slate-200 w-32 text-xs focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleReconcileSubmit}
                className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs hover:bg-blue-500"
              >
                OK
              </button>
              <button
                onClick={() => { setShowReconcileInput(false); setReconcileValue(''); }}
                className="text-slate-500 hover:text-slate-300 text-xs px-1"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowReconcileInput(true)}
              className="ml-auto px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-slate-700 text-xs"
            >
              Balance
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter Bar
// ---------------------------------------------------------------------------

function FilterBar({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  categoryOptions,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  categoryOptions: Category[];
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <input
        type="text"
        placeholder="Search descriptions..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 w-52"
      />

      <select
        value={categoryFilter}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 appearance-none"
      >
        <option value="">All categories</option>
        <option value="__uncategorized__">Uncategorized</option>
        {categoryOptions.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <div className="flex items-center gap-1 text-xs text-slate-500">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
        />
        <span>to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort Header
// ---------------------------------------------------------------------------

function SortHeader({
  field,
  label,
  current,
  dir,
  onToggle,
  className = '',
}: {
  field: SortField;
  label: string;
  current: SortField;
  dir: SortDir;
  onToggle: (f: SortField) => void;
  className?: string;
}) {
  const active = current === field;
  return (
    <th
      className={`pb-2 px-3 font-medium cursor-pointer select-none hover:text-slate-300 ${className}`}
      onClick={() => onToggle(field)}
    >
      {label}
      {active && (
        <span className="ml-0.5 text-slate-400">
          {dir === 'asc' ? ' \u2191' : ' \u2193'}
        </span>
      )}
    </th>
  );
}

// ---------------------------------------------------------------------------
// Transaction Row (with inline editing)
// ---------------------------------------------------------------------------

function TransactionRow({
  txn,
  accountMap,
  categoryMap,
  showAccount,
  editingId,
  editField,
  editValue,
  onStartEdit,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  categoryOptions,
}: {
  txn: Transaction;
  accountMap: Map<string, Account>;
  categoryMap: Map<string, Category>;
  showAccount: boolean;
  editingId: string | null;
  editField: string | null;
  editValue: string;
  onStartEdit: (id: string, field: string, value: string) => void;
  onEditChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  categoryOptions: Category[];
}) {
  const isEditing = editingId === txn.id;
  const acctName = accountMap.get(txn.accountId)?.name ?? 'Unknown';
  const catName = txn.categoryId
    ? (categoryMap.get(txn.categoryId)?.name ?? 'Unknown')
    : 'Uncategorized';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSaveEdit();
    if (e.key === 'Escape') onCancelEdit();
  };

  return (
    <tr className="border-b border-slate-800/50 hover:bg-slate-800/30 group">
      {/* Date */}
      <td className="py-1.5 px-3 tabular-nums text-slate-400 whitespace-nowrap">
        {isEditing && editField === 'date' ? (
          <input
            type="date"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onSaveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-slate-200 text-sm w-32 focus:outline-none focus:border-blue-500"
          />
        ) : (
          <span
            className="cursor-pointer hover:text-slate-200"
            onClick={() => onStartEdit(txn.id, 'date', txn.date)}
          >
            {formatDate(txn.date)}
          </span>
        )}
      </td>

      {/* Account */}
      {showAccount && (
        <td className="py-1.5 px-3 text-slate-300 truncate max-w-[160px]">
          {acctName}
        </td>
      )}

      {/* Category */}
      <td className="py-1.5 px-3 text-slate-400">
        {isEditing && editField === 'categoryId' ? (
          <select
            value={editValue}
            onChange={(e) => { onEditChange(e.target.value); }}
            onBlur={onSaveEdit}
            autoFocus
            className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">Uncategorized</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <span
            className="cursor-pointer hover:text-slate-200"
            onClick={() => onStartEdit(txn.id, 'categoryId', txn.categoryId)}
          >
            {catName}
          </span>
        )}
      </td>

      {/* Description */}
      <td className="py-1.5 px-3 text-slate-200 truncate max-w-[300px]">
        {isEditing && editField === 'description' ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onSaveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-slate-200 text-sm w-full focus:outline-none focus:border-blue-500"
          />
        ) : (
          <span
            className="cursor-pointer hover:text-blue-300"
            onClick={() => onStartEdit(txn.id, 'description', txn.description)}
          >
            {txn.description || '\u2014'}
          </span>
        )}
      </td>

      {/* Amount */}
      <td className="py-1.5 px-3 text-right tabular-nums font-medium whitespace-nowrap">
        {isEditing && editField === 'amount' ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onSaveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-slate-200 text-sm w-24 text-right focus:outline-none focus:border-blue-500"
          />
        ) : (
          <span
            className={`cursor-pointer ${
              txn.amount > 0 ? 'text-green-400' : txn.amount < 0 ? 'text-red-400' : 'text-slate-400'
            }`}
            onClick={() => onStartEdit(txn.id, 'amount', String(txn.amount / 100))}
          >
            {formatAmount(txn.amount)}
          </span>
        )}
      </td>

      {/* Delete button */}
      <td className="py-1.5 px-2 text-center">
        <button
          onClick={() => onDelete(txn.id)}
          className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
          title="Delete transaction"
        >
          &#10005;
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Add Transaction Modal
// ---------------------------------------------------------------------------

function AddTransactionModal({
  accounts,
  categories,
  selectedAccountId,
  onClose,
  onSaved,
}: {
  accounts: Account[];
  categories: Category[];
  selectedAccountId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [accountId, setAccountId] = useState(selectedAccountId ?? accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Set default toAccountId for transfers
  useEffect(() => {
    if (mode === 'transfer' && !toAccountId) {
      const other = accounts.find((a) => a.id !== accountId);
      if (other) setToAccountId(other.id);
    }
  }, [mode, accountId, accounts, toAccountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const parsed = Math.round(parseFloat(amount) * 100);
    if (isNaN(parsed) || parsed <= 0) {
      setFormError('Enter a valid positive amount.');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'transfer') {
        if (!toAccountId || toAccountId === accountId) {
          setFormError('Select a different destination account.');
          setSaving(false);
          return;
        }
        await apiCreateTransfer({
          fromAccountId: accountId,
          toAccountId: toAccountId,
          date,
          amount: parsed,
          description,
          notes,
        });
      } else {
        const signedAmount = mode === 'expense' ? -parsed : parsed;
        await apiCreateTxn({
          type: mode,
          accountId,
          date,
          amount: signedAmount,
          description,
          categoryId: categoryId || undefined,
          notes,
        });
      }
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-100">Add Transaction</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">&times;</button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-4">
          {(['expense', 'income', 'transfer'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 text-xs font-medium py-1.5 rounded ${
                mode === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Account */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              {mode === 'transfer' ? 'From Account' : 'Account'}
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* To Account (transfer mode) */}
          {mode === 'transfer' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">To Account</label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {accounts.filter((a) => a.id !== accountId).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date + Amount */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Amount</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Category (not for transfers) */}
          {mode !== 'transfer' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {formError && <p className="text-xs text-red-400">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Form Modal (Add / Edit)
// ---------------------------------------------------------------------------

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'asset', label: 'Investment / Asset' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'loan', label: 'Loan' },
];

function AccountFormModal({
  account,
  onClose,
  onSave,
}: {
  account: Account | null;
  onClose: () => void;
  onSave: (data: CreateAccountInput) => Promise<void>;
}) {
  const isEdit = !!account;
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'checking');
  const [currency, setCurrency] = useState(account?.currency ?? 'USD');
  const [institution, setInstitution] = useState(account?.institution ?? '');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) { setFormError('Name is required.'); return; }
    if (!currency.trim()) { setFormError('Currency is required.'); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), type, currency: currency.trim(), institution: institution.trim() || undefined });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-100">{isEdit ? 'Edit Account' : 'Add Account'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Currency</label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={5}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Institution</label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Optional"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {formError && <p className="text-xs text-red-400">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
