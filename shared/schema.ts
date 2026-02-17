import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("creator"),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationToken: text("verification_token"),
  verificationCodeExpiry: timestamp("verification_code_expiry"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const creators = pgTable("creators", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  instagramUsername: text("instagram_username"),
  tiktokUsername: text("tiktok_username"),
  instagramConnected: boolean("instagram_connected").default(false),
  tiktokConnected: boolean("tiktok_connected").default(false),
  instagramFollowers: integer("instagram_followers").default(0),
  tiktokFollowers: integer("tiktok_followers").default(0),
  paypalEmail: text("paypal_email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  status: text("status").notNull().default("active"),
  basePay: decimal("base_pay", { precision: 10, scale: 2 }).default("10.00"),
  customInstagramBasePay: decimal("custom_instagram_base_pay", { precision: 10, scale: 2 }),
  customTiktokBasePay: decimal("custom_tiktok_base_pay", { precision: 10, scale: 2 }),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0.00"),
  lastSyncAt: timestamp("last_sync_at"),
  dailySyncCount: integer("daily_sync_count").default(0),
  lastSyncDate: text("last_sync_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").references(() => creators.id).notNull(),
  platform: text("platform").notNull(),
  videoId: text("video_id").notNull(),
  platformVideoId: text("platform_video_id"),
  title: text("title"),
  caption: text("caption"),
  thumbnailUrl: text("thumbnail_url"),
  thumbnail: text("thumbnail"),
  duration: integer("duration"),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  postedAt: timestamp("posted_at"),
  pairedVideoId: integer("paired_video_id"),
  isPaired: boolean("is_paired").default(false),
  isIrrelevant: boolean("is_irrelevant").default(false),
  videoFileUrl: text("video_file_url"),
  basePay: decimal("base_pay", { precision: 10, scale: 2 }).default("0.00"),
  bonusPay: decimal("bonus_pay", { precision: 10, scale: 2 }).default("0.00"),
  totalPay: decimal("total_pay", { precision: 10, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const payouts = pgTable("payouts", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").references(() => creators.id).notNull(),
  cycleId: integer("cycle_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  basePay: decimal("base_pay", { precision: 10, scale: 2 }),
  bonusPay: decimal("bonus_pay", { precision: 10, scale: 2 }),
  eligibleViews: integer("eligible_views"),
  snapshotIgBasePay: decimal("snapshot_ig_base_pay", { precision: 10, scale: 2 }),
  snapshotTtBasePay: decimal("snapshot_tt_base_pay", { precision: 10, scale: 2 }),
  snapshotDefaultBasePay: decimal("snapshot_default_base_pay", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("pending"),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payoutSettings = pgTable("payout_settings", {
  id: serial("id").primaryKey(),
  basePay: decimal("base_pay", { precision: 10, scale: 2 }).default("10.00"),
  minVideosPerWeek: integer("min_videos_per_week").default(3).notNull(),
  maxVideosPerDay: integer("max_videos_per_day").default(10).notNull(),
  cycleDurationDays: integer("cycle_duration_days").default(14).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bonusTiers = pgTable("bonus_tiers", {
  id: serial("id").primaryKey(),
  viewThreshold: integer("view_threshold").notNull(),
  bonusAmount: decimal("bonus_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").references(() => creators.id).notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("normal"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const survivorGames = pgTable("survivor_games", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default("Streak Survivor"),
  description: text("description"),
  prizePool: decimal("prize_pool", { precision: 10, scale: 2 }).notNull().default("500.00"),
  originalPrizePool: decimal("original_prize_pool", { precision: 10, scale: 2 }).notNull().default("500.00"),
  startingLives: integer("starting_lives").notNull().default(2),
  minPostsPerDay: integer("min_posts_per_day").notNull().default(1),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("pending"),
  currentDay: integer("current_day").default(0),
  addedFromEliminations: decimal("added_from_eliminations", { precision: 10, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const gameParticipants = pgTable("game_participants", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").references(() => survivorGames.id).notNull(),
  creatorId: integer("creator_id").references(() => creators.id).notNull(),
  lives: integer("lives").notNull().default(2),
  totalPosts: integer("total_posts").default(0),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  isEliminated: boolean("is_eliminated").default(false),
  eliminatedOnDay: integer("eliminated_on_day"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  lastPostDate: text("last_post_date"),
});

export const bounties = pgTable("bounties", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  reward: decimal("reward", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull().default("challenge"),
  status: text("status").notNull().default("active"),
  targetViews: integer("target_views"),
  targetPosts: integer("target_posts"),
  startDate: timestamp("start_date"),
  deadline: timestamp("deadline"),
  maxClaims: integer("max_claims").default(1),
  currentClaims: integer("current_claims").default(0),
  penaltyAmount: decimal("penalty_amount", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bountyCompletions = pgTable("bounty_completions", {
  id: serial("id").primaryKey(),
  bountyId: integer("bounty_id").references(() => bounties.id).notNull(),
  creatorId: integer("creator_id").references(() => creators.id).notNull(),
  status: text("status").notNull().default("pending"),
  completedAt: timestamp("completed_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payoutCycles = pgTable("payout_cycles", {
  id: serial("id").primaryKey(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull().default("pending"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).default("0.00"),
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
  notes: text("notes"),
  paidAt: timestamp("paid_at"),
  basePayPerVideo: decimal("base_pay_per_video", { precision: 10, scale: 2 }),
  bonusPayPer100kViews: decimal("bonus_pay_per_100k_views", { precision: 10, scale: 2 }),
  bonusViewThreshold: integer("bonus_view_threshold"),
  snapshotsCreated: boolean("snapshots_created").default(false),
  bonusTiersSnapshot: text("bonus_tiers_snapshot"),
  isRecurring: boolean("is_recurring").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorSchema = createInsertSchema(creators).omit({
  id: true,
  createdAt: true,
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  createdAt: true,
});

export const insertPayoutSchema = createInsertSchema(payouts).omit({
  id: true,
  createdAt: true,
});

export const videoFires = pgTable("video_fires", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").references(() => videos.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const videoComments = pgTable("video_comments", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").references(() => videos.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const celebrations = pgTable("celebrations", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").references(() => creators.id).notNull(),
  type: text("type").notNull(),
  achievement: text("achievement").notNull(),
  emoji: text("emoji").notNull().default("🎉"),
  referenceId: text("reference_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const statsSnapshots = pgTable("stats_snapshots", {
  id: serial("id").primaryKey(),
  snapshotType: text("snapshot_type").notNull().default("global"),
  newCreators: integer("new_creators").default(0),
  totalCreators: integer("total_creators").default(0),
  videosThisCycle: integer("videos_this_cycle").default(0),
  igVideosThisCycle: integer("ig_videos_this_cycle").default(0),
  ttVideosThisCycle: integer("tt_videos_this_cycle").default(0),
  eligibleVideos: integer("eligible_videos").default(0),
  igEligibleVideos: integer("ig_eligible_videos").default(0),
  ttEligibleVideos: integer("tt_eligible_videos").default(0),
  viewsThisCycle: integer("views_this_cycle").default(0),
  igViewsThisCycle: integer("ig_views_this_cycle").default(0),
  ttViewsThisCycle: integer("tt_views_this_cycle").default(0),
  eligibleViews: integer("eligible_views").default(0),
  igEligibleViews: integer("ig_eligible_views").default(0),
  ttEligibleViews: integer("tt_eligible_views").default(0),
  followers: integer("followers").default(0),
  igFollowers: integer("ig_followers").default(0),
  ttFollowers: integer("tt_followers").default(0),
  totalPay: decimal("total_pay", { precision: 10, scale: 2 }).default("0.00"),
  moneyPaidTillNow: decimal("money_paid_till_now", { precision: 10, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const violations = pgTable("violations", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").references(() => creators.id).notNull(),
  date: timestamp("date").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cycleVideoSnapshots = pgTable("cycle_video_snapshots", {
  id: serial("id").primaryKey(),
  cycleId: integer("cycle_id").references(() => payoutCycles.id).notNull(),
  videoId: integer("video_id"),
  creatorId: integer("creator_id").references(() => creators.id).notNull(),
  platform: text("platform").notNull(),
  platformVideoId: text("platform_video_id"),
  url: text("url"),
  caption: text("caption"),
  timestamp: timestamp("timestamp"),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  isIrrelevant: boolean("is_irrelevant").default(false),
  isEligible: boolean("is_eligible").default(true),
  basePayPerVideo: decimal("base_pay_per_video", { precision: 10, scale: 2 }),
  bonusPayPer100kViews: decimal("bonus_pay_per_100k_views", { precision: 10, scale: 2 }),
  bonusViewThreshold: integer("bonus_view_threshold"),
  thumbnailUrl: text("thumbnail_url"),
  thumbnailHash: text("thumbnail_hash"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminCreatorViews = pgTable("admin_creator_views", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id).notNull(),
  creatorId: integer("creator_id").references(() => creators.id).notNull(),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Creator = typeof creators.$inferSelect;
export type InsertCreator = z.infer<typeof insertCreatorSchema>;
export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Payout = typeof payouts.$inferSelect;
export type InsertPayout = z.infer<typeof insertPayoutSchema>;
export type Cycle = typeof payoutCycles.$inferSelect;
export type PayoutSettings = typeof payoutSettings.$inferSelect;
export type BonusTier = typeof bonusTiers.$inferSelect;
export type Violation = typeof violations.$inferSelect;
