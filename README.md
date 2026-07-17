# Call Log Sync System

Enterprise Android Call Log sync — monorepo with PostgreSQL, Ionic mobile app, and admin dashboard.

## Project Structure

```
call-log-sync-system/
├── apps/
│   ├── mobile/                 # Ionic Angular Android app
│   ├── api/                    # Express + PostgreSQL API
│   └── dashboard/              # Admin web dashboard
├── packages/
│   └── plugin/                 # Capacitor Kotlin plugin
├── infrastructure/
│   └── postgres/migrations/    # Database schema SQL
├── scripts/setup.js              # One-command project setup
└── docs/                         # Guides
```

## Quick Start

### 1. Install dependencies

```bash
npm run setup
```

### 2. Set up PostgreSQL in pgAdmin 4

**Docker is NOT required.** Follow the guide:

**[docs/SETUP-POSTGRES-PGADMIN.md](docs/SETUP-POSTGRES-PGADMIN.md)**

### 3. Configure database credentials

Edit `apps/api/.env`:

```env
DB_USER=postgres
DB_PASSWORD=your_pgadmin_password
DB_NAME=call_log_sync
```

### 4. Create tables

```bash
npm run db:migrate
```

### 5. Start development (API + Dashboard on same port)

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Dashboard + API | http://localhost:3000 |
| API only | http://localhost:3000/api/v1 |
| Admin login | `admin@enterprise.com` / `admin123` |

### 5b. ngrok — one URL for everything

```bash
npm run tunnel
# or: ngrok http --domain=ninth-rebalance-deny.ngrok-free.dev 3000
```

Then use `https://ninth-rebalance-deny.ngrok-free.dev` for dashboard, API, and mobile.

See **[docs/NGROK-MOBILE-API.md](docs/NGROK-MOBILE-API.md)**

### 6. Android

```bash
npm run sync:android
npm run open:android
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | Install deps + build plugin & API |
| `npm run db:migrate` | Create PostgreSQL tables |
| `npm run dev` | Start API + Dashboard |
| `npm run build` | Build all packages |
| `npm run sync:android` | Build & sync Android project |

## Documentation

- **[PostgreSQL + pgAdmin 4 Setup](docs/SETUP-POSTGRES-PGADMIN.md)** ← start here for DB
- [Architecture](docs/ARCHITECTURE.md)
- [Capacitor Plugin Guide](docs/PART-01-CAPACITOR-PLUGIN.md)
- [API Reference](apps/api/README.md)
