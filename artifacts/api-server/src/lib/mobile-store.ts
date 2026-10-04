import { supabaseRequest } from "./supabase-rest";

export interface MobileUser {
  install_id: string;
  display_name: string;
  platform: string;
  app_version: string | null;
  first_seen: string;
  last_seen: string;
  is_blocked: boolean;
  blocked_reason: string | null;
}

const INSTALL_ID_PATTERN = /^[a-zA-Z0-9_:.\-]{6,100}$/;

export function isValidInstallId(value: unknown): value is string {
  return typeof value === "string" && INSTALL_ID_PATTERN.test(value);
}

export async function findMobileUser(installId: string): Promise<MobileUser | null> {
  const rows = await supabaseRequest<MobileUser[]>(
    `mobile_app_users?select=*&install_id=eq.${encodeURIComponent(installId)}&limit=1`,
  );
  return rows[0] ?? null;
}

export async function registerMobileOpen(input: {
  installId: string;
  platform: string;
  appVersion?: string;
}): Promise<{ user: MobileUser; blocked: boolean }> {
  const current = await findMobileUser(input.installId);
  if (current?.is_blocked) return { user: current, blocked: true };

  const rows = await supabaseRequest<MobileUser[]>(
    "mobile_app_users?on_conflict=install_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        install_id: input.installId,
        platform: input.platform.slice(0, 24),
        app_version: input.appVersion?.slice(0, 32) ?? null,
        last_seen: new Date().toISOString(),
      }),
    },
  );
  const user = rows[0];
  if (!user) throw new Error("Mobile user record was not returned by Supabase");

  await supabaseRequest("mobile_app_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ install_id: input.installId, event_type: "open" }),
  });
  return { user, blocked: false };
}

export async function setMobileUserName(installId: string, name: string, platform = "unknown"): Promise<MobileUser | null> {
  const rows = await supabaseRequest<MobileUser[]>(
    "mobile_app_users?on_conflict=install_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        install_id: installId,
        display_name: name.slice(0, 48),
        platform: platform.slice(0, 24),
        last_seen: new Date().toISOString(),
      }),
    },
  );
  return rows[0] ?? null;
}

export async function recordMobileProgress(input: {
  installId: string;
  sessionId: string;
}): Promise<void> {
  const existing = await supabaseRequest<Array<{ id: number }>>(
    `mobile_app_events?select=id&install_id=eq.${encodeURIComponent(input.installId)}&event_type=eq.lesson_complete&session_id=eq.${encodeURIComponent(input.sessionId)}&limit=1`,
  );
  if (existing.length) return;

  await supabaseRequest("mobile_app_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      install_id: input.installId,
      event_type: "lesson_complete",
      session_id: input.sessionId.slice(0, 200),
    }),
  });
}

export async function getMobileStats(): Promise<{
  installs: number;
  opensToday: number;
  opensWeek: number;
  opensTotal: number;
  activeToday: number;
  lessonsCompleted: number;
}> {
  return supabaseRequest("rpc/tnc_mobile_admin_stats", { method: "POST", body: "{}" });
}

export async function listMobileUsers(limit = 100): Promise<MobileUser[]> {
  return supabaseRequest(
    `mobile_app_users?select=*&order=last_seen.desc&limit=${Math.min(Math.max(limit, 1), 500)}`,
  );
}

export async function setMobileUserBlocked(
  installId: string,
  blocked: boolean,
  reason?: string,
): Promise<boolean> {
  const rows = await supabaseRequest<Array<{ install_id: string }>>(
    `mobile_app_users?install_id=eq.${encodeURIComponent(installId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        is_blocked: blocked,
        blocked_reason: blocked ? (reason?.slice(0, 240) ?? "Blocked by admin") : null,
        blocked_at: blocked ? new Date().toISOString() : null,
      }),
    },
  );
  return rows.length > 0;
}