# ExampleHR Time-Off Management System

A full-stack time-off management system with HCM integration, built per the technical requirements document.

## Architecture

- **HCM Mock** (`apps/hcm-service`) — Port 3001 — Simulates enterprise HCM REST API
- **ExampleHR Backend** (`apps/examplehr-backend`) — Port 3000 — NestJS API with JWT auth, balance cache, sync
- **ExampleHR Frontend** (`apps/examplehr-frontend`) — Port 5173 — React SPA with TailwindCSS

## Quick Start

### Prerequisites

- Node.js 20 LTS (Node 24+ also works with `sqlite3` prebuilds)
- npm 9+

### Install

```bash
npm install
```

### Seed databases

Start HCM first, then seed both services:

```bash
npm run seed -w apps/hcm-service
npm run seed -w apps/examplehr-backend
```

### Run (3 terminals)

```bash
npm run start:hcm
npm run start:backend
npm run start:frontend
```

Open http://localhost:5173

### Demo accounts

| Email | Role | Password |
|---|---|---|
| alice@example.com | Employee | password123 |
| bob@example.com | Employee | password123 |
| carol@example.com | Manager | password123 |
| admin@example.com | Admin | password123 |

## API Documentation

- ExampleHR Swagger: http://localhost:3000/docs
- HCM Swagger: http://localhost:3001/docs

## Key Features

- Real-time HCM balance checks before deductions
- Local balance cache with TTL and batch reconciliation (cron every 60 min)
- Optimistic locking on concurrent balance updates
- Idempotent HCM deduct/credit via `referenceId`
- JWT auth with refresh tokens
- Manager approval queue
- Admin sync trigger and status

## Environment

Copy `.env.example` to `.env` in each app directory or set variables at the workspace root.

## Docker

```bash
docker-compose up --build
```

## Tests

```bash
npm test
```
