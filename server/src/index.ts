import express from 'express';
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
