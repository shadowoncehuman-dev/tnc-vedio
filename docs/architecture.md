# Architecture — TNC Nursing Classes Web Platform
> Version 1.0 · August 2026

---

## 1. App Flow

```
User opens site
      │
      ▼
FingerprintJS runs silently
      │
      ├─ No visitorId in localStorage?
      │         │
      │         ▼
      │   Name-entry modal (blocking)
      │         │
      │         ▼
      │   POST /edge/register  ──► Supabase Edge Function
      │   { name, visitorId, ip, ua, device }
      │         │
      │         ▼
      │   Store in localStorage: { name, visitorId }
      │
      ├─ visitorId exists → greet returning user
      │
      ▼
Home page loads
  ├─ Continue-studying strip (last 5 items from localStorage)
  ├─ Featured courses carousel (GET /edge/courses)
  ├─ Recent PDF notes (GET /edge/notes?limit=20)
  └─ Leaderboard widget (GET /edge/leaderboard)

Course page → Session list → Video/PDF viewer
                                   │
                            POST /edge/progress
                            (marks watch/read, awards XP)
```

---

## 2. System Architecture

```
Browser
   │
   │  HTTPS only
   ▼
Supabase Edge Functions  ◄──── All API traffic
   │                           • Validates request signature (HMAC)
   │                           • Rate-limits (30 req/min/IP)
   │                           • Blocks scraper UAs
   │
   ├─► TNC CRM API  (https://crm.tncnursing.in/common/)
   │       Never exposed to browser directly
   │
   ├─► Supabase PostgreSQL
   │       visitors, progress, xp_log, leaderboard_cache
   │
   └─► Returns signed short-lived URLs for video/PDF assets
```

---

## 3. Folder & File Structure

