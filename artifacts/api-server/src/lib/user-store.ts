import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase-server";

function ensureClient() {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured on server");
  return getSupabaseAdmin();
}

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
  const fallbackUser: BotUser = {
    id: user.id,
    telegramId: String(user.id),
    firstName: user.first_name ?? "",
    lastName: user.last_name ?? null,
    username: user.username ?? null,
    isBanned: false,
    bannedReason: null,
    bannedAt: null,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    totalStudySeconds: 0,
  };

  if (!isSupabaseConfigured()) {
    return fallbackUser;
  }

  try {
    const supabase = ensureClient();
    const payload = {
      telegram_id: user.id,
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? null,
      username: user.username ?? null,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from<SupabaseBotUser>("bot_users")
      .upsert(payload, { onConflict: "telegram_id", returning: "representation" })
      .select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Supabase did not return the upserted bot user");
    return mapUser(data[0]);
  } catch (err) {
    // Log error but don't crash - return fallback user so bot continues working
    const { logger } = await import("./logger");
    logger.warn({ err, userId: user.id }, "Supabase upsert failed, using fallback user");
    return fallbackUser;
  }
}

export async function getUser(telegramId: string): Promise<BotUser | undefined> {
  if (!isSupabaseConfigured()) {
    return undefined;
  }

  try {
    const supabase = ensureClient();
    const { data, error } = await supabase
      .from<SupabaseBotUser>("bot_users")
      .select("*")
      .eq("telegram_id", telegramId)
      .limit(1);
    if (error) throw error;
    return data && data[0] ? mapUser(data[0]) : undefined;
  } catch (err) {
    const { logger } = await import("./logger");
    logger.warn({ err, telegramId }, "Supabase getUser failed");
    return undefined;
  }
}

export async function banUser(telegramId: string, reason: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const supabase = ensureClient();
    const { data, error } = await supabase
      .from("bot_users")
      .update({ is_banned: true, banned_reason: reason, banned_at: new Date().toISOString() })
      .eq("telegram_id", telegramId)
      .select("telegram_id");
    if (error) throw error;
    return Boolean(data && data.length > 0);
  } catch (err) {
    const { logger } = await import("./logger");
    logger.warn({ err, telegramId }, "Supabase banUser failed");
    return false;
  }
}

export async function unbanUser(telegramId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const supabase = ensureClient();
    const { data, error } = await supabase
      .from("bot_users")
      .update({ is_banned: false, banned_reason: null, banned_at: null })
      .eq("telegram_id", telegramId)
      .select("telegram_id");
    if (error) throw error;
    return Boolean(data && data.length > 0);
  } catch (err) {
    const { logger } = await import("./logger");
    logger.warn({ err, telegramId }, "Supabase unbanUser failed");
    return false;
  }
}

export async function listUsers(
  page: number,
  limit: number,
): Promise<{ users: BotUser[]; total: number; banned: number }> {
  if (!isSupabaseConfigured()) {
    return { users: [], total: 0, banned: 0 };
  }

  try {
    const supabase = ensureClient();
    const offset = (page - 1) * limit;
    const [{ data: rows, error: rowsErr }, { data: all, error: allErr }] = await Promise.all([
      supabase.from<SupabaseBotUser>("bot_users").select("*").order("last_seen", { ascending: false }).range(offset, offset + limit - 1),
      supabase.from<Pick<SupabaseBotUser, "is_banned">>("bot_users").select("is_banned"),
    ]);
    if (rowsErr) throw rowsErr;
    if (allErr) throw allErr;
    return {
      users: (rows || []).map(mapUser),
      total: (all || []).length,
      banned: (all || []).filter((u) => u.is_banned).length,
    };
  } catch (err) {
    const { logger } = await import("./logger");
    logger.warn({ err }, "Supabase listUsers failed");
    return { users: [], total: 0, banned: 0 };
  }
}

export async function checkBannedStore(
  telegramId: string | number,
): Promise<{ banned: boolean; reason?: string }> {
  if (!isSupabaseConfigured()) {
    return { banned: false };
  }

  try {
    const user = await getUser(String(telegramId));
    return user?.isBanned
      ? { banned: true, reason: user.bannedReason ?? undefined }
      : { banned: false };
  } catch (err) {
    const { logger } = await import("./logger");
    logger.warn({ err, telegramId }, "Supabase checkBannedStore failed");
    return { banned: false };
  }
}

export async function getStats(): Promise<{ total: number; banned: number; active: number }> {
  if (!isSupabaseConfigured()) {
    return { total: 0, banned: 0, active: 0 };
  }

  try {
    const supabase = ensureClient();
    const { data, error } = await supabase.from<Pick<SupabaseBotUser, "is_banned">>("bot_users").select("is_banned");
    if (error) throw error;
    const all = data || [];
    const banned = all.filter((user) => user.is_banned).length;
    return { total: all.length, banned, active: all.length - banned };
  } catch (err) {
    const { logger } = await import("./logger");
    logger.warn({ err }, "Supabase getStats failed");
    return { total: 0, banned: 0, active: 0 };
  }
}

export async function getAllUsers(): Promise<BotUser[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = ensureClient();
    const { data, error } = await supabase.from<SupabaseBotUser>("bot_users").select("*").order("last_seen", { ascending: false });
    if (error) throw error;
    return (data || []).map(mapUser);
  } catch (err) {
    const { logger } = await import("./logger");
    logger.warn({ err }, "Supabase getAllUsers failed");
    return [];
  }
}
