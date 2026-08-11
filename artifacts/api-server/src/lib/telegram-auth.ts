import { createHash, createHmac } from "node:crypto";

export interface TelegramUserPayload {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramAuthResult {
  user: TelegramUserPayload;
  raw: string;
}

export function verifyTelegramInitData(initData: string | undefined, botToken: string | undefined): TelegramAuthResult | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  const entries = Array.from(params.entries()).filter(([key]) => key !== "hash");
  const dataCheckString = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computed !== hash) return null;

  const authDate = Number(params.get("auth_date") ?? "0");
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  if (Date.now() / 1000 - authDate > 24 * 60 * 60) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;

  let user: TelegramUserPayload;
  try {
    user = JSON.parse(userRaw) as TelegramUserPayload;
  } catch {
    return null;
  }

  if (!user?.id) return null;

  return {
    user: {
      id: Number(user.id),
      first_name: user.first_name ?? "",
      last_name: user.last_name,
      username: user.username,
      language_code: user.language_code,
    },
    raw: initData,
  };
}
