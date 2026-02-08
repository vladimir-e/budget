import { Router } from 'express';

export const accountsRouter = Router();

// GET /api/accounts — list all accounts
accountsRouter.get('/', (_req, res) => {
  // TODO: implement
  res.json([]);
});

// POST /api/accounts — create account
accountsRouter.post('/', (_req, res) => {
  // TODO: implement
  res.status(201).json({});
});

// GET /api/accounts/:id — get account by ID
accountsRouter.get('/:id', (req, res) => {
  // TODO: implement
  res.json({ id: req.params.id });
});

// PUT /api/accounts/:id — update account
accountsRouter.put('/:id', (req, res) => {
  // TODO: implement
  res.json({ id: req.params.id });
});

// DELETE /api/accounts/:id — delete/hide account
accountsRouter.delete('/:id', (_req, res) => {
  // TODO: implement
  res.status(204).send();
});
