import { useState } from 'react';
import { TransactionsScreen } from './screens/TransactionsScreen.tsx';
import { BudgetScreen } from './screens/BudgetScreen.tsx';
import { HelpScreen } from './screens/HelpScreen.tsx';

type Screen = 'transactions' | 'budget' | 'help';

export function App() {
  const [screen, setScreen] = useState<Screen>('transactions');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold text-gray-900">PFS</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setScreen('transactions')}
              className={`text-sm font-medium ${screen === 'transactions' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Transactions
            </button>
            <button
              onClick={() => setScreen('budget')}
              className={`text-sm font-medium ${screen === 'budget' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Budget
            </button>
            <button
              onClick={() => setScreen('help')}
              className={`text-sm font-medium ${screen === 'help' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Help
            </button>
          </div>
        </div>
      </nav>
      <main className="p-4">
        {screen === 'transactions' && <TransactionsScreen />}
        {screen === 'budget' && <BudgetScreen />}
        {screen === 'help' && <HelpScreen />}
      </main>
    </div>
  );
}
