# Phases — TNC Nursing Classes Web Platform
> Build plan broken into 5 phases, each shippable independently

---

## Phase 1 — Foundation & Identity (Week 1)
**Goal**: App runs, users can be identified, courses display.

### Tasks
- [ ] Scaffold project: Vite + React + TypeScript + Tailwind + wouter + TanStack Query
- [ ] `NameGate` component — blocking first-visit modal, name input, stores to `localStorage`
- [ ] FingerprintJS integration — generate `visitorId` silently on load
- [ ] Supabase Edge Function: `register` — saves visitor record (name, visitorId, IP, UA, device)
- [ ] Request signing utility (`lib/request-sign.ts`) — HMAC-SHA256, attached to every call
- [ ] DevTools guard (`lib/devtools-guard.ts`) — detect open + redirect to `/blocked`
- [ ] `robots.txt` — disallow all bots
- [ ] Supabase Edge Function: `courses` — proxy `t_co` from CRM, return parsed course list
- [ ] Home page skeleton: navbar, course carousel, footer with copyright
- [ ] `/courses` page: grid of course cards with search
- [ ] Deploy to Vercel / Netlify for preview

**Definition of Done**: A visitor opens the site, enters their name, sees the course list.

---

## Phase 2 — Video & PDF Learning (Week 2)
**Goal**: Users can watch videos and read PDFs.

### Tasks
- [ ] Supabase Edge Function: `sessions` — proxy `t_ch` by courseId, parse chapters
- [ ] Supabase Edge Function: `notes` — PDF-only sessions per courseId
- [ ] Supabase Edge Function: `pdf-token` — issue signed 10-min token for a PDF path
- [ ] `/course/:id` detail page — session list with tabs (All / Videos / Notes)
- [ ] `VideoPlayer` component:
  - TNC CDN: `<iframe src="https://videoplay.tncnursing.in/?id={fsId}">` with fullscreen button
  - YouTube: `<iframe src="https://www.youtube-nocookie.com/embed/{ytId}">` with autoplay handling
- [ ] `PdfViewer` component — proxied iframe, watermark overlay with visitor name
- [ ] `/enotes` page — expandable course rows lazy-loading PDF sessions
- [ ] Supabase Edge Function: `progress` — POST watch/read events, update `progress` table
- [ ] Continue-watching localStorage store (`lib/progress.ts`)
- [ ] Anti-scraper UA blocking in all Edge Functions

**Definition of Done**: User can watch a TNC video, read a PDF, and come back to continue.

---

## Phase 3 — Quizzes & XP (Week 3)
**Goal**: Mock exams work end-to-end; XP is awarded.

### Tasks
- [ ] Supabase Edge Function: `quizzes` — proxy `t_ex` list
- [ ] Supabase Edge Function: `quiz/:id` — fetch exam + all questions in batches
- [ ] `/quiz` page — list of exam sets with search and difficulty badge
- [ ] `/quiz/:id` take page — timed quiz UI: question card, option selector, timer, submit
- [ ] Score card page — results, correct answers, explanations, XP earned
- [ ] XP engine in `progress` edge function — award XP on video complete / PDF read / quiz done
- [ ] `XpBadge` component — animated XP gain overlay (`+10 XP!`)
- [ ] Local XP cache (`lib/xp.ts`) — optimistic update, sync to server
- [ ] Daily streak tracking — `last_login` in `visitors` table, +5 XP on new day

**Definition of Done**: User completes a quiz, sees score, earns XP, streak updates.

---

## Phase 4 — Social & Discovery (Week 4)
**Goal**: Leaderboard, favourites, continue studying strip — retention hooks.

### Tasks
- [ ] Supabase Edge Function: `leaderboard` — top 50 by XP, cached 5 min
- [ ] `/leaderboard` page — ranked list with user's own rank pinned at bottom
- [ ] `Leaderboard` home widget — top 5 preview with "View All" link
- [ ] Favourites system (`lib/favourites.ts`) — localStorage, per type (course / session / note)
- [ ] Batch-favourite mode — long-press on course card enters multi-select; floating action bar
- [ ] `/favourites` page — tabbed: Courses / Videos / Notes
- [ ] `ContinueStrip` component — last 5 items with progress rings
- [ ] Home page: assemble final layout (Continue strip + Featured courses + Leaderboard widget)
- [ ] Course card: progress ring overlay (% complete based on sessions watched)
- [ ] Search: cross-type search (courses + sessions + quizzes) from header

**Definition of Done**: User can see their rank, favourite courses, and resume studying from home.

---

## Phase 5 — Polish, Security & Launch (Week 5)
**Goal**: Production-ready. Anti-abuse hardened. Performance optimised.

### Tasks
- [ ] Rate limiting: 30 req/min/IP enforced in all Edge Functions with `429 + Retry-After`
- [ ] Request signature replay protection: reject if `|now - timestamp| > 60 s`
- [ ] Signed video/PDF URLs: 10-min TTL, tied to `visitorId`
- [ ] PDF watermark: visitor name overlaid on every page
- [ ] `Content-Security-Policy` header from Edge Functions
- [ ] `X-Robots-Tag: noindex, nofollow` on all responses
- [ ] Lighthouse audit: target 90+ mobile performance score
- [ ] Route-level code splitting (`React.lazy`) for all pages
- [ ] Image optimisation: explicit width/height, `loading="lazy"`, WebP course thumbnails
- [ ] Error boundaries on all pages — catch and show friendly fallback
- [ ] Offline fallback page (service worker, cache course list)
- [ ] Final UX review: all loading/empty/error states present on every page
- [ ] Set up Supabase Row-Level Security (RLS) — visitors can only read/write their own rows
- [ ] Smoke test on Android Chrome, iOS Safari, desktop Chrome, Telegram WebView
- [ ] Go live 🚀

**Definition of Done**: Production deployment passes all security checks, Lighthouse ≥ 90, all pages render correctly on all target devices.
