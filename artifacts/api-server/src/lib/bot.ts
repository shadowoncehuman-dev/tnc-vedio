import { Telegraf } from "telegraf";
import { logger } from "./logger";
import {
  upsertUser,
  checkBannedStore,
  banUser,
  unbanUser,
  getAllUsers,
  getStats,
} from "./user-store";
import { getRandomSfwImage } from "./waifu";
import { isAdmin } from "./admin";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN;

export let bot: Telegraf | null = null;

async function sendWelcomeMessage(ctx: any, user: { id: number; first_name: string; username?: string }) {
  const imageUrl = await getRandomSfwImage();
  const text = `🏥 *Welcome to TNC Nursing Classes!*

Access all courses, video lectures, quizzes, and e-notes for your nursing exam preparation.`;
  if (imageUrl) {
    await ctx.replyWithPhoto?.(imageUrl, { caption: text, parse_mode: "Markdown" });
    return;
  }
  await ctx.reply(text, { parse_mode: "Markdown" });
}

export async function upsertBotUser(user: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}): Promise<Record<string, unknown>> {
  return (await upsertUser(user)) as unknown as Record<string, unknown>;
}

export async function checkBanned(
  telegramId: number,
): Promise<{ banned: boolean; reason?: string }> {
  return checkBannedStore(telegramId);
}

