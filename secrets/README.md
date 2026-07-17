# Secrets & environment configuration

Central copy of environment variables for this project. Use **`sync-env.ps1`** (Windows) or **`sync-env.sh`** to copy these into the app folders after clone.

## Files

| File | Copied to | Purpose |
|------|-----------|---------|
| `api.env` | `apps/api/.env` | PostgreSQL, JWT, API server, ngrok `PUBLIC_URL` |
| `ngrok.env` | `.env.ngrok` | ngrok authtoken for `npm run tunnel` |
| `ngrok.yml` | `infrastructure/ngrok/ngrok.yml` | ngrok tunnel config (domain + port 3000) |
| `mobile.env.json` | reference for `apps/mobile/src/environments/` | Mobile API base URL |
| `dashboard.env` | reference for Vite | Dashboard API proxy / public URL |
| `admin.credentials` | — | Default admin dashboard login (dev only) |

## Quick sync (after git clone)

```powershell
cd secrets
.\sync-env.ps1
```

```bash
cd secrets && ./sync-env.sh
```

## Security

- **Keep this repository private** if real tokens and DB passwords are stored here.
- Rotate ngrok authtoken and JWT secrets if this repo was ever public with live values.
- Local `apps/api/.env` and root `.env.ngrok` remain gitignored; this folder is the tracked source of truth for your team.

## Current URLs (dev)

- **Public (ngrok):** `https://ninth-rebalance-deny.ngrok-free.dev`
- **Local API + dashboard:** `http://localhost:3000`
- **Admin:** see `admin.credentials`
