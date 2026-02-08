import { Router } from 'express';

export const transactionsRouter = Router();

// GET /api/transactions — list transactions
transactionsRouter.get('/', (_req, res) => {
  // TODO: implement with filtering (account, category, date range)
  res.json([]);
});

// POST /api/transactions — create transaction
transactionsRouter.post('/', (_req, res) => {
  // TODO: implement
  res.status(201).json({});
});

// GET /api/transactions/:id — get transaction by ID
transactionsRouter.get('/:id', (req, res) => {
  // TODO: implement
  res.json({ id: req.params.id });
});

// PUT /api/transactions/:id — update transaction
transactionsRouter.put('/:id', (req, res) => {
  // TODO: implement
  res.json({ id: req.params.id });
});

// DELETE /api/transactions/:id — delete transaction
transactionsRouter.delete('/:id', (_req, res) => {
  // TODO: implement
  res.status(204).send();
});
