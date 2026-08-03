import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

/**
 * Fixes DATABASE_URL when the password contains special characters (@, #, ], etc.)
 * that are not URL-encoded. Same logic as lib/db/src/index.ts.
 */
function sanitizeDatabaseUrl(url: string): string {
  try {
    new URL(url);
    return url;
  } catch {
    const protoEnd = url.indexOf("://");
    if (protoEnd === -1) return url;
    const proto = url.slice(0, protoEnd + 3);
    const rest = url.slice(protoEnd + 3);
    const lastAt = rest.lastIndexOf("@");
    if (lastAt === -1) return url;
    const credentials = rest.slice(0, lastAt);
    const hostPart = rest.slice(lastAt + 1);
    const colonIdx = credentials.indexOf(":");
    if (colonIdx === -1) return url;
    const user = credentials.slice(0, colonIdx);
    const password = credentials.slice(colonIdx + 1);
    return `${proto}${user}:${encodeURIComponent(password)}@${hostPart}`;
  }
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: sanitizeDatabaseUrl(process.env.DATABASE_URL),
  },
});
