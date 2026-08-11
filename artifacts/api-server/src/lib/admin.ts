export function isAdmin(telegramUserId?: number | string): boolean {
  const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
  if (!ADMIN_CHAT_ID || !telegramUserId) return false;
  return String(telegramUserId) === String(ADMIN_CHAT_ID);
}
