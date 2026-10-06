# TNC Nursing Mobile App — Agent Handoff

This document is a build specification for an engineer or coding agent extending
the native app in `mobile/` so it fetches the same catalog and learning content
as the live website, plays its videos, and follows the website's design and
learner features.

## 1. Project map and source of truth

| Area | Source of truth |
|---|---|
| Current web routes and page flow | `artifacts/tnc-web/src/App.tsx` |
| Web screens | `artifacts/tnc-web/src/pages/` |
| Shared web navigation and visitor flow | `artifacts/tnc-web/src/components/Layout.tsx` |
| Web API client and query defaults | `artifacts/tnc-web/src/lib/api-client/`, `artifacts/tnc-web/src/App.tsx` |
| Live API routes and real CRM response mapping | `artifacts/api-server/src/routes/proxy.ts` |
| API routing, CORS, static serving, install-block middleware | `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/index.ts` |
| Native app already in the repository | `mobile/App.tsx`, `mobile/app.json`, `mobile/package.json` |
| Active web color variables and dark mode | `artifacts/tnc-web/src/index.css`, `artifacts/tnc-web/src/components/Layout.tsx` |

Use `docs/platform-api-and-database.md`, `mobile/App.tsx`, and the live Express
route handlers as the contract for the currently running app. The older
`docs/api.md`, `docs/architecture.md`, `docs/prd.md`, `docs/phases.md`, and
`docs/rules.md` describe a proposed Supabase Edge Functions/HMAC architecture;
those `/edge/...` routes and signing requirements are not the API currently
used by `mobile/App.tsx`. Do not mix the proposed API with the current Express
API. Do not call the upstream CRM from the phone; the API server is the
intended proxy.

### How to read the other files in `docs/`

- `platform-api-and-database.md` documents the currently implemented Express
  API and its server/Supabase boundary. Use it with the route handlers for
  current endpoints.
- `api.md` documents the upstream CRM request format and a proposed
  Supabase-Edge-Function proxy. Its CRM host is server-side only; do not copy
  its CRM fetch example into the mobile app.
- `architecture.md`, `prd.md`, `phases.md`, and `rules.md` are a design/spec
  for a planned web platform. Their `/edge/...`, HMAC signing, FingerprintJS,
  XP, and signed asset URL details are not evidence those endpoints/features
  are deployed in the current Express/native app.
- `design.md` is an older palette. For matching the current app, use the active
  web CSS tokens in `artifacts/tnc-web/src/index.css` and the native color
  constants in `mobile/App.tsx`; see §11.
- `memory.md` gives project context and confirms the CRM must stay behind a
  backend proxy. The SQL files document database setup/analytics, not
  client-callable HTTP APIs. `mobile-app-supabase.sql` is the relevant mobile
  install/progress schema; run SQL only in the Supabase SQL Editor when setting
  up the backend, never from the app.

The repository already contains an Expo/React Native app in `mobile/`. Inspect
and extend it instead of creating a second app. It is currently a single
`mobile/App.tsx` navigation/state machine, not an Expo Router app.

## 2. API base URL and configuration

Use the production API/site origin already configured by the current native
app:

```text
https://courses.tncnursing.site
```

This is the `API_BASE` value in `mobile/App.tsx`. The project API guide says
production API paths use the deployed site origin followed by `/api`. Thus the
native app's real API URLs are:

```http
GET https://courses.tncnursing.site/api/healthz
GET https://courses.tncnursing.site/api/courses
```

Do not replace this with a Render deployment URL. Do not use the CRM host as
the app API host. The CRM endpoint in `docs/api.md` is an upstream server-side
data source, not a mobile API. Keep the configured production origin in one
place so it can be changed without editing every screen:

```ts
export const API_BASE = "https://courses.tncnursing.site";
```

All API route strings passed to the current mobile `request()` helper include
`/api` themselves; `request()` concatenates them directly onto `API_BASE`:

```text
request<Course[]>('/api/courses')
→ GET https://courses.tncnursing.site/api/courses
```

Use the same method in new mobile screens instead of duplicating base URL
concatenation. Show loading/error/empty states distinctly and allow a retry.

## 3. Request helper and error handling

The existing native helper in `mobile/App.tsx` uses standard `fetch`, sends
`Content-Type: application/json`, reads `tnc.mobile.id` from AsyncStorage, and
adds it as `x-tnc-install-id`. Add this helper pattern to new screens rather
than creating a second networking convention. Encode query values and treat
non-2xx results as errors; do not turn network failure into a successful empty
list.

```ts
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const installId = await AsyncStorage.getItem("tnc.mobile.id");
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(installId ? { "x-tnc-install-id": installId } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}
```

For POST routes, send `JSON.stringify(body)`. Binary routes such as `/api/pdf`
and `/api/firebase-stream/:fsId` must not be decoded as JSON; use a suitable
native video/PDF or file viewer.

## 4. Public API endpoints used by the learner app

All paths in this table are prefixed by `/api`; append them to
`https://courses.tncnursing.site`.

| Method and path | Response / purpose |
|---|---|
| `GET /healthz` | Health check, e.g. `{ "status": "ok" }`. |
| `GET /courses` | Array of courses, newest first. Fields include `id`, `rowId`, `name`, `description`, `serialNo`, `imageUrl`, `createdAt`, `updatedAt`. |
| `GET /subjects?courseId={courseRowId}` | Array of subjects with `rowId`, `name`, `serialNo`, `videoCount`, `pdfCount`, `totalCount`. Counts come from course lessons; some subjects can be synthesized from content. |
| `GET /sessions?courseId={courseRowId}` | All course sessions as an array (not paginated when `courseId` is present). This is the course playlist source. |
| `GET /sessions?courseId={courseRowId}&subjectId={subjectRowId}` | All sessions for that subject, as an array. |
| `GET /sessions?courseId={courseRowId}&subjectId={subjectRowId}&type=video` | Video sessions, including Firebase sessions. |
| `GET /sessions?courseId={courseRowId}&subjectId={subjectRowId}&type=pdf` | PDF sessions. Mixed PDF/video rows may also appear here. |
| `GET /sessions?courseId={courseRowId}&subjectId={subjectRowId}&search={text}` | Subject lessons filtered by title. Also supports `sort=newest`. |
| `GET /sessions/{sessionRowId}` | One session. A missing ID returns `404`. |
| `GET /notes?courseId={courseRowId}` | Course PDFs sorted in lesson order. Without course ID, defaults to the newest 60, maximum 200. |
| `GET /sliders` | Homepage banners: `id`, `rowId`, `imageUrl`, `name`, `description`. |
| `GET /promo/status` | `{ enabled, expiresAt, message }`; used by the UI's promo access display. |
| `GET /purchases/{userId}` | Purchase rows for the supplied user ID. |
| `GET /quizzes?page=1&limit=20&search={text}` | `{ quizzes, total, page, limit }`. Maximum page limit is 100. |
| `GET /quiz/{examId}` | Exam details and its question array. |
| `GET /bot/study/leaderboard?limit=20` | Public study leaderboard; maximum limit is 100. |
| `POST /bot/study/heartbeat` | Adds study time; details below. |
| `GET /search?q={text}` | `{ courses, sessions, quizzes }`. Current implementation returns `sessions: []`; do not rely on this route for lesson search. |

### Session object

The API's CRM-backed session mapper returns objects with this shape. Nullable
media values may be `null`; `firebaseId` is present in actual session responses
even though some generated API types omit it.

```ts
export type Session = {
  id: number;
  rowId: string;
  title: string;
  description: string;
  videoUrl: string | null;
  pdfUrl: string | null;
  firebaseId: string | null;
  contentType: "youtube" | "firebase" | "pdf" | "none";
  type: "video" | "pdf" | "content";
  courseId: string | null;
  subjectId: string | null;
  isPaid: boolean;
  duration: string | null;
  thumbnailUrl: string | null;
  serialNo: string;
  createdAt: string;
};
```

Example from the live batch the site owner reported:

```text
courseId = 1773830374687_v6Cd
subjectId = 1777042464061_AjnW
subject name = Neurology
GET /api/sessions?courseId=1773830374687_v6Cd&subjectId=1777042464061_AjnW
```

The API returns lessons including:

