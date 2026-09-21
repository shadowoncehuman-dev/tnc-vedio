export function isAdmin(telegramUserId?: number | string): boolean {
  if (!telegramUserId) return false;
  const configuredIds = [
    process.env.ADMIN_CHAT_ID,
    process.env.ADMIN_TELEGRAM_ID,
    process.env.TELEGRAM_ADMIN_ID,
  ]
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  return configuredIds.includes(String(telegramUserId));
}
