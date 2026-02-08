import { Router } from 'express';

export const budgetRouter = Router();

// GET /api/budget — budget overview (assigned/spent/available per category)
budgetRouter.get('/', (_req, res) => {
  // TODO: implement
  res.json({ categories: [] });
});