```text
serialNo "8" — Neurology - 08 Brain Cerbal Cortex
serialNo "9" — Neurology - 09 Function Area Of Brain
serialNo "16" — Neurology - 16 Hind Brain Part - II
serialNo "29" — Neuro - 29 increase intracranial pressure mgt
serialNo "30" — Neuro - 30 TBI
serialNo "31" — Neurology - 31 Intra Carinal Hemorrhage
```

Lesson numbers are data (`serialNo`) and should be displayed/sorted using that
field, not regenerated from the index after filtering. A Firebase lesson can
also have a `pdfUrl`; do not classify it as PDF-only. If a Firebase ID is
present, offer video playback even when a PDF link is also available. Preserve
both actions where both media types exist.

### Pagination and sorting details

For requests without `courseId`, sessions are limited by default to 200 and at
most 500. A `page` parameter changes the response to:

```json
{ "sessions": [], "total": 0, "page": 1, "limit": 30 }
```

Pagination's default `limit` is 30 and maximum is 100. Course-specific requests
currently return the complete matching result, so prefer those over fetching
global sessions. Default session ordering is numeric serial order. Do not sort
serial numbers lexicographically (`"10"` must come after `"9"`).

## 5. Real fetch examples

```ts
const courses = await request<Course[]>("/api/courses");

const params = new URLSearchParams({ courseId });
const subjects = await request<Subject[]>(`/api/subjects?${params}`);

const lessonParams = new URLSearchParams({ courseId, subjectId });
const sessions = await request<Session[]>(`/api/sessions?${lessonParams}`);
```

For a URL passed to `/pdf`, preserve existing query parameters safely. Relative
PDF paths from CRM should go through the backend:

```ts
const url = `${API_BASE}/api/pdf?${new URLSearchParams({ path: pdfPath })}`;
```

The course-specific notes screen can call `/notes?courseId=...`; the subject
lesson screen should use `/sessions` so it can show videos and PDFs together.

## 6. Video and PDF playback requirements

### Firebase/TNC secured videos

The most common course videos use `contentType: "firebase"` and `firebaseId`.
The current website's working iframe URL is:

```ts
const playerUrl =
  `https://videoplay.tncnursing.in/videos/fs/index.html?${encodeURIComponent(firebaseId)}`;
```

The web player embeds this URL; the current Expo app may instead use the
server's range-capable stream:

```text
GET /api/firebase-stream/{firebaseId}
```

Keep Firebase credentials on the API server. Do not embed Firebase service
account credentials or call the upstream CRM/Storage APIs directly from the
mobile app. The server stream requires deployment-side Firebase configuration.
If using the native stream path, verify playback, seeking, and authorization on
both iOS and Android; if that path is unavailable, use the same iframe player
URL as the website in a WebView.

### YouTube and direct/HLS videos

- YouTube URLs use the YouTube embed/player path; in native, use the existing
  `react-native-webview` implementation or another supported YouTube embed.
- Direct `.m3u8` and media URLs use a video element with HLS support on web.
  Native should use Expo Video's native HLS support and expose play/pause,
  seeking, progress, duration, fullscreen, and an error/retry state.
- Treat `videoUrl` as a playable media URL only when present. Firebase playback
  uses `firebaseId`, not `videoUrl`.
- Support portrait phones and landscape/fullscreen playback. Do not let the
  completion overlay intercept the player controls except for its own button.

### PDFs and mixed-media lessons

- CRM-relative PDF path: `GET /api/pdf?path={encodedPath}`.
- URL PDF: `GET /api/pdf?url={encodedUrl}` (only use API-provided URLs).
- Render PDF inside the app where reliable; provide an explicit “Open externally”
  fallback via the platform linking API.
- When both `firebaseId` and `pdfUrl` exist, show the lesson as video and also
  provide an independent “Open notes/PDF” action. Never route the video button
  to the PDF viewer merely because `pdfUrl` exists.
- `/api/media-proxy?url=...` buffers the upstream response and does not forward
  byte-range requests. Avoid it for large seekable videos; prefer the Firebase
  stream endpoint when configured.

## 7. Screens and parity checklist

Reproduce these current web learner flows in native navigation:

1. **Home:** banner carousel, featured/recent courses, study streak/activity,
   navigation to courses and video browsing.
2. **Courses:** searchable catalog, favorites, course cards and available/free
   status indicators.
3. **Course:** course description and subjects with video/PDF/item counts.
4. **Subject/lessons:** search, All/Videos/PDFs filters, display/newest/oldest
   sort, numeric lesson numbers, paid badge/lock, and lesson navigation.
5. **Player:** Firebase/YouTube/HLS playback, title, back-to-course action,
   ordered course playlist, watch progress, and “mark complete” control at the
   top-right of the video area.
6. **PDF/notes:** subject PDFs and E-Notes by course, open in app with external
   fallback.
7. **Videos:** browse courses and recently watched lectures.
8. **Watched/history:** Activity, Videos, Completed, and Courses views; show
   completed status and date; allow clearing history.
9. **Leaderboard:** public rankings with display name and study time.
10. **Profile/settings:** visitor name, dark/light mode, favorites and app info.
11. **Quiz:** open the external exam product at
    `https://test.tncnursing.site/tnc-tests`. Current web `/quiz` routes
    redirect there; don't assume its old in-repo quiz screens are active.

