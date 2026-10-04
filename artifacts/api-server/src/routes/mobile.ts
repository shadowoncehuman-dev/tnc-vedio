import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import {
  findMobileUser,
  getMobileStats,
  isValidInstallId,
  listMobileUsers,
  recordMobileProgress,
  registerMobileOpen,
  setMobileUserBlocked,
  setMobileUserName,
} from "../lib/mobile-store";

const router = Router();
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";

function requireAdmin(req: Request, res: Response): boolean {
  const token = req.header("x-admin-token");
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function sendError(res: Response, error: unknown, message: string): void {
  logger.error({ err: error }, message);
  res.status(500).json({ error: message, setup: "Apply docs/mobile-app-supabase.sql in Supabase SQL Editor." });
}

router.post("/open", async (req: Request, res: Response): Promise<void> => {
  const { installId, platform, appVersion } = req.body as {
    installId?: unknown;
    platform?: unknown;
    appVersion?: unknown;
  };
  if (!isValidInstallId(installId) || typeof platform !== "string") {
    res.status(400).json({ error: "A valid installId and platform are required" });
    return;
  }
  try {
    const result = await registerMobileOpen({
      installId,
      platform,
      appVersion: typeof appVersion === "string" ? appVersion : undefined,
    });
    res.json({ blocked: result.blocked, reason: result.user.blocked_reason });
  } catch (error) {
    sendError(res, error, "Could not record mobile app open");
  }
});

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const { installId, name, platform } = req.body as {
    installId?: unknown;
    name?: unknown;
    platform?: unknown;
  };
  if (!isValidInstallId(installId) || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "A valid installId and name are required" });
    return;
  }
  try {
    const user = await setMobileUserName(installId, name.trim(), typeof platform === "string" ? platform : "unknown");
    if (!user) {
      res.status(404).json({ error: "Mobile user not found; open the app first" });
      return;
    }
    res.json({ success: true, name: user.display_name, platform: user.platform || platform });
  } catch (error) {
    sendError(res, error, "Could not save mobile profile");
  }
});

router.post("/progress", async (req: Request, res: Response): Promise<void> => {
  const { installId, sessionId, completed } = req.body as {
    installId?: unknown;
    sessionId?: unknown;
    completed?: unknown;
  };
  if (!isValidInstallId(installId) || typeof sessionId !== "string" || !sessionId.trim() || completed !== true) {
    res.status(400).json({ error: "A valid installId, sessionId and completed=true are required" });
    return;
  }
  try {
    const user = await findMobileUser(installId);
    if (!user || user.is_blocked) {
      res.status(user?.is_blocked ? 403 : 404).json({ error: user?.blocked_reason ?? "Mobile user not found" });
      return;
    }
    await recordMobileProgress({ installId, sessionId });
    res.json({ success: true });
  } catch (error) {
    sendError(res, error, "Could not save mobile progress");
  }
});

router.get("/admin/stats", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    res.json(await getMobileStats());
  } catch (error) {
    sendError(res, error, "Could not load mobile analytics");
  }
});

router.get("/admin/users", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const users = await listMobileUsers(Number(req.query.limit) || 100);
    res.json({ users: users.map((user) => ({
      id: user.install_id,
      name: user.display_name,
      platform: user.platform,
      appVersion: user.app_version,
      firstSeen: user.first_seen,
      lastSeen: user.last_seen,
      isBlocked: user.is_blocked,
      blockedReason: user.blocked_reason,
    })) });
  } catch (error) {
    sendError(res, error, "Could not load mobile users");
  }
});

router.post("/admin/users/:installId/block", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  if (!isValidInstallId(req.params.installId)) {
    res.status(400).json({ error: "Invalid install ID" });
    return;
  }
  try {
    const { reason } = req.body as { reason?: string };
    const updated = await setMobileUserBlocked(req.params.installId, true, reason);
    res.status(updated ? 200 : 404).json({ success: updated });
  } catch (error) {
    sendError(res, error, "Could not block mobile user");
  }
});

router.post("/admin/users/:installId/unblock", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  if (!isValidInstallId(req.params.installId)) {
    res.status(400).json({ error: "Invalid install ID" });
    return;
  }
  try {
    const updated = await setMobileUserBlocked(req.params.installId, false);
    res.status(updated ? 200 : 404).json({ success: updated });
  } catch (error) {
    sendError(res, error, "Could not unblock mobile user");
  }
});

export default router;