import { Router } from 'express';
import {
  getVisibleCategories,
  calculateSpent,
  calculateAvailable,
  getTransactionsByDateRange,
} from '@pfs/lib';
import { getStore } from '../storeManager.js';

export const budgetRouter = Router();

// GET /api/budget — budget overview (assigned/spent/available per category)
// Optional ?month=YYYY-MM to filter spending by month
budgetRouter.get('/', (_req, res) => {
  const store = getStore();
  const categories = getVisibleCategories(store.categories);

  // Determine which transactions to consider for spending
  let transactions = store.transactions;
  const month = _req.query.month;
  if (typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
    const startDate = `${month}-01`;
    const [year, mon] = month.split('-').map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
    transactions = getTransactionsByDateRange(store.transactions, startDate, endDate);
  }

  const result = categories.map((cat) => {
    const spent = calculateSpent(cat.id, transactions);
    const available = calculateAvailable(cat.assigned, spent);
    return { ...cat, spent, available };
  });

  const totalAssigned = result.reduce((sum, c) => sum + c.assigned, 0);
  const totalSpent = result.reduce((sum, c) => sum + c.spent, 0);
  const totalAvailable = result.reduce((sum, c) => sum + c.available, 0);

  // Calculate total income for the period (income transactions in the filtered range)
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  res.json({
    categories: result,
    totals: { assigned: totalAssigned, spent: totalSpent, available: totalAvailable },
    income: totalIncome,
  });
});