The website also has an admin dashboard. Implement admin functionality only
when explicitly requested and protect admin operations; do not ship an admin
token in the application.

## 8. Completed lectures, history, and persistence

On the website, watch history, completion, favorites, streaks, and visitor
identity are local to that browser. Relevant storage keys include:

```text
tnc_user
tnc_admin_token
tnc_visitor_name
tnc_visitor_id
tnc_streak
tnc_favorites
tnc-dark-mode
```

The native app should use AsyncStorage or SecureStore as appropriate, with
versioned keys. Minimum local data:

- Stable random install ID.
- Display name.
- Favorite course IDs.
- Recently watched session records.
- Explicitly completed session IDs and completion timestamps.
- Last opened course/subject/session.
- Dark/light theme preference.

The website's “mark complete” action is explicit; merely opening or playing a
video does not mean the learner completed the lecture. Keep watch history and
completion as separate concepts. A completed lecture must be visible in the
Watched screen's Completed filter, and clearing watch history should clear
completion state too.

The API has `POST /api/mobile/progress`:

```json
{
  "installId": "stable-device-install-id",
  "sessionId": "session-row-id",
  "completed": true
}
```

It returns `{ "success": true }`. The current API does not expose a corresponding
route to fetch a complete list of a device's progress. Keep a local completion
record for immediate/offline UI; don't claim completion sync across devices
unless a read API is added and tested.

Study time can be submitted to:

```http
POST /api/bot/study/heartbeat
Content-Type: application/json
```

Telegram example body:

```json
{ "telegramId": 123456, "sessionId": "session-row-id", "seconds": 30 }
```

Non-Telegram example:

```json
{
  "visitorId": "client-generated-uuid",
  "visitorName": "Learner",
  "sessionId": "session-row-id",
  "seconds": 30
}
```

Send only while a lesson is actively playing and the app is foregrounded.
Heartbeat seconds are rounded/clamped by the server (0–300 seconds per request).

## 9. Install identity and access checks

The API app middleware checks `x-tnc-install-id` when supplied. `/api/mobile/open`
is exempt so a new installation can check its status. Use a stable UUID generated
once on device; it identifies an installation but is not an authenticated user
credential.

On startup:

1. Load/create a stable install ID.
2. `POST /api/mobile/open` with `{ installId, platform, appVersion }`.
3. If `blocked` is true, show the returned reason and stop normal app use.
4. Collect/save the learner display name, then optionally `POST /api/mobile/register`
   with `{ installId, name, platform }`.
5. Add `x-tnc-install-id` on later API requests.

These endpoints are implemented by the API but are not a substitute for
account-level authorization. For free content, do not require a registration
token that the API does not issue.

## 10. Paid content and security limitations

The web UI considers a paid session unlocked when promo is enabled or a purchase
exists for the user's course. The app can mirror this display behavior using
`GET /promo/status` and `GET /purchases/{userId}` when a user is logged in.
However, this is not a secure entitlement boundary today:

- Session, PDF, and media routes do not enforce purchase entitlements.
- Purchase lookup uses a user ID in the URL.
- Purchase creation accepts client-supplied data and does not verify payment
  with a payment provider.
- Login/register screens exist in the repository but are not routed in the
  active web app; their token is not a general API bearer credential.
