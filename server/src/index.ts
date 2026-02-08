import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { accountsRouter } from './routes/accounts.js';
import { transactionsRouter } from './routes/transactions.js';
import { categoriesRouter } from './routes/categories.js';
import { budgetRouter } from './routes/budget.js';
import { initStore } from './storeManager.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json());

// API routes
app.use('/api/accounts', accountsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/budget', budgetRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve built UI in production (when ui/dist exists)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiDistPath = path.resolve(__dirname, '../../ui/dist');

if (existsSync(uiDistPath)) {
  app.use(express.static(uiDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(uiDistPath, 'index.html'));
  });
}

// Initialize store and start server
async function start() {
  await initStore();
  app.listen(PORT, () => {
    console.log(`PFS server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { app };
