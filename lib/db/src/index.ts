import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * Fixes DATABASE_URL when the password contains special characters (@, #, ], etc.)
 * that are not URL-encoded. Locates the last @ before the host, then
 * percent-encodes the password portion so pg-connection-string can parse it.
 */
function sanitizeDatabaseUrl(url: string): string {
  try {
    new URL(url); // already valid — nothing to do
    return url;
  } catch {
    // Find protocol prefix
    const protoEnd = url.indexOf("://");
    if (protoEnd === -1) return url;
    const proto = url.slice(0, protoEnd + 3);
    const rest = url.slice(protoEnd + 3);

    // The LAST @ separates credentials from host
    const lastAt = rest.lastIndexOf("@");
    if (lastAt === -1) return url;

    const credentials = rest.slice(0, lastAt);
    const hostPart = rest.slice(lastAt + 1);

    // Split credentials into user:password
    const colonIdx = credentials.indexOf(":");
    if (colonIdx === -1) return url;

    const user = credentials.slice(0, colonIdx);
    const password = credentials.slice(colonIdx + 1);

    return `${proto}${user}:${encodeURIComponent(password)}@${hostPart}`;
  }
}

const connectionString = sanitizeDatabaseUrl(process.env.DATABASE_URL);

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export * from "./schema";
