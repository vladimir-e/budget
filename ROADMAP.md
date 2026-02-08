# PFS Roadmap — From Scaffolding to Working Budget Tracker

> Goal: a fully functional personal finance system where you can track your budget,
> and anyone can clone the repo and start managing theirs.

## Current State

The scaffolding PR established the monorepo structure and partial implementations:

- [x] Monorepo workspace (`lib/`, `server/`, `ui/`, `data/`)
- [x] TypeScript, Vite, Tailwind, Vitest config
- [x] CSV parser/writer (RFC 4180, BOM-safe, no deps)
- [x] Type definitions and validators
- [x] Seed categories (21 starter categories)
- [x] Query-only functions for accounts, transactions, categories
- [x] 41 passing unit tests
- [x] Express server skeleton with stub routes
- [x] React app shell with tab navigation and placeholder screens
- [x] README.md with quick start instructions

### Schema changes needed (informed by POC)

- Add `crypto` to AccountType enum (handled like any currency, crypto-specific features later)
- Integer money: CSV stores human-readable decimals (`10.50`), but in-memory all amounts are integers (`1050`). Conversion happens in serialize/deserialize only. All math is integer — no floating-point drift.
- Currency precision map: `{ USD: 2, EUR: 2, JPY: 0, BTC: 8, ... }` — determines ×10^n on read, ÷10^n on write. Precision comes from account's currency.

---

## Phase 1 — Foundations: Type System, Storage, Schemas

**Why**: The lib operates on in-memory arrays with no connection to the filesystem.
Before any CRUD, we need reliable typed I/O and a coherent data architecture.

### Architecture: Functional Core, Imperative Shell

All business logic is pure functions. Side effects (file I/O) live at the boundary.

```
Pure core:   (DataStore, input) → Result<DataStore>
I/O shell:   load(dataDir) → DataStore    persist(DataStore, dataDir) → void
```

### 1.1 Result type (`lib/src/result.ts`)
- [x] `type Result<T> = {ok: true, value: T} | {ok: false, error: string}`
- [x] Helper constructors: `ok(value)`, `err(error)`
- [x] No exceptions for expected failures — Result everywhere

### 1.2 Field schemas (`lib/src/schema.ts`)
- [x] Field metadata: `{name, type: 'string'|'number'|'boolean'}` per field
- [x] `ACCOUNT_SCHEMA`, `TRANSACTION_SCHEMA`, `CATEGORY_SCHEMA`
- [x] Compile-time check: schema field names must match interface keys (TypeScript `satisfies` + conditional type)
- [x] Replace existing `ACCOUNT_FIELDS` / `TRANSACTION_FIELDS` / `CATEGORY_FIELDS` arrays — schemas become the single source of truth
- [x] `serialize<T>(record, schema)` → `Record<string, string>` for CSV writing
- [x] `deserialize<T>(raw, schema)` → typed record (parse numbers, booleans)
- [x] `fieldNames(schema)` → `string[]` for CSV headers
- [x] Integer money conversion in serialize/deserialize: CSV `"10.50"` → memory `1050` (×10^precision on read, ÷10^precision on write)
- [x] Currency precision map: `{ USD: 2, EUR: 2, JPY: 0, BTC: 8, ... }` — extensible constant
- [x] Amount fields use `'money'` type in schema (not plain `'number'`) — requires currency context for conversion
- [x] Tests: round-trip serialize/deserialize, edge cases (empty strings, "0", "false"), precision per currency, no floating-point drift

