# PFS — Design & Architecture

## Architecture: Functional Core, Imperative Shell

All business logic is pure functions. Side effects (file I/O, HTTP) live at the boundary.

```
Pure core:   (DataStore, input) → Result<DataStore>
I/O shell:   load(dataDir) → DataStore    persist(DataStore, dataDir) → void
```

The `lib/` package contains the pure core. The `server/` package provides the imperative shell — it loads data from disk, passes it through pure functions, and persists the result.

## Project Structure

```
lib/            Pure business logic (no I/O in exports, Node fs only in storage.ts/store.ts)
  src/
    types.ts          Account, Transaction, Category interfaces + enums
    result.ts         Result<T> = Ok | Err, no exceptions
    schema.ts         Field metadata, serialize/deserialize, money conversion
    csv.ts            RFC 4180 parser/writer, BOM-safe
    storage.ts        Atomic file I/O (readCSVFile, writeCSVFile, appendCSVRecords)
    store.ts          DataStore type, loadStore, persistStore
    ids.ts            Auto-increment ID generation
    accounts.ts       Account CRUD (pure functions returning Result<DataStore>)
    transactions.ts   Transaction CRUD + bulk import with dedup
    categories.ts     Category CRUD
    transfers.ts      Transfer pair management
    reconcile.ts      Account reconciliation
    validators.ts     Input validation (validateAccount, validateTransaction, validateCategory)
    index.ts          Public API re-exports

server/         Express REST API (imperative shell)
  src/
    index.ts          Express app setup, static file serving
    storeManager.ts   In-memory DataStore lifecycle (init, get, mutate+persist)
    routes/           REST endpoints for accounts, transactions, categories, budget

ui/             React web UI
  src/
    api/              Typed fetch client (accounts, transactions, categories, budget)
    context/          AppContext — global state (accounts, transactions, categories, budget, selection)
    components/       TransactionsScreen, BudgetScreen, HelpScreen

data/           CSV files (accounts.csv, transactions.csv, categories.csv)
```

## Key Patterns

### Result type — no exceptions

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
```

Every operation that can fail returns `Result<T>`. No `throw` for expected failures. This makes error paths explicit and composable.

```typescript
const result = createAccount(store, input);
if (!result.ok) {
  return res.status(400).json({ error: result.error });
}
// result.value is the new DataStore
```

### DataStore — immutable state container

```typescript
type DataStore = {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
};
```

Every mutation returns a new `DataStore`. The server holds one in memory and swaps it on successful mutations.

### Store Manager — mutation + persistence

```typescript
// Server-side pattern
async function mutate(fn: (store: DataStore) => Result<DataStore>): Promise<Result<DataStore>> {
  const result = fn(getStore());
  if (result.ok) {
    store = result.value;
    await persistStore(store, dataDir);
  }
  return result;
}
```

This keeps the pure core clean: lib functions don't know about persistence. The server handles the load-mutate-persist lifecycle.

### Schema-driven serialization

Each entity type has a schema defining its fields:

```typescript
const ACCOUNT_SCHEMA: Schema<Account> = [
  { name: 'id', type: 'string' },
  { name: 'name', type: 'string' },
  { name: 'balance', type: 'money' },  // Currency-aware conversion
  // ...
];
```

Schemas are the single source of truth for:
- CSV column order and headers
- Type conversion on read/write
- Money precision (integer cents ↔ decimal strings)
- Schema migration (missing columns get defaults, extra columns are ignored)

Compile-time checks ensure schema field names match the TypeScript interface.

### Atomic file I/O

All CSV writes follow: write to temp → fsync → atomic rename.

```
writeCSVFile(path, schema, records)
  → serialize records using schema
  → writeCSV (RFC 4180 format)
  → atomicWriteFile: write tmp, fsync, rename over original
