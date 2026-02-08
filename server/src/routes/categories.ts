import { Router } from 'express';

export const categoriesRouter = Router();

// GET /api/categories — list categories
categoriesRouter.get('/', (_req, res) => {
  // TODO: implement
  res.json([]);
});

// POST /api/categories — create category
categoriesRouter.post('/', (_req, res) => {
  // TODO: implement
  res.status(201).json({});
});

// GET /api/categories/:id — get category by ID
categoriesRouter.get('/:id', (req, res) => {
  // TODO: implement
  res.json({ id: req.params.id });
});

// PUT /api/categories/:id — update category
categoriesRouter.put('/:id', (req, res) => {
  // TODO: implement
  res.json({ id: req.params.id });
});
