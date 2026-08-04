# API Reference — TNC Nursing Classes
> How to fetch courses, sessions, videos, PDFs, and quizzes from the TNC CRM backend.
> All requests below are made from **Supabase Edge Functions only** — never from the browser.

---

## 1. TNC CRM Base

```
Base URL:  https://crm.tncnursing.in
Endpoint:  POST https://crm.tncnursing.in/common/
```

**No authentication header is required.** The API is gated by request structure.

---

## 2. Request Format

Every call uses the same envelope:

```typescript
const response = await fetch("https://crm.tncnursing.in/common/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    payload: JSON.stringify({
      fn:   "common_fn",   // always this value
      se:   "fe",          // "fe" = fetch, "in" = insert, "up" = update
      sch:  "<table>",     // see table map below
      data: { json: "*" }, // fields to return; "*" = all JSON fields
      cond: {},            // filter conditions (see examples)
    }),
  }),
});
const rows = await response.json(); // returns an array of row objects
```

---

## 3. Table Map

| Table | Content | ~Row count |
|---|---|---|
| `t_co` | Courses | ~50 |
| `t_ch` | Chapters / Sessions (videos + PDFs) | ~59 000 |
| `t_ex` | Exam sets (quiz metadata) | ~6 750 |
| `t_qu` | Individual questions | ~157 000 |
| `t_us` | App users (mobile CRM users) | varies |
| `t_cu` | Course purchases | varies |
| `t_sl` | Home banner sliders | ~10 |

---

## 4. Fetch All Courses (`t_co`)

```typescript
const rows = await crmQuery({
  fn: "common_fn", se: "fe", sch: "t_co",
  data: { json: "*" }, cond: {},
});

// Parse a course row:
function parseCourse(row) {
  const json = row.json ?? {};
  const at   = json._at ?? {};
  return {
    rowId:       row.row_id,
    name:        json._na,
    description: json._de,
    serialNo:    json._sno,
    imageUrl:    at.url ? `https://crm.tncnursing.in/${at.url}` : null,
    createdAt:   row.cr_on,
  };
}
```

---

## 5. Fetch Sessions / Chapters (`t_ch`)

### All sessions for one course
```typescript
const rows = await crmQuery({
  fn: "common_fn", se: "fe", sch: "t_ch",
  data: { json: "*" },
  cond: { co_refid: "<courseRowId>" },   // filter by course
});
```

### Parse a chapter row — determines video vs PDF type
```typescript
function parseChapter(row) {
  const json  = row.json ?? {};
  const vi    = json._vi  ?? {};
  const de    = json._de  ?? {};
  const deVi  = de._vi    ?? {};
  const deNo  = de._no    ?? {};

  // ── VIDEO detection ──────────────────────────────────────────────
  const rawVideoUrls = [vi._vi_url, deVi.url, vi.url, json._vi_url].filter(Boolean);
  let videoUrl   = null;
  let contentType = "none";

  for (const raw of rawVideoUrls) {
    if (raw.includes("youtube.com") || raw.includes("youtu.be")) {
      videoUrl    = raw;
      contentType = "youtube";
      break;
    }
    if (raw.includes(".mp4") || raw.includes(".m3u8") || raw.includes("stream")) {
      videoUrl    = raw;
      contentType = "video";
      break;
    }
  }

  // ── TNC CDN VIDEO (fs-stream.net) ────────────────────────────────
  // _vi._fs_id is a UUID-style CDN ID for videoplay.tncnursing.in
  const fsId = (vi._fs_id ?? deVi.fs_id ?? "") as string;
  const hasFsId = fsId.trim().length > 10;
  if (!videoUrl && hasFsId) contentType = "tnc_cdn";

  // ── PDF detection ─────────────────────────────────────────────────
  const pdfPath = (deNo.url ?? "").replace(/^\//, "");
  let pdfUrl = null;
  if (pdfPath.startsWith("uploads/")) {
    pdfUrl = `https://crm.tncnursing.in/${pdfPath}`;
    if (contentType === "none") contentType = "pdf";
  }

  return {
    rowId:       row.row_id,
    title:       json._na ?? "Untitled",
    videoUrl,
    pdfUrl,
    fsId:        hasFsId ? fsId : null,
    contentType, // "youtube" | "video" | "tnc_cdn" | "pdf" | "none"
    type:        videoUrl || hasFsId ? "video" : pdfUrl ? "pdf" : "content",
    courseId:    row.co_refid ?? json._co,
    isPaid:      (json._pr_ty) === 1,
    serialNo:    String(json._sno ?? ""),
    createdAt:   row.cr_on,
  };
}
```

---

## 6. Video Playback

### TNC CDN video (`contentType === "tnc_cdn"`, `fsId` present)

```html
<!-- Embed as iframe — this is the ONLY working method.
     videoplay.tncnursing.in does NOT set X-Frame-Options, so embedding works. -->
<iframe
  src="https://videoplay.tncnursing.in/?id={fsId}"
  width="100%"
  style="aspect-ratio: 16/9; border: none;"
  allowfullscreen
  allow="fullscreen"
></iframe>
```

**Fullscreen on iOS / Telegram WebView:**
```typescript
// The iframe's contentWindow can't be accessed cross-origin.
// Instead, request fullscreen on the iframe element itself:
function requestIframeFullscreen(iframeEl: HTMLIFrameElement) {
  if (iframeEl.requestFullscreen)       return iframeEl.requestFullscreen();
  if (iframeEl.webkitRequestFullscreen) return (iframeEl as any).webkitRequestFullscreen();
}
```

### YouTube video (`contentType === "youtube"`)

```typescript
// Extract YouTube video ID
function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}
```

```html
<!-- Use privacy-enhanced embed domain -->
<iframe
  src="https://www.youtube-nocookie.com/embed/{youtubeId}?autoplay=0&rel=0"
  width="100%"
  style="aspect-ratio: 16/9; border: none;"
  allowfullscreen
  allow="autoplay; fullscreen"
