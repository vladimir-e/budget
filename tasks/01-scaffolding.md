# PFS — Personal Finance System Roadmap

An AI-assisted, open-source personal finance system. Inspired by popular finance apps but simpler.
All data stored in CSV files, managed via a TypeScript library with a web UI.

**Tech stack**: TypeScript, Node.js, Express, React, Vite, Tailwind CSS, Vitest

**Git strategy**: `main` branch for framework code (forkable by users), `budget` branch for working with personal budget data. Rebase workflow.

---

## Phase 1 — Data Layer (`/data`)

Define the CSV schemas and directory structure for all user data.

### Directory Structure
```
data/
  accounts.csv
  transactions.csv
  categories.csv
  parsers/          # AI-generated on-demand import parsers
```

### Account Schema
| Field       | Type    | Description                                          |
|-------------|---------|------------------------------------------------------|
| id          | string  | Unique identifier (UUID or auto-increment)           |
| name        | string  | Display name (e.g., "Chase Checking")                |
| type        | enum    | cash, checking, credit_card, loan, savings, asset    |
| currency    | string  | Currency code (e.g., "USD") — stored, no conversion logic yet |
| institution | string  | Bank/institution name                                |
| balance     | number  | User-reported balance (what the bank says)           |
| hidden      | boolean | Whether account is hidden from default views         |
| reconciled  | string  | ISO date of last reconciliation, or empty            |
| createdAt   | string  | ISO datetime of account creation                     |

### Transaction Schema
| Field          | Type    | Description                                        |
|----------------|---------|----------------------------------------------------|
| id             | string  | Unique identifier                                  |
| type           | enum    | income, expense, transfer                          |
| accountId      | string  | References account.id                              |
| date           | string  | ISO date (YYYY-MM-DD)                              |
| categoryId     | string  | References category.id                             |
| description    | string  | Cleaned description                                |
| payee          | string  | Who the money went to/came from                    |
| transferPairId | string  | ID of the linked transfer transaction, or empty    |
| amount         | number  | Signed decimal (negative = outflow, positive = inflow) |
| notes          | string  | User notes                                         |
| source         | string  | Import origin identifier, or "manual"              |
| createdAt      | string  | ISO datetime of creation                           |

### Category Schema
| Field    | Type    | Description                                         |
|----------|---------|-----------------------------------------------------|
| id       | string  | Unique identifier                                   |
| type     | enum    | income, expense                                     |
| name     | string  | Display name (e.g., "Groceries")                    |
| group    | string  | Grouping label (e.g., "Immediate Obligations")      |
| assigned | number  | Budgeted amount for this category                   |
| hidden   | boolean | Whether category is hidden from default views       |

### Deliverables
- [ ] Define CSV files with headers (empty data)
- [ ] Seed file with starter categories (common expense/income groups)
- [ ] Document data conventions (date formats, ID generation, amount signs)

---

## Phase 2 — Library (`/lib`)

Core business logic. This is critical infrastructure — high test coverage, defensive coding, thorough edge case testing.

### Directory Structure
```
lib/
  docs/           # API documentation for each module
  src/
    csv.ts        # RFC 4180 CSV parser/writer (BOM-safe, no deps)
    accounts.ts   # Account CRUD + balance calculations
    transactions.ts  # Transaction CRUD + bulk operations
    categories.ts    # Category CRUD + budget calculations
    transfers.ts     # Transfer pair creation + sync logic
    reconcile.ts     # Reconciliation logic + auto-clearing
    validators.ts    # Input validation + sanitization
    types.ts         # Shared TypeScript types/enums
    index.ts         # Unified API entry point
  tests/
    csv.test.ts
    accounts.test.ts
    transactions.test.ts
    categories.test.ts
    transfers.test.ts
    reconcile.test.ts
    validators.test.ts
```

### Core Modules

