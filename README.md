# PFS — Personal Finance System

A local-first, CSV-based personal finance tracker. All your data stays on your machine as plain CSV files, managed through a TypeScript library with a web UI.

## Tech Stack

TypeScript, Node.js, Express, React, Vite, Tailwind CSS, Vitest

## Quick Start

```bash
git clone <repo-url> && cd pfs
npm install
npm run dev       # start server + UI in parallel (dev mode)
```

Or for production use:

```bash
npm start         # build everything & serve at localhost:3001
```

## Project Structure

```
data/           CSV files (accounts, transactions, categories)
lib/            Core library — CSV parsing, types, validation, business logic
server/         Express API server
ui/             React web UI
tasks/          Development task specs
```

## How It Works

Your financial data lives in three CSV files:
- **accounts.csv** — bank accounts, credit cards, etc.
- **transactions.csv** — every income, expense, and transfer
- **categories.csv** — budget categories with assigned amounts

The `lib/` package reads and writes these files. The `server/` exposes them as a REST API. The `ui/` renders everything in a browser.

## Status

Early development. See [ROADMAP.md](ROADMAP.md) for the full plan.

## License

MIT
