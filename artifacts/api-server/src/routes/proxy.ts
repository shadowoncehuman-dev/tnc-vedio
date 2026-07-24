import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { getCachedFirebaseVideoUrl, isFirebaseConfigured } from "../lib/firebase-rest";

const router = Router();

const CRM_BASE = "https://crm.tncnursing.in";
const ADMIN_PASSWORD = "newtncsite";
const ADMIN_TOKEN = "admin_tnc_2024_secure_token";
const PROMO_EXPIRES_DAYS = 30;

let promoState = {
  enabled: true,
  expiresAt: new Date(Date.now() + PROMO_EXPIRES_DAYS * 24 * 60 * 60 * 1000).toISOString() as string | null,
};

async function crmQuery(payload: object): Promise<unknown> {
  const resp = await fetch(`${CRM_BASE}/common/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: JSON.stringify(payload) }),
  });
  if (!resp.ok) throw new Error(`CRM error ${resp.status}`);
  return resp.json();
}

function buildMediaUrl(path: string | undefined | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${CRM_BASE}/${path.replace(/^\//, "")}`;
}

function parseCourse(row: Record<string, unknown>) {
  const json = (row.json as Record<string, unknown>) ?? {};
  const at = (json._at as Record<string, unknown>) ?? {};
  return {
    id: row.id,
    rowId: row.row_id,
    name: json._na ?? "",
    description: json._de ?? "",
    serialNo: json._sno ?? "",
    imageUrl: buildMediaUrl(at.url as string),
    createdAt: row.cr_on as string,
    updatedAt: row.up_on,
  };
}

function isYouTubeUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url.startsWith("http")) return false;
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function isDirectVideoUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  if (!url.startsWith("http")) return false;
  return (
    url.includes(".mp4") ||
    url.includes(".m3u8") ||
    url.includes(".webm") ||
    url.includes(".mov") ||
    url.includes("video") ||
    url.includes("stream") ||
    url.includes("cloudfront") ||
    url.includes("vimeo") ||
    url.includes("bunny") ||
    url.includes("cdn")
  );
}

function isPlayableVideoUrl(url: unknown): url is string {
  return isYouTubeUrl(url) || isDirectVideoUrl(url);
}

function isFirebaseStorageUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  return url.includes("firebasestorage.googleapis.com") || url.startsWith("gs://");
}

function convertFirebaseStorageUrl(url: string): string {
  if (url.startsWith("gs://")) {
    const withoutGs = url.replace("gs://", "");
    const slashIdx = withoutGs.indexOf("/");
    const bucket = withoutGs.slice(0, slashIdx);
    const path = withoutGs.slice(slashIdx + 1);
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
  }
  return url;
}

