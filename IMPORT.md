# PFS — Import Workflow

This document describes how AI agents should handle bank CSV imports.

## Overview

The user exports a CSV from their bank and drops it in the `drop_files_here/` folder. The AI agent analyzes the file, maps it to PFS's data model, and imports the transactions via the API. The goal: the user drops files and watches balanced accounts appear in the UI.

## Step-by-step

### 1. Detect the file

Check `drop_files_here/` for new CSV files:

```bash
ls drop_files_here/
```

Read the file to understand its format. Bank CSVs vary wildly — different column names, date formats, amount representations, and layouts.

### 2. Determine the budget state

Check if this is a fresh setup or an existing budget:

```bash
# Check for existing accounts
curl http://localhost:3001/api/accounts

# Or read the CSV directly
cat data/accounts.csv
```

**Fresh setup (no accounts):**
- You need to create the account first
- Ask the user: What bank is this from? What type of account (checking, savings, credit card)?
- Look at the CSV for clues — the filename often contains the bank name, and the data may include the account number
- Set the starting balance from the CSV: use the earliest balance or calculate from transactions if available

**Existing budget:**
- Match the file to an existing account by bank name, account type, or ask the user
- The account already has an ID — you'll use it for the import

### 3. Analyze the CSV format

Common patterns in bank exports:

| Bank pattern | Date format | Amount style | Notes |
|---|---|---|---|
| Single amount column | Various | Negative = debit, positive = credit | Most common |
| Separate debit/credit columns | Various | Both positive, in separate columns | Chase, some others |
| "Transaction Type" column | Various | Amount is always positive, type indicates direction | Some banks |
| Balance column included | Various | Running balance, not useful for import | Ignore it |

**Key fields to map:**
- **Date** → `date` (must convert to `YYYY-MM-DD`)
- **Amount** → `amount` (must be integer cents, negative for expenses)
- **Description/Memo** → `description`
- **Payee/Merchant** → `payee` (if available)
- **Type** → `type` (`expense` for outflows, `income` for inflows)

### 4. Write or use a parser

Check if a parser exists for this bank:

```bash
ls data/parsers/
```

If no parser exists, write one. Parsers live in `data/parsers/` and are TypeScript/JavaScript files that export a function to convert bank CSV rows to PFS transaction format.

**Parser requirements:**
- Handle the bank's specific date format
- Handle the bank's amount format (single column, debit/credit split, etc.)
- Convert amounts to integer cents (multiply by 100 for USD)
- Make amounts negative for expenses, positive for income
- Extract description and payee where possible
- Set `type` to `expense` or `income` based on amount sign
- Set `source` to `"import"`

**Example parser structure:**

```typescript
// data/parsers/chase-checking.ts
export function parseChaseChecking(csvContent: string): ParsedTransaction[] {
  // Parse CSV rows
  // Map: Details → description, Amount (negative=expense), Posting Date → date
  // Return array of { type, date, amount, description, payee, source: 'import' }
}
```

### 5. Commit before import

Commit the current state before importing:

```bash
git add data/
git commit -m "pre-import: snapshot before chase checking import"
```

### 6. Import via API

Start the server if not running (`npm run dev`), then call the import endpoint:

```bash
curl -X POST http://localhost:3001/api/transactions/import \
  -H 'Content-Type: application/json' \
  -d '{
    "accountId": "1",
    "transactions": [
      {"type": "expense", "date": "2025-01-15", "amount": -1299, "description": "NETFLIX", "source": "import"},
      {"type": "income", "date": "2025-01-01", "amount": 350000, "description": "PAYROLL", "source": "import"}
    ]
  }'
```

**The import endpoint handles deduplication automatically.** If you import the same file twice, duplicates are skipped. The dedup key is `date|accountId|amount|description`.

### 7. Commit after import

```bash
git add data/
git commit -m "import: chase checking 2025-01 (47 transactions, 3 duplicates skipped)"
```

### 8. Archive the source file

Move the processed bank CSV to the archive:

```bash
mkdir -p data/imports/chase-checking/
mv drop_files_here/chase-statement.csv data/imports/chase-checking/2025-01-01_to_2025-01-31.csv
git add data/imports/ drop_files_here/
git commit -m "archive: chase checking 2025-01 source file"
```

This preserves the original bank file for re-import or debugging.

### 9. Help categorize

After import, transactions are uncategorized (`categoryId = ""`). Help the user categorize them:

- Look at descriptions and payees to suggest categories
- Group similar transactions: all "WHOLE FOODS" → Groceries, all "NETFLIX" → Entertainment
- Use `PUT /api/transactions/:id` to update categories:

```bash
curl -X PUT http://localhost:3001/api/transactions/42 \
  -H 'Content-Type: application/json' \
  -d '{"categoryId": "6"}'
```

Commit after bulk categorization.

## Handling edge cases

### Credit cards

Credit card transactions are typically all expenses (negative amounts). Payments to the card from a checking account should be recorded as transfers, not expenses, to avoid double-counting.

If you see a payment that matches a checking account outflow, create a transfer instead:

```bash
curl -X POST http://localhost:3001/api/transactions \
  -H 'Content-Type: application/json' \
  -d '{"fromAccountId": "1", "toAccountId": "2", "amount": 50000, "date": "2025-01-15", "description": "CC Payment"}'
```

### Multiple currencies

Each account has a currency. Amounts are converted using the currency's precision (USD: ×100, JPY: ×1, BTC: ×100000000). Make sure the parser uses the correct precision for the account's currency.

### Starting balance for new accounts

When creating a new account from a bank export:

1. If the CSV includes a running balance, use the **earliest** balance minus the sum of transactions to get the starting balance
2. If no balance column, ask the user for the account's current balance, then back-calculate
3. Or set balance to 0 and let the user reconcile later

### Overlapping imports

If the user imports January and February statements that overlap by a few days, the dedup logic handles it. Transactions with the same `date|accountId|amount|description` are skipped.

### Bank CSV quirks

- **BOM (Byte Order Mark)**: The CSV parser handles this automatically
- **Extra header rows**: Some banks add summary rows at the top. Skip non-data rows.
- **Footer rows**: Some banks add totals at the bottom. Skip these too.
- **Quoted fields with commas**: RFC 4180 handles this. Use the built-in parser.
- **Different encodings**: Convert to UTF-8 before parsing if needed.

## Parser maintenance

When a bank changes their CSV format (new columns, renamed headers, different date format), update the parser in `data/parsers/`. Before updating:

1. Test the existing parser against the new file to see what breaks
2. Update the parser
3. Re-import to verify — dedup prevents duplicates

Parsers should be defensive: handle missing columns gracefully, skip rows that can't be parsed, and log warnings for the user.
