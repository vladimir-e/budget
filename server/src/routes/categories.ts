import { Router } from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  hideCategory,
} from '@pfs/lib';
import { getStore, mutate } from '../storeManager.js';

export const categoriesRouter = Router();

// GET /api/categories — list all categories
categoriesRouter.get('/', (_req, res) => {
  const store = getStore();
  res.json(getCategories(store.categories));
});

// POST /api/categories — create category
categoriesRouter.post('/', async (req, res) => {
  const result = await mutate((store) => createCategory(store, req.body));
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  const created = result.value.categories[result.value.categories.length - 1];
  res.status(201).json(created);
});

// GET /api/categories/:id — get category by ID
categoriesRouter.get('/:id', (req, res) => {
  const store = getStore();
  const category = getCategoryById(store.categories, req.params.id);
  if (!category) {
    res.status(404).json({ error: `Category not found: ${req.params.id}` });
    return;
  }
  res.json(category);
});

// PUT /api/categories/:id — update category
categoriesRouter.put('/:id', async (req, res) => {
  const result = await mutate((store) => updateCategory(store, req.params.id, req.body));
  if (!result.ok) {
    const status = result.error.includes('not found') ? 404 : 400;
    res.status(status).json({ error: result.error });
    return;
  }
  const updated = result.value.categories.find((c) => c.id === req.params.id);
  res.json(updated);
});

// DELETE /api/categories/:id — delete or hide category
// Uses ?mode=hide for soft delete (default), ?mode=hard for hard delete
categoriesRouter.delete('/:id', async (req, res) => {
  const mode = req.query.mode === 'hard' ? 'hard' : 'hide';
  const result = await mutate((store) =>
    mode === 'hard'
      ? deleteCategory(store, req.params.id)
      : hideCategory(store, req.params.id),
  );
  if (!result.ok) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.status(204).send();
});
