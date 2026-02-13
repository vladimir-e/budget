# PFS — Personal Finance System

A local-first, CSV-based personal finance tracker. All your data stays on your machine as plain CSV files, managed through a TypeScript library with a web UI.

**Designed to work with AI assistants.** Open this project in Claude Code, Cursor, Codex, or Copilot. Drop your bank CSV exports into `drop_files_here/`, and the AI handles import, account setup, and categorization. You set your budget and watch the numbers balance.

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

## Working with AI

The recommended workflow uses an AI coding assistant (Claude Code, Cursor, Codex, Copilot) to manage your budget:

1. **Open the project** in your AI-assisted editor or terminal
2. **Drop bank CSV exports** into `drop_files_here/`
3. **Ask the AI** to import the files — it reads `AGENTS.md` and `IMPORT.md` for instructions
4. **Review and categorize** transactions in the web UI at `localhost:3001`
5. **Set your budget** on the Budget screen

The AI assistant commits your data changes to git automatically, giving you full history and undo capability. If something goes wrong, you can always roll back.

**Important:** Your financial data is stored in CSV files tracked by git. Do not push this repository to a public remote. Keep it local or use a private repository. As a safeguard, disable push on the remote:

```bash
git remote set-url --push origin no_push
```

This allows `git pull` to fetch updates but blocks `git push` from accidentally uploading your data.

## Project Structure

```
data/              CSV files (accounts, transactions, categories)
data/parsers/      Bank-specific CSV parsers
drop_files_here/   Drop bank CSV exports here for AI-assisted import
lib/               Core library — CSV parsing, types, validation, business logic
server/            Express API server
ui/                React web UI
```

## Documentation

| Doc | What it covers |
|---|---|
| [SYSTEM.md](SYSTEM.md) | How the budget system works — goals, concepts, workflow |
| [DESIGN.md](DESIGN.md) | Architecture, patterns, API reference, testing |
| [AGENTS.md](AGENTS.md) | Instructions for AI assistants working with this project |
| [IMPORT.md](IMPORT.md) | How to import bank CSV exports |
| [ROADMAP.md](ROADMAP.md) | Development plan and progress |

## How It Works

Your financial data lives in three CSV files:
- **accounts.csv** — bank accounts, credit cards, etc.
- **transactions.csv** — every income, expense, and transfer
- **categories.csv** — budget categories with assigned amounts

The `lib/` package reads and writes these files. The `server/` exposes them as a REST API. The `ui/` renders everything in a browser.

## Tech Stack

TypeScript, Node.js, Express, React, Vite, Tailwind CSS, Vitest

## Prerequisites

- Node.js 18+
- npm 9+
- git (required — used for data history and recovery)

## License

MIT
