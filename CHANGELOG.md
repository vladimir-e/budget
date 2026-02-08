# Changelog

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
