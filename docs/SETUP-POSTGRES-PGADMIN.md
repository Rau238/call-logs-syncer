# PostgreSQL Setup with pgAdmin 4

This project uses **local PostgreSQL** — Docker is **not required**.

---

## Step 1 — Install PostgreSQL (if not installed)

Download from: https://www.postgresql.org/download/windows/

During install, remember the **postgres user password** you set.

pgAdmin 4 is included with the PostgreSQL installer.

---

## Step 2 — Open pgAdmin 4

1. Launch **pgAdmin 4**
2. In the left panel, expand **Servers**
3. Click your server (usually `PostgreSQL 16` or similar)
4. Enter the password you set during installation

---

## Step 3 — Create the database

### Option A — Using pgAdmin GUI

1. Right-click **Databases** → **Create** → **Database...**
2. Set **Database name:** `call_log_sync`
3. Click **Save**

### Option B — Using Query Tool

1. Right-click your server → **Query Tool**
2. Run:

```sql
CREATE DATABASE call_log_sync;
```

---

## Step 4 — (Optional) Create a dedicated user

You can use the default `postgres` user, or create a dedicated one:

```sql
CREATE USER calllog WITH PASSWORD 'calllog_secret';
GRANT ALL PRIVILEGES ON DATABASE call_log_sync TO calllog;
```

Then connect to `call_log_sync` database and run:

```sql
GRANT ALL ON SCHEMA public TO calllog;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO calllog;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO calllog;
```

---

## Step 5 — Configure the API

Edit `apps/api/.env` with your credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=YOUR_PGADMIN_PASSWORD
DB_NAME=call_log_sync
```

> Use the same username/password you use to log into pgAdmin 4.

---

## Step 6 — Run migrations

From the project root:

```bash
npm run db:migrate
```

This creates all tables: `users`, `devices`, `call_logs`, `sync_audit`.

### Alternative — Run SQL manually in pgAdmin

1. In pgAdmin, click database **call_log_sync**
2. Open **Query Tool**
3. Open file: `infrastructure/postgres/migrations/001_initial.sql`
4. Paste contents and click **Execute (F5)**

---

## Step 7 — Verify in pgAdmin

1. Expand **call_log_sync** → **Schemas** → **public** → **Tables**
2. You should see:

| Table | Purpose |
|-------|---------|
| `users` | Admin / employee accounts |
| `devices` | Registered Android devices |
| `call_logs` | Synced call history |
| `sync_audit` | Sync batch logs |

3. Check admin user exists:

```sql
SELECT email, role FROM users;
```

Default admin: `admin@enterprise.com` / `admin123`

> **Login returns 401?** The seed password hash was wrong. Run:
> ```bash
> npm run db:seed-admin
> ```
> Or in pgAdmin, run `infrastructure/postgres/migrations/002_fix_admin_password.sql`

---

## Step 8 — Start the project

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| API | http://localhost:3000/health |
| Dashboard | http://localhost:5173 |

Login to dashboard with `admin@enterprise.com` / `admin123`

---

## Troubleshooting

### `password authentication failed for user "postgres"`

- Open pgAdmin → check which user you log in with
- Update `DB_USER` and `DB_PASSWORD` in `apps/api/.env`

### `database "call_log_sync" does not exist`

- Create it in pgAdmin (Step 3)

### `connection refused` on port 5432

- Open **Services** (Windows) → find **postgresql-x64-16** → ensure it is **Running**
- Or in pgAdmin, confirm the server is connected

### Migration errors about types already existing

- Tables already created — safe to ignore if schema exists
- To start fresh: right-click `call_log_sync` in pgAdmin → **Delete/Drop** → recreate → run migrate again

### Android app cannot reach API

- Emulator uses `http://10.0.2.2:3000/api/v1` (already set in `apps/mobile/src/environments/environment.ts`)
- Physical device: use your PC's LAN IP, e.g. `http://192.168.1.5:3000/api/v1`

---

## pgAdmin quick reference

```
Servers
 └── PostgreSQL 16
      └── Databases
           └── call_log_sync
                └── Schemas
                     └── public
                          └── Tables
                               ├── call_logs    ← view synced calls here
                               ├── devices
                               ├── sync_audit
                               └── users
```

To browse call data:

```sql
SELECT phone_number, contact_name, call_type, duration, call_time, device_id
FROM call_logs
ORDER BY call_time DESC
LIMIT 50;
```
