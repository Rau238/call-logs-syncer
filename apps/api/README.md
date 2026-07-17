# @call-log/api

Node.js + Express + TypeScript + **PostgreSQL** REST API.

## Setup

1. Configure PostgreSQL in pgAdmin 4 — see [docs/SETUP-POSTGRES-PGADMIN.md](../../docs/SETUP-POSTGRES-PGADMIN.md)
2. Copy `.env.example` to `.env` and set your DB password
3. Run `npm run db:migrate` from project root

## Development

```bash
npm run dev
```

## Endpoints

See root [README.md](../../README.md) and run `GET http://localhost:3000/health` to verify.
