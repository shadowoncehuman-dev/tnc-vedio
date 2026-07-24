/**
 * Firebase Storage REST access using Google Service Account JWT.
 * No firebase-admin package needed — uses Node's built-in crypto.
 */
import { createSign } from "crypto";

const BUCKET = "team-nursing-classes-818e5.appspot.com";
const VIDEO_PATHS = ["videos", "chapters", "lectures", "sessions", "media", "stream"];

// Cache access tokens to avoid re-minting every request
let cachedToken: { value: string; expiresAt: number } | null = null;

function parseServiceAccount(): Record<string, string> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}

export function isFirebaseConfigured(): boolean {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT;
}

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const sa = parseServiceAccount();
  if (!sa) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: [
        "https://www.googleapis.com/auth/devstorage.read_only",
        "https://www.googleapis.com/auth/firebase",
      ].join(" "),
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

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Google token error ${resp.status}: ${err}`);
  }

  const data = (await resp.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.value;
}

async function getFileMetadata(
  path: string,
  token: string
): Promise<{ downloadTokens?: string; name?: string } | null> {
  const encoded = encodeURIComponent(path);
  const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return null;
  return resp.json() as Promise<{ downloadTokens?: string; name?: string }>;
}

function buildPublicDownloadUrl(path: string, token: string): string {
  const encoded = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}?alt=media&token=${token}`;
}

/**
 * Find and return a public download URL for a Firebase Storage video by _fs_id.
 * Tries multiple path patterns.
 */
export async function getFirebaseVideoDownloadUrl(
  fsId: string
): Promise<{ url: string; path: string } | null> {
  if (!isFirebaseConfigured()) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const pathsToTry = [
    ...VIDEO_PATHS.map((p) => `${p}/${fsId}`),
    ...VIDEO_PATHS.map((p) => `${p}/${fsId}.mp4`),
    fsId,
    `${fsId}.mp4`,
  ];

  for (const path of pathsToTry) {
    const meta = await getFileMetadata(path, token);
    if (meta?.downloadTokens) {
      const url = buildPublicDownloadUrl(path, meta.downloadTokens);
      return { url, path };
    }
  }
  return null;
}

// Simple in-memory cache for resolved video URLs (1-hour TTL)
const urlCache = new Map<string, { url: string; path: string; expiresAt: number }>();

export async function getCachedFirebaseVideoUrl(
  fsId: string
): Promise<{ url: string; path: string } | null> {
  const cached = urlCache.get(fsId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const result = await getFirebaseVideoDownloadUrl(fsId);
  if (result) {
    urlCache.set(fsId, { ...result, expiresAt: Date.now() + 55 * 60 * 1000 });
  }
  return result;
}
