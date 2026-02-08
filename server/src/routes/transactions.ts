import { Router } from 'express';
import {
  getTransactions,
  getTransactionById,
  getTransactionsByAccount,
  getTransactionsByCategory,
  getTransactionsByDateRange,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  bulkImportTransactions,
  createTransfer,
} from '@pfs/lib';
import { getStore, mutate } from '../storeManager.js';

export const transactionsRouter = Router();

// GET /api/transactions — list with optional filters
transactionsRouter.get('/', (_req, res) => {
  const store = getStore();
  let result = getTransactions(store.transactions);

  const { accountId, categoryId, startDate, endDate } = _req.query;

  if (typeof accountId === 'string' && accountId) {
    result = getTransactionsByAccount(result, accountId);
  }
  if (typeof categoryId === 'string' && categoryId) {
    result = getTransactionsByCategory(result, categoryId);
  }
  if (typeof startDate === 'string' && typeof endDate === 'string' && startDate && endDate) {
    result = getTransactionsByDateRange(result, startDate, endDate);
  }

  res.json(result);
});

// POST /api/transactions — create transaction or transfer
transactionsRouter.post('/', async (req, res) => {
  // If fromAccountId + toAccountId present, treat as transfer
  if (req.body.fromAccountId && req.body.toAccountId) {
    const result = await mutate((store) => createTransfer(store, req.body));
    if (!result.ok) {
      const status = result.error.includes('not found') ? 404 : 400;
      res.status(status).json({ error: result.error });
      return;
    }
    const newTxns = result.value.transactions.slice(-2);
    res.status(201).json(newTxns);
    return;
  }

  const result = await mutate((store) => createTransaction(store, req.body));
  if (!result.ok) {
    const status = result.error.includes('not found') ? 404 : 400;
    res.status(status).json({ error: result.error });
    return;
  }
  const created = result.value.transactions[result.value.transactions.length - 1];
  res.status(201).json(created);
});

// POST /api/transactions/import — bulk import with dedup
transactionsRouter.post('/import', async (req, res) => {
  const storeBefore = getStore();
  const countBefore = storeBefore.transactions.length;

  const result = await mutate((store) => bulkImportTransactions(store, req.body));
  if (!result.ok) {
    const status = result.error.includes('not found') ? 404 : 400;
    res.status(status).json({ error: result.error });
    return;
  }
  const countAfter = result.value.transactions.length;
  res.status(201).json({
    imported: countAfter - countBefore,
    total: countAfter,
  });
});

// GET /api/transactions/:id — get transaction by ID
transactionsRouter.get('/:id', (req, res) => {
  const store = getStore();
  const transaction = getTransactionById(store.transactions, req.params.id);
  if (!transaction) {
    res.status(404).json({ error: `Transaction not found: ${req.params.id}` });
    return;
  }
  res.json(transaction);
});

// PUT /api/transactions/:id — update transaction
transactionsRouter.put('/:id', async (req, res) => {
  const result = await mutate((store) => updateTransaction(store, req.params.id, req.body));
  if (!result.ok) {
    const status = result.error.includes('not found') ? 404 : 400;
    res.status(status).json({ error: result.error });
    return;
  }
  const updated = result.value.transactions.find((t) => t.id === req.params.id);
  res.json(updated);
});

// DELETE /api/transactions/:id — delete transaction (cascades transfer pair)
transactionsRouter.delete('/:id', async (req, res) => {
  const result = await mutate((store) => deleteTransaction(store, req.params.id));
  if (!result.ok) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.status(204).send();
});
