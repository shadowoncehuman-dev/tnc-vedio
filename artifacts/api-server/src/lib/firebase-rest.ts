/**
 * Firebase video proxy — authenticates with Firebase using EITHER:
 *   A) Email/password (FIREBASE_USER_EMAIL + FIREBASE_USER_PASSWORD env vars)
 *   B) Service account JWT (FIREBASE_SERVICE_ACCOUNT env var)
 *
 * Firebase API key is baked-in (extracted from the Android APK).
 */
import { createSign } from "crypto";
import type { Response } from "express";

const FIREBASE_API_KEY = "AIzaSyD8LTjLjo89KpUzvHLpjwODOGj9UKb2H8c";
const BUCKET = "shivangi-nursing-academy-818e5.appspot.com";
const VIDEO_PATHS = ["videos", "chapters", "lectures", "sessions", "media", "stream"];

// ─────────────────────────────────────────────
// USER EMAIL / PASSWORD AUTH (primary method)
// ─────────────────────────────────────────────
interface UserToken {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

let userToken: UserToken | null = null;

export function isUserAuthConfigured(): boolean {
  const email = process.env.FIREBASE_USER_EMAIL ?? "";
  const password = process.env.FIREBASE_USER_PASSWORD ?? "";
  // Must look like a real email (TNC uses phone numbers, which aren't valid Firebase emails)
  return !!(email.includes("@") && password);
}

/** Sign in with email+password via Firebase Auth REST API */
export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<UserToken> {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = (await resp.json()) as {
    idToken?: string;
    refreshToken?: string;
    expiresIn?: string;
    error?: { message: string };
  };
  if (!resp.ok || !data.idToken) {
    throw new Error(`Firebase sign-in failed: ${data.error?.message ?? resp.status}`);
  }
  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken!,
    expiresAt: Date.now() + parseInt(data.expiresIn ?? "3600") * 1000,
  };
}

async function refreshUserToken(refreshToken: string): Promise<UserToken | null> {
  const resp = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    }
  );
  if (!resp.ok) return null;
  const data = (await resp.json()) as {
    id_token: string;
    refresh_token: string;
    expires_in: string;
  };
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + parseInt(data.expires_in) * 1000,
  };
}

async function getUserIdToken(): Promise<string | null> {
  if (userToken && userToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return userToken.idToken;
  }
  if (userToken?.refreshToken) {
    const refreshed = await refreshUserToken(userToken.refreshToken);
    if (refreshed) {
      userToken = refreshed;
      return refreshed.idToken;
    }
  }
  const email = process.env.FIREBASE_USER_EMAIL!;
  const password = process.env.FIREBASE_USER_PASSWORD!;
  const tokens = await signInWithEmailPassword(email, password);
  userToken = tokens;
  return tokens.idToken;
}

// ─────────────────────────────────────────────
// SERVICE ACCOUNT AUTH (fallback)
// ─────────────────────────────────────────────
let saToken: { value: string; expiresAt: number } | null = null;

export function isServiceAccountConfigured(): boolean {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT;
}

async function getServiceAccountToken(): Promise<string | null> {
  if (saToken && saToken.expiresAt > Date.now() + 60_000) return saToken.value;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  let sa: Record<string, string>;
  try {
    sa = JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/devstorage.read_only",
    })
  ).toString("base64url");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${claims}`);
  const sig = sign.sign(sa.private_key, "base64url");
  const jwt = `${header}.${claims}.${sig}`;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth2:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!resp.ok) return null;
  const data = (await resp.json()) as { access_token: string; expires_in: number };
  saToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return saToken.value;
}

// ─────────────────────────────────────────────
// COMBINED: get whichever auth token is available
// ─────────────────────────────────────────────
export function isFirebaseConfigured(): boolean {
  return isUserAuthConfigured() || isServiceAccountConfigured();
}

async function getAuthToken(): Promise<string | null> {
  if (isUserAuthConfigured()) return getUserIdToken();
  if (isServiceAccountConfigured()) return getServiceAccountToken();
  return null;
}

// ─────────────────────────────────────────────
// PATH RESOLUTION + STREAMING
// ─────────────────────────────────────────────
const pathCache = new Map<string, { path: string; expiresAt: number }>();

async function findStoragePath(fsId: string, token: string): Promise<string | null> {
  const cached = pathCache.get(fsId);
  if (cached && cached.expiresAt > Date.now()) return cached.path;

  const candidates = [
    ...VIDEO_PATHS.map((p) => `${p}/${fsId}`),
    ...VIDEO_PATHS.map((p) => `${p}/${fsId}.mp4`),
    fsId,
    `${fsId}.mp4`,
  ];

  for (const path of candidates) {
    const encoded = encodeURIComponent(path);
    const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (resp.ok) {
      pathCache.set(fsId, { path, expiresAt: Date.now() + 60 * 60 * 1000 });
      return path;
    }
  }
  return null;
}

/**
 * Stream a Firebase-secured video directly to an Express response.
 * Supports Range requests for seeking.
 */
export async function streamFirebaseVideo(
  fsId: string,
  rangeHeader: string | undefined,
  res: Response
): Promise<void> {
  const token = await getAuthToken();
  if (!token) throw new Error("no_auth");

  const path = await findStoragePath(fsId, token);
  if (!path) throw new Error("not_found");

  const encoded = encodeURIComponent(path);
  const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}?alt=media`;

  const fetchHeaders: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (rangeHeader) fetchHeaders.Range = rangeHeader;

  const fbResp = await fetch(storageUrl, { headers: fetchHeaders });

  // Forward relevant headers
  res.status(fbResp.status);
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = fbResp.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  res.setHeader("cache-control", "private, max-age=3600");

  if (!fbResp.body) {
    res.end();
    return;
  }

  // Pipe the web ReadableStream to Node.js response
  const { Readable } = await import("stream");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeStream = Readable.fromWeb(fbResp.body as any);
  nodeStream.pipe(res);
  nodeStream.on("error", () => res.end());
}

/**
 * Get a download URL (for short-lived direct play, no proxying).
 * Only works with service account (downloadTokens).
 */
export async function getCachedFirebaseVideoUrl(
  fsId: string
): Promise<{ url: string; path: string } | null> {
  if (!isServiceAccountConfigured()) return null;
  const token = await getServiceAccountToken();
  if (!token) return null;
  const path = await findStoragePath(fsId, token);
  if (!path) return null;
  const encoded = encodeURIComponent(path);
  const metaResp = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaResp.ok) return null;
  const meta = (await metaResp.json()) as { downloadTokens?: string };
  if (!meta.downloadTokens) return null;
  const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}?alt=media&token=${meta.downloadTokens}`;
  return { url, path };
}