function parseChapter(row: Record<string, unknown>) {
  const json = (row.json as Record<string, unknown>) ?? {};
  const vi = (json._vi as Record<string, unknown>) ?? {};
  const de = (json._de as Record<string, unknown>) ?? {};
  const deVi = (de._vi as Record<string, unknown>) ?? {};
  const deNo = (de._no as Record<string, unknown>) ?? {};

  // Collect all possible video URL fields from both old and new schema
  const rawVideoUrls = [
    vi._vi_url,
    deVi.url,
    vi.url,
    json._vi_url,
    json.video_url,
    vi.video_url,
  ].filter(Boolean) as string[];

  let videoUrl: string | null = null;
  let contentType: "youtube" | "firebase" | "pdf" | "none" = "none";

  for (const raw of rawVideoUrls) {
    if (!raw || typeof raw !== "string") continue;
    if (isFirebaseStorageUrl(raw)) {
      videoUrl = `/api/media-proxy?url=${encodeURIComponent(convertFirebaseStorageUrl(raw))}`;
      contentType = "youtube"; // treat as playable video
      break;
    }
    if (isYouTubeUrl(raw)) {
      videoUrl = raw;
      contentType = "youtube";
      break;
    }
    if (isDirectVideoUrl(raw)) {
      videoUrl = raw;
      contentType = "youtube";
      break;
    }
  }

  // Firebase ID for secured content (UUID style)
  const firebaseId = (vi._fs_id ?? deVi.fs_id ?? "") as string;
  const hasFirebaseId = typeof firebaseId === "string" && firebaseId.trim().length > 10;

  if (!videoUrl && hasFirebaseId) {
    contentType = "firebase";
  }

  // PDF handling — uploads/ path (CRM-hosted, proxy works)
  const rawPdfPath = ((deNo.url ?? "") as string).replace(/^\//, "");
  const isCrmHostedPdf = rawPdfPath.startsWith("uploads/");
  let pdfUrl: string | null = null;

  if (isCrmHostedPdf) {
    pdfUrl = `/api/pdf?path=${encodeURIComponent(rawPdfPath)}`;
    if (!videoUrl && contentType !== "firebase") {
      contentType = "pdf";
    }
  }

  // Firebase PDF (stored as Firebase URL in _no.url)
  const rawNoUrl = (deNo.url ?? deNo.uri ?? "") as string;
  const hasFirebasePdf = !isCrmHostedPdf && (
    isFirebaseStorageUrl(rawNoUrl) || (rawNoUrl.length > 5 && !isCrmHostedPdf)
  );

  if (!videoUrl && !pdfUrl && hasFirebasePdf && rawNoUrl.startsWith("http")) {
    pdfUrl = `/api/media-proxy?url=${encodeURIComponent(rawNoUrl)}`;
    if (contentType === "none") contentType = "pdf";
  }

  // Determine final type
  const finalType = videoUrl
    ? "video"
    : pdfUrl
      ? "pdf"
      : "content";

  return {
    id: row.id as number,
    rowId: row.row_id as string,
    title: (json._na ?? "Untitled") as string,
    description: "",
    videoUrl,
    pdfUrl,
    firebaseId: hasFirebaseId ? firebaseId : null,
    contentType,
    type: finalType,
    courseId: (row.co_refid ?? json._co) as string | null,
    subjectId: (row.su_refid ?? json._su) as string | null,
    isPaid: (json._pr_ty as number) === 1,
    duration: null as string | null,
    thumbnailUrl: null as string | null,
    serialNo: String(json._sno ?? ""),
    createdAt: row.cr_on as string,
  };
}

function parseSlider(row: Record<string, unknown>) {
  const json = (row.json as Record<string, unknown>) ?? {};
  const at = (json._at as Record<string, unknown>) ?? {};
  return {
    id: row.id,
    rowId: row.row_id,
    imageUrl: buildMediaUrl(at.url as string) ?? "",
    name: (json._na ?? "") as string,
    description: (json._de ?? "") as string,
  };
}

function parseUserRow(row: Record<string, unknown>) {
  const json = (row.json as Record<string, unknown>) ?? {};
  return {
    userId: (json._us_id ?? row.row_id) as string,
    name: (json._us_na ?? "") as string,
    mobile: (json._mo ?? "") as string,
    email: (json._em as string) ?? null,
    college: (json._cl as string) ?? null,
    state: (json._st as string) ?? null,
    token: `usr_${json._us_id ?? row.row_id}`,
  };
}

function parseAdminUser(row: Record<string, unknown>) {
  const json = (row.json as Record<string, unknown>) ?? {};
  return {
    id: row.id,
    rowId: row.row_id,
    name: (json._us_na ?? "") as string,
    mobile: (json._mo ?? "") as string,
    email: (json._em as string) ?? null,
    college: (json._cl as string) ?? null,
    state: (json._st as string) ?? null,
    createdAt: row.cr_on,
  };
}

function parseExam(row: Record<string, unknown>) {
  const json = (row.json as Record<string, unknown>) ?? {};
  const quRefids = (row.qu_refid as string[]) ?? [];
  return {
    examId: row.row_id as string,
    examNo: (row.examno as number) ?? 0,
    name: (json._ex_na ?? "Quiz") as string,
    maxMarks: (json._ma_ma as number) ?? 0,
    negativeMarks: (json._ne_ma as number) ?? 0.25,
    durationMinutes: String(json._ex_du ?? "60"),
    questionCount: quRefids.length,
    validUntil: (json._va_ti as string) ?? null,
    allowForPremium: (json._al_fo_pr as number) === 1,
    startDate: (json._st_da as string) ?? null,
    endDate: (json._en_da as string) ?? null,
  };
}

function parseQuestion(row: Record<string, unknown>) {
  const json = (row.json as Record<string, unknown>) ?? {};
  const quObj = (json._qu as Record<string, unknown>) ?? {};
  const ops = (json._op as Record<string, Record<string, unknown>>) ?? {};
  const soObj = (json._so as Record<string, unknown>) ?? {};

  return {
    rowId: row.row_id as string,
    questionId: row.id as number,
    questionText: (quObj._qu ?? "") as string,
    optionA: ((ops._op_A ?? {})?._op_ti ?? "") as string,
    optionB: ((ops._op_B ?? {})?._op_ti ?? "") as string,
    optionC: ((ops._op_C ?? {})?._op_ti ?? "") as string,
    optionD: ((ops._op_D ?? {})?._op_ti ?? "") as string,
    correctAnswer: (json._an ?? "") as string,
    explanation: (soObj._ti ?? null) as string | null,
    questionNo: (json._qno as number) ?? null,
  };
}

// GET /api/courses — newest first
router.get("/courses", async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await crmQuery({
      fn: "common_fn", se: "fe", sch: "t_co",
      data: { json: "*" }, cond: {},
    });
    const courses = Array.isArray(data)
      ? (data as Record<string, unknown>[]).map(parseCourse)
      : [];
    // Sort newest first by createdAt
    courses.sort((a, b) => {
      const aTime = String(a.createdAt ?? "");
      const bTime = String(b.createdAt ?? "");
      return bTime.localeCompare(aTime);
    });
    res.json(courses);
  } catch (err) {
    logger.error({ err }, "Failed to fetch courses");
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

// GET /api/pdf?path=... — proxy PDFs from CRM (uploads/ paths)
router.get("/pdf", async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: pdfPath } = req.query;
    if (!pdfPath || typeof pdfPath !== "string") {
      res.status(400).json({ error: "Missing path" });
      return;
    }
    const url = `${CRM_BASE}/${pdfPath.replace(/^\/+/, "")}`;
    const upstream = await fetch(url);
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: "PDF not found" });
      return;
    }
    const ct = upstream.headers.get("content-type") ?? "application/pdf";
    res.setHeader("Content-Type", ct);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const buf = await upstream.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (err) {
    logger.error({ err }, "Failed to proxy PDF");
    res.status(500).json({ error: "Failed to load PDF" });
  }
});