```

A crash at any point during write leaves the original file intact.

### Integer money

CSV stores `"10.50"`. Memory stores `1050`. Conversion uses a precision map:

```typescript
const CURRENCY_PRECISION: Record<string, number> = {
  USD: 2, EUR: 2, GBP: 2, JPY: 0, BTC: 8, ETH: 18, ...
};
```

All arithmetic operates on integers. No floating-point drift, ever.

### Referential integrity

Since CSV has no foreign key constraints, the lib enforces them:

- **Block**: Can't delete an account that has transactions
- **Cascade**: Deleting a transfer transaction deletes its pair
- **Nullify**: Deleting a category sets `categoryId=""` on all its transactions
- **Auto-clear**: Any transaction mutation clears the account's reconciled state

### Bulk import with deduplication

Dedup key: `${date}|${accountId}|${amount}|${description}`

Re-importing the same bank CSV is safe — duplicates are skipped. Transactions before the account's reconciled date are also skipped.

## Testing

### Running tests

```bash
npm test                         # All tests (lib + server)
npm test --workspace=lib         # Lib unit tests only
npm test --workspace=server      # Server integration tests only
```

### Test philosophy

- **Unit tests** cover all pure functions in `lib/`. Every CRUD operation, every edge case, every integrity constraint.
- **Integration tests** cover server routes end-to-end using supertest. Each route is tested for success cases, validation errors, 404s, and conflict scenarios.
- **Round-trip tests** verify that data survives serialize → write → read → deserialize without loss.
- **Integrity tests** verify every cascade/block/nullify scenario, dangling references, and corruption resistance.

### Before committing

Always run `npm test` before committing. All tests must pass. If you're modifying lib code, run `npm test --workspace=lib` for fast feedback, then the full suite before committing.

### Adding tests

- Place lib tests next to source files or in `lib/src/__tests__/`
- Place server tests in `server/src/__tests__/`
- Use vitest. Test files: `*.test.ts`
- Test pure functions directly. No mocking needed for lib — that's the point of pure functions.

## Data Conventions

| Convention | Rule |
|---|---|
| Dates | ISO 8601: `YYYY-MM-DD` for dates, full ISO for timestamps |
| IDs | Auto-increment integers stored as strings (`"1"`, `"2"`, ...) |
| Amounts | Negative = outflow, positive = inflow |
| CSV encoding | RFC 4180, UTF-8, no BOM on write, BOM-safe on read |
| Empty fields | Empty string `""`, not null/undefined |
| Booleans | `"true"` / `"false"` in CSV |
| Uncategorized | `categoryId = ""` (empty string, not a magic ID) |

## API Reference

### Server endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/accounts` | List visible accounts with working balances |
| POST | `/api/accounts` | Create account |
| GET | `/api/accounts/:id` | Get account detail with discrepancy |
| PUT | `/api/accounts/:id` | Update account |
| DELETE | `/api/accounts/:id?mode=hide` | Soft delete (default) |
| DELETE | `/api/accounts/:id?mode=hard` | Hard delete (blocked if has transactions) |
| POST | `/api/accounts/:id/reconcile` | Reconcile account |
| GET | `/api/transactions` | List with filters: `accountId`, `categoryId`, `startDate`, `endDate` |
| POST | `/api/transactions` | Create transaction or transfer |
| GET | `/api/transactions/:id` | Get transaction |
| PUT | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete (cascades transfer pair) |
| POST | `/api/transactions/import` | Bulk import with dedup |
| GET | `/api/categories` | List all categories |
| POST | `/api/categories` | Create category |
| GET | `/api/categories/:id` | Get category |
| PUT | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id?mode=hide` | Soft delete (default) |
| DELETE | `/api/categories/:id?mode=hard` | Hard delete (nullifies transactions) |
| POST | `/api/categories/:id/unhide` | Restore hidden category |
| GET | `/api/budget?month=YYYY-MM` | Budget overview for month |

### Request/response format

All requests and responses use JSON. Error responses follow:

```json
{ "error": "Human-readable error message" }
```

HTTP status codes: 200 success, 201 created, 204 no content, 400 validation error, 404 not found, 409 conflict.
