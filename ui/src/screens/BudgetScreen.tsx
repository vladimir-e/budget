import { useApp } from '../context/AppContext.tsx';
import type { BudgetCategory } from '../api/types.ts';

function formatAmount(amount: number): string {
  const value = amount / 100;
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function offsetMonth(month: string, offset: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function BudgetScreen() {
  const { budget, selectedMonth, selectMonth, loading, error } = useApp();

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
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-100">Budget</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => selectMonth(offsetMonth(selectedMonth, -1))}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            &larr;
          </button>
          <span className="text-sm font-medium text-slate-100 min-w-[140px] text-center">
            {formatMonth(selectedMonth)}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => selectMonth(offsetMonth(selectedMonth, 1))}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            &rarr;
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !budget?.categories.length && (
        <p className="text-sm text-slate-500">No budget categories configured yet.</p>
      )}

      {budget && budget.categories.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-700">
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
            <tr className="border-t-2 border-slate-600 font-medium text-slate-100">
              <td className="pt-2">Total</td>
              <td className="pt-2 text-right tabular-nums">
                {formatAmount(budget.totals.assigned)}
              </td>
              <td className="pt-2 text-right tabular-nums">
                {formatAmount(budget.totals.spent)}
              </td>
              <td
                className={`pt-2 text-right tabular-nums ${
                  budget.totals.available >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {formatAmount(budget.totals.available)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

function GroupRows({ group, categories }: { group: string; categories: BudgetCategory[] }) {
  const groupAssigned = categories.reduce((s, c) => s + c.assigned, 0);
  const groupSpent = categories.reduce((s, c) => s + c.spent, 0);
  const groupAvailable = categories.reduce((s, c) => s + c.available, 0);

  return (
    <>
      <tr className="bg-slate-800/50">
        <td className="py-1.5 px-1 font-medium text-slate-300" colSpan={1}>
          {group}
        </td>
        <td className="py-1.5 text-right tabular-nums text-slate-500 text-xs">
          {formatAmount(groupAssigned)}
        </td>
        <td className="py-1.5 text-right tabular-nums text-slate-500 text-xs">
          {formatAmount(groupSpent)}
        </td>
        <td className="py-1.5 text-right tabular-nums text-slate-500 text-xs">
          {formatAmount(groupAvailable)}
        </td>
      </tr>
      {categories.map((cat) => (
        <tr key={cat.id} className="border-b border-slate-800 hover:bg-slate-800/30">
          <td className="py-1.5 pl-4 text-slate-200">{cat.name}</td>
          <td className="py-1.5 text-right tabular-nums text-slate-300">{formatAmount(cat.assigned)}</td>
          <td className="py-1.5 text-right tabular-nums text-slate-300">{formatAmount(cat.spent)}</td>
          <td
            className={`py-1.5 text-right tabular-nums font-medium ${
              cat.available >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {formatAmount(cat.available)}
          </td>
        </tr>
      ))}
    </>
  );
}
