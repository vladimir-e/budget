# Changelog

## Phase 4 — UI: API Client & State
Added the API client layer and React state management that connects the UI to the backend:

- **API client** (`ui/src/api/client.ts`) — Fetch wrapper with JSON handling, typed error extraction (`ApiRequestError`), and get/post/put/del helpers
- **API modules** — Typed functions for all server endpoints: accounts (list, create, update, hide, delete, reconcile), transactions (list with filters, create, transfer, update, delete, import), categories (list, create, update, hide, delete), budget (get with month filter)
- **API types** (`ui/src/api/types.ts`) — Full TypeScript interfaces for all API request/response shapes, mirroring server contracts
- **AppContext** (`ui/src/context/AppContext.tsx`) — React Context provider with: accounts/transactions/categories/budget state, loading/error states, selected account + month selection, automatic refetch on selection changes, granular refresh functions for post-mutation updates
- **Screen integration** — TransactionsScreen now shows real account sidebar (grouped by type, with balances and net worth) and transaction table; BudgetScreen now shows categories grouped by group with assigned/spent/available columns and month navigation

## Phase 3 — Server API
Wired all Express routes to lib CRUD functions via a store manager (load once, mutate + persist). Accounts, transactions, categories, and budget endpoints are live with proper HTTP status codes (400/404/409), transfer creation, bulk import with dedup, reconciliation, and month-filtered budget queries. 33 integration tests (supertest).

## Phase 2 — CRUD & Data Integrity
Added pure-function CRUD operations for accounts, transactions, categories, and transfers, plus account reconciliation. All mutations return Result<DataStore> and enforce referential integrity:

## Phase 1 — Foundations: Type System, Storage, Schemas

- **Result type** — `Result<T>` with `ok()`/`err()` constructors for error handling without exceptions
- **Field schemas** — `ACCOUNT_SCHEMA`, `TRANSACTION_SCHEMA`, `CATEGORY_SCHEMA` replace the old `*_FIELDS` arrays as single source of truth, with compile-time completeness checks
- **Integer money** — Amounts stored as integers in memory (e.g. `1050` = $10.50), converted on CSV read/write using a currency precision map (USD:2, JPY:0, BTC:8)
- **Atomic file I/O** — Write-to-temp + fsync + rename; read/write/append helpers with schema-aware serialization
- **DataStore** — `loadStore()`/`persistStore()` for reading and writing all three CSVs, with multi-currency precision handling
- **ID generation** — `nextId()` auto-increments from max existing numeric ID
- **Schema migration** — Missing CSV columns auto-filled with defaults on read; extra columns ignored; writes always include all schema columns
- Added `crypto` to `AccountType`
- 123 tests (82 new)
