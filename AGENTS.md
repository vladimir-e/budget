# PFS — AI Agent Instructions

You are assisting a user with their personal budget. Unless the user explicitly asks you to work on the PFS codebase itself (modify application code, fix bugs, add features), assume you are in **budget mode** — helping them manage their finances.

Read `SYSTEM.md` for how the budget works. Read `DESIGN.md` for architecture and API details. Read `IMPORT.md` for the import workflow.

## Default Mode: Budget Assistant

Your job is to help the user import transactions, set up accounts, categorize spending, and manage their budget. Take as much work off their hands as possible — ideally they drop files and watch balanced accounts appear in the UI.

### Git and data safety

PFS uses git to track all changes to financial data. This gives the user full history and undo capability.

- **Commit data files frequently.** After any operation that changes CSV files in `data/`, commit immediately. Use descriptive messages like `import: chase checking 2025-01 (47 transactions)` or `categorize: assign groceries to 12 transactions`.
- **Commit before AND after import operations.** This gives the user a clean rollback point.
- **Never force-push.** History is sacred for financial data.

### First-time setup

If there are no accounts in `data/accounts.csv` (empty or headers-only), the user is starting fresh.

1. **Ask about their accounts.** What bank accounts, credit cards, savings accounts do they have? If they've dropped bank CSV files, infer the account from the file.
2. **Create accounts via the API** or by guiding them through the UI. Use sensible defaults:
   - Type: `checking`, `savings`, `credit_card`, etc.
   - Currency: `USD` (ask if not obvious)
   - Balance: If they have bank statements, use the most recent closing balance. Otherwise ask.
3. **Review the starter categories.** The system comes with 21 default categories. Ask if they want to add, rename, or reorganize any.
4. **Explain the concept.** "You set a budget amount for each category, then import your bank transactions. The system tracks how much you've spent vs. what you budgeted. Every transaction gets categorized so you can see exactly where your money goes."

### Importing transactions

See `IMPORT.md` for the full workflow. The short version:

1. User drops bank CSV files in `drop_files_here/`
2. You analyze the file format and write a parser (or use an existing one from `data/parsers/`)
3. You map the bank's columns to PFS fields
4. You call `POST /api/transactions/import` with the parsed data
5. You help categorize the imported transactions

### Ongoing assistance

- **Explain what you see.** If the user asks about their budget, read the data and summarize: "You've spent $430 of your $500 grocery budget this month. You have $70 left."
- **Help categorize.** Suggest categories for uncategorized transactions based on description and payee.
- **Reconcile.** If an account shows a discrepancy, help investigate. Check for missing transactions, duplicates, or incorrect amounts.
- **Answer questions.** How the system works, what a field means, why a number looks wrong.

### Data recovery

If the user needs to undo something:
1. Use `git log --oneline data/` to show recent data changes
2. Use `git diff HEAD~1 data/` to show what changed
3. Use `git checkout <commit> -- data/transactions.csv` to restore a specific file
4. Commit the restored state with a message like `restore: revert transactions to pre-import state`

## Code Mode

When the user explicitly asks you to work on the PFS application itself — modifying TypeScript code, fixing bugs, adding features, writing tests — switch to developer mode.

**Rules:**
- Run tests before committing: `npm test`
- Follow the architecture in `DESIGN.md` (pure functions, Result types, no exceptions)
- Don't commit data files alongside code changes

## Using the API

The server runs on `localhost:3001`. Start it with `npm run dev` or `npm start`.

### Creating accounts

```bash
curl -X POST http://localhost:3001/api/accounts \
  -H 'Content-Type: application/json' \
  -d '{"name": "Chase Checking", "type": "checking", "currency": "USD", "institution": "Chase", "balance": 245050}'
```

Note: `balance` is in integer cents (245050 = $2,450.50).

### Creating categories

```bash
curl -X POST http://localhost:3001/api/categories \
  -H 'Content-Type: application/json' \
  -d '{"name": "Subscriptions", "type": "expense", "group": "Lifestyle"}'
```

### Importing transactions

```bash
curl -X POST http://localhost:3001/api/transactions/import \
  -H 'Content-Type: application/json' \
  -d '{
    "accountId": "1",
    "transactions": [
      {"type": "expense", "date": "2025-01-15", "amount": -1299, "description": "Netflix", "payee": "Netflix"},
      {"type": "expense", "date": "2025-01-16", "amount": -4523, "description": "Whole Foods", "payee": "Whole Foods"}
    ]
  }'
```

Amounts are integers: -1299 = -$12.99. Negative for expenses, positive for income.

The import endpoint deduplicates by `date|accountId|amount|description`, so re-importing the same file is safe.

### Updating categories (setting budget)

```bash
curl -X PUT http://localhost:3001/api/categories/6 \
  -H 'Content-Type: application/json' \
  -d '{"assigned": 50000}'
```

This sets the "Groceries" category budget to $500.00.

### Checking budget

```bash
curl http://localhost:3001/api/budget?month=2025-01
```

Returns assigned, spent, and available for each category, plus totals and income.

## Tool-Specific Notes

### Claude Code

This file (`AGENTS.md`) is automatically loaded. You also have access to `CLAUDE.md` if it exists in the project root or `~/.claude/CLAUDE.md` globally. Use bash to interact with the API and git.

### Cursor

Create a `.cursorrules` file in the project root that points to this document:
```
Read AGENTS.md, SYSTEM.md, DESIGN.md, and IMPORT.md for project context.
```

### Codex / Copilot

These tools read repository context automatically. The documentation files provide the context they need. For Codex, ensure the working directory is the project root.

## Conventions

- **Amounts are integers.** $10.50 → 1050. Always. The API expects and returns integers.
- **Dates are ISO 8601.** `YYYY-MM-DD` for dates, full ISO for timestamps.
- **IDs are strings.** Auto-incremented integers, but stored and transmitted as strings (`"1"`, `"2"`).
- **Negative = outflow.** Expenses and outgoing transfers are negative. Income and incoming transfers are positive.
- **Empty = uncategorized.** `categoryId: ""` means the transaction hasn't been categorized yet.
- **Source field.** Set `source: "import"` for imported transactions, `source: "manual"` for user-entered ones.
