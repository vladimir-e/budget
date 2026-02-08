import { useApp } from '../context/AppContext.tsx';
import type { Account } from '../api/types.ts';

/** Group label for an account type */
function accountTypeLabel(type: Account['type']): string {
  const labels: Record<Account['type'], string> = {
    checking: 'Checking',
    savings: 'Savings',
    credit_card: 'Credit Card',
    cash: 'Cash',
    loan: 'Loan',
    asset: 'Asset',
    crypto: 'Crypto',
  };
  return labels[type] ?? type;
}

/** Format an integer amount as currency (e.g. 1050 → "$10.50") */
function formatAmount(amount: number): string {
  const value = amount / 100;
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function TransactionsScreen() {
  const { accounts, transactions, selectedAccountId, selectAccount, loading, error } = useApp();

  // Group accounts by type for the sidebar
  const grouped = accounts.reduce<Record<string, Account[]>>((acc, account) => {
    const key = account.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(account);
    return acc;
  }, {});

  const netWorth = accounts.reduce((sum, a) => sum + a.workingBalance, 0);

  return (
    <div className="flex gap-4">
      {/* Account sidebar */}
      <aside className="w-64 shrink-0">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Accounts</h2>

          {loading && <p className="text-sm text-gray-400">Loading...</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}

          {!loading && accounts.length === 0 && (
            <p className="text-sm text-gray-500">No accounts yet.</p>
          )}

          {/* "All accounts" option */}
          {accounts.length > 0 && (
            <button
              onClick={() => selectAccount(null)}
              className={`w-full text-left text-sm px-2 py-1 rounded mb-2 ${
                selectedAccountId === null
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              All Accounts
            </button>
          )}

          {/* Accounts grouped by type */}
          {Object.entries(grouped).map(([type, accts]) => (
            <div key={type} className="mb-3">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2 mb-1">
                {accountTypeLabel(type as Account['type'])}
              </h3>
              {accts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => selectAccount(a.id)}
                  className={`w-full text-left text-sm px-2 py-1 rounded flex justify-between items-center ${
                    selectedAccountId === a.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate">{a.name}</span>
                  <span className="ml-2 tabular-nums text-xs">
                    {formatAmount(a.workingBalance)}
                  </span>
                </button>
              ))}
            </div>
          ))}

          {/* Net worth */}
          {accounts.length > 0 && (
            <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between text-sm font-medium px-2">
              <span>Net Worth</span>
              <span className="tabular-nums">{formatAmount(netWorth)}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Transaction table */}
      <div className="flex-1">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Transactions</h2>

          {loading && <p className="text-sm text-gray-400">Loading...</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}

          {!loading && transactions.length === 0 && (
            <p className="text-sm text-gray-500">No transactions yet.</p>
          )}

          {transactions.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium">Payee</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 tabular-nums text-gray-600">{t.date}</td>
                    <td className="py-2 text-gray-900">{t.description || '—'}</td>
                    <td className="py-2 text-gray-600">{t.payee || '—'}</td>
                    <td
                      className={`py-2 text-right tabular-nums font-medium ${
                        t.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatAmount(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
