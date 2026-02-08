export function HelpScreen() {
  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">How PFS Works</h2>
        <div className="space-y-4 text-sm text-gray-700">
          <section>
            <h3 className="font-medium text-gray-900 mb-1">Accounts</h3>
            <p>Add your bank accounts, credit cards, and other financial accounts. Track balances and reconcile with your bank statements.</p>
          </section>
          <section>
            <h3 className="font-medium text-gray-900 mb-1">Transactions</h3>
            <p>Record income, expenses, and transfers between accounts. Import transactions from your bank or add them manually.</p>
          </section>
          <section>
            <h3 className="font-medium text-gray-900 mb-1">Budget</h3>
            <p>Assign money to categories each month. Track how much you have assigned, spent, and available in each category.</p>
          </section>
          <section>
            <h3 className="font-medium text-gray-900 mb-1">Data Storage</h3>
            <p>All data is stored in simple CSV files. No database required. Your data is portable and easy to back up.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
