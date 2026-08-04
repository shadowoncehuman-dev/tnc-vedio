# Memory — TNC Nursing Classes Web Platform
> Durable context for AI agents working on this codebase

---

## Project Identity
- **Product**: TNC Nursing Classes — nursing exam prep platform (NORCET, AIIMS, ESIC, State PCS)
- **Audience**: Indian nursing students, 18–28, ~70% Android mobile
- **Existing live site**: `artifacts/tnc-web` (React + Vite + Tailwind, deployed on Render)
- **New platform docs**: `docs/` folder — prd.md, architecture.md, rules.md, phases.md, design.md, api.md

---

## TNC CRM API (Critical)

```
Endpoint:  POST https://crm.tncnursing.in/common/
Body:      { payload: JSON.stringify({ fn, se, sch, data, cond }) }
Auth:      None required
```

- **Always proxy from backend / Edge Functions** — never call from browser
- `se: "fe"` = fetch, `se: "in"` = insert, `se: "up"` = update
- `cond: { co_refid: "<id>" }` = filter t_ch by course
- `cond: { row_id: ["id1", "id2"] }` = IN clause for batch question fetch

### Key tables
| Table | Content |
|---|---|
| `t_co` | Courses |
| `t_ch` | Chapters/Sessions (videos + PDFs) — 59k rows |
| `t_ex` | Exam sets |
| `t_qu` | Questions — 157k rows |

### Video fields in t_ch
- `json._vi._fs_id` → TNC CDN ID → embed as `<iframe src="https://videoplay.tncnursing.in/?id={fsId}">`
- `json._de._vi.url` → YouTube or direct MP4/M3U8 URL
- `json._de._no.url` → PDF path starting with `uploads/` → `https://crm.tncnursing.in/{path}`

---

## Existing App (artifacts/tnc-web)

### What works
- Course list, course detail, video watch page, PDF viewer
- Quiz list and quiz-take flow
- E-Notes page (as of latest update: expandable course rows + "Recent PDFs" tab)
- Admin panel (bot users now in-memory, promo toggle, CRM user list)
- Telegram Mini App integration (optional — app works in any browser)

### API client pattern
- Generated hooks in `src/lib/api-client/generated/api.ts` (orval)
- Custom fetch util: `src/lib/api-client/custom-fetch.ts`
- For new endpoints not in generated client: import `customFetch` directly and wrap with `useQuery`
- `customFetch` is exported from `custom-fetch.ts` and re-exported from `index.ts`

### Bot users
- **No DB** — stored in-memory `Map` in `artifacts/api-server/src/lib/user-store.ts`
- Resets on server restart (by design — removes need for DB dependency)
- Admin panel reads from `/api/bot/users` (no DB calls, instant)
- Bot commands `/ban`, `/unban`, `/users`, `/stats` all use the in-memory store

### Video playback (confirmed working)
- TNC CDN (`_fs_id`): **iframe only** — `https://videoplay.tncnursing.in/?id={fsId}`, no X-Frame-Options
- YouTube: standard embed
- Firebase Storage URLs in t_ch are rare; proxy via `/api/firebase-stream/:fsId` if needed
- Fullscreen on mobile/Telegram: call `requestFullscreen()` on the iframe element, fallback `webkitRequestFullscreen`

### PDF notes
- PDF path format: `uploads/<filename>.pdf` → proxied via `/api/pdf?path=uploads/...`
- `/api/notes?courseId=X` → returns PDF-only sessions for a course (added Aug 2026)
- `/api/notes` (no courseId) → returns 60 newest PDFs across all courses

---

## New Platform (docs/ specs)

### Core concept
- **No login** — users identified by FingerprintJS `visitorId` + display name
- Name entered once on first visit, stored in `localStorage`
- Two people with same name on different devices = separate isolated accounts
- All API calls signed with HMAC-SHA256; unsigned requests → 403

### Security requirements (non-negotiable)
- TNC CRM credentials hidden behind Supabase Edge Functions
- DevTools detection → abort requests + redirect to `/blocked`
- Rate limiting: 30 req/min/IP in Edge Functions
- Signed PDF/video URLs: 10-min TTL
- `robots.txt`: `Disallow: /` for all bots
- PDF watermark with visitor name

### Stack decision
- Frontend: React + Vite + Tailwind + wouter + TanStack Query
- Backend: Supabase Edge Functions (Deno) — not Express
- DB: Supabase PostgreSQL — `visitors`, `progress`, `xp_log` tables
- Fingerprint: `@fingerprintjs/fingerprintjs` v4 (open-source, free)

---

## Deployment

- Current app on **Render** — `build.sh` script, `DATABASE_URL` has special chars that need sanitizing
- GitHub repo: `shadowoncehuman-dev/tnc-vedio`
- After any push, user must manually redeploy on Render dashboard
- `ADMIN_CHAT_ID` env var must be set in Render dashboard (Telegram numeric user ID)
- `SESSION_SECRET`, `ADMIN_TOKEN`, `ADMIN_PASSWORD`, `TELEGRAM_BOT_TOKEN` are Render env vars

---

## Agent Rules (always follow)
1. Never call `crm.tncnursing.in` from frontend/browser code
2. Never put credentials in frontend bundle
3. Fetch sessions with `courseId` filter — never fetch all 59k t_ch rows unfiltered
4. Always use `Array.isArray()` check before mapping CRM responses (they can return non-array on error)
5. Bot users are in-memory — no DB migration needed for user store changes