export function initBot(): Telegraf | null {
  if (!BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
    return null;
  }

  const tgBot = new Telegraf(BOT_TOKEN);
  bot = tgBot;

  const appUrl = process.env.RENDER_URL ?? "";
  const pendingBroadcasts = new Set<number>();

  // /start — welcome + open mini app button
  tgBot.start(async (ctx) => {
    const user = ctx.from;
    if (user) await upsertUser(user);

    const banStatus = user ? await checkBannedStore(user.id) : { banned: false };
    if (banStatus.banned) {
      await ctx.reply("🚫 You are blocked and cannot access this platform.");
      return;
    }

    const replyOpts: Record<string, unknown> = { parse_mode: "Markdown" };

    if (appUrl) {
      const keyboard: { text: string; web_app: { url: string } }[][] = [[
        { text: "📚 Open TNC Nursing App", web_app: { url: appUrl } },
      ]];
      if (isAdmin(user?.id)) {
        keyboard.push([
          { text: "🛡️ Admin Panel", web_app: { url: `${appUrl}/admin` } },
        ]);
      }
      replyOpts.reply_markup = { inline_keyboard: keyboard };
    }

    await ctx.reply(
      `🏥 *Welcome to TNC Nursing Classes!*\n\nAccess all courses, video lectures, quizzes, and e-notes for your nursing exam preparation.\n\n${appUrl ? "Tap the button below to open the app 👇" : "Visit the app to start studying."}`,
      replyOpts as Parameters<typeof ctx.reply>[1],
    );
  });

  // /admin — open admin panel (admin only)
  tgBot.command("admin", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) { await ctx.reply("❌ Admin only"); return; }
    if (!appUrl) { await ctx.reply("❌ RENDER_URL not set"); return; }
    await ctx.reply("🛡️ *Admin Panel*", {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "🛡️ Open Admin Panel", web_app: { url: `${appUrl}/admin` } },
        ]],
      },
    } as Parameters<typeof ctx.reply>[1]);
  });

  // /help
  tgBot.help(async (ctx) => {
    const admin = isAdmin(ctx.from?.id);
    const adminCmds = admin
       ? "\n\n*Admin Commands:*\n/stats — View user stats\n/users — List recent users\n/ban \\<id\\> \\[reason\\] — Ban a user\n/unban \\<id\\> — Unban a user\n/banned — List banned users\n/leaderboard — Study leaderboard\n/broadcast — Broadcast a message"
      : "";
    await ctx.reply(
      `*TNC Nursing Classes Bot*\n\n/start — Open the app${adminCmds}`,
      { parse_mode: "Markdown" },
    );
  });

  // /stats (admin)
  tgBot.command("stats", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) { await ctx.reply("❌ Admin only"); return; }
    const { total, banned, active } = await getStats();
    await ctx.reply(
      `📊 *Bot Stats*\n\n👥 Total users: ${total}\n✅ Active: ${active}\n🚫 Banned: ${banned}`,
      { parse_mode: "Markdown" },
    );
  });

  tgBot.command("user", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) { await ctx.reply("❌ Admin only"); return; }
    const targetId = ctx.message.text.split(" ")[1];
    if (!targetId) { await ctx.reply("Usage: /user <telegram_id>"); return; }
    const user = await (await import("./user-store")).getUser(targetId);
    if (!user) { await ctx.reply("User not found."); return; }
    const details = [
      `Telegram ID: ${user.telegramId}`,
      `Name: ${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`,
      `Username: ${user.username ?? "—"}`,
      `Banned: ${user.isBanned ? "Yes" : "No"}`,
      `Reason: ${user.bannedReason ?? "—"}`,
      `Study Time: ${Math.round(user.totalStudySeconds / 60)} min`,
    ].join("\n");
    await ctx.reply(`🧾 *User Details*\n\n${details}`, { parse_mode: "Markdown" });
  });

  // /users (admin)
  tgBot.command("users", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) { await ctx.reply("❌ Admin only"); return; }
    const users = (await getAllUsers()).slice(0, 15);
    if (!users.length) { await ctx.reply("No users yet"); return; }
    const list = users.map((u) =>
      `• ${u.firstName}${u.lastName ? " " + u.lastName : ""} (@${u.username ?? "—"}) — \`${u.telegramId}\`${u.isBanned ? " 🚫" : ""}`,
    ).join("\n");
    await ctx.reply(`👥 *Recent Users:*\n\n${list}`, { parse_mode: "Markdown" });
  });

  // /ban <id> [reason] (admin)
  tgBot.command("ban", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) { await ctx.reply("❌ Admin only"); return; }
    const parts = ctx.message.text.split(" ").slice(1);
    const targetId = parts[0];
    const reason = parts.slice(1).join(" ") || "Banned by admin";
    if (!targetId) { await ctx.reply("Usage: /ban <telegram_id> [reason]"); return; }
    const ok = await banUser(targetId, reason);
    if (ok) {
      await ctx.reply(`✅ User \`${targetId}\` banned.\nReason: ${reason}`, { parse_mode: "Markdown" });
    } else {
      await ctx.reply(`⚠️ User \`${targetId}\` not found in store. They must open the app first.`, { parse_mode: "Markdown" });
    }
  });

  // /unban <id> (admin)
  tgBot.command("unban", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) { await ctx.reply("❌ Admin only"); return; }
    const targetId = ctx.message.text.split(" ")[1];
    if (!targetId) { await ctx.reply("Usage: /unban <telegram_id>"); return; }
    const ok = await unbanUser(targetId);
    if (ok) {
      await ctx.reply(`✅ User \`${targetId}\` unbanned.`, { parse_mode: "Markdown" });
    } else {
      await ctx.reply(`⚠️ User \`${targetId}\` not found in store.`, { parse_mode: "Markdown" });
    }
  });

  // /banned (admin)
  tgBot.command("banned", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) { await ctx.reply("❌ Admin only"); return; }
    const banned = (await getAllUsers()).filter((u) => u.isBanned);
    if (!banned.length) { await ctx.reply("No banned users"); return; }
    const text = banned.map((u) =>
      `• ${u.firstName} (@${u.username ?? "—"}) — \`${u.telegramId}\`\n  Reason: ${u.bannedReason ?? "none"}`,
    ).join("\n\n");
    await ctx.reply(`🚫 *Banned Users:*\n\n${text}`, { parse_mode: "Markdown" });
  });

  tgBot.command("leaderboard", async (ctx) => {
    const { getLeaderboard } = await import("./study-store");
    try {
      const rows = await getLeaderboard(10);
      if (!rows.length) { await ctx.reply("No study activity recorded yet."); return; }
      const text = rows.map((row, index) =>
        `${index + 1}. ${row.firstName}${row.username ? ` (@${row.username})` : ""} — ${Math.round(row.seconds / 60)} min (${row.sessions} sessions)`,
      ).join("\n");
      await ctx.reply(`🏆 *Study Leaderboard*\n\n${text}`, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply("Leaderboard is unavailable until the Supabase study tables are created.");
    }
  });

  // Copy the admin's next message to all active users. This preserves text,
  // images, videos, stickers, and emoji without storing media in the database.
  tgBot.command("broadcast", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) { await ctx.reply("❌ Admin only"); return; }
    pendingBroadcasts.add(ctx.from!.id);
    await ctx.reply("📣 Send the message to broadcast now. Text, image, video, sticker, and emoji are supported.\n\nSend /cancel to stop.");
  });

  tgBot.command("cancel", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    if (pendingBroadcasts.delete(ctx.from.id)) await ctx.reply("Broadcast cancelled.");
  });

  tgBot.on("message", async (ctx) => {
    const adminId = ctx.from?.id;
    if (!adminId || !isAdmin(adminId) || !pendingBroadcasts.has(adminId)) return;
    if ("text" in ctx.message && ctx.message.text === "/cancel") {
      pendingBroadcasts.delete(adminId);
      await ctx.reply("Broadcast cancelled.");
      return;
    }
    pendingBroadcasts.delete(adminId);
    const users = await getAllUsers();
    const recipients = users.filter((user) => !user.isBanned && user.telegramId !== String(adminId));
    let delivered = 0;
    let failed = 0;
    const batchSize = 10;
    for (let index = 0; index < recipients.length; index += batchSize) {
      const batch = recipients.slice(index, index + batchSize);
      for (const recipient of batch) {
        try {
          await tgBot.telegram.copyMessage(recipient.telegramId, ctx.chat.id, ctx.message.message_id);
          delivered += 1;
        } catch {
          failed += 1;
        }
      }
      if (index + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    await ctx.reply(`📣 Broadcast complete.\n✅ Delivered: ${delivered}\n⚠️ Failed: ${failed}`);
  });

  logger.info("Telegram bot initialized (Supabase user store)");
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
