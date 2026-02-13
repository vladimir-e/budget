# PFS — Import Workflow

This document describes how AI agents should handle bank CSV imports.

## Overview

The user exports a CSV from their bank and drops it in the `drop_files_here/` folder. The AI agent analyzes the file, maps it to PFS's data model, and imports the transactions via the API. The goal: the user drops files and watches balanced accounts appear in the UI.

## Before you start: clarify with the user

Every import source is different. Before writing code or calling APIs, ask the user about these decisions:

### Accounts
- **Create new or map to existing?** If PFS already has accounts, the import file's accounts might correspond to existing ones. Ask the user to confirm the mapping rather than creating duplicates.
- **Import all accounts or a subset?** Budget app exports may contain dozens of accounts, many closed. Ask which ones to import, or suggest importing only active ones and creating closed accounts as hidden.
- **Account types.** PFS supports: `checking`, `savings`, `credit_card`, `loan`, `cash`, `asset`, `crypto`. The source may use different names. Confirm the mapping.

### Categories
- **Import source categories or use PFS's?** PFS comes with 18 simple categories. Budget app exports often have 30-50 granular categories. The user might prefers PFS's simpler structure. Ask if they want to import their old categories, or map them to PFS's ones?"
- **Build a category mapping.** If mapping, enumerate all source categories and propose a mapping to PFS categories. Let the user review and adjust before importing.
- **Handle unmapped categories.** Decide with the user: import as uncategorized, or create new PFS categories for gaps?

### Transfers
- Skipping transfers might make account balances wrong — credit card payments, savings moves, and inter-account transfers must be represented. PFS creates transfers as linked pairs via `POST /api/transactions` with `fromAccountId` and `toAccountId`.

### Scale
- **Large imports (100+ transactions, multiple accounts):** Write a script in `data/parsers`. Scripts are reusable, testable, and can handle batching, error recovery, and dry-run mode.

## Step-by-step

### 1. Detect the file

Check `drop_files_here/` for new CSV files:

```bash
ls drop_files_here/
```

Read the file to understand its format. Bank CSVs vary wildly — different column names, date formats, amount representations, and layouts.

### 2. Determine the source type

**Bank statement CSV**:
- Single account per file
- Usually no information about categories, try categorizing
- Try to identify transfers and do you best to match accounts
- Help user categorize transactions and clean up the data after import

**Budget app export**:
- Multiple accounts in one file
- Includes categories, transfer links, notes
- May have account metadata in a separate file
- Complex: requires a script (see "Large imports" below)

### 3. Determine the budget state

Check if this is a fresh setup or an existing budget:

```bash
curl http://localhost:3001/api/accounts
```

**Fresh setup (no accounts):**
- Create accounts first, either from the import file or by asking the user
- Review the starter categories with the user

**Existing budget:**
- Match import accounts to existing PFS accounts by name
- Ask the user to confirm ambiguous matches

### 4. Analyze the CSV format

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
- **Type** → `type` (`expense` for outflows, `income` for inflows, `transfer` for transfers)

**Amount conversion:** Source files often use decimals (-30.50). PFS uses integer cents (-3050). Multiply by 100 and round: `Math.round(parseFloat(amount) * 100)`.

### 5. Write a parser or script

**For small, single-account imports:** Parse inline and call the API directly.

**For large or multi-account imports:** Write a script in `data/parsers/`. A good import script should:

- **Batch transactions** — import in groups of 500 to avoid timeouts
- **Handle transfers** — match transfer pairs and use the transfer API
- **Map categories** — build a mapping from source categories to PFS category IDs
- **Report results** — show counts of imported, skipped, categorized, uncategorized, and failed

Check if a parser exists for this source:

```bash
ls data/parsers/
```
But double check if it's up to date and able to handle provided file.

### 6. Commit before import

```bash
git add data/
git commit -m "pre-import: snapshot before chase checking import"
```

### 7. Import via API

Start the server if not running (`npm run dev`), then import.

**Regular transactions** use the batch endpoint:

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

**Transfers** use the single transaction endpoint:

```bash
curl -X POST http://localhost:3001/api/transactions \
  -H 'Content-Type: application/json' \
  -d '{"fromAccountId": "1", "toAccountId": "2", "amount": 50000, "date": "2025-01-15", "description": "CC Payment"}'
```

This creates two linked transactions (outflow + inflow) with matching `transferPairId`. The `amount` is the absolute value — the API negates the outflow side automatically.

**The import endpoint handles deduplication automatically.** If you import the same file twice, duplicates are skipped. The dedup key is `date|accountId|amount|description`.

**Note:** The transfer endpoint does NOT deduplicate. If you re-run a script that creates transfers, you'll get duplicates. To re-import cleanly, clear the data files first (see "Re-importing" below).

### 8. Commit after import

```bash
git add data/
git commit -m "import: chase checking 2025-01 (47 transactions, 3 duplicates skipped)"
```

### 9. Archive the source file

Move the processed bank CSV to the archive:

```bash
mkdir -p data/imports/chase-checking/
mv drop_files_here/chase-statement.csv data/imports/chase-checking/2025-01-01_to_2025-01-31.csv
git add data/imports/ drop_files_here/
git commit -m "archive: chase checking 2025-01 source file"
```

This preserves the original file for re-import or debugging.

### 10. Help categorize

After import, bank-sourced transactions are uncategorized (`categoryId = ""`). Help the user categorize them:

- Look at descriptions and payees to suggest categories
- Group similar transactions: all "WHOLE FOODS" → Groceries, all "NETFLIX" → Entertainment
- Use `PUT /api/transactions/:id` to update categories:

```bash
curl -X PUT http://localhost:3001/api/transactions/42 \
  -H 'Content-Type: application/json' \
  -d '{"categoryId": "6"}'
```

Commit after bulk categorization.

## Handling transfers

Transfers are critical for correct account balances. Without them, credit card payments show as expenses from checking but never arrive at the credit card, making both accounts look wrong.

### How bank CSVs show transfers

Bank exports don't label transfers explicitly. Look for:
- Payments to credit cards (description contains "PAYMENT", "AUTOPAY", or the card name)
- Transfers between accounts ("TRANSFER", "ONLINE TRANSFER", "XFER")
- Matching amounts between accounts on the same date

For bank CSVs, it may be easier to import everything as regular transactions first, then help the user identify and convert transfers.


## Handling edge cases

### Credit cards

Credit card transactions are typically all expenses (negative amounts). Payments to the card from a checking account should be recorded as transfers, not expenses, to avoid double-counting.

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

- **BOM (Byte Order Mark)**: Strip with `.replace(/^\uFEFF/, '')` before parsing
- **Extra header rows**: Some banks add summary rows at the top. Skip non-data rows.
- **Footer rows**: Some banks add totals at the bottom. Skip these too.
- **Quoted fields with commas**: RFC 4180 handles this. Use a proper CSV parser.
- **Different encodings**: Convert to UTF-8 before parsing if needed.
- **Decimal amounts**: Source files use decimals, PFS uses integer cents. Always `Math.round()` after multiplying to avoid floating-point drift.

## Parser maintenance

When a bank changes their CSV format (new columns, renamed headers, different date format), update the parser in `data/parsers/`. Before updating:

1. Test the existing parser against the new file to see what breaks
2. Update the parser
3. Re-import to verify — dedup prevents duplicates

Parsers should be defensive: handle missing columns gracefully, skip rows that can't be parsed, and log warnings for the user.
