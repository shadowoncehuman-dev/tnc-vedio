import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { supabaseRequest } from "./supabase-rest";

export interface AppUser {
  userId: string;
  name: string;
  mobile: string;
  email: string | null;
  college: string | null;
  state: string | null;
  token: string;
}

interface AppUserRow {
  id: number;
  user_id: string;
  name: string;
  mobile: string;
  email: string | null;
  college: string | null;
  state: string | null;
  password_hash: string;
  created_at: string;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = createHash("sha256").update(`${salt}:${password}`).digest("hex");
  return `${salt}:${digest}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const actual = createHash("sha256").update(`${salt}:${password}`).digest("hex");
  return actual.length === digest.length && timingSafeEqual(Buffer.from(actual), Buffer.from(digest));
}

function toAuthResponse(row: AppUserRow): AppUser {
  return {
    userId: row.user_id,
    name: row.name,
    mobile: row.mobile,
    email: row.email,
    college: row.college,
    state: row.state,
    token: `usr_${row.user_id}`,
  };
}

export async function findAppUser(mobile: string): Promise<AppUserRow | undefined> {
  const rows = await supabaseRequest<AppUserRow[]>(
    `app_users?mobile=eq.${encodeURIComponent(mobile)}&limit=1`,
  );
  return rows[0];
}

export async function authenticateAppUser(mobile: string, password: string): Promise<AppUser | null> {
  const user = await findAppUser(mobile);
  return user && verifyPassword(password, user.password_hash) ? toAuthResponse(user) : null;
}

export async function createAppUser(input: {
  name: string;
  mobile: string;
  password: string;
  email?: string;
  college?: string;
  state?: string;
}): Promise<AppUser> {
  const userId = `${Date.now()}_${randomBytes(3).toString("hex").toUpperCase()}`;
  const rows = await supabaseRequest<AppUserRow[]>("app_users", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: userId,
      name: input.name,
      mobile: input.mobile,
      email: input.email ?? null,
      college: input.college ?? null,
      state: input.state ?? null,
      password_hash: hashPassword(input.password),
    }),
  });
  if (!rows[0]) throw new Error("Supabase did not return the created app user");
  return toAuthResponse(rows[0]);
}
