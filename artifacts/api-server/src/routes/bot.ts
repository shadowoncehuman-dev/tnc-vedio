import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { bot, upsertBotUser, checkBanned } from "../lib/bot";
import {
  listUsers,
  banUser,
  unbanUser,
  checkBannedStore,
  getStats,
} from "../lib/user-store";
import { recordStudyHeartbeat, getLeaderboard } from "../lib/study-store";

const router = Router();

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";

function requireAdmin(req: Request, res: Response): boolean {
  const token =
    (req.headers["x-admin-token"] as string) ??
    (req.query.adminToken as string);
  if (token !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// POST /api/bot/webhook — Telegram sends updates here
router.post("/webhook", async (req: Request, res: Response): Promise<void> => {
  try {
    if (!bot) {
      res.status(503).json({ error: "Bot not initialized" });
      return;
    }
    await bot.handleUpdate(req.body);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Bot webhook error");
    res.status(500).json({ error: "Webhook error" });
  }
});

// POST /api/bot/register — Mini app registers user on open
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { telegramId, firstName, lastName, username } = req.body as {
      telegramId: number;
      firstName: string;
      lastName?: string;
      username?: string;
    };
    if (!telegramId) {
      res.status(400).json({ error: "telegramId required" });
      return;
    }
    const user = await upsertBotUser({
      id: telegramId,
      first_name: firstName ?? "",
      last_name: lastName,
      username,
    });
    const banStatus = await checkBannedStore(telegramId);
    res.json({
      success: true,
      banned: banStatus.banned,
      reason: banStatus.reason,
      telegramId: String(telegramId),
      user,
    });
  } catch (err) {
    logger.error({ err }, "Failed to register bot user");
    res.status(500).json({ error: "Registration failed" });
  }
});

// GET /api/bot/check-ban/:telegramId — Public ban check
router.get("/check-ban/:telegramId", async (req: Request, res: Response): Promise<void> => {
  try {
    const telegramId = parseInt(String(req.params.telegramId));
    if (isNaN(telegramId)) {
      res.status(400).json({ error: "Invalid telegramId" });
      return;
    }
    const status = await checkBanned(telegramId);
    res.json(status);
  } catch (err) {
    logger.error({ err }, "Ban check failed");
    res.status(500).json({ error: "Check failed" });
  }
});

// GET /api/bot/users — List bot users (admin) — served from Supabase
router.get("/users", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const { users, total, banned } = await listUsers(page, limit);
    res.json({ users, total, banned, page, limit });
  } catch (err) {
    logger.error({ err }, "Failed to list bot users");
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET /api/bot/stats — Bot stats (admin)
router.get("/stats", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  res.json(await getStats());
});

// POST /api/bot/users/:telegramId/ban (admin)
router.post("/users/:telegramId/ban", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const { reason } = req.body as { reason?: string };
    const ok = await banUser(
      String(req.params.telegramId),
      reason ?? "Banned by admin",
    );
    if (ok) {
      res.json({ success: true, message: "User banned" });
    } else {
      res.status(404).json({ error: "User not found — they must open the app first" });
    }
  } catch (err) {
    logger.error({ err }, "Failed to ban user");
    res.status(500).json({ error: "Failed to ban user" });
  }
});

// POST /api/bot/users/:telegramId/unban (admin)
router.post("/users/:telegramId/unban", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const ok = await unbanUser(String(req.params.telegramId));
    if (ok) {
      res.json({ success: true, message: "User unbanned" });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (err) {
    logger.error({ err }, "Failed to unban user");
    res.status(500).json({ error: "Failed to unban user" });
  }
});

router.post("/study/heartbeat", async (req: Request, res: Response): Promise<void> => {
  try {
    const { telegramId, sessionId, seconds } = req.body as {
      telegramId?: number;
      sessionId?: string;
      seconds?: number;
    };
    if (!telegramId || !sessionId || !Number.isFinite(seconds)) {
      res.status(400).json({ error: "telegramId, sessionId, and seconds are required" });
      return;
    }
    await recordStudyHeartbeat({ telegramId, sessionId, seconds: seconds! });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to record study time");
    res.status(500).json({ error: "Failed to record study time" });
  }
});

router.get("/study/leaderboard", async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await getLeaderboard());
  } catch (err) {
    logger.error({ err }, "Failed to fetch study leaderboard");
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

export default router;
