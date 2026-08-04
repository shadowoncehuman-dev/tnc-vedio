# PRD — TNC Nursing Classes Web Platform
> Version 1.0 · August 2026

---

## 1. Product Overview

A modern, mobile-first web learning platform for Indian nursing students preparing for competitive exams (NORCET, AIIMS, ESIC, RRB, State PCS Nursing). Students can browse courses, watch video lectures, read PDF notes, and take mock exams — all without a traditional login system.

Users are identified by a device fingerprint + display name. Their progress, favourites, and XP are stored against this fingerprint so they can resume on the same device without a password.

---

## 2. Target Users

| Segment | Description |
|---|---|
| **Primary** | Nursing students (BSc, GNM, ANM) preparing for government exams |
| **Age range** | 18 – 28 years |
| **Device** | ~70% mobile (Android), ~20% desktop/laptop, ~10% iOS |
| **Connectivity** | Variable — 4G on mobile, WiFi at colleges |
| **Language** | English UI, Hindi content acceptable |
| **Telegram users** | Subset who access via the existing Telegram Mini App |

---

## 3. Core Features

### 3.1 Frictionless Onboarding
- First visit: full-screen name-entry modal (no registration form).
- After name is submitted:
  - FingerprintJS Pro (open-source build) generates a `visitorId`.
  - Supabase Edge Function records: `name`, `visitorId`, `ip`, `userAgent`, `deviceModel`, `platform`, `firstSeen`, `lastSeen`, `visitCount`.
  - `visitorId` + `name` are stored in `localStorage`; used as the user identity key.
- If a visitor returns on the same device, name is pre-filled and greeted: *"Welcome back, Priya!"*
- **Account isolation**: a visitor's progress is tied to their `visitorId` (device fingerprint), not their name. Two people entering the same name on different devices get separate, isolated accounts.

### 3.2 Course Catalogue
- Grid/list of all courses fetched from TNC CRM (`t_co` table).
- Filter by exam type, subject.
- Each course card shows: thumbnail, name, video count, PDF note count, free/paid badge.
- Batch favourite: long-press / hold to multi-select courses and favourite them at once.

### 3.3 Video Lectures
- Course → session list (tabs: All / Videos / Notes).
- Two video types handled transparently:
  - **TNC CDN** (`_vi._fs_id`): rendered as an iframe pointing to `https://videoplay.tncnursing.in/?id={fs_id}`. No CORS issues; fullscreen works via JS API.
  - **YouTube**: embedded via `youtube-nocookie.com` iframe.
- Continue-watching: stores `{ sessionId, progressSeconds, lastWatched }` per visitorId.
- Resume banner on home: *"Continue — Anatomy of Heart (43:12 left)"*.

### 3.4 PDF / E-Notes
- E-Notes page: courses list with expandable rows that lazy-load PDF sessions per course.
- "Recent PDFs" tab: newest 60 PDFs across all courses.
- PDF viewer: proxied via Supabase Edge Function (hides origin URL from browser).
- Open-in-new-tab button for desktop users.

### 3.5 Mock Exams / Quizzes
- List all exam sets from `t_ex`.
- Timed quiz UI: question, four options, timer, negative marking.
- After submit: score card, correct answers, explanations.
- XP awarded on completion.

### 3.6 XP System & Leaderboard
| Action | XP |
|---|---|
| Watch a video (≥ 80% complete) | +10 |
| Read a PDF (opened ≥ 30 s) | +5 |
| Complete a quiz | +20 |
| Daily login streak | +5/day |
| Finish a full course | +50 |

- XP stored per `visitorId` in Supabase.
- Leaderboard: top 50 learners (shows `name` + masked visitorId hash), refreshed every 5 min.
- Personal rank always shown at bottom even if not in top 50.

### 3.7 Favourites
- Single-tap favourite: courses, sessions, PDFs.
- Batch favourite on courses list: press-and-hold enters selection mode.
- Favourites page: tabbed by type (Courses / Videos / Notes).
- Stored locally in `localStorage` (instant, no server round-trip).

### 3.8 Continue Studying
- Home page "Continue" section shows last 5 accessed items.
- Progress ring on course cards.
- *"Pick up where you left off"* banner.

---

## 4. Security & Anti-Abuse Features

### 4.1 DevTools Detection
- On `devtools` open (resize-based detection + `debugger` timing trick):
  - Stop all active API requests (AbortController).
  - Redirect to `/blocked` page with message: *"DevTools detected. Please close developer tools to continue."*
  - All subsequent API calls return 403 until page is reloaded without devtools.

### 4.2 Anti-Scraping
- HTTP headers on every page:
  ```
  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
  X-Content-Type-Options: nosniff
  Cache-Control: no-store
  ```
- `robots.txt`: `Disallow: /` for all bots.
- Supabase Edge Function rate-limit: 30 req/min per IP; 429 with `Retry-After` on breach.
- Request signing: each API call includes an HMAC of `(visitorId + timestamp)` in `X-Request-Sig` header; Edge Function verifies it. Unsigned requests → 403.
- User-Agent block: requests from known scraper UAs (python-requests, curl, scrapy, puppeteer/headless) → 403.
- All video/PDF URLs are short-lived signed tokens (10-min TTL), never raw origin URLs.

### 4.3 Copyright Notice
- Visible footer on all pages: *"© TNC Nursing Classes. All content is copyrighted. Unauthorized reproduction, distribution, or scraping is prohibited."*
- PDF viewer has watermark overlay with visitor name.

---

## 5. Non-Functional Requirements

| Requirement | Target |
|---|---|
| First Contentful Paint | < 1.5 s on 4G |
| Time to Interactive | < 3 s |
| Bundle size (initial) | < 200 KB gzip |
| API response cache (courses) | 10 min stale-while-revalidate |
| Uptime | 99.5% |
| Mobile usability score | > 90 (Lighthouse) |

---

## 6. Out of Scope (v1)

- Payment / purchase flow (handled by existing Telegram bot).
- Admin panel (already exists on current site).
- iOS / Android native app.
- Live classes / video upload.
