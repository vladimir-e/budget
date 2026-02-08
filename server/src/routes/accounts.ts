import { Router } from 'express';
import {
  getVisibleAccounts,
  getAccountById,
  calculateWorkingBalance,
  getBalanceDiscrepancy,
  createAccount,
  updateAccount,
  deleteAccount,
  hideAccount,
  reconcileAccount,
} from '@pfs/lib';
import { getStore, mutate } from '../storeManager.js';

export const accountsRouter = Router();

// GET /api/accounts — list all visible accounts with working balances
accountsRouter.get('/', (_req, res) => {
  const store = getStore();
  const accounts = getVisibleAccounts(store.accounts);
  const result = accounts.map((a) => {
    const workingBalance = calculateWorkingBalance(a.id, store.transactions);
    return { ...a, workingBalance };
  });
  res.json(result);
});

// POST /api/accounts — create account
accountsRouter.post('/', async (req, res) => {
  const result = await mutate((store) => createAccount(store, req.body));
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  const created = result.value.accounts[result.value.accounts.length - 1];
  res.status(201).json(created);
});

// GET /api/accounts/:id — get account by ID with balance info
accountsRouter.get('/:id', (req, res) => {
  const store = getStore();
  const account = getAccountById(store.accounts, req.params.id);
  if (!account) {
    res.status(404).json({ error: `Account not found: ${req.params.id}` });
    return;
  }
  const workingBalance = calculateWorkingBalance(account.id, store.transactions);
  const discrepancy = getBalanceDiscrepancy(account.balance, workingBalance);
  res.json({ ...account, workingBalance, discrepancy });
});

// PUT /api/accounts/:id — update account
accountsRouter.put('/:id', async (req, res) => {
  const result = await mutate((store) => updateAccount(store, req.params.id, req.body));
  if (!result.ok) {
    const status = result.error.includes('not found') ? 404 : 400;
    res.status(status).json({ error: result.error });
    return;
  }
  const updated = result.value.accounts.find((a) => a.id === req.params.id);
  res.json(updated);
});

// DELETE /api/accounts/:id — delete or hide account
// Uses ?mode=hide for soft delete (default), ?mode=hard for hard delete
accountsRouter.delete('/:id', async (req, res) => {
  const mode = req.query.mode === 'hard' ? 'hard' : 'hide';
  const result = await mutate((store) =>
    mode === 'hard'
      ? deleteAccount(store, req.params.id)
      : hideAccount(store, req.params.id),
  );
  if (!result.ok) {
    const status = result.error.includes('not found') ? 404 : 409;
    res.status(status).json({ error: result.error });
    return;
  }
  res.status(204).send();
});

// POST /api/accounts/:id/reconcile — reconcile account
accountsRouter.post('/:id/reconcile', async (req, res) => {
  const { reportedBalance } = req.body;
  if (typeof reportedBalance !== 'number') {
    res.status(400).json({ error: 'reportedBalance must be a number' });
    return;
  }
  const result = await mutate((store) =>
    reconcileAccount(store, req.params.id, reportedBalance),
  );
  if (!result.ok) {
    const status = result.error.includes('not found') ? 404 : 400;
    res.status(status).json({ error: result.error });
    return;
  }
  const account = result.value.accounts.find((a) => a.id === req.params.id);
  res.json(account);
});
