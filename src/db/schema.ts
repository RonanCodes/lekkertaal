import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Stub: Ralph US-003 will flesh this out into the full schema per PRD section 4.
// This stub exists so the build doesn't fail before US-003 runs.

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clerkId: text("clerk_id").unique(),
  email: text("email").unique(),
  displayName: text("display_name"),
  cefrLevel: text("cefr_level").default("A2"),
  timezone: text("timezone").default("Europe/Amsterdam"),
  reminderHour: integer("reminder_hour").default(20),
  reminderEnabled: integer("reminder_enabled", { mode: "boolean" }).default(true),
  streakDays: integer("streak_days").default(0),
  streakFreezesBalance: integer("streak_freezes_balance").default(0),
  streakLastActiveDate: text("streak_last_active_date"),
  xpTotal: integer("xp_total").default(0),
  coinsBalance: integer("coins_balance").default(0),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});