**csv.ts** — CSV Parser/Writer
- RFC 4180 compliant parsing and writing
- BOM handling, quoted fields, escaped quotes
- No external dependencies
- Tests: malformed input, edge cases (empty fields, newlines in quotes, special chars)

**types.ts** — Type Definitions
- Account, Transaction, Category interfaces
- Enums for account types, transaction types, category types
- Validation schemas

**validators.ts** — Input Validation
- Validate all fields before write operations
- Type checking, required fields, enum validation
- Amount formatting, date parsing
- Referential integrity (accountId exists, categoryId exists)
- Defensive: never trust input, always validate

**accounts.ts** — Account Management
- CRUD operations (add, get, update, delete/hide)
- Balance calculations: working balance = sum of all account transactions
- Discrepancy detection: working balance vs user-reported balance
- Account summaries for dashboard

**transactions.ts** — Transaction Management
- CRUD operations
- Bulk import with deduplication (key: date|accountId|amount|description)
- Filtering and querying (by account, category, date range)
- Import filtering: skip transactions before reconciled date

**categories.ts** — Category Management
- CRUD operations
- Budget calculations: assigned vs spent (sum of categorized expenses) vs available
- Visible/hidden filtering
- Group-based organization

**transfers.ts** — Transfer Logic
- Create linked transfer pairs (two transactions with mutual transferPairId)
- Sync mutations: amount changes flip sign on counterpart
- Account changes update both sides
- Cascade delete when transfer is deleted or category changed from transfer

**reconcile.ts** — Reconciliation
- Mark account as reconciled (only when discrepancy < threshold)
- Clear reconciled flag on account mutation
- Auto-clear on any transaction change affecting the account
- Reconciliation date tracking

**index.ts** — Unified API
- Wraps all modules with reconciliation auto-clearing
- Single entry point for all operations
- Consistent error handling

### Testing Strategy (Vitest)
- Unit tests for every public function
- Edge cases: empty CSVs, missing fields, duplicate IDs, invalid references
- Boundary conditions: zero amounts, negative dates, very long strings
- Concurrent operation safety
- Integration tests: multi-module workflows (import → categorize → reconcile)
- Target: >90% coverage on lib

### Deliverables
- [ ] All source modules with full TypeScript types
- [ ] Comprehensive test suite
- [ ] API documentation in `/lib/docs/`

---

## Phase 3 — SYSTEM.md

Describes the core personal finance system — what it is, how it works, the data model, and core concepts.

### Contents
- System overview and philosophy
- Data model documentation (accounts, transactions, categories)
- Core concepts: reconciliation, transfers, budgeting
- CSV conventions and data integrity rules
- How the budget calculation works (assigned vs spent vs available)
- Glossary of terms

### Deliverables
- [ ] SYSTEM.md at project root

---

## Phase 4 — AGENTS.md

Instructions for AI agents working on the project.

### Contents
- Role: act as PFS (Personal Finance System)
- Git workflow: `main` for framework, `budget` for data work, rebase
- Coding conventions: TypeScript, naming, file organization
- Tone and communication style
- How to interact with the codebase
- Testing requirements before committing
- PR and commit conventions

### Deliverables
- [ ] AGENTS.md at project root
- [ ] CLAUDE.md with project-specific instructions

---

## Phase 5 — Design.md

Architecture and design documentation.

### Contents
- System architecture diagram (data → lib → server → UI)
- Module dependency graph
- Data flow: import → parse → store → display → edit
- API design (REST endpoints)
- UI component architecture
- State management approach
- Security considerations (single-user, local-first)

### Deliverables
- [ ] Design.md at project root

---

## Phase 6 — Server + UI (`/server`, `/ui`)

Web application for managing finances.

### Server (`/server`)
```
server/
  src/
    index.ts          # Express app setup
    routes/
      accounts.ts     # Account CRUD + reconciliation endpoints
      transactions.ts # Transaction CRUD (includes transfers)
      categories.ts   # Category CRUD endpoints
      budget.ts       # Budget overview endpoints
```

