import { pgTable, serial, bigint, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const botUsersTable = pgTable("bot_users", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "bigint" }).notNull().unique(),
  username: text("username"),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name"),
  isBanned: boolean("is_banned").notNull().default(false),
  bannedAt: timestamp("banned_at"),
  bannedReason: text("banned_reason"),
  firstSeen: timestamp("first_seen").notNull().defaultNow(),
  lastSeen: timestamp("last_seen").notNull().defaultNow(),
});

export type BotUser = typeof botUsersTable.$inferSelect;
export type InsertBotUser = typeof botUsersTable.$inferInsert;
