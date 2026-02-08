import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import express from 'express';
import { accountsRouter } from '../src/routes/accounts.js';
import { transactionsRouter } from '../src/routes/transactions.js';
import { categoriesRouter } from '../src/routes/categories.js';
import { budgetRouter } from '../src/routes/budget.js';
import { initStore } from '../src/storeManager.js';

// Create a fresh app + temp data dir for each test
let app: express.Express;
let dataDir: string;

async function setupTestApp() {
  dataDir = await mkdtemp(join(tmpdir(), 'pfs-test-'));

  // Write empty CSVs with headers
  await writeFile(
    join(dataDir, 'accounts.csv'),
    'id,name,type,currency,institution,balance,hidden,reconciled,createdAt\n',
  );
  await writeFile(
    join(dataDir, 'transactions.csv'),
    'id,type,accountId,date,categoryId,description,payee,transferPairId,amount,notes,source,createdAt\n',
  );
  await writeFile(
    join(dataDir, 'categories.csv'),
    'id,type,name,group,assigned,hidden\n' +
    '1,expense,Groceries,Immediate Obligations,0,false\n' +
    '2,expense,Dining Out,Lifestyle,0,false\n' +
    '3,income,Paycheck,Income,0,false\n',
  );

  await initStore(dataDir);

  app = express();
  app.use(express.json());
  app.use('/api/accounts', accountsRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/budget', budgetRouter);
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

describe('Accounts API', () => {
  beforeEach(async () => {
    await setupTestApp();
  });

  it('GET /api/accounts returns empty array initially', async () => {
    const res = await request(app).get('/api/accounts');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/accounts creates an account', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({ name: 'Checking', type: 'checking', currency: 'USD' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Checking');
    expect(res.body.type).toBe('checking');
    expect(res.body.id).toBe('1');
  });

  it('POST /api/accounts validates input', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({ name: '', type: 'invalid', currency: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('GET /api/accounts/:id returns account with balance info', async () => {
    await request(app)
      .post('/api/accounts')
      .send({ name: 'Savings', type: 'savings', currency: 'USD' });

    const res = await request(app).get('/api/accounts/1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Savings');
    expect(res.body.workingBalance).toBe(0);
    expect(res.body.discrepancy).toBe(0);
  });

  it('GET /api/accounts/:id returns 404 for missing account', async () => {
    const res = await request(app).get('/api/accounts/999');
    expect(res.status).toBe(404);
  });

  it('PUT /api/accounts/:id updates an account', async () => {
    await request(app)
      .post('/api/accounts')
      .send({ name: 'Old Name', type: 'checking', currency: 'USD' });

    const res = await request(app)
      .put('/api/accounts/1')
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('DELETE /api/accounts/:id hides by default', async () => {
    await request(app)
      .post('/api/accounts')
      .send({ name: 'To Hide', type: 'checking', currency: 'USD' });

    const del = await request(app).delete('/api/accounts/1');
    expect(del.status).toBe(204);

    // Should no longer appear in list (hidden)
    const list = await request(app).get('/api/accounts');
    expect(list.body).toHaveLength(0);
  });

  it('DELETE /api/accounts/:id?mode=hard blocks if transactions exist', async () => {
    await request(app)
      .post('/api/accounts')
      .send({ name: 'Active', type: 'checking', currency: 'USD' });
    await request(app)
      .post('/api/transactions')
      .send({ type: 'expense', accountId: '1', date: '2025-01-15', amount: -500 });

    const res = await request(app).delete('/api/accounts/1?mode=hard');
    expect(res.status).toBe(409);
  });

  it('POST /api/accounts/:id/reconcile reconciles an account', async () => {
    await request(app)
      .post('/api/accounts')
      .send({ name: 'Checking', type: 'checking', currency: 'USD' });
    // Working balance is 0, so reconcile at 0
    const res = await request(app)
      .post('/api/accounts/1/reconcile')
      .send({ reportedBalance: 0 });
    expect(res.status).toBe(200);
    expect(res.body.reconciled).toBeTruthy();
  });

  it('POST /api/accounts/:id/reconcile rejects bad balance', async () => {
    await request(app)
      .post('/api/accounts')
      .send({ name: 'Checking', type: 'checking', currency: 'USD' });
    const res = await request(app)
      .post('/api/accounts/1/reconcile')
      .send({ reportedBalance: 'not-a-number' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

describe('Transactions API', () => {
  beforeEach(async () => {
    await setupTestApp();
    // Create an account for transactions
    await request(app)
      .post('/api/accounts')
      .send({ name: 'Checking', type: 'checking', currency: 'USD' });
  });

  it('GET /api/transactions returns empty initially', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/transactions creates a transaction', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .send({ type: 'expense', accountId: '1', date: '2025-01-15', amount: -1000, categoryId: '1' });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('expense');
    expect(res.body.amount).toBe(-1000);
    expect(res.body.categoryId).toBe('1');
  });

  it('POST /api/transactions validates input', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .send({ type: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('POST /api/transactions creates a transfer', async () => {
    // Create second account
    await request(app)
      .post('/api/accounts')
      .send({ name: 'Savings', type: 'savings', currency: 'USD' });

    const res = await request(app)
      .post('/api/transactions')
      .send({ fromAccountId: '1', toAccountId: '2', amount: 500, date: '2025-01-15' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].type).toBe('transfer');
    expect(res.body[1].type).toBe('transfer');
    expect(res.body[0].amount).toBe(-500);
    expect(res.body[1].amount).toBe(500);
  });

  it('GET /api/transactions filters by accountId', async () => {
    await request(app)
      .post('/api/accounts')
      .send({ name: 'Savings', type: 'savings', currency: 'USD' });
    await request(app)
      .post('/api/transactions')
      .send({ type: 'expense', accountId: '1', date: '2025-01-15', amount: -100 });
    await request(app)
      .post('/api/transactions')
      .send({ type: 'income', accountId: '2', date: '2025-01-15', amount: 200 });

    const res = await request(app).get('/api/transactions?accountId=1');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].accountId).toBe('1');
  });

  it('GET /api/transactions filters by date range', async () => {
    await request(app)
      .post('/api/transactions')
      .send({ type: 'expense', accountId: '1', date: '2025-01-10', amount: -100 });
    await request(app)
      .post('/api/transactions')
      .send({ type: 'expense', accountId: '1', date: '2025-02-10', amount: -200 });

    const res = await request(app).get('/api/transactions?startDate=2025-01-01&endDate=2025-01-31');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].date).toBe('2025-01-10');
  });

  it('GET /api/transactions/:id returns a transaction', async () => {
    await request(app)
      .post('/api/transactions')
      .send({ type: 'expense', accountId: '1', date: '2025-01-15', amount: -500 });

    const res = await request(app).get('/api/transactions/1');
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(-500);
  });

  it('GET /api/transactions/:id returns 404 for missing', async () => {
    const res = await request(app).get('/api/transactions/999');
    expect(res.status).toBe(404);
  });

  it('PUT /api/transactions/:id updates a transaction', async () => {
    await request(app)
      .post('/api/transactions')
      .send({ type: 'expense', accountId: '1', date: '2025-01-15', amount: -500 });

    const res = await request(app)
      .put('/api/transactions/1')
      .send({ description: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Updated');
  });

  it('DELETE /api/transactions/:id deletes a transaction', async () => {
    await request(app)
      .post('/api/transactions')
      .send({ type: 'expense', accountId: '1', date: '2025-01-15', amount: -500 });

    const del = await request(app).delete('/api/transactions/1');
    expect(del.status).toBe(204);

    const list = await request(app).get('/api/transactions');
    expect(list.body).toHaveLength(0);
  });

  it('DELETE /api/transactions/:id cascade deletes transfer pair', async () => {
    await request(app)
      .post('/api/accounts')
      .send({ name: 'Savings', type: 'savings', currency: 'USD' });
    await request(app)
      .post('/api/transactions')
      .send({ fromAccountId: '1', toAccountId: '2', amount: 500, date: '2025-01-15' });

    // Delete one side of the transfer
    await request(app).delete('/api/transactions/1');

    const list = await request(app).get('/api/transactions');
    expect(list.body).toHaveLength(0); // Both sides deleted
  });

  it('POST /api/transactions/import imports transactions with dedup', async () => {
    const transactions = [
      { type: 'expense' as const, date: '2025-01-15', amount: -100, description: 'Coffee' },
      { type: 'expense' as const, date: '2025-01-16', amount: -200, description: 'Lunch' },
    ];
    const res = await request(app)
      .post('/api/transactions/import')
      .send({ accountId: '1', transactions });
    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(2);

    // Import same again — should deduplicate
    const res2 = await request(app)
      .post('/api/transactions/import')
      .send({ accountId: '1', transactions });
    expect(res2.body.imported).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

describe('Categories API', () => {
  beforeEach(async () => {
    await setupTestApp();
  });

  it('GET /api/categories returns seeded categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('POST /api/categories creates a category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .send({ name: 'Rent', type: 'expense', group: 'Housing' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Rent');
    expect(res.body.group).toBe('Housing');
  });

  it('POST /api/categories validates input', async () => {
    const res = await request(app)
      .post('/api/categories')
      .send({ name: '', type: 'invalid', group: '' });
    expect(res.status).toBe(400);
  });

  it('GET /api/categories/:id returns a category', async () => {
    const res = await request(app).get('/api/categories/1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Groceries');
  });

  it('GET /api/categories/:id returns 404 for missing', async () => {
    const res = await request(app).get('/api/categories/999');
    expect(res.status).toBe(404);
  });

  it('PUT /api/categories/:id updates a category', async () => {
    const res = await request(app)
      .put('/api/categories/1')
      .send({ assigned: 50000 });
    expect(res.status).toBe(200);
    expect(res.body.assigned).toBe(50000);
  });

  it('DELETE /api/categories/:id hides by default', async () => {
    const del = await request(app).delete('/api/categories/1');
    expect(del.status).toBe(204);

    // Category still exists but hidden — GET by ID still works
    const res = await request(app).get('/api/categories/1');
    expect(res.body.hidden).toBe(true);
  });

  it('DELETE /api/categories/:id?mode=hard deletes and nullifies transactions', async () => {
    // Create account + transaction with category
    await request(app)
      .post('/api/accounts')
      .send({ name: 'Checking', type: 'checking', currency: 'USD' });
    await request(app)
      .post('/api/transactions')
      .send({ type: 'expense', accountId: '1', date: '2025-01-15', amount: -500, categoryId: '1' });

    const del = await request(app).delete('/api/categories/1?mode=hard');
    expect(del.status).toBe(204);

    // Transaction's categoryId should be nullified
    const txn = await request(app).get('/api/transactions/1');
    expect(txn.body.categoryId).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

describe('Budget API', () => {
  beforeEach(async () => {
    await setupTestApp();
    // Create account and some transactions
    await request(app)
      .post('/api/accounts')
      .send({ name: 'Checking', type: 'checking', currency: 'USD' });
  });

  it('GET /api/budget returns categories with spending data', async () => {
    const res = await request(app).get('/api/budget');
    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(3); // only visible (non-hidden)
    expect(res.body.totals).toHaveProperty('assigned');
    expect(res.body.totals).toHaveProperty('spent');
    expect(res.body.totals).toHaveProperty('available');
  });

  it('GET /api/budget computes spent correctly', async () => {
    // Assign budget to Groceries
    await request(app)
      .put('/api/categories/1')
      .send({ assigned: 50000 });

    // Create expense in Groceries category
    await request(app)
      .post('/api/transactions')
      .send({ type: 'expense', accountId: '1', date: '2025-01-15', amount: -2000, categoryId: '1' });

    const res = await request(app).get('/api/budget');
    const groceries = res.body.categories.find((c: { id: string }) => c.id === '1');
    expect(groceries.assigned).toBe(50000);
    expect(groceries.spent).toBe(-2000);
    expect(groceries.available).toBe(48000);
  });

  it('GET /api/budget?month=YYYY-MM filters by month', async () => {
    await request(app)
      .post('/api/transactions')
      .send({ type: 'expense', accountId: '1', date: '2025-01-15', amount: -1000, categoryId: '1' });
    await request(app)
      .post('/api/transactions')
      .send({ type: 'expense', accountId: '1', date: '2025-02-15', amount: -2000, categoryId: '1' });

    const jan = await request(app).get('/api/budget?month=2025-01');
    const janGroceries = jan.body.categories.find((c: { id: string }) => c.id === '1');
    expect(janGroceries.spent).toBe(-1000);

    const feb = await request(app).get('/api/budget?month=2025-02');
    const febGroceries = feb.body.categories.find((c: { id: string }) => c.id === '1');
    expect(febGroceries.spent).toBe(-2000);
  });
});
