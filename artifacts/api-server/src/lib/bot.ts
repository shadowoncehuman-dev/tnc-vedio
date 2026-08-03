import { Telegraf } from "telegraf";
import { logger } from "./logger";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

export let bot: Telegraf | null = null;

function isAdmin(chatId: number | undefined): boolean {
  if (!ADMIN_CHAT_ID || !chatId) return false;
  return String(chatId) === String(ADMIN_CHAT_ID);
}

// Lazy DB helper — avoids crashing if DATABASE_URL isn't set
async function getDb() {
  try {
    const { db, botUsersTable } = await import("@workspace/db");
    const { eq, desc } = await import("drizzle-orm");
    return { db, botUsersTable, eq, desc };
  } catch {
    return null;
  }
}

export async function upsertBotUser(user: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}): Promise<Record<string, unknown> | null> {
  const ctx = await getDb();
  if (!ctx) return null;
  const { db, botUsersTable, eq } = ctx;
  try {
    const existing = await db
      .select()
      .from(botUsersTable)
      .where(eq(botUsersTable.telegramId, BigInt(user.id)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(botUsersTable)
        .set({
          username: user.username ?? null,
          firstName: user.first_name,
          lastName: user.last_name ?? null,
          lastSeen: new Date(),
        })
        .where(eq(botUsersTable.telegramId, BigInt(user.id)));
      return existing[0] as Record<string, unknown>;
    } else {
      const [newUser] = await db
        .insert(botUsersTable)
        .values({
          telegramId: BigInt(user.id),
          username: user.username ?? null,
          firstName: user.first_name,
          lastName: user.last_name ?? null,
        })
        .returning();
      return newUser as Record<string, unknown>;
    }
  } catch (err) {
    logger.error({ err }, "Failed to upsert bot user");
    return null;
  }
}

export async function checkBanned(telegramId: number): Promise<{ banned: boolean; reason?: string }> {
  const ctx = await getDb();
  if (!ctx) return { banned: false };
  const { db, botUsersTable, eq } = ctx;
  try {
    const users = await db
      .select()
      .from(botUsersTable)
      .where(eq(botUsersTable.telegramId, BigInt(telegramId)))
      .limit(1);
    if (users.length === 0) return { banned: false };
    const u = users[0];
    return { banned: u.isBanned, reason: u.bannedReason ?? undefined };
  } catch {
    return { banned: false };
  }
}

export function initBot(): Telegraf | null {
  if (!BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
    return null;
  }

  const tgBot = new Telegraf(BOT_TOKEN);
  bot = tgBot;

  const appUrl = process.env.RENDER_URL ?? "";

  // /start — welcome + open mini app button
  tgBot.start(async (ctx) => {
    const user = ctx.from;
    if (user) {
      await upsertBotUser(user);
    }

    const banStatus = user ? await checkBanned(user.id) : { banned: false };
    if (banStatus.banned) {
      await ctx.reply("🚫 You are blocked and cannot access this platform.");
      return;
    }

    const replyOpts: Record<string, unknown> = {
      parse_mode: "Markdown",
    };

    if (appUrl) {
      replyOpts.reply_markup = {
        inline_keyboard: [[
          { text: "📚 Open TNC Nursing App", web_app: { url: appUrl } },
        ]],
      };
    }

    await ctx.reply(
      `🏥 *Welcome to TNC Nursing Classes!*\n\nAccess all courses, video lectures, quizzes, and e-notes for your nursing exam preparation.\n\n${appUrl ? "Tap the button below to open the app 👇" : "Visit the app to start studying."}`,
      replyOpts as Parameters<typeof ctx.reply>[1],
    );
  });

  // /help
  tgBot.help(async (ctx) => {
    const admin = isAdmin(ctx.from?.id);
    const adminCmds = admin
      ? "\n\n*Admin Commands:*\n/stats — View user stats\n/users — List recent users\n/ban \\<id\\> \\[reason\\] — Ban a user\n/unban \\<id\\> — Unban a user\n/banned — List banned users"
      : "";
    await ctx.reply(
      `*TNC Nursing Classes Bot*\n\n/start — Open the app${adminCmds}`,
      { parse_mode: "Markdown" },
    );
  });

  // /stats (admin)
  tgBot.command("stats", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) { await ctx.reply("❌ Admin only"); return; }
    const dbCtx = await getDb();
    if (!dbCtx) { await ctx.reply("❌ Database not available"); return; }
    const { db, botUsersTable } = dbCtx;
    try {
      const users = await db.select().from(botUsersTable);
      const total = users.length;
      const banned = users.filter((u) => u.isBanned).length;
      await ctx.reply(
        `📊 *Bot Stats*\n\n👥 Total users: ${total}\n✅ Active: ${total - banned}\n🚫 Banned: ${banned}`,
        { parse_mode: "Markdown" },
      );
    } catch { await ctx.reply("❌ Failed to fetch stats"); }
  });

  // /users (admin)
  tgBot.command("users", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) { await ctx.reply("❌ Admin only"); return; }
    const dbCtx = await getDb();
    if (!dbCtx) { await ctx.reply("❌ Database not available"); return; }
    const { db, botUsersTable, desc } = dbCtx;
    try {
      const users = await db
        .select()
        .from(botUsersTable)
        .orderBy(desc(botUsersTable.firstSeen))
        .limit(15);
      if (!users.length) { await ctx.reply("No users yet"); return; }
      const list = users.map((u) =>
        `• ${u.firstName}${u.lastName ? " " + u.lastName : ""} (@${u.username ?? "—"}) — \`${u.telegramId}\`${u.isBanned ? " 🚫" : ""}`,
      ).join("\n");
      await ctx.reply(`👥 *Recent Users:*\n\n${list}`, { parse_mode: "Markdown" });
    } catch { await ctx.reply("❌ Failed to fetch users"); }
  });

  // /ban <id> [reason] (admin)
  tgBot.command("ban", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) { await ctx.reply("❌ Admin only"); return; }
    const parts = ctx.message.text.split(" ").slice(1);
    const targetId = parts[0];
    const reason = parts.slice(1).join(" ") || "Banned by admin";
    if (!targetId) { await ctx.reply("Usage: /ban <telegram_id> [reason]"); return; }
    const dbCtx = await getDb();
    if (!dbCtx) { await ctx.reply("❌ Database not available"); return; }
    const { db, botUsersTable, eq } = dbCtx;
    try {
      await db.update(botUsersTable)
        .set({ isBanned: true, bannedAt: new Date(), bannedReason: reason })
        .where(eq(botUsersTable.telegramId, BigInt(targetId)));
      await ctx.reply(`✅ User \`${targetId}\` banned.\nReason: ${reason}`, { parse_mode: "Markdown" });
    } catch { await ctx.reply("❌ Failed to ban user"); }
  });

  // /unban <id> (admin)
  tgBot.command("unban", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) { await ctx.reply("❌ Admin only"); return; }
    const targetId = ctx.message.text.split(" ")[1];
    if (!targetId) { await ctx.reply("Usage: /unban <telegram_id>"); return; }
    const dbCtx = await getDb();
    if (!dbCtx) { await ctx.reply("❌ Database not available"); return; }
    const { db, botUsersTable, eq } = dbCtx;
    try {
      await db.update(botUsersTable)
        .set({ isBanned: false, bannedAt: null, bannedReason: null })
        .where(eq(botUsersTable.telegramId, BigInt(targetId)));
      await ctx.reply(`✅ User \`${targetId}\` unbanned.`, { parse_mode: "Markdown" });
    } catch { await ctx.reply("❌ Failed to unban"); }
  });

  // /banned (admin)
  tgBot.command("banned", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) { await ctx.reply("❌ Admin only"); return; }
    const dbCtx = await getDb();
    if (!dbCtx) { await ctx.reply("❌ Database not available"); return; }
    const { db, botUsersTable, eq } = dbCtx;
    try {
      const list = await db.select().from(botUsersTable).where(eq(botUsersTable.isBanned, true));
      if (!list.length) { await ctx.reply("No banned users"); return; }
      const text = list.map((u) =>
        `• ${u.firstName} (@${u.username ?? "—"}) — \`${u.telegramId}\`\n  Reason: ${u.bannedReason ?? "none"}`,
      ).join("\n\n");
      await ctx.reply(`🚫 *Banned Users:*\n\n${text}`, { parse_mode: "Markdown" });
    } catch { await ctx.reply("❌ Failed to fetch banned users"); }
  });

  logger.info("Telegram bot initialized");
  return tgBot;
}

export async function setupWebhook(webhookUrl: string): Promise<void> {
  if (!bot) return;
  try {
    await bot.telegram.setWebhook(webhookUrl);
    logger.info({ webhookUrl }, "Telegram webhook configured");
  } catch (err) {
    logger.error({ err }, "Failed to set Telegram webhook");
  }
}
