# Single URL — API + Dashboard + Mobile (ngrok)

Everything runs on **one URL** via ngrok port **3000**.

```
https://ninth-rebalance-deny.ngrok-free.dev
├── /                    → Admin Dashboard (React)
├── /health              → API health check
└── /api/v1/...          → REST API (mobile + dashboard)
```

---

## How it works

The Express API serves:
- **Dashboard** — static files from `apps/dashboard/dist`
- **API** — `/api/v1/*` routes

One ngrok tunnel → one public URL for everything.

---

## Step 1 — Start the server

```bash
cd c:\Users\ViP\call-log-sync-system
npm run dev
```

This builds the dashboard and starts the API on port **3000** (dashboard included).

Verify locally:

| What | URL |
|------|-----|
| Dashboard | http://localhost:3000/ |
| API health | http://localhost:3000/health |
| API login | http://localhost:3000/api/v1/auth/login |

---

## Step 2 — Start ngrok (port 3000)

```bash
npm run tunnel
```

Or manually (requires ngrok 3.20+):

```bash
ngrok update   # if you see ERR_NGROK_121
ngrok http 3000 --url=https://ninth-rebalance-deny.ngrok-free.dev
```

> **NOT port 5000 or 80** — always **3000**  
> **Do NOT use `npx ngrok`** — the npm package bundles an outdated agent.

---

## Step 3 — Use the same ngrok URL everywhere

| App | URL |
|-----|-----|
| **Dashboard** | `https://ninth-rebalance-deny.ngrok-free.dev/` |
| **API** | `https://ninth-rebalance-deny.ngrok-free.dev/api/v1` |
| **Mobile app** | `https://ninth-rebalance-deny.ngrok-free.dev/api/v1` (already configured) |
| **Health check** | `https://ninth-rebalance-deny.ngrok-free.dev/health` |

Dashboard login: `admin@enterprise.com` / `admin123`

---

## Step 4 — Rebuild Android (if needed)

```bash
npm run sync:android
npm run open:android
```

Mobile `environment.ts` already points to the ngrok API URL.

---

## Startup order

```
Terminal 1:  npm run dev
Terminal 2:  ngrok http --domain=ninth-rebalance-deny.ngrok-free.dev 3000
```

---

## ⚠️ Do NOT use ngrok OAuth / traffic policy

```bash
# ❌ Blocks mobile API
ngrok http 3000 --traffic-policy-file policy.yaml

# ✅ Correct
ngrok http --domain=ninth-rebalance-deny.ngrok-free.dev 3000
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `ERR_NGROK_8012` port 5000 | Old ngrok still running on 5000 | Stop all ngrok (`Get-Process ngrok | Stop-Process`), run `npm run tunnel` |
| `ERR_NGROK_121` agent too old | npx ngrok bundles old agent | Use system ngrok: `ngrok update`, then `npm run tunnel` |
| `unknown version '3'` config | Old winget ngrok vs v3 config | Run `ngrok update`, or edit `%LOCALAPPDATA%\ngrok\ngrok.yml` |
| Dashboard blank | Not built | Run `npm run dev` (auto-builds) |
| 401 login | Wrong admin password | `npm run db:seed-admin` |
| Mobile sync fails | ngrok not running | Start ngrok on 3000 |
| API 404 on dashboard | Old split setup | Use `npm run dev` not `dev:split` |

---

## Local dev with hot-reload (optional)

If you want separate ports for faster dashboard editing:

```bash
npm run dev:split
```

- Dashboard: http://localhost:5173
- API: http://localhost:3000

For ngrok/mobile testing, always use `npm run dev` (single URL).
