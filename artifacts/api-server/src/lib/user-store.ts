/**
 * In-memory bot user store.
 * Users are registered when they open the Telegram Mini App or /start the bot.
 * Data lives in process memory — fast, zero DB dependency, resets on restart.
 */

export interface BotUser {
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  isBanned: boolean;
  bannedReason: string | null;
  bannedAt: string | null;
  firstSeen: string;
  lastSeen: string;
}

const store = new Map<string, BotUser>();

export function upsertUser(user: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}): BotUser {
  const key = String(user.id);
  const now = new Date().toISOString();
  const existing = store.get(key);
  if (existing) {
    const updated: BotUser = {
      ...existing,
      firstName: user.first_name,
      lastName: user.last_name ?? null,
      username: user.username ?? null,
      lastSeen: now,
    };
    store.set(key, updated);
    return updated;
  }
  const newUser: BotUser = {
    telegramId: key,
    firstName: user.first_name,
    lastName: user.last_name ?? null,
    username: user.username ?? null,
    isBanned: false,
    bannedReason: null,
    bannedAt: null,
    firstSeen: now,
    lastSeen: now,
  };
  store.set(key, newUser);
  return newUser;
}

export function getUser(telegramId: string): BotUser | undefined {
  return store.get(String(telegramId));
}

export function banUser(telegramId: string, reason: string): boolean {
  const user = store.get(String(telegramId));
  if (!user) return false;
  store.set(String(telegramId), {
    ...user,
    isBanned: true,
    bannedReason: reason,
    bannedAt: new Date().toISOString(),
  });
  return true;
}

export function unbanUser(telegramId: string): boolean {
  const user = store.get(String(telegramId));
  if (!user) return false;
  store.set(String(telegramId), {
    ...user,
    isBanned: false,
    bannedReason: null,
    bannedAt: null,
  });
  return true;
}

export function listUsers(
  page: number,
  limit: number,
): { users: BotUser[]; total: number; banned: number } {
  const all = Array.from(store.values()).sort((a, b) =>
    b.firstSeen.localeCompare(a.firstSeen),
  );
  const total = all.length;
  const banned = all.filter((u) => u.isBanned).length;
  const start = (page - 1) * limit;
  return { users: all.slice(start, start + limit), total, banned };
}

export function checkBannedStore(telegramId: string | number): { banned: boolean; reason?: string } {
  const user = store.get(String(telegramId));
  if (!user) return { banned: false };
  return { banned: user.isBanned, reason: user.bannedReason ?? undefined };
}

export function getStats(): { total: number; banned: number; active: number } {
  const all = Array.from(store.values());
  const banned = all.filter((u) => u.isBanned).length;
  return { total: all.length, banned, active: all.length - banned };
}

export function getAllUsers(): BotUser[] {
  return Array.from(store.values()).sort((a, b) =>
    b.firstSeen.localeCompare(a.firstSeen),
  );
}
