import { supabaseRequest } from "./supabase-rest";

export interface BotUser {
  id: number;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  isBanned: boolean;
  bannedReason: string | null;
  bannedAt: string | null;
  firstSeen: string;
  lastSeen: string;
  totalStudySeconds: number;
}

interface SupabaseBotUser {
  id: number;
  telegram_id: number | string;
  username: string | null;
  first_name: string;
  last_name: string | null;
  is_banned: boolean;
  banned_at: string | null;
  banned_reason: string | null;
  first_seen: string;
  last_seen: string;
  total_study_seconds?: number | null;
}

function mapUser(row: SupabaseBotUser): BotUser {
  return {
    id: row.id,
    telegramId: String(row.telegram_id),
    firstName: row.first_name ?? "",
    lastName: row.last_name,
    username: row.username,
    isBanned: Boolean(row.is_banned),
    bannedReason: row.banned_reason,
    bannedAt: row.banned_at,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    totalStudySeconds: Number(row.total_study_seconds ?? 0),
  };
}

export async function upsertUser(user: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}): Promise<BotUser> {
  const rows = await supabaseRequest<SupabaseBotUser[]>("bot_users?on_conflict=telegram_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      telegram_id: user.id,
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? null,
      username: user.username ?? null,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    }),
  });
  if (!rows[0]) throw new Error("Supabase did not return the upserted bot user");
  return mapUser(rows[0]);
}

export async function getUser(telegramId: string): Promise<BotUser | undefined> {
  const rows = await supabaseRequest<SupabaseBotUser[]>(
    `bot_users?telegram_id=eq.${encodeURIComponent(telegramId)}&limit=1`,
  );
  return rows[0] ? mapUser(rows[0]) : undefined;
}

export async function banUser(telegramId: string, reason: string): Promise<boolean> {
  const rows = await supabaseRequest<SupabaseBotUser[]>(
    `bot_users?telegram_id=eq.${encodeURIComponent(telegramId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        is_banned: true,
        banned_reason: reason,
        banned_at: new Date().toISOString(),
      }),
    },
  );
  return rows.length > 0;
}

export async function unbanUser(telegramId: string): Promise<boolean> {
  const rows = await supabaseRequest<SupabaseBotUser[]>(
    `bot_users?telegram_id=eq.${encodeURIComponent(telegramId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ is_banned: false, banned_reason: null, banned_at: null }),
    },
  );
  return rows.length > 0;
}

export async function listUsers(
  page: number,
  limit: number,
): Promise<{ users: BotUser[]; total: number; banned: number }> {
  const rows = await supabaseRequest<SupabaseBotUser[]>(
    `bot_users?select=*&order=last_seen.desc&offset=${(page - 1) * limit}&limit=${limit}`,
  );
  const all = await supabaseRequest<Pick<SupabaseBotUser, "is_banned">[]>("bot_users?select=is_banned");
  return {
    users: rows.map(mapUser),
    total: all.length,
    banned: all.filter((u) => u.is_banned).length,
  };
}

export async function checkBannedStore(
  telegramId: string | number,
): Promise<{ banned: boolean; reason?: string }> {
  const user = await getUser(String(telegramId));
  return user?.isBanned
    ? { banned: true, reason: user.bannedReason ?? undefined }
    : { banned: false };
}

export async function getStats(): Promise<{ total: number; banned: number; active: number }> {
  const all = await supabaseRequest<Pick<SupabaseBotUser, "is_banned">[]>("bot_users?select=is_banned");
  const banned = all.filter((user) => user.is_banned).length;
  return { total: all.length, banned, active: all.length - banned };
}

export async function getAllUsers(): Promise<BotUser[]> {
  const all = await supabaseRequest<SupabaseBotUser[]>("bot_users?select=*&order=last_seen.desc");
  return all.map(mapUser);
}