```
tnc-study/
├── public/
│   ├── robots.txt          # Disallow all bots
│   └── favicon.ico
│
├── src/
│   ├── main.tsx
│   ├── App.tsx             # Routes + DevTools guard + name-gate
│   │
│   ├── components/
│   │   ├── NameGate.tsx        # Blocking first-visit modal
│   │   ├── Layout.tsx          # Navbar + footer + copyright
│   │   ├── CourseCard.tsx
│   │   ├── SessionItem.tsx
│   │   ├── VideoPlayer.tsx     # Handles TNC iframe + YouTube
│   │   ├── PdfViewer.tsx       # Proxied iframe + watermark
│   │   ├── XpBadge.tsx
│   │   ├── Leaderboard.tsx
│   │   ├── ContinueStrip.tsx
│   │   └── BatchSelectBar.tsx  # Floating bar for batch-favourite
│   │
│   ├── pages/
│   │   ├── home.tsx
│   │   ├── courses.tsx
│   │   ├── course-detail.tsx
│   │   ├── watch.tsx
│   │   ├── pdf-view.tsx
│   │   ├── enotes.tsx
│   │   ├── quiz.tsx
│   │   ├── quiz-take.tsx
│   │   ├── favourites.tsx
│   │   ├── leaderboard.tsx
│   │   └── blocked.tsx         # DevTools / scraper blocked page
│   │
│   ├── lib/
│   │   ├── fingerprint.ts      # FingerprintJS init + visitorId
│   │   ├── identity.ts         # Name + visitorId localStorage helpers
│   │   ├── devtools-guard.ts   # DevTools detection + redirect
│   │   ├── request-sign.ts     # HMAC signing for every API call
│   │   ├── api.ts              # All fetch calls → edge functions
│   │   ├── progress.ts         # Continue-studying localStorage store
│   │   ├── favourites.ts       # Favourites localStorage store
│   │   └── xp.ts              # Local XP cache + server sync
│   │
│   ├── hooks/
│   │   ├── useIdentity.ts      # Current user name + visitorId
│   │   ├── useCourses.ts
│   │   ├── useSessions.ts
│   │   ├── useNotes.ts
│   │   ├── useProgress.ts
│   │   └── useLeaderboard.ts
│   │
│   └── styles/
│       ├── globals.css
│       └── animations.css
│
├── supabase/
│   └── functions/
│       ├── register/       index.ts   — save visitor, return greeting
│       ├── courses/        index.ts   — proxy t_co from CRM
│       ├── sessions/       index.ts   — proxy t_ch from CRM
│       ├── notes/          index.ts   — PDF sessions per course
│       ├── quizzes/        index.ts   — proxy t_ex + t_qu from CRM
│       ├── progress/       index.ts   — save watch/read events, award XP
│       ├── leaderboard/    index.ts   — top 50 by XP (cached 5 min)
│       ├── pdf-token/      index.ts   — issue signed PDF URL (10-min TTL)
│       └── _shared/
│           ├── crm.ts      — crmQuery() helper
│           ├── auth.ts     — HMAC verify + rate limit
│           └── cors.ts     — CORS headers
│
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## 4. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend framework | **React 18 + Vite** | Fast HMR, excellent ecosystem |
| Language | **TypeScript** | Type safety end-to-end |
| Styling | **Tailwind CSS v3** | Utility-first, mobile-first, small bundle |
| Animations | **Framer Motion** | Smooth page transitions, gesture support |
| Routing | **wouter** | Lightweight (< 2 KB), no history issues in Telegram |
| Data fetching | **TanStack Query v5** | Caching, stale-while-revalidate, refetch |
| User fingerprint | **@fingerprintjs/fingerprintjs** (open-source) | No paid plan needed, runs client-side |
| Icons | **Lucide React** | Consistent, tree-shakeable |
| Backend / API proxy | **Supabase Edge Functions** (Deno) | Hides CRM credentials, global edge network |
| Database | **Supabase PostgreSQL** | Visitor records, XP, progress |
| Video (TNC) | **`<iframe src="https://videoplay.tncnursing.in/?id=...">`** | Only working method — no CORS issues |
| Video (YouTube) | **`<iframe src="https://www.youtube-nocookie.com/embed/...">`** | Privacy-enhanced mode |
| PDF viewer | **Proxied `<iframe>`** via edge function | Hides origin URL, adds watermark |

---

## 5. Database Schema (Supabase)

```sql
-- Visitor identity
CREATE TABLE visitors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id    TEXT UNIQUE NOT NULL,   -- FingerprintJS visitorId
  name          TEXT NOT NULL,
  ip            TEXT,
  user_agent    TEXT,
  device_model  TEXT,
  platform      TEXT,                   -- "Android" | "iOS" | "Windows" | ...
  first_seen    TIMESTAMPTZ DEFAULT NOW(),
  last_seen     TIMESTAMPTZ DEFAULT NOW(),
  visit_count   INT DEFAULT 1,
  xp            INT DEFAULT 0,
  is_blocked    BOOLEAN DEFAULT FALSE
);

-- Per-session progress
CREATE TABLE progress (
  id          BIGSERIAL PRIMARY KEY,
  visitor_id  TEXT NOT NULL REFERENCES visitors(visitor_id),
  session_id  TEXT NOT NULL,            -- rowId from t_ch
  type        TEXT NOT NULL,            -- "video" | "pdf"
  seconds     INT DEFAULT 0,            -- for video: progress seconds
  completed   BOOLEAN DEFAULT FALSE,
  xp_awarded  BOOLEAN DEFAULT FALSE,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (visitor_id, session_id)
);

-- XP transaction log
CREATE TABLE xp_log (
  id          BIGSERIAL PRIMARY KEY,
  visitor_id  TEXT NOT NULL,
  action      TEXT NOT NULL,            -- "watch_video" | "read_pdf" | etc.
  xp          INT NOT NULL,
  session_id  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Request Signing

Every browser → Edge Function call includes:
```
X-Visitor-Id: <visitorId>
X-Timestamp:  <unix ms>
X-Request-Sig: <HMAC-SHA256(visitorId + ":" + timestamp, SHARED_SECRET)>
```
Edge Function rejects requests where:
- `|now - timestamp| > 60 s` (replay protection)
- HMAC doesn't match

The `SHARED_SECRET` lives only in Supabase env vars — never in browser JS.