- Promo state is currently in server memory and can reset when the server
  restarts.

Do not describe an unlocked UI as verified payment authorization. Keep service
credentials, Firebase account/service-account credentials, Supabase service
keys, Telegram bot tokens, admin tokens/passwords, and payment secrets out of
the native bundle. No such secrets are needed to call the public course API.

## 11. Design system and dark mode

Use the active CSS, not the older `docs/design.md` palette. Current web typography
is Outfit with Inter fallback, radius `0.5rem`, and these CSS HSL variables:

| Token | Light value | Dark value |
|---|---:|---:|
| Background | `42 33% 95%` | `220 40% 7%` |
| Foreground | `165 22% 12%` | `220 20% 95%` |
| Card | `0 0% 100%` | `220 35% 11%` |
| Primary | `165 48% 24%` | `226 71% 60%` |
| Secondary/lime | `71 68% 53%` | `38 80% 55%` |
| Accent/coral | `10 78% 61%` | `38 80% 55%` |
| Muted | `40 20% 89%` | `220 25% 17%` |
| Border | `42 18% 82%` | `220 25% 20%` |

These values are HSL components used as `hsl(var(--token))`. Use semantic tokens
for screen/card/text/border colors, not scattered hardcoded grays. The site's
dark-mode preference is `tnc-dark-mode` and the root `.dark` class activates
dark variables. Native should provide a persistent visible Light/Dark toggle
and apply the selected theme at the root/navigation/container level.

The existing native app palette in `mobile/App.tsx` is:

```text
ink #17242A, muted #738087, paper #F6F7F3, green #1D765D,
mint #DDF0E8, coral #F1A88D, line #E5E9E5, gold #DCA84C, red #B44646
```

That palette differs from the web CSS variables. To match the current website,
map native semantic colors to the web CSS table above. Preserve the app's
rounded cards, brand-green top/navigation areas, lightweight backgrounds,
high-contrast text, responsive spacing, and clear loading/error/empty states.

## 12. Build and verification

The Expo app identity in `mobile/app.json` is `TNC Nursing 2.0`, version
`2.0.0`, package/bundle ID `com.tncnursing.mobile`, portrait orientation.
Check the current Expo SDK and package scripts in `mobile/package.json` before
installing/upgrading anything.

Before release, verify:

- A clean app install reaches the verified API base and loads courses.
- A slow/failed API shows retry/error UI, not a false empty state.
- Course → subject → session lists contain all API results and retain numeric
  order, including lesson numbers with gaps.
- Firebase ID, YouTube, direct MP4, and HLS playback work on real iOS/Android
  devices; test seeking/fullscreen and app background/resume.
- Mixed Firebase video + PDF lessons expose both playback and notes.
- PDF opens in-app and external fallback works.
- Paid/free labels match promo/purchase responses without pretending the API
  enforces payment.
- Mark complete survives relaunch, updates Watched immediately, and can be
  toggled incomplete.
- Dark mode persists across app restart and is readable on every screen.
- Install block check, name, favorites, recent lessons, and leaderboard paths
  handle errors visibly.
- Test with the supplied sample IDs above, then with a different course and
  subject to prove IDs are not hardcoded.

## 13. Suggested agent task prompt

> Work in the existing `mobile/` Expo app. Use the real production API origin
> `https://courses.tncnursing.site` and append the API routes described in
> `docs/mobile-app-agent-handoff.md`. Follow the currently implemented Express
> API and `mobile/App.tsx`; do not substitute a Render URL, call the CRM from
> the phone, or implement the old proposed `/edge/...` routes from stale docs.
> Make the native app fetch courses,
> subjects, sessions, notes, sliders, promo state, purchases, and leaderboard
> from the verified configurable API base. Match the active web palette, routes,
> lesson numbering, search/filter/sort behavior, dark-mode preference, Watched
> and explicit completion behavior. Implement Firebase, YouTube, direct/HLS,
> and PDF playback with mobile fallbacks. Preserve the API server as the only
> CRM/credential boundary. Don't hardcode batch IDs or secrets. Build and test
> the app on the available targets, document anything blocked by external
> credentials or device-only playback, and do not claim a feature is verified
> unless it was exercised.