></iframe>
```

---

## 7. PDF Notes

### Fetch PDFs for one course
```typescript
const rows = await crmQuery({
  fn: "common_fn", se: "fe", sch: "t_ch",
  data: { json: "*" },
  cond: { co_refid: "<courseRowId>" },
});
const pdfs = rows
  .map(parseChapter)
  .filter((s) => s.pdfUrl || s.contentType === "pdf");
```

### PDF URL pattern
```
https://crm.tncnursing.in/uploads/<filename>.pdf
```

**In the app, proxy PDFs through an Edge Function** to hide the origin URL and add access control:
```
GET /edge/pdf-token?sessionId=<rowId>
→ returns: { token: "<signed-jwt>", url: "<signed-proxy-url>", expiresAt: "..." }
```

The Edge Function streams the PDF from the CRM URL and sets:
```
Content-Disposition: inline
Cache-Control: private, no-store
```

---

## 8. Fetch Quiz Sets (`t_ex`)

```typescript
const rows = await crmQuery({
  fn: "common_fn", se: "fe", sch: "t_ex",
  data: { json: "*", qu_refid: "*" },  // qu_refid gives the question IDs array
  cond: {},
});

function parseExam(row) {
  const json    = row.json ?? {};
  const qIds    = row.qu_refid ?? [];
  return {
    examId:          row.row_id,
    name:            json._ex_na ?? "Quiz",
    maxMarks:        json._ma_ma ?? 0,
    negativeMarks:   json._ne_ma ?? 0.25,
    durationMinutes: json._ex_du ?? 60,
    questionCount:   qIds.length,
    startDate:       json._st_da ?? null,
    endDate:         json._en_da ?? null,
  };
}
```

---

## 9. Fetch Quiz Questions (`t_qu`)

Fetch in batches of 50 to avoid timeouts:

```typescript
async function fetchAllQuestions(questionIds: string[]) {
  const BATCH = 50;
  const batches: string[][] = [];
  for (let i = 0; i < questionIds.length; i += BATCH)
    batches.push(questionIds.slice(i, i + BATCH));

  const results = await Promise.all(
    batches.map((ids) =>
      crmQuery({
        fn: "common_fn", se: "fe", sch: "t_qu",
        data: { json: "*" },
        cond: { row_id: ids },   // pass array → IN clause on server
      })
    )
  );
  return results.flat().map(parseQuestion);
}

function parseQuestion(row) {
  const json = row.json ?? {};
  const qu   = json._qu ?? {};
  const ops  = json._op ?? {};
  const so   = json._so ?? {};
  return {
    rowId:       row.row_id,
    text:        qu._qu ?? "",
    optionA:     ops._op_A?._op_ti ?? "",
    optionB:     ops._op_B?._op_ti ?? "",
    optionC:     ops._op_C?._op_ti ?? "",
    optionD:     ops._op_D?._op_ti ?? "",
    answer:      json._an ?? "",       // "A" | "B" | "C" | "D"
    explanation: so._ti ?? null,
    questionNo:  json._qno ?? null,
  };
}
```

---

## 10. Supabase Edge Function Template

Every edge function should use this shell:

```typescript
// supabase/functions/<name>/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyRequest } from "../_shared/auth.ts";
import { crmQuery }       from "../_shared/crm.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  // Verify HMAC signature + rate limit
  const authResult = await verifyRequest(req);
  if (!authResult.ok)
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: authResult.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // --- your logic ---
    const data = await crmQuery({ fn: "common_fn", se: "fe", sch: "t_co", data: { json: "*" }, cond: {} });
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

```typescript
// supabase/functions/_shared/crm.ts
const CRM_BASE = "https://crm.tncnursing.in";

export async function crmQuery(payload: object): Promise<unknown[]> {
  const resp = await fetch(`${CRM_BASE}/common/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: JSON.stringify(payload) }),
  });
  if (!resp.ok) throw new Error(`CRM ${resp.status}`);
  const data = await resp.json();
  return Array.isArray(data) ? data : [];
}
```

---

## 11. CRM Field Quick Reference

| Field | Table | Meaning |
|---|---|---|
| `row.row_id` | all | Stable unique string ID |
| `json._na` | `t_co`, `t_ch` | Name / Title |
| `json._de` | `t_co`, `t_ch` | Description |
| `json._sno` | `t_co`, `t_ch` | Serial / order number |
| `json._at.url` | `t_co` | Thumbnail relative path |
| `json._vi._fs_id` | `t_ch` | TNC CDN video ID → iframe |
| `json._de._vi.url` | `t_ch` | YouTube or direct video URL |
| `json._de._no.url` | `t_ch` | PDF relative path (`uploads/…`) |
| `json._pr_ty` | `t_ch` | `1` = paid, `0` = free |
| `row.co_refid` | `t_ch` | Parent course `row_id` |
| `json._ex_na` | `t_ex` | Exam / quiz name |
| `json._ma_ma` | `t_ex` | Max marks |
| `json._ne_ma` | `t_ex` | Negative marks per wrong answer |
| `json._ex_du` | `t_ex` | Duration in minutes |
| `row.qu_refid` | `t_ex` | Array of question `row_id`s |
| `json._qu._qu` | `t_qu` | Question text |
| `json._op._op_A._op_ti` | `t_qu` | Option A text |
| `json._an` | `t_qu` | Correct answer (`"A"–"D"`) |
| `json._so._ti` | `t_qu` | Explanation / solution |
