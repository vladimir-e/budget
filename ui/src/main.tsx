import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { AppProvider } from './context/AppContext.tsx';
import { App } from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
