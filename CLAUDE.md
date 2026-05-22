# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **npm workspaces monorepo** simulating a time-off management system integrated with a mock HCM (Human Capital Management) service. Three independent apps run simultaneously:

| App | Directory | Port | Description |
|-----|-----------|------|-------------|
| HCM Mock Service | `apps/hcm-service` | 3001 | Simulates enterprise HCM REST API |
| ExampleHR Backend | `apps/examplehr-backend` | 3000 | NestJS API (auth, balance cache, sync) |
| ExampleHR Frontend | `apps/examplehr-frontend` | 5173 | React SPA (Vite, TailwindCSS) |

## Commands

### Development (run each in a separate terminal)
```bash
npm run start:hcm        # HCM mock service in watch mode
npm run start:backend    # ExampleHR backend in watch mode
npm run start:frontend   # Vite dev server (proxies /api → :3000)
```

### Per-workspace commands
```bash
# Run a command in a specific workspace
npm run <script> -w apps/hcm-service
npm run <script> -w apps/examplehr-backend
npm run <script> -w apps/examplehr-frontend
```

### Seeding databases
```bash
npm run seed             # Seeds both backends (hcm-service + examplehr-backend)
npm run seed -w apps/hcm-service
npm run seed -w apps/examplehr-backend
```

### Testing
```bash
npm run test                                        # All workspaces
npm run test -w apps/examplehr-backend              # Unit tests only
npm run test:e2e -w apps/examplehr-backend          # E2E tests
npm run test:cov -w apps/examplehr-backend          # With coverage report
```

Coverage thresholds (examplehr-backend): 50% lines/functions, 40% branches.

### Building
```bash
npm run build            # Build all workspaces
npm run build -w apps/examplehr-backend
```

### Docker
```bash
docker-compose up        # Start all three services with persistent SQLite volumes
```

### API docs
- ExampleHR Backend: http://localhost:3000/docs
- HCM Mock Service: http://localhost:3001/docs

## Architecture

### Backend pattern (NestJS + Sequelize + SQLite)

Both backends follow NestJS's modular architecture with feature-based modules. Each module typically has: `module.ts`, `controller.ts`, `service.ts`, DTOs, and model files.

**ExampleHR Backend modules:**
- `auth/` — JWT login/logout, refresh tokens, RolesGuard, JwtStrategy
- `balance/` — Local balance cache with TTL, served from SQLite (not HCM)
- `time-off/` — Request lifecycle: PENDING → APPROVED/REJECTED, triggers HCM deduction
- `sync/` — Scheduled and manual reconciliation with HCM (default: every 60 min)
- `hcm-client/` — Axios-based client that calls the HCM mock service
- `database/` — Sequelize setup via `DatabaseModule` (global)

**HCM Mock Service modules:**
- `balance/` — Authoritative balance records
- `batch/` — Batch balance push endpoint
- `common/` — API key guard, failure rate simulator
- `simulate/` — Endpoint to toggle failure simulation

### Key architectural decisions

**Balance caching flow:** Frontend → ExampleHR Backend (SQLite cache, TTL configurable) → periodic sync from HCM. The cache uses an `hcmVersion` column for optimistic locking.

**Idempotent HCM writes:** Every time-off deduction request carries a `referenceId` (stored in `HcmDeductionRef`) to prevent duplicate deductions on retry.

**JWT auth:** Access tokens (15 min default) + refresh tokens stored in `AuthToken` table. Frontend stores tokens in localStorage; 401 responses trigger automatic logout.

**Failure simulation:** HCM service has a configurable failure rate (`SIMULATE_FAILURE_RATE`) used to test sync resilience.

### Frontend pattern (React + Vite + React Query)

```
src/
├── pages/         # Route-level components (Login, Dashboard, TimeOff, etc.)
├── components/    # Reusable UI (Layout, BalanceCard, StatusBadge)
├── context/       # AuthContext — user state + token management
├── services/      # api.ts — Axios instance with /api base URL and 401 interceptor
└── App.tsx        # React Router setup
```

Dev server proxies `/api/*` → `http://localhost:3000` (configured in `vite.config.ts`). All API calls use the `/api` prefix.

Form validation uses **React Hook Form + Zod**. Server state (fetching, caching, refetching) uses **TanStack React Query**.

### Database models (Sequelize + TypeScript decorators)

Both backends use `synchronize: true` — schema auto-syncs on startup, no migrations. Models use `sequelize-typescript` decorators (`@Table`, `@Column`, `@HasMany`, etc.).

## Environment Setup

Copy `.env.example` to `.env` in each backend app directory, or set env vars:

```
# ExampleHR Backend defaults
PORT=3000
HCM_BASE_URL=http://localhost:3001/hcm
HCM_API_KEY=dev-secret
JWT_SECRET=change-me-in-production
DB_PATH=./examplehr.sqlite

# HCM Service defaults
HCM_PORT=3001
HCM_DB_PATH=./hcm.sqlite
SIMULATE_FAILURE_RATE=0.05
```

## Pre-seeded Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| alice@example.com | password123 | Employee |
| bob@example.com | password123 | Employee |
| carol@example.com | password123 | Manager |
| admin@example.com | password123 | Admin |