// GET /api/media-proxy?url=... — generic media proxy for Firebase Storage / CORS-blocked URLs
router.get("/media-proxy", async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "Missing url" });
      return;
    }
    // Only allow known trusted domains
    const allowedDomains = [
      "firebasestorage.googleapis.com",
      "crm.tncnursing.in",
      "storage.googleapis.com",
    ];
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      res.status(400).json({ error: "Invalid URL" });
      return;
    }
    if (!allowedDomains.some((d) => parsedUrl.hostname.endsWith(d))) {
      res.status(403).json({ error: "Domain not allowed" });
      return;
    }

    const upstream = await fetch(url, {
      headers: { "Accept": "*/*" },
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `Upstream error ${upstream.status}` });
      return;
    }

    const ct = upstream.headers.get("content-type") ?? "application/octet-stream";
    const cl = upstream.headers.get("content-length");
    res.setHeader("Content-Type", ct);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (cl) res.setHeader("Content-Length", cl);

    const buf = await upstream.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (err) {
    logger.error({ err }, "Media proxy failed");
    res.status(500).json({ error: "Media proxy failed" });
  }
});

// GET /api/sessions — queries t_ch (real video sessions) with pagination + sort
router.get("/sessions", async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId, limit: limitParam, type, sort, page: pageParam } = req.query;
    const cond: Record<string, unknown> = {};
    if (courseId) cond.co_refid = courseId;

    const data = await crmQuery({
      fn: "common_fn", se: "fe", sch: "t_ch",
      data: { json: "*" }, cond,
    });

    if (!Array.isArray(data)) {
      res.json(courseId ? [] : { sessions: [], total: 0 });
      return;
    }

    let sessions = (data as Record<string, unknown>[]).map(parseChapter);

    // Filter by content type if requested
    if (type === "video") {
      sessions = sessions.filter((s) => s.contentType === "youtube" || s.videoUrl);
    } else if (type === "pdf") {
      sessions = sessions.filter((s) => s.contentType === "pdf" || s.pdfUrl);
    }

    // Sort
    if (sort === "newest") {
      sessions.sort((a, b) => {
        const aTime = String(a.createdAt ?? "");
        const bTime = String(b.createdAt ?? "");
        return bTime.localeCompare(aTime);
      });
    } else {
      // Default: sort by serial number ascending (lesson order within a course)
      sessions.sort((a, b) => {
        const aNo = parseFloat(String(a.serialNo)) || 0;
        const bNo = parseFloat(String(b.serialNo)) || 0;
        return aNo - bNo;
      });
    }

    // Paginated response when page param given
    if (pageParam) {
      const page = Math.max(1, parseInt(String(pageParam)));
      const limit = Math.min(parseInt(String(limitParam ?? "30")), 100);
      const total = sessions.length;
      const paged = sessions.slice((page - 1) * limit, page * limit);
      res.json({ sessions: paged, total, page, limit });
      return;
    }

    // Limit when no courseId to avoid huge payloads
    if (!courseId) {
      const limit = Math.min(parseInt(String(limitParam ?? "200")), 500);
      sessions = sessions.slice(0, limit);
    }

    res.json(sessions);
  } catch (err) {
    logger.error({ err }, "Failed to fetch sessions");
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// GET /api/sessions/:rowId — fetch a single session by rowId
router.get("/sessions/:rowId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { rowId } = req.params;
    const data = await crmQuery({
      fn: "common_fn", se: "fe", sch: "t_ch",
      data: { json: "*" }, cond: { row_id: rowId },
    });
    if (!Array.isArray(data) || data.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(parseChapter((data as Record<string, unknown>[])[0]));
  } catch (err) {
    logger.error({ err }, "Failed to fetch session");
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

// GET /api/search?q=... — global search across courses, sessions, quizzes
router.get("/search", async (req: Request, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string) ?? "").trim().toLowerCase();
    if (!q || q.length < 2) {
      res.json({ courses: [], sessions: [], quizzes: [] });
      return;
    }

    const [coursesData, quizzesData] = await Promise.all([
      crmQuery({ fn: "common_fn", se: "fe", sch: "t_co", data: { json: "*" }, cond: {} }),
      crmQuery({ fn: "common_fn", se: "fe", sch: "t_ex", data: { json: "*", qu_refid: "*" }, cond: {} }),
    ]);

    const courses = Array.isArray(coursesData)
      ? (coursesData as Record<string, unknown>[])
          .map(parseCourse)
          .filter((c) => String(c.name).toLowerCase().includes(q))
          .slice(0, 10)
      : [];

    const quizzes = Array.isArray(quizzesData)
      ? (quizzesData as Record<string, unknown>[])
          .filter((row) => {
            const json = (row.json as Record<string, unknown>) ?? {};
            return String(json._ex_na ?? "").toLowerCase().includes(q);
          })
          .map(parseExam)
          .slice(0, 10)
      : [];

    res.json({ courses, sessions: [], quizzes });
  } catch (err) {
    logger.error({ err }, "Search failed");
    res.status(500).json({ error: "Search failed" });
  }
});

