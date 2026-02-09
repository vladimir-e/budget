# PFS — System Overview

PFS (Personal Finance System) is a local-first budget tracker where all data lives as plain CSV files on your machine. No cloud, no database, no vendor lock-in. You own your data, and it's human-readable.

## Goals

1. **Track where your money goes.** See every transaction across all accounts in one place.
2. **Set budget targets.** Assign dollar amounts to categories and track actual spending against them.
3. **Stay balanced.** Reconcile accounts against bank statements to catch errors and maintain accuracy.
4. **Work with AI.** Drop bank CSV exports into the project and let an AI assistant handle the import, categorization, and setup.
5. **Clone and go.** Anyone can clone the repo and start their own budget — no signup, no setup wizard, just `npm install && npm start`.

## Non-goals

- Not a replacement for accounting software (no double-entry bookkeeping)
- Not a bank aggregator (no Plaid, no screen scraping)
- Not a forecasting tool (no projections, no trend analysis — yet)

## How It Works

### The data model

Three CSV files hold everything:

**accounts.csv** — Your financial accounts (checking, savings, credit cards, etc.)
Each account has a type, currency, reported balance, and reconciliation state.

**transactions.csv** — Every movement of money.
Each transaction belongs to one account, optionally to one category, and has a date, amount, and description. Negative amounts are outflows, positive are inflows.

**categories.csv** — Budget categories with assigned amounts.
Categories are grouped (e.g., "Immediate Obligations", "Lifestyle") and have an assigned budget amount. The system calculates spent and available from transaction data.

### Core concepts

**Uncategorized.** A transaction with no category (`categoryId = ""`) is uncategorized. This is a first-class state, not an error. Every imported transaction starts uncategorized. Uncategorized spending doesn't count toward any category's budget.

**Transfers.** Moving money between accounts creates two linked transactions: an outflow from one account and an inflow to another. They share a `transferPairId` so editing or deleting one automatically updates the other. Transfers are budget-neutral — they move money, not spend it.

**Reconciliation.** Three states per account:
- **Reconciled** — You've confirmed the account balance matches the bank. Transactions before the reconciled date are locked from re-import.
- **Balanced** — The reported balance equals the working balance (sum of transactions), but you haven't formally reconciled.
- **Discrepancy** — The reported balance doesn't match the working balance. Something needs fixing.

Any mutation to an account's transactions auto-clears its reconciled state, forcing you to re-verify.

### Budget calculation

```
spent     = sum of expense transactions in the category (for the selected month)
available = assigned + spent
```

Since expenses are negative, `available = assigned - |expenses|`. If you assigned $200 to Groceries and spent $150, available is $50.

The budget view filters by month. Each month is independent — you see what you assigned and what you spent that month.

**"Ready to assign"** is total income minus total assigned across all categories. It tells you how much unbudgeted money you have.

### Amount representation

All money is stored as integers internally (1050 = $10.50) to avoid floating-point drift. CSV files store human-readable decimals. The conversion uses a currency precision map (`USD: 2`, `JPY: 0`, `BTC: 8`).

### Soft vs hard delete

- **Hide** (soft delete): Sets `hidden=true`. Data stays, can be restored. Default for accounts and categories.
- **Delete** (hard delete): Removes the record. Accounts can only be hard-deleted if they have zero transactions. Deleting a category nullifies `categoryId` on all referencing transactions.

## Typical Workflow

1. **Setup.** Create accounts matching your bank accounts. The system comes with 21 starter categories.
2. **Import.** Export CSV from your bank, drop it in `drop_files_here/`, and let the AI assistant import and categorize.
3. **Budget.** Go to the Budget screen, assign dollar amounts to categories for the month.
4. **Review.** Check the Transactions screen to see spending, search, filter, and re-categorize as needed.
5. **Reconcile.** When your bank statement arrives, enter the reported balance and reconcile to confirm everything matches.
6. **Repeat.** Each month, assign new budget amounts and import new transactions.

## Data Safety

- All writes are atomic (write to temp file, fsync, rename). A crash mid-write never corrupts your data.
- Git tracks all changes to your financial data with full history.
- The AI assistant commits before and after import operations, so you can always roll back.
- CSV files are plain text — you can always read and edit them directly.
