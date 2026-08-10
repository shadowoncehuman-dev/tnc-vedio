# TNC Nursing Classes Website

India's premier nursing exam prep platform — a full-stack website reverse-engineered from the TNC Nursing Android app, using the same live CRM backend APIs.

## Run & Operate

- API server runs on port 8080, frontend on port 22705 (both managed by workflows)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec after spec changes
- `pnpm --filter @workspace/tnc-web run typecheck` — typecheck frontend only
- `pnpm --filter @workspace/api-server run typecheck` — typecheck backend only

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (`artifacts/api-server`) — proxies all requests to CRM backend
- Frontend: React + Vite + Tailwind CSS (`artifacts/tnc-web`) — Wouter routing, TanStack Query
- Validation: Zod (use `zod` NOT `zod/v4` in frontend forms for react-hook-form compatibility)
- API codegen: Orval (from `lib/api-spec/openapi.yaml`)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `artifacts/api-server/src/routes/proxy.ts` — all CRM proxy routes
- `artifacts/tnc-web/src/App.tsx` — frontend routes
- `artifacts/tnc-web/src/pages/` — all page components
- `artifacts/tnc-web/src/components/Layout.tsx` — nav + layout wrapper
- `artifacts/tnc-web/src/lib/auth.ts` — localStorage auth helpers

## Architecture decisions

- **Supabase application store** — app users, Telegram users, bans, and study-time aggregates are stored in Supabase through server-only REST calls. The CRM at `https://crm.tncnursing.in/` remains the source for courses, sessions, PDFs, quizzes, and purchases.
- **CRM API pattern**: POST `/common/` with `{payload: JSON.stringify({fn, se, sch, data, cond})}`. Tables: `t_co` (courses), `t_se` (sessions), `t_sl` (sliders), `t_us` (users), `t_cu` (purchases).
- **Promo mode** is in-memory server state (resets on server restart). Default: enabled for 30 days.
- **Auth** is localStorage-only (no server sessions) — userId + token stored as `tnc_user`; credentials are verified against Supabase server-side.
- **Admin** password and token read from env vars `ADMIN_PASSWORD` and `ADMIN_TOKEN` — set as Replit secrets (dev) and in Render dashboard (prod).

## Product

- Home page with real slider images, course grid, stats, testimonials
- Courses listing with search, lock/unlock based on purchase or promo mode
- Course detail with full session list (videos + PDFs), locked unless purchased/promo
- Video player (HLS via hls.js + YouTube iframe embed)
- PDF viewer (iframe embed of CRM-hosted PDFs)
- Login/Register using Supabase-backed app users (mobile + password)
- Admin panel (opened via Telegram bot `/admin` command) with aggregate stats and promo mode toggle; student records remain in the Telegram admin moderation flow

## User preferences

_Populate as you build._

## Deployment

### Build command
```
bash build.sh
```
This installs pnpm via npx, builds the Vite frontend, then bundles the API server with esbuild. Apply `docs/supabase-schema.sql` once in Supabase before the first deploy.

### Start command
```
node --enable-source-maps artifacts/api-server/dist/index.mjs
```
The API server serves both the REST API (`/api/*`) and the React frontend static files in production (`NODE_ENV=production`).

### Required environment variables
| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes (auto-injected) | Platform injects this automatically |
| `NODE_ENV` | Yes | Set to `production` |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service-role key; server-only, never expose to the browser |
| `ADMIN_PASSWORD` | Yes | Admin panel password |
| `ADMIN_TOKEN` | Yes | Admin panel token |
| `SESSION_SECRET` | Yes | Express session secret |
| `TELEGRAM_BOT_TOKEN` | Optional | Enables Telegram bot |
| `ADMIN_CHAT_ID` | Optional | Telegram admin chat ID |
| `RENDER_URL` | Optional | Your public URL — Telegram webhook auto-setup |

### Render
Config file: `render.yaml` (Blueprint)
1. Connect the repo in Render dashboard → New → Blueprint
2. Run `docs/supabase-schema.sql` once in the Supabase SQL Editor
3. Set the env vars listed above in the Environment tab
4. Build command and start command are already in `render.yaml`

### Railway
Config files: `railway.toml` + `nixpacks.toml`
1. Connect the repo in Railway → New Project → Deploy from GitHub repo
2. Set env vars in the Variables tab
3. Railway reads `railway.toml` and `nixpacks.toml` automatically — no manual command entry needed

## Gotchas

- Always import `z` from `"zod"` (not `"zod/v4"`) in frontend form files — zodResolver from @hookform/resolvers expects zod v3 type signatures
- CRM sessions (`t_se`) may return `false` for broad queries — handled with fallback in proxy
- **Telegram-only**: the frontend blocks direct browser access (`isTelegramWebApp()` check in App.tsx). It only renders when opened as a Telegram Mini App.
- **Buy page removed** — `/buy` route and nav links are gone. All content access is via promo mode or direct course unlock.
- **ADMIN_PASSWORD / ADMIN_TOKEN**: must be set as env secrets — admin login returns 401 if not set.
- `PORT` is optional during `vite build` (only needed for dev server); vite.config.ts defaults to 3000 if unset.
- Run `pnpm --filter @workspace/api-spec run codegen` after any spec changes, then typecheck

## Pointers

- See `pnpm-workspace` skill for workspace structure
- CRM API docs: reverse-engineered from APK at `attached_assets/TNC_1781079562368.apk`
