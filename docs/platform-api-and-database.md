# TNC Platform API and Database Guide

This document describes the APIs currently implemented by the Express server, the upstream CRM API, the Supabase data used by the platform, and the normal method for calling each service.

## 1. Request flow

The browser calls the local API under `/api`. The API server is the trusted boundary: it talks to the TNC CRM and Supabase using server-side credentials, then returns only the fields needed by the site.

- Web app: `artifacts/tnc-web`
- API server: `artifacts/api-server`
- API contract: `lib/api-spec/openapi.yaml`
- Database package/schema: `lib/db`
- Base URL in production: the deployed site origin followed by `/api`
- JSON requests: send `Content-Type: application/json`

Do not call the CRM or Supabase service-role API directly from browser code.

## 2. Application API

### Health

`GET /api/healthz`

Checks that the API process is alive. Useful for deployment health checks.

```bash
curl https://YOUR_HOST/api/healthz
```

### Courses and content

| Method and route | Parameters | Value |
|---|---|---|
| `GET /api/courses` | none | Lists courses/batches for the catalogue. |
| `GET /api/sessions` | `courseId`, `type`, `limit`, `search` | Lists videos, PDFs, and other learning sessions. |
| `GET /api/sessions/:rowId` | path `rowId` | Loads one session for playback or reading. |
| `GET /api/sliders` | none | Loads homepage promotional banners. |
| `GET /api/quizzes` | `page`, `limit` | Lists available exam sets. |
| `GET /api/quizzes/:examId` | path `examId` | Loads an exam and its questions. |

The CRM `row_id` is the stable content identifier used by the site. Keep it when linking to a course, session, or quiz.

### Student authentication

`POST /api/auth/login`

```json
{ "mobile": "9999999999", "password": "student-password" }
```

`POST /api/auth/register`

```json
{
  "name": "Student Name",
  "mobile": "9999999999",
  "password": "student-password",
  "email": "student@example.com",
  "college": "College name",
  "state": "State"
}
```

The server hashes the password before storage. Login verifies the submitted password against the hash and returns a short application token. Password hashes and passwords are never returned to the client.

### Purchases and study data

| Method and route | Parameters | Value |
|---|---|---|
| `GET /api/purchases/:userId` | path `userId` | Shows course access/purchase history for a student. |
| `POST /api/purchases` | `userId`, `courseId`, `courseName`, optional `amount`, `paymentId` | Records a course purchase. |
| `GET /api/leaderboard` | optional `limit` | Shows study ranking data. |
| `POST /api/study/heartbeat` | study event body | Updates active study time. |
| `GET /api/study/stats` | optional user parameters | Reads study totals and ranking information. |

### Admin

`POST /api/admin/login`

```json
{ "password": "ADMIN_PASSWORD" }
```

Returns the configured admin token. The token is supplied on protected admin requests as `x-admin-token` or, for legacy promo routes, `adminToken` in the JSON body.

`GET /api/admin/stats`

Returns course, session, purchase, and bot-user summary counts.

`GET /api/admin/users?page=1&limit=100&search=anita`

Requires `x-admin-token`. Returns registered app students with name, mobile, email, college, state, user ID, and creation date. It deliberately excludes `password_hash`.

The response includes:

```json
{
  "users": [],
  "total": 0,
  "page": 1,
  "limit": 100,
  "credentials": {
    "revealable": false,
    "reason": "Passwords are stored as one-way hashes and cannot be recovered."
  }
}
```

`POST /api/promo/toggle` and `POST /api/promo/extend` require the admin token and manage the temporary free-content period.

### Bot administration

These routes use the bot admin token and operate on Telegram bot users:

- `POST /api/bot/register`: register/update a Telegram user and check ban status.
- `GET /api/bot/users`: paginated bot-user list.
- `GET /api/bot/stats`: bot totals.
- `POST /api/bot/ban`: ban a Telegram user.
- `POST /api/bot/unban`: remove a ban.
- `GET /api/bot/leaderboard`: Telegram study leaderboard.
- `POST /api/bot/broadcast`: send an admin broadcast.

## 3. CRM API

The upstream CRM is `https://crm.tncnursing.in/common/`. Calls are server-side POST requests with a JSON string inside `payload`:

```typescript
const response = await fetch("https://crm.tncnursing.in/common/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    payload: JSON.stringify({
      fn: "common_fn",
      se: "fe",
      sch: "t_co",
      data: { json: "*" },
      cond: {}
    })
  })
});
```

Important CRM tables:

| Table | Meaning | Real value |
|---|---|---|
| `t_co` | Courses | Catalogue and course navigation. |
| `t_ch` | Chapters/sessions | The main learning inventory: videos, notes, and paid flags. |
| `t_ex` | Exam sets | Quiz metadata and question references. |
| `t_qu` | Questions | Question text, options, answers, and explanations. |
| `t_us` | CRM users | Legacy/upstream user records. |
| `t_cu` | Course purchases | Upstream purchase/access records. |
| `t_sl` | Sliders | Homepage campaign/banner content. |

Use `se: "fe"` for fetch, `se: "in"` for insert, and `se: "up"` for update. Use `cond` to restrict rows, for example `{ co_refid: "COURSE_ROW_ID" }` for sessions belonging to one course.

## 4. Supabase database

Supabase is used for application-owned data and server-side user/auth data. The API server connects with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; those values must stay server-side.

### `app_users`

Application student accounts.

- `id`: database identity
- `user_id`: public application user ID
- `name`, `mobile`, `email`, `college`, `state`: profile data
- `password_hash`: salted one-way SHA-256 credential hash
- `created_at`: registration timestamp

The admin student directory selects only profile columns. A hash cannot be converted back to the original password, so an admin password reveal is intentionally unavailable. If account access is needed, add a password-reset flow that generates a new temporary credential and forces a change at next login.

### `bot_users`

Telegram users and moderation state.

- `telegram_id`, `username`, `first_name`, `last_name`: Telegram identity
- `is_banned`, `banned_at`, `banned_reason`: moderation controls
- `first_seen`, `last_seen`: activity timestamps
- `total_study_seconds`: study aggregate

### Study tables

The study store owns study-time events, leaderboard data, and related progress records. These records are valuable for retention, rankings, and identifying where students stop studying. Use the server study routes rather than writing directly from the browser.

### Drizzle schema

`lib/db/src/schema` contains the typed local schema used by packages that need Drizzle. The current production user and CRM integrations also use Supabase REST because those tables are external to the local Drizzle connection.

## 5. Admin usage method

1. Set `ADMIN_PASSWORD` and a long random `ADMIN_TOKEN` in the API-server environment.
2. Sign in at `/admin`.
3. The panel stores the returned token in browser local storage under `tnc_admin_token`.
4. The Registered Students section calls `/api/admin/users` with `x-admin-token`.
5. Search filters by name, mobile, email, college, or state.
6. The credential status button confirms that the password is unavailable; it does not expose secrets.

Never add `password_hash` to an API response, client schema, log statement, or admin table.