**API Endpoints:**
- `GET/POST /api/accounts` — list/create accounts
- `GET/PUT/DELETE /api/accounts/:id` — account CRUD + reconciliation
- `GET/POST /api/transactions` — list/create transactions
- `GET/PUT/DELETE /api/transactions/:id` — transaction CRUD (transfers are transactions with type=transfer)
- `GET/POST /api/categories` — list/create categories
- `GET/PUT /api/categories/:id` — category CRUD
- `GET /api/budget` — budget overview (assigned/spent/available per category)

### UI (`/ui`)
```
ui/
  src/
    components/
      Transactions/   # Transaction table, filters, inline editing
      Budget/         # Budget view — assigned vs spent vs available
      AccountSidebar/ # Account list with balances, grouping, settings cog
      Layout/         # App shell, navigation
    screens/
      TransactionsScreen.tsx
      BudgetScreen.tsx
      HelpScreen.tsx    # How it works + how it helps
    hooks/
    api/
    types/
```

**Key Screens (3 total):**
1. **Transactions** — The main workhorse screen. Left sidebar shows accounts grouped by type with balance indicators (reconciled checkmark, colored amounts). Clicking an account filters transactions. Sidebar has a settings cog for account management (add/edit/hide accounts). Main area has search, category filter, date range, and transaction table with inline editing. Balance bar shows reported vs actual with discrepancy. Reconciliation controls live here. Add transaction/transfer from this screen.
2. **Budget** — Categories grouped by group, with columns for assigned / spent / available. Edit assigned amounts inline. Month navigation compares historical spending against current assigned values. Category management (add/edit/hide/reorder) happens here.
3. **Help** — How the system works, how it helps manage finances

### Deliverables
- [ ] Express server with all API routes
- [ ] React UI with all screens
- [ ] Vite build pipeline
- [ ] Tailwind CSS styling

---

## Phase 7 — IMPORT.md

Guide for AI agents to create on-demand parsers when users bring bank data.

### Contents
- Parser architecture: how parsers live in `/data/parsers/`
- How to create a new parser (template/conventions)
- Input: raw bank CSV from user → Output: normalized transactions
- Deduplication strategy
- Field mapping conventions
- Fresh start workflow: first-time import guide
- Examples of parser patterns (date formats, amount conventions per bank)

### Deliverables
- [ ] IMPORT.md at project root
- [ ] Parser template/example in `/data/parsers/`

---

## Phase 8 — Website (`/website`)

Public-facing project site for the open-source PFS.

### Contents
- Landing page explaining what PFS is
- Key features and philosophy
- Getting started guide
- Link to GitHub repository
- Screenshots/demo

### Directory Structure
```
website/
  index.html
  # Static site (could be Astro, plain HTML, or similar)
```

### Deliverables
- [ ] Landing page
- [ ] Deploy configuration (GitHub Pages or similar)

---

## Execution Order Summary

| Phase | What                | Focus                                    |
|-------|---------------------|------------------------------------------|
| 1     | `/data`             | CSV schemas, seed data                   |
| 2     | `/lib`              | Core library, types, tests (high coverage) |
| 3     | `SYSTEM.md`         | System documentation                     |
| 4     | `AGENTS.md`         | AI agent instructions                    |
| 5     | `Design.md`         | Architecture documentation               |
| 6     | `/server` + `/ui`   | Web application                          |
| 7     | `IMPORT.md`         | Import parser guide                      |
| 8     | `/website`          | Project landing page                     |

---

## Open Questions / Future Considerations

- **Multi-currency**: Currency field stored per account, conversion logic deferred
- **Authentication**: Single-user system, no auth needed initially
- **Mobile**: Responsive web UI first, native app TBD
- **Export**: CSV export, migration tools for popular finance apps
- **Recurring transactions**: Auto-generate scheduled transactions
- **Reports/Charts**: Spending trends, net worth over time