// GET /api/sliders
router.get("/sliders", async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await crmQuery({
      fn: "common_fn", se: "fe", sch: "t_sl",
      data: { json: "*" }, cond: {},
    });
    res.json(Array.isArray(data) ? (data as Record<string, unknown>[]).map(parseSlider) : []);
  } catch (err) {
    logger.error({ err }, "Failed to fetch sliders");
    res.status(500).json({ error: "Failed to fetch sliders" });
  }
});

// POST /api/auth/login
router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { mobile, password } = req.body as { mobile: string; password: string };
    if (!mobile || !password) {
      res.status(400).json({ error: "Mobile and password required" });
      return;
    }
    const data = await crmQuery({
      fn: "common_fn", se: "fe", sch: "t_us",
      data: { json: "*" },
      cond: { "json->>'_mo'": mobile, "json->>'_us_pa'": password },
    });
    if (!Array.isArray(data) || data.length === 0) {
      res.status(401).json({ error: "Invalid mobile number or password" });
      return;
    }
    res.json(parseUserRow((data as Record<string, unknown>[])[0]));
  } catch (err) {
    logger.error({ err }, "Login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/register
router.post("/auth/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, mobile, password, email, college, state, city, gender, dob } = req.body as Record<string, string>;
    if (!name || !mobile || !password) {
      res.status(400).json({ error: "Name, mobile, and password are required" });
      return;
    }
    const existing = await crmQuery({
      fn: "common_fn", se: "fe", sch: "t_us",
      data: { json: "*" }, cond: { "json->>'_mo'": mobile },
    });
    if (Array.isArray(existing) && existing.length > 0) {
      res.status(409).json({ error: "Mobile number already registered" });
      return;
    }
    const userId = `${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const rowId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await crmQuery({
      fn: "common_fn", se: "in", sch: "t_us",
      data: {
        row_id: rowId, us_gr: 1, status: 0,
        json: {
          _us_id: userId, _us_na: name, _mo: mobile, _us_pa: password,
          _em: email ?? "", _cl: college ?? "", _st: state ?? "",
          _ci: city ?? "", _ge: gender ?? "", _dob: dob ?? "",
          _cr_on: new Date().toLocaleString(), _up_on: new Date().toLocaleString(),
        },
      },
      cond: {},
    });
    res.status(201).json({
      userId, name, mobile, email: email ?? null, college: college ?? null,
      state: state ?? null, token: `usr_${userId}`,
    });
  } catch (err) {
    logger.error({ err }, "Registration failed");
    res.status(500).json({ error: "Registration failed" });
  }
});

// GET /api/purchases/:userId
router.get("/purchases/:userId", async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await crmQuery({
      fn: "common_fn", se: "fe", sch: "t_cu",
      data: { json: "*" }, cond: { us_refid: req.params.userId },
    });
    if (!Array.isArray(data)) {
      res.json([]);
      return;
    }
    res.json(
      (data as Record<string, unknown>[]).map((row) => {
        const json = (row.json as Record<string, unknown>) ?? {};
        return {
          id: row.id, rowId: row.row_id, userId: row.us_refid,
          courseId: (json._co_id as string) ?? "",
          courseName: (json._co_na ?? json._na ?? "") as string,
          amount: (json._am as number) ?? null,
          paymentId: (json._pa_id as string) ?? null,
          createdAt: row.cr_on,
        };
      })
    );
  } catch (err) {
    logger.error({ err }, "Failed to fetch purchases");
    res.status(500).json({ error: "Failed to fetch purchases" });
  }
});

// POST /api/purchases
router.post("/purchases", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, courseId, courseName, amount, paymentId } = req.body as Record<string, unknown>;
    if (!userId || !courseId || !courseName) {
      res.status(400).json({ error: "userId, courseId, and courseName are required" });
      return;
    }
    const rowId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await crmQuery({
      fn: "common_fn", se: "in", sch: "t_cu",
      data: {
        row_id: rowId, us_refid: userId,
        json: { _co_id: courseId, _co_na: courseName, _am: amount ?? 0, _pa_id: paymentId ?? "" },
      },
      cond: {},
    });
    res.status(201).json({
      id: Date.now(), rowId, userId, courseId, courseName,
      amount: (amount as number) ?? null, paymentId: (paymentId as string) ?? null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to create purchase");
    res.status(500).json({ error: "Failed to create purchase" });
  }
});

// POST /api/admin/login
router.post("/admin/login", (req: Request, res: Response): void => {
  const { password } = req.body as { password: string };
  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid admin password" });
    return;
  }
  res.json({ token: ADMIN_TOKEN, message: "Admin logged in successfully" });
});

// GET /api/admin/stats
router.get("/admin/stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [coursesData, usersData, purchasesData] = await Promise.all([
      crmQuery({ fn: "common_fn", se: "fe", sch: "t_co", data: { json: "*" }, cond: {} }),
      crmQuery({ fn: "common_fn", se: "fe", sch: "t_us", data: { json: "*" }, cond: {} }),
      crmQuery({ fn: "common_fn", se: "fe", sch: "t_cu", data: { json: "*" }, cond: {} }),
    ]);
    const courses = Array.isArray(coursesData) ? coursesData as Record<string, unknown>[] : [];
    const users = Array.isArray(usersData) ? usersData as Record<string, unknown>[] : [];
    const purchases = Array.isArray(purchasesData) ? purchasesData as Record<string, unknown>[] : [];

    const sortedUsers = [...users].sort((a, b) => {
      const aTime = String(a.cr_on ?? "");
      const bTime = String(b.cr_on ?? "");
      return bTime.localeCompare(aTime);
    });

    // Registration trend: last 7 days
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const trend = Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date(now - (6 - i) * day);
      const dayLabel = dayStart.toLocaleDateString("en-IN", { weekday: "short" });
      const count = users.filter((u) => {
        const t = String(u.cr_on ?? "");
        return t.slice(0, 10) === dayStart.toISOString().slice(0, 10);
      }).length;
      return { label: dayLabel, count };
    });

    res.json({
      totalUsers: users.length,
      totalCourses: courses.length,
      totalSessions: 59806,
      totalPurchases: purchases.length,
      recentUsers: sortedUsers.slice(0, 20).map(parseAdminUser),
      registrationTrend: trend,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch admin stats");
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});

// GET /api/admin/users — server-side paginated, cached fetch
const usersCache: { data: Record<string, unknown>[]; fetchedAt: number } | null = null as unknown as { data: Record<string, unknown>[]; fetchedAt: number } | null;
let usersCacheState: { data: Record<string, unknown>[]; fetchedAt: number } | null = null;

router.get("/admin/users", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = (req.query.search as string) ?? "";
    const sort = (req.query.sort as string) ?? "newest";

    // Use cache if < 5 minutes old
    const now = Date.now();
    if (!usersCacheState || now - usersCacheState.fetchedAt > 5 * 60 * 1000) {
      const freshData = await crmQuery({
        fn: "common_fn", se: "fe", sch: "t_us", data: { json: "*" }, cond: {},
      });
      usersCacheState = {
        data: Array.isArray(freshData) ? (freshData as Record<string, unknown>[]) : [],
        fetchedAt: now,
      };
    }

    let users = usersCacheState.data;

    if (search) {
      const q = search.toLowerCase();
      users = users.filter((row) => {
        const json = (row.json as Record<string, unknown>) ?? {};
        return (
          String(json._us_na ?? "").toLowerCase().includes(q) ||
          String(json._mo ?? "").includes(q) ||
          String(json._em ?? "").toLowerCase().includes(q)
        );
      });
    }

    // Sort
    if (sort === "oldest") {
      users = [...users].sort((a, b) => String(a.cr_on ?? "").localeCompare(String(b.cr_on ?? "")));
    } else {
      users = [...users].sort((a, b) => String(b.cr_on ?? "").localeCompare(String(a.cr_on ?? "")));
    }

    const total = users.length;
    res.json({
      users: users.slice((page - 1) * limit, page * limit).map(parseAdminUser),
      total, page, limit,
      cachedAt: new Date(usersCacheState.fetchedAt).toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch admin users");
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET /api/promo/status
router.get("/promo/status", (_req: Request, res: Response): void => {
  const now = new Date();
  if (promoState.expiresAt && new Date(promoState.expiresAt) < now) {
    promoState.enabled = false;
    promoState.expiresAt = null;
  }
  res.json({
    enabled: promoState.enabled,
    expiresAt: promoState.expiresAt,
    message: promoState.enabled
      ? `Promo active — all content unlocked until ${new Date(promoState.expiresAt!).toLocaleDateString("en-IN")}`
      : "Promotional mode is inactive",
  });
});

// POST /api/promo/toggle
router.post("/promo/toggle", (req: Request, res: Response): void => {
  const { enabled, durationDays, adminToken } = req.body as { enabled: boolean; durationDays?: number; adminToken: string };
  if (adminToken !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  promoState.enabled = Boolean(enabled);
  if (promoState.enabled) {
    const days = durationDays ?? PROMO_EXPIRES_DAYS;
    promoState.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  } else {
    promoState.expiresAt = null;
  }
  res.json({
    enabled: promoState.enabled,
    expiresAt: promoState.expiresAt,
    message: promoState.enabled
      ? `Promotional mode enabled for ${durationDays ?? PROMO_EXPIRES_DAYS} days`
      : "Promotional mode disabled",
  });
});

// POST /api/promo/extend
router.post("/promo/extend", (req: Request, res: Response): void => {
  const { durationDays, adminToken } = req.body as { durationDays: number; adminToken: string };
  if (adminToken !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!durationDays || durationDays < 1) {
    res.status(400).json({ error: "Invalid durationDays" });
    return;
  }
  const base = promoState.expiresAt && new Date(promoState.expiresAt) > new Date()
    ? new Date(promoState.expiresAt)
    : new Date();
  promoState.enabled = true;
  promoState.expiresAt = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  res.json({
    enabled: promoState.enabled,
    expiresAt: promoState.expiresAt,
    message: `Free period extended by ${durationDays} days — now active until ${new Date(promoState.expiresAt).toLocaleDateString("en-IN")}`,
  });
});

// GET /api/quizzes — list exam sets from t_ex, newest first
router.get("/quizzes", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = ((req.query.search as string) ?? "").toLowerCase();

    const data = await crmQuery({
      fn: "common_fn", se: "fe", sch: "t_ex",
      data: { json: "*", qu_refid: "*" }, cond: {},
    });

    if (!Array.isArray(data)) {
      res.json({ quizzes: [], total: 0, page, limit });
      return;
    }

    let valid = (data as Record<string, unknown>[]).filter((row) => {
      const ids = (row.qu_refid as string[]) ?? [];
      return ids.length > 0;
    });

    if (search) {
      valid = valid.filter((row) => {
        const json = (row.json as Record<string, unknown>) ?? {};
        return String(json._ex_na ?? "").toLowerCase().includes(search);
      });
    }

    // Sort newest first (examno descending)
    const sorted = [...valid].sort((a, b) =>
      ((b.examno as number) ?? 0) - ((a.examno as number) ?? 0)
    );

    const total = sorted.length;
    const paged = sorted.slice((page - 1) * limit, page * limit);

    res.json({ quizzes: paged.map(parseExam), total, page, limit });
  } catch (err) {
    logger.error({ err }, "Failed to fetch quizzes");
    res.status(500).json({ error: "Failed to fetch quizzes" });
  }
});

// GET /api/quiz/:examId — fetch exam with ALL questions (actual count, no hardcode)
router.get("/quiz/:examId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { examId } = req.params;

    const data = await crmQuery({
      fn: "common_fn", se: "fe", sch: "t_ex",
      data: { json: "*", qu_refid: "*" }, cond: { row_id: examId },
    });

    if (!Array.isArray(data) || data.length === 0) {
      res.status(404).json({ error: "Quiz not found" });
      return;
    }

    const exam = (data as Record<string, unknown>[])[0];
    const quRefids = (exam.qu_refid as string[]) ?? [];
    const actualQuestionCount = quRefids.length;

    // Fetch ALL questions in parallel batches of 50 (no hardcoded cap)
    const BATCH_SIZE = 50;
    const batches: string[][] = [];
    for (let i = 0; i < actualQuestionCount; i += BATCH_SIZE) {
      batches.push(quRefids.slice(i, i + BATCH_SIZE));
    }

    const batchResults = await Promise.all(
      batches.map((ids) =>
        crmQuery({
          fn: "common_fn", se: "fe", sch: "t_qu",
          data: { json: "*" }, cond: { row_id: ids },
        })
      )
    );

    const questions = batchResults
      .flatMap((r) => (Array.isArray(r) ? (r as Record<string, unknown>[]) : []))
      .map(parseQuestion)
      .filter((q) => q.questionText.trim().length > 0);

    // Sort by questionNo if available, else preserve CRM order
    questions.sort((a, b) => {
      if (a.questionNo !== null && b.questionNo !== null) return a.questionNo - b.questionNo;
      return 0;
    });

    const examMeta = parseExam(exam);
    res.json({
      ...examMeta,
      questionCount: actualQuestionCount,
      questions,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch quiz");
    res.status(500).json({ error: "Failed to fetch quiz" });
  }
});

// GET /api/firebase-video/:fsId — resolve a Firebase secured video to a playable URL
router.get("/firebase-video/:fsId", async (req: Request, res: Response): Promise<void> => {
  const { fsId } = req.params;

  if (!isFirebaseConfigured()) {
    res.status(503).json({
      error: "Firebase not configured",
      setup: "Set FIREBASE_SERVICE_ACCOUNT environment variable with service account JSON from Firebase Console → Project Settings → Service Accounts.",
      projectId: "team-nursing-classes-818e5",
      bucket: "team-nursing-classes-818e5.appspot.com",
    });
    return;
  }

  try {
    const result = await getCachedFirebaseVideoUrl(fsId);
    if (!result) {
      res.status(404).json({ error: "Video not found in Firebase Storage" });
      return;
    }
    res.json({ url: result.url, path: result.path });
  } catch (err) {
    logger.error({ err, fsId }, "Firebase video URL resolution failed");
    res.status(500).json({ error: "Failed to resolve Firebase video" });
  }
});

// GET /api/firebase-status — check if Firebase is configured
router.get("/firebase-status", (_req: Request, res: Response): void => {
  res.json({
    configured: isFirebaseConfigured(),
    projectId: "team-nursing-classes-818e5",
    bucket: "team-nursing-classes-818e5.appspot.com",
    setup: isFirebaseConfigured()
      ? null
      : "Add FIREBASE_SERVICE_ACCOUNT secret (service account JSON) to enable Firebase video playback.",
  });
});

export default router;
