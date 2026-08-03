---
name: Telegram bot architecture
description: How the Telegram bot mini app is structured in this project
---

**Bot location:** `artifacts/api-server/src/lib/bot.ts` — Telegraf instance, lazy DB import via dynamic `import("@workspace/db")`

**DB table:** `bot_users` in `lib/db/src/schema/bot-users.ts` — tracks telegram_id, ban status, first/last seen

**Routes:** `artifacts/api-server/src/routes/bot.ts` — mounted at `/api/bot/`
- `POST /api/bot/webhook` — Telegram sends updates here
- `POST /api/bot/register` — mini app calls on load, returns ban status
- `GET /api/bot/check-ban/:telegramId` — public ban check
- `GET/POST /api/bot/users` — admin user management (requires x-admin-token header)

**Webhook setup:** Bot auto-sets webhook on server start if `RENDER_URL` env var is set. After Render deploy, set `RENDER_URL=https://your-app.onrender.com` in Render env vars.

**Frontend integration:** `artifacts/tnc-web/src/lib/telegram.ts` — reads Telegram.WebApp.initDataUnsafe.user. App.tsx calls /api/bot/register on mount if in Telegram context, shows BannedScreen if banned.

**Admin detection in bot:** checks `String(ctx.from.id) === String(ADMIN_CHAT_ID)` env var.

**Why lazy DB import:** Allows API server to start even if DATABASE_URL is missing; bot degrades gracefully.
