# Rules — TNC Nursing Classes Web Platform
> What to use · What to avoid · Error handling · AI boundaries

---

## 1. What TO Use

### Libraries (approved)
| Purpose | Library | Version |
|---|---|---|
| Framework | `react` | 18.x |
| Build | `vite` | 5.x |
| Language | `typescript` | 5.x |
| Styling | `tailwindcss` | 3.x |
| Animations | `framer-motion` | 11.x |
| Routing | `wouter` | 3.x |
| Data fetching | `@tanstack/react-query` | 5.x |
| Forms | `react-hook-form` + `zod` | latest |
| Icons | `lucide-react` | latest |
| Fingerprint | `@fingerprintjs/fingerprintjs` | 4.x (open-source) |
| HTTP client | `fetch` (native) — no axios | — |
| Toasts | `sonner` | latest |
| PDF embed | native `<iframe>` | — |
| YouTube embed | `<iframe src="youtube-nocookie.com">` | — |

### Patterns
- **All API calls go through Supabase Edge Functions** — never call `crm.tncnursing.in` directly from the browser.
- Use `TanStack Query` for every server-state fetch (caching, background refetch, loading/error states).
- Use `localStorage` for: visitorId, name, favourites, continue-watching, local XP cache. Keep sensitive data off `localStorage`.
- Use `AbortController` on every `fetch` — pass `signal` so requests cancel on component unmount or devtools detection.
- Code-split at the route level with `React.lazy` + `Suspense`.
- Prefer composition over inheritance. Components should be ≤ 200 lines.

---

## 2. What to AVOID

### Libraries — never add these
| Category | Banned | Reason |
|---|---|---|
| HTTP client | `axios`, `ky`, `superagent` | `fetch` is sufficient; adds bundle size |
| State management | `redux`, `zustand`, `mobx` | TanStack Query + context covers all needs |
| Component library | `MUI`, `Chakra`, `Ant Design` | Too heavy; Tailwind + Lucide is the design system |
| Date | `moment` | Use `date-fns` or native `Intl.DateTimeFormat` |
| Animation extras | `react-spring`, `react-transition-group` | Framer Motion only |
| Router | `react-router-dom` | `wouter` only — smaller, SSR-agnostic |
| CSS-in-JS | `styled-components`, `emotion` | Tailwind only |
| Bundler extras | `webpack`, `rollup` manually | Vite handles everything |

### Patterns — never do these
- **Never put TNC CRM credentials, Supabase service-role key, or HMAC secret in frontend JS.** These live only in Supabase Edge Function env vars.
- Never call `crm.tncnursing.in` from the browser.
- Never store the HMAC shared secret in `localStorage`, `sessionStorage`, or any JS variable.
- Never use `dangerouslySetInnerHTML` unless sanitising with DOMPurify first.
- Never disable TypeScript with `// @ts-ignore` or `any` casts — use proper types.
- Never use `console.log` in production paths — use a logger that respects `import.meta.env.DEV`.
- Never access raw PDF/video origin URLs in the browser — always use signed proxy tokens.
- Never store quiz answers in client state only — verify on edge function to prevent cheating.
- Never lazy-load the DevTools guard or NameGate — they must run synchronously on every page.

---

## 3. Error Handling Rules

### API errors
```typescript
// Every edge function call must handle these cases:
try {
  const data = await apiFetch("/edge/courses");
  // happy path
} catch (err) {
  if (err instanceof ApiError) {
    if (err.status === 429) showRateLimitToast();
    else if (err.status === 403) redirectToBlocked();
    else showErrorToast(err.message);
  } else {
    showErrorToast("Something went wrong. Please try again.");
  }
}
```

### UI states — every data-fetching component must render all three
1. **Loading** — skeleton placeholders (never spinners alone on full pages).
2. **Error** — friendly message + retry button. Log to console in dev only.
3. **Empty** — context-aware empty state with an icon and helpful copy.

### Never
- Silent failures (catch + do nothing).
- Raw error messages shown to users (e.g. stack traces, SQL errors).
- Alert() or confirm() — use toast or modal.

---

## 4. Security Rules

- HMAC-sign every request (see `architecture.md §6`). Unsigned = 403.
- Rate-limit on Edge Function side — don't trust client-side throttling.
- Signed PDF/video tokens: 10-minute TTL, one-time use, tied to `visitorId`.
- Sanitise all user input (name field): strip HTML, max 60 chars, no SQL-like patterns.
- CSP header from Edge Function:
  ```
  Content-Security-Policy: default-src 'self'; frame-src videoplay.tncnursing.in youtube-nocookie.com; img-src * data:; connect-src 'self' *.supabase.co;
  ```

---

## 5. Performance Rules

- Every image: `loading="lazy"`, explicit `width`/`height`, WebP where possible.
- Course thumbnails: served through `crm.tncnursing.in` CDN path, not re-proxied.
- TanStack Query stale times: courses = 10 min, sessions = 5 min, leaderboard = 5 min.
- Avoid fetching all 59 000 sessions at once — always filter by `courseId`.
- Video iframes: render only when user clicks "Play" (use poster + play button overlay until then).
- PDF iframes: render only when tab is "Notes" or user clicks the note.

---

## 6. AI Agent Boundaries

When an AI agent (Replit Agent or similar) works on this codebase, it MUST:

- ✅ Add new Supabase edge functions for new API needs.
- ✅ Extend the existing Tailwind design tokens (don't invent new colours).
- ✅ Write TypeScript with explicit return types on all exported functions.
- ✅ Add `data-testid` attributes to every interactive element.
- ✅ Keep all secrets in env vars, never in code.

It MUST NOT:
- ❌ Call `crm.tncnursing.in` from frontend code.
- ❌ Add a new router, state manager, or HTTP client library.
- ❌ Change the HMAC signing scheme without updating both client and all edge functions.
- ❌ Remove the DevTools guard or NameGate.
- ❌ Add any `console.log` with user data or credentials.
- ❌ Expose visitorId in page titles, URLs, or `<meta>` tags.
- ❌ Add any third-party analytics or tracking scripts other than FingerprintJS.
