# Changelog

## Phase 4 — UI: API Client & State
Typed API client (`ui/src/api/`) for all server endpoints, React Context for app state (accounts, transactions, categories, budget, selected account/month), and wired screens to display live data.

## Phase 3 — Server API
Wired all Express routes to lib CRUD functions via a store manager (load once, mutate + persist). Accounts, transactions, categories, and budget endpoints are live with proper HTTP status codes (400/404/409), transfer creation, bulk import with dedup, reconciliation, and month-filtered budget queries. 33 integration tests (supertest).

## Phase 2 — CRUD & Data Integrity
Added pure-function CRUD operations for accounts, transactions, categories, and transfers, plus account reconciliation. All mutations return Result<DataStore> and enforce referential integrity:

## Phase 1 — Foundations: Type System, Storage, Schemas
Result type, field schemas, integer money with currency precision, atomic file I/O, DataStore load/persist, ID generation, schema migration. 123 tests.
