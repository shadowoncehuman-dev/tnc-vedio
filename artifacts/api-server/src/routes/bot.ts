import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { bot, upsertBotUser, checkBanned } from "../lib/bot";

const router = Router();

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "admin_tnc_2024_secure_token";

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

async function getDb() {
  try {
    const { db, botUsersTable } = await import("@workspace/db");
    const { eq, desc } = await import("drizzle-orm");
    return { db, botUsersTable, eq, desc };
  } catch {
    return null;
  }
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
    const banStatus = await checkBanned(telegramId);
    res.json({
      success: true,
      banned: banStatus.banned,
      reason: banStatus.reason,
      telegramId: String(telegramId),
      user: user ? { ...user, telegramId: String((user as Record<string, unknown>).telegramId) } : null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to register bot user");
    res.status(500).json({ error: "Registration failed" });
  }
});

// GET /api/bot/check-ban/:telegramId — Public ban check
router.get("/check-ban/:telegramId", async (req: Request, res: Response): Promise<void> => {
  try {
    const telegramId = parseInt(req.params.telegramId);
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

// GET /api/bot/users — List bot users (admin)
router.get("/users", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const ctx = await getDb();
  if (!ctx) { res.status(503).json({ error: "Database not available" }); return; }
  const { db, botUsersTable, desc } = ctx;
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const [users, allUsers] = await Promise.all([
      db.select().from(botUsersTable).orderBy(desc(botUsersTable.firstSeen)).limit(limit).offset((page - 1) * limit),
      db.select().from(botUsersTable),
    ]);
    res.json({
      users: users.map((u) => ({ ...u, telegramId: String(u.telegramId) })),
      total: allUsers.length,
      banned: allUsers.filter((u) => u.isBanned).length,
      page,
      limit,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch bot users");
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET /api/bot/stats — Bot stats (admin)
router.get("/stats", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const ctx = await getDb();
  if (!ctx) { res.json({ total: 0, banned: 0, active: 0 }); return; }
  const { db, botUsersTable } = ctx;
  try {
    const users = await db.select().from(botUsersTable);
    const total = users.length;
    const banned = users.filter((u) => u.isBanned).length;
    res.json({ total, banned, active: total - banned });
  } catch {
    res.json({ total: 0, banned: 0, active: 0 });
  }
});

// POST /api/bot/users/:telegramId/ban (admin)
router.post("/users/:telegramId/ban", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const ctx = await getDb();
  if (!ctx) { res.status(503).json({ error: "Database not available" }); return; }
  const { db, botUsersTable, eq } = ctx;
  try {
    const { reason } = req.body as { reason?: string };
    const telegramId = BigInt(req.params.telegramId);
    await db.update(botUsersTable)
      .set({ isBanned: true, bannedAt: new Date(), bannedReason: reason ?? "Banned by admin" })
      .where(eq(botUsersTable.telegramId, telegramId));
    res.json({ success: true, message: "User banned" });
  } catch (err) {
    logger.error({ err }, "Failed to ban user");
    res.status(500).json({ error: "Failed to ban user" });
  }
});

// POST /api/bot/users/:telegramId/unban (admin)
router.post("/users/:telegramId/unban", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const ctx = await getDb();
  if (!ctx) { res.status(503).json({ error: "Database not available" }); return; }
  const { db, botUsersTable, eq } = ctx;
  try {
    const telegramId = BigInt(req.params.telegramId);
    await db.update(botUsersTable)
      .set({ isBanned: false, bannedAt: null, bannedReason: null })
      .where(eq(botUsersTable.telegramId, telegramId));
    res.json({ success: true, message: "User unbanned" });
  } catch (err) {
    logger.error({ err }, "Failed to unban user");
    res.status(500).json({ error: "Failed to unban user" });
  }
});

export default router;
