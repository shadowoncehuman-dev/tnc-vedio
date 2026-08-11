const WAIFU_API_URL = "https://api.waifu.im/images?IsNsfw=False&PageSize=1";

function isValidImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function getRandomSfwImage(): Promise<string | null> {
  try {
    const resp = await fetch(WAIFU_API_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    const payload = (await resp.json()) as { items?: Array<{ url?: unknown }> };
    const url = payload.items?.[0]?.url;
    return isValidImageUrl(url) ? url : null;
  } catch {
    return null;
  }
}
