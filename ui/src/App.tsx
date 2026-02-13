import { useState } from 'react';
import { useTheme } from './context/ThemeContext.tsx';
import { TransactionsScreen } from './screens/TransactionsScreen.tsx';
import { BudgetScreen } from './screens/BudgetScreen.tsx';
import { HelpScreen } from './screens/HelpScreen.tsx';

type Screen = 'transactions' | 'budget' | 'help';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    {
      value: 'light' as const,
      label: 'Light',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ),
    },
    {
      value: 'system' as const,
      label: 'System',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
    {
      value: 'dark' as const,
      label: 'Dark',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex rounded-md overflow-hidden border border-edge">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`p-1.5 transition-colors ${
            theme === opt.value
              ? 'bg-accent text-white'
              : 'text-muted hover:text-body bg-elevated'
          }`}
          title={opt.label}
          aria-label={`${opt.label} theme`}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const [screen, setScreen] = useState<Screen>('transactions');

  return (
    <div className="min-h-screen bg-page">
      <nav className="bg-surface border-b border-edge px-5 py-2.5">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-heading tracking-tight">Budget</h1>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {(['transactions', 'budget', 'help'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setScreen(tab)}
                  className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                    screen === tab
                      ? 'bg-accent text-white'
                      : 'text-muted hover:text-body hover:bg-elevated'
                  }`}
                >
                  {tab === 'transactions' ? 'Transactions' : tab === 'budget' ? 'Budget' : 'Help'}
                </button>
              ))}
            </div>
            <ThemeToggle />
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
