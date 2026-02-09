import { useState } from 'react';
import { TransactionsScreen } from './screens/TransactionsScreen.tsx';
import { BudgetScreen } from './screens/BudgetScreen.tsx';
import { HelpScreen } from './screens/HelpScreen.tsx';

type Screen = 'transactions' | 'budget' | 'help';

export function App() {
  const [screen, setScreen] = useState<Screen>('transactions');

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="bg-slate-900 border-b border-slate-800 px-4 py-2">
        <div className="flex items-center gap-6">
          <h1 className="text-base font-bold text-slate-100 tracking-tight">Budget</h1>
          <div className="flex gap-1">
            {(['transactions', 'budget', 'help'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setScreen(tab)}
                className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                  screen === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab === 'transactions' ? 'Transactions' : tab === 'budget' ? 'Budget' : 'Help'}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <main className="p-3">
        {screen === 'transactions' && <TransactionsScreen />}
        {screen === 'budget' && <BudgetScreen />}
        {screen === 'help' && <HelpScreen />}
      </main>
    </div>
  );
}
