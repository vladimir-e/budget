import { useApp } from '../context/AppContext.tsx';
import type { BudgetCategory } from '../api/types.ts';

/** Format an integer amount as currency (e.g. 1050 → "$10.50") */
function formatAmount(amount: number): string {
  const value = amount / 100;
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** Navigate month: offset -1 or +1 */
function offsetMonth(month: string, offset: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

/** Display-friendly month label */
function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function BudgetScreen() {
  const { budget, selectedMonth, selectMonth, loading, error } = useApp();

  // Group categories by their group field
  const grouped = (budget?.categories ?? []).reduce<Record<string, BudgetCategory[]>>(
    (acc, cat) => {
      const key = cat.group || 'Uncategorized';
      if (!acc[key]) acc[key] = [];
      acc[key].push(cat);
      return acc;
    },
    {},
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Budget</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => selectMonth(offsetMonth(selectedMonth, -1))}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr;
          </button>
          <span className="text-sm font-medium text-gray-900 min-w-[140px] text-center">
            {formatMonth(selectedMonth)}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => selectMonth(offsetMonth(selectedMonth, 1))}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &rarr;
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !budget?.categories.length && (
        <p className="text-sm text-gray-500">No budget categories configured yet.</p>
      )}

      {budget && budget.categories.length > 0 && (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium text-right">Assigned</th>
                <th className="pb-2 font-medium text-right">Spent</th>
                <th className="pb-2 font-medium text-right">Available</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([group, cats]) => (
                <GroupRows key={group} group={group} categories={cats} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-medium">
                <td className="pt-2">Total</td>
                <td className="pt-2 text-right tabular-nums">
                  {formatAmount(budget.totals.assigned)}
                </td>
                <td className="pt-2 text-right tabular-nums">
                  {formatAmount(budget.totals.spent)}
                </td>
                <td
                  className={`pt-2 text-right tabular-nums ${
                    budget.totals.available >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatAmount(budget.totals.available)}
                </td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </div>
  );
}

/** Render a group header + its category rows */
function GroupRows({ group, categories }: { group: string; categories: BudgetCategory[] }) {
  const groupAssigned = categories.reduce((s, c) => s + c.assigned, 0);
  const groupSpent = categories.reduce((s, c) => s + c.spent, 0);
  const groupAvailable = categories.reduce((s, c) => s + c.available, 0);

  return (
    <>
      {/* Group header */}
      <tr className="bg-gray-50">
        <td className="py-1.5 px-1 font-medium text-gray-700" colSpan={1}>
          {group}
        </td>
        <td className="py-1.5 text-right tabular-nums text-gray-500 text-xs">
          {formatAmount(groupAssigned)}
        </td>
        <td className="py-1.5 text-right tabular-nums text-gray-500 text-xs">
          {formatAmount(groupSpent)}
        </td>
        <td className="py-1.5 text-right tabular-nums text-gray-500 text-xs">
          {formatAmount(groupAvailable)}
        </td>
      </tr>
      {/* Category rows */}
      {categories.map((cat) => (
        <tr key={cat.id} className="border-b border-gray-100 hover:bg-gray-50">
          <td className="py-1.5 pl-4 text-gray-900">{cat.name}</td>
          <td className="py-1.5 text-right tabular-nums">{formatAmount(cat.assigned)}</td>
          <td className="py-1.5 text-right tabular-nums">{formatAmount(cat.spent)}</td>
          <td
            className={`py-1.5 text-right tabular-nums font-medium ${
              cat.available >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {formatAmount(cat.available)}
          </td>
        </tr>
      ))}
    </>
  );
}