### 1.3 Schema migration
- [x] On read: CSV with missing columns → fill with defaults per schema
- [x] On read: CSV with extra columns → ignore (don't crash)
- [x] On write: always write ALL schema columns
- [x] First write after adding a column auto-migrates the file
- [x] Tests: read old CSV missing a column, read CSV with extra column, migration round-trip

### 1.4 Atomic file I/O (`lib/src/storage.ts`)
- [x] `atomicWriteFile(path, content)` — write to temp file, fsync, rename over original
- [x] `readCSVFile<T>(path, schema)` → `T[]` — read + deserialize with schema
- [x] `writeCSVFile<T>(path, schema, records)` — serialize + atomic write
- [x] `appendCSVRecords<T>(path, schema, records)` — append without rewriting (transactions optimization)
- [x] Multi-file write: write all temp files first, rename in sequence
- [x] Tests: atomic write (original untouched on failure), append correctness, round-trips

### 1.5 DataStore (`lib/src/store.ts`)
- [x] `type DataStore = { accounts: Account[], transactions: Transaction[], categories: Category[] }`
- [x] `loadStore(dataDir)` → `Promise<DataStore>` — reads all 3 CSVs
- [x] `persistStore(store, dataDir)` → `Promise<void>` — atomic write all changed files
- [x] Defensive reads: dangling references never crash (treat as uncategorized / non-transfer)
- [x] Tests: load from disk, persist and reload, empty data dir

### 1.6 ID generation (`lib/src/ids.ts`)
- [x] `nextId(records)` → string — auto-increment from max existing ID
- [x] Handles empty dataset (starts at "1"), gaps in IDs, non-numeric IDs
- [x] Tests: empty, sequential, gaps

---

## Phase 2 — CRUD & Data Integrity

**Why**: The lib can query data but can't create, update, or delete anything.
Every mutation must enforce referential integrity — CSV files are our database,
and we have no RDBMS safety net.

### Core concept: "Uncategorized"
- `categoryId = ""` (empty string) means uncategorized — a first-class state
- Every imported transaction starts uncategorized
- No magic row in categories.csv — it's the absence of a category
- Uncategorized transactions don't count toward any category's "spent"

### 2.1 Account CRUD (`lib/src/accounts.ts`)
- [x] `createAccount(store, data)` → `Result<DataStore>` — validate, assign ID, set createdAt
- [x] `updateAccount(store, id, changes)` → `Result<DataStore>` — validate, immutable ID
- [x] `hideAccount(store, id)` → `Result<DataStore>` — soft delete (set hidden=true)
- [x] `deleteAccount(store, id)` → `Result<DataStore>` — **BLOCK if any transactions reference this account**
- [x] Tests: create, update, hide, delete empty account, block delete with transactions

### 2.2 Transaction CRUD (`lib/src/transactions.ts`)
- [x] `createTransaction(store, data)` → `Result<DataStore>` — validate, verify accountId exists, verify categoryId exists or empty
- [x] `updateTransaction(store, id, changes)` → `Result<DataStore>` — validate, verify new accountId/categoryId if changed
- [x] `deleteTransaction(store, id)` → `Result<DataStore>` — **cascade delete transfer pair** if transferPairId exists
- [x] Bulk import: accept array, deduplicate by `date|accountId|amount|description`, skip before reconciled date
- [x] Append optimization: new transactions use appendCSVRecords, edits/deletes do full rewrite
- [x] Tests: create, update, delete, bulk import, dedup, cascade delete pair, dangling categoryId

### 2.3 Category CRUD (`lib/src/categories.ts`)
- [x] `createCategory(store, data)` → `Result<DataStore>` — validate, assign ID
- [x] `updateCategory(store, id, changes)` → `Result<DataStore>` — validate, update assigned amount
- [x] `hideCategory(store, id)` → `Result<DataStore>` — soft delete
- [x] `deleteCategory(store, id)` → `Result<DataStore>` — **nullify categoryId on ALL referencing transactions** (mass CSV rewrite of transactions.csv)
- [x] Tests: create, update, hide, delete with nullification, verify transaction mass update

### 2.4 Transfer integrity (`lib/src/transfers.ts`)
- [x] `createTransfer(store, fromAccountId, toAccountId, amount, ...)` → `Result<DataStore>` — create two transactions with mutual transferPairId
- [x] Edit amount → sync paired transaction (flip sign)
- [x] Edit accountId → only edited side moves, pair stays (valid: "wrong source account" fix)
- [x] Change type from transfer → other → **unlink and delete paired transaction**
- [x] Delete one side → **cascade delete the other**
- [x] Tests: create pair, sync amount, change account, unlink on type change, cascade delete

### 2.5 Reconciliation (`lib/src/reconcile.ts`)
- [x] `reconcileAccount(store, accountId, reportedBalance)` → `Result<DataStore>` — check discrepancy, set reconciled date + update balance
- [x] `createBalanceAdjustment(store, accountId)` → `Result<DataStore>` — auto-create transaction to zero out discrepancy
- [x] **Auto-clear**: any transaction create/update/delete affecting an account clears its reconciled field
- [x] Wire auto-clearing into all transaction mutations
- [x] Three account states: **reconciled** (formally verified) / **balanced** (amounts match, not verified) / **discrepancy** (amounts differ)
- [x] Tests: reconcile flow, balance adjustment, auto-clear on mutation, threshold checks, three-state detection

### 2.6 Unified API (`lib/src/index.ts`)
- [x] Coordinate multi-file operations (e.g., deleteCategory touches categories.csv AND transactions.csv)
- [x] Consistent Result-based error handling across all operations
- [x] Integration tests: create account → add transactions → categorize → reconcile → delete category → verify nullification

### Data integrity test suite
- [x] Referential integrity: every cascade/block/nullify scenario
- [x] Corruption resistance: dangling accountId, dangling categoryId, dangling transferPairId — never crash
- [x] Round-trips: write N records → read → assert identical, including special characters
- [x] Bulk operations: import 1000 transactions, delete category with 500 transactions
- [x] Concurrent-ish safety: verify atomic write leaves original untouched on abort

---

## Phase 3 — Server API

**Why**: The UI needs endpoints that actually return and modify data.
All routes currently return empty responses.

### 3.1 Wire routes to lib
- [x] `GET /api/accounts` — all accounts with working balances
- [x] `POST /api/accounts` — create account
- [x] `GET/PUT/DELETE /api/accounts/:id` — account CRUD
- [x] `POST /api/accounts/:id/reconcile` — reconcile
- [x] `GET /api/transactions` — list with filters: `accountId`, `categoryId`, `startDate`, `endDate`
- [x] `POST /api/transactions` — create transaction or transfer
- [x] `GET/PUT/DELETE /api/transactions/:id` — transaction CRUD (cascade transfers)
- [x] `POST /api/transactions/import` — bulk import with dedup
- [x] `GET /api/categories` — all categories
- [x] `POST /api/categories` — create category
- [x] `GET/PUT/DELETE /api/categories/:id` — category CRUD
- [x] `GET /api/budget` — categories with assigned / spent / available
- [x] `GET /api/budget?month=YYYY-MM` — budget for specific month

### 3.2 Error handling
- [x] Validate request bodies using lib validators
- [x] HTTP status codes: 400 validation, 404 not found, 409 conflict (e.g., delete account with transactions)
- [x] Consistent JSON error format

### 3.3 Server tests
- [x] Integration tests for each route (supertest or similar)
- [x] Error cases and edge cases

---

## Phase 4 — UI: API Client & State

**Why**: The UI can't fetch or send data yet.

### 4.1 API client (`ui/src/api/`)
- [x] Fetch wrapper with error handling
- [x] Modules: accounts, transactions, categories, budget

### 4.2 State management
- [x] React Context or lightweight store
- [x] Loading / error states
- [x] Refetch after mutations
- [x] Selected account + selected month state

---

## Phase 5 — UI: Transactions Screen

**Why**: The main workhorse screen — where you see your money.

### 5.1 Account sidebar
- [ ] Accounts grouped by type with balances
- [ ] Three-state indicators per account: reconciled (checkmark) / balanced (faded checkmark) / discrepancy (amber dot)
- [ ] Click to filter, net worth summary
- [ ] Settings cog for account management

### 5.2 Transaction table
- [ ] Sortable table with inline editing
- [ ] Color coding (income/expense/transfer)
- [ ] Pagination or virtual scrolling

### 5.3 Filters & search
- [ ] Search box, category filter, date range picker

### 5.4 Add transaction
- [ ] Form with validation, transfer mode for linked pairs

### 5.5 Reconciliation UI
- [ ] Balance bar (reported vs working), reconcile button

---

## Phase 6 — UI: Budget Screen

**Why**: The core budgeting experience — where you plan your money.

### 6.1 Budget table
- [ ] Categories grouped by group, columns: assigned / spent / available
- [ ] Inline editing of assigned amounts, group subtotals

### 6.2 Month navigation
- [ ] Month selector, per-month spending data

### 6.3 Category management
- [ ] Add, edit, hide/unhide categories

### 6.4 Budget summary
- [ ] Total budgeted vs spent vs available, "ready to assign"

---

## Phase 7 — Import Flow

**Why**: Without import, manual entry is the only option — too tedious for real use.

### 7.1 CSV import UI
- [ ] File upload, preview, dedup indicators, account selector

### 7.2 Parser infrastructure (`data/parsers/`)
- [ ] Parser template and conventions
- [ ] IMPORT.md guide for creating parsers (designed for AI assistance)

### 7.3 Import archiving
- [ ] After successful import, archive processed bank CSV to `data/imports/{account-slug}/YYYY-MM-DD_to_YYYY-MM-DD.csv`
- [ ] Audit trail: original bank files preserved for re-import or debugging

---

## Phase 8 — Documentation

**Why**: Essential for the open-source goal. Others need to understand
the system to use it and contribute. Docs also help during development.

### 8.1 SYSTEM.md
- [ ] System overview and philosophy
- [ ] Data model documentation (accounts, transactions, categories)
- [ ] Core concepts: reconciliation, transfers, budgeting, uncategorized
- [ ] Budget calculation: assigned vs spent vs available

### 8.2 Data conventions
- [ ] Date formats (ISO 8601: YYYY-MM-DD for dates, full ISO for timestamps)
- [ ] ID generation (auto-increment integers as strings)
- [ ] Amount signs (negative = outflow, positive = inflow)
- [ ] CSV rules (RFC 4180, UTF-8, no BOM on write)
- [ ] Schema migration behavior

### 8.3 CLAUDE.md / AGENTS.md
- [ ] Git workflow (main for framework, budget for personal data, rebase)
- [ ] Coding conventions (FP style, Result types, no exceptions)
- [ ] Testing requirements before committing
- [ ] How AI agents should interact with the codebase

---

## Phase 9 — Polish & Getting Started Experience

**Why**: For others to clone and use this, the first-run experience must be smooth.

### 9.1 Getting started flow
- [ ] First-run detection (no accounts exist)
- [ ] Guided setup: create first account → add transactions → set budget

### 9.2 UI polish
- [ ] Responsive layout, loading states, empty states
- [ ] Toast notifications, keyboard shortcuts

### 9.3 Error resilience
- [ ] Graceful handling of malformed CSV files
- [ ] Server error display in UI

---

## Phase 10 — Project Website (Optional)

**Why**: A landing page to explain what PFS is and link to the repo.

### 10.1 Landing page (`website/`)
- [ ] What PFS is, key features, getting started, GitHub link

---

## Execution Priority

```
Phase 1 (foundations) ──→ Phase 2 (CRUD + integrity) ──→ Phase 3 (API)
                                                              │
                                                    ┌─────────┼─────────┐
                                                    ▼         ▼         ▼
                                               Phase 4   Phase 5   Phase 6
                                              (UI state) (txns UI) (budget UI)
                                                    │         │         │
                                                    └─────────┼─────────┘
                                                              ▼
                                                   Phase 7 (import) ──→ Phase 8 (docs)
                                                                              │
                                                                              ▼
                                                                     Phase 9 (polish)
```

**Minimum viable budget tracker** = Phases 1–6.
After Phase 6 you can create accounts, enter transactions, assign budgets,
and see where your money goes.

Phase 7 (import) makes it practical for real use.
Phase 8 (docs) makes it understandable and contributable.
Phase 9 (polish) makes it nice to use.
Phase 10 is a nice-to-have.
