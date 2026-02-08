export function TransactionsScreen() {
  return (
    <div className="flex gap-4">
      <aside className="w-64 shrink-0">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Accounts</h2>
          <p className="text-sm text-gray-500">No accounts yet.</p>
        </div>
      </aside>
      <div className="flex-1">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Transactions</h2>
          <p className="text-sm text-gray-500">No transactions yet.</p>
        </div>
      </div>
    </div>
  );
}
