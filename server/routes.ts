import type { Express } from "express";
import crypto from "crypto";
import { db } from "./db";
import { users, creators, videos, payouts, payoutSettings, payoutCycles, supportTickets, survivorGames, gameParticipants, bounties, bountyCompletions, videoFires, videoComments, celebrations, bonusTiers, statsSnapshots, cycleVideoSnapshots, violations } from "../shared/schema";
import { eq, ne, desc, and, sql, gte, lte, lt, gt, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { fetchTikTokVideos, fetchInstagramReels, fetchTikTokProfile, fetchInstagramProfile, instagramPkToShortcode, isInstagramNumericPk, delay } from "./scrapecreators";

const JWT_SECRET = process.env.JWT_SECRET || "whisper-jwt-secret";
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = "Creator Catalyst <contact@neonugc.com>";
function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  return "https://creatorcatalyst.com";
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  if (!resend) {
    console.error("Resend not configured - RESEND_API_KEY missing");
    return false;
  }
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Verify your email - Creator Catalyst",
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #0A0F1A; color: #ffffff;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-family: 'Lilita One', cursive; color: #38BDF8; font-size: 28px; margin: 0;">Creator Catalyst</h1>
            <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Creator Dashboard</p>
          </div>
          <div style="background: #0F172A; border-radius: 12px; padding: 32px; text-align: center;">
            <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 12px;">Verify your email</h2>
            <p style="color: #94a3b8; font-size: 14px; margin: 0 0 24px;">Use the code below to verify your email address.</p>
            <div style="background: #0A0F1A; border: 2px solid #38BDF8; border-radius: 8px; padding: 16px; display: inline-block; letter-spacing: 8px; font-size: 32px; font-weight: bold; color: #38BDF8; font-family: monospace;">
              ${code}
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">This code expires in 15 minutes.</p>
          </div>
          <p style="color: #475569; font-size: 12px; text-align: center; margin-top: 24px;">If you didn't create an account with Creator Catalyst, you can safely ignore this email.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return false;
  }
}

async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  if (!resend) {
    console.error("Resend not configured - RESEND_API_KEY missing");
    return false;
  }
  const resetLink = `${getAppUrl()}/reset-password?token=${token}`;
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Reset your password - Creator Catalyst",
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #0A0F1A; color: #ffffff;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-family: 'Lilita One', cursive; color: #38BDF8; font-size: 28px; margin: 0;">Creator Catalyst</h1>
            <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Creator Dashboard</p>
          </div>
          <div style="background: #0F172A; border-radius: 12px; padding: 32px; text-align: center;">
            <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 12px;">Reset your password</h2>
            <p style="color: #94a3b8; font-size: 14px; margin: 0 0 24px;">Click the button below to reset your password. This link will expire in 1 hour.</p>
            <a href="${resetLink}" style="display: inline-block; background: #38BDF8; color: #0A0F1A; font-weight: bold; font-size: 16px; padding: 12px 32px; border-radius: 8px; text-decoration: none;">Reset Password</a>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">Or copy this link into your browser:</p>
            <p style="color: #94a3b8; font-size: 12px; word-break: break-all;">${resetLink}</p>
          </div>
          <p style="color: #475569; font-size: 12px; text-align: center; margin-top: 24px;">If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return false;
  }
}

async function replaceCreatorPlatformVideos(
  creatorId: number,
  platform: string,
  fetchedVideos: Array<{
    platformVideoId: string;
    caption: string;
    views: number;
    likes: number;
    comments: number;
    shares?: number;
    thumbnail: string;
    videoFileUrl?: string;
    duration: number;
    postedAt: Date;
  }>
): Promise<number> {
  const existingVideos = await db.select().from(videos).where(
    and(eq(videos.creatorId, creatorId), eq(videos.platform, platform))
  );

  const existingMap = new Map<string, typeof existingVideos[0]>();
  for (const v of existingVideos) {
    if (v.platformVideoId) existingMap.set(v.platformVideoId, v);
  }

  let processed = 0;

  for (const fetched of fetchedVideos) {
    if (!fetched.platformVideoId) continue;

    const existing = existingMap.get(fetched.platformVideoId);

    if (existing) {
      await db.update(videos)
        .set({
          views: fetched.views,
          likes: fetched.likes,
          comments: fetched.comments,
          shares: fetched.shares || 0,
          thumbnail: fetched.thumbnail,
          thumbnailUrl: fetched.thumbnail,
          duration: fetched.duration,
          videoFileUrl: fetched.videoFileUrl || "",
          postedAt: fetched.postedAt,
          updatedAt: new Date(),
        })
        .where(eq(videos.id, existing.id));
    } else {
      await db.insert(videos).values({
        creatorId,
        platform,
        videoId: fetched.platformVideoId,
        platformVideoId: fetched.platformVideoId,
        title: fetched.caption?.substring(0, 100) || "",
        caption: fetched.caption,
        views: fetched.views,
        likes: fetched.likes,
        comments: fetched.comments,
        shares: fetched.shares || 0,
        thumbnailUrl: fetched.thumbnail,
        videoFileUrl: fetched.videoFileUrl || "",
        thumbnail: fetched.thumbnail,
        duration: fetched.duration,
        postedAt: fetched.postedAt,
      });
    }
    processed++;
  }

  return processed;
}

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}


function authenticateToken(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function getUTCDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function detectViolations(creatorId: number) {
  try {
    const [settings] = await db.select().from(payoutSettings).limit(1);
    const maxVideosPerDay = settings?.maxVideosPerDay ?? 10;
    const minVideosPerWeek = settings?.minVideosPerWeek ?? 3;

    const creatorVideos = await db.select().from(videos)
      .where(eq(videos.creatorId, creatorId));

    const now = new Date();
    const todayStr = getUTCDateStr(now);

    const todayVideos = creatorVideos.filter(v => {
      if (!v.postedAt) return false;
      return getUTCDateStr(new Date(v.postedAt)) === todayStr;
    });

    if (todayVideos.length > maxVideosPerDay) {
      const existingViolation = await db.select().from(supportTickets)
        .where(and(
          eq(supportTickets.creatorId, creatorId),
          eq(supportTickets.subject, `Daily limit exceeded: ${todayStr}`),
        )).limit(1);

      if (existingViolation.length === 0) {
        await db.insert(supportTickets).values({
          creatorId,
          subject: `Daily limit exceeded: ${todayStr}`,
          message: `Posted ${todayVideos.length} videos on ${todayStr}, exceeding the maximum of ${maxVideosPerDay} per day.`,
          status: "open",
          priority: "high",
        });
      }
    }

    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay());
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekStartStr = getUTCDateStr(weekStart);

    if (now.getUTCDay() === 0 && minVideosPerWeek > 0) {
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);
      const prevWeekEnd = new Date(weekStart);
      prevWeekEnd.setUTCDate(prevWeekEnd.getUTCDate() - 1);

      const prevWeekVideos = creatorVideos.filter(v => {
        if (!v.postedAt) return false;
        const d = new Date(v.postedAt);
        return d >= prevWeekStart && d <= prevWeekEnd;
      });

      if (prevWeekVideos.length < minVideosPerWeek) {
        const prevWeekStr = getUTCDateStr(prevWeekStart);
        const existingViolation = await db.select().from(supportTickets)
          .where(and(
            eq(supportTickets.creatorId, creatorId),
            eq(supportTickets.subject, `Weekly minimum not met: week of ${prevWeekStr}`),
          )).limit(1);

        if (existingViolation.length === 0) {
          await db.insert(supportTickets).values({
            creatorId,
            subject: `Weekly minimum not met: week of ${prevWeekStr}`,
            message: `Posted only ${prevWeekVideos.length} videos during the week of ${prevWeekStr}, below the minimum of ${minVideosPerWeek} per week.`,
            status: "open",
            priority: "normal",
          });
        }
      }
    }
  } catch (error) {
    console.error(`Violation detection error for creator ${creatorId}:`, error);
  }
}

async function updateSurvivorGameStats(creatorIds?: number[]) {
  try {
    const [activeGame] = await db.select().from(survivorGames)
      .where(eq(survivorGames.status, "active"))
      .limit(1);

    if (!activeGame || !activeGame.startDate) return;

    const gameStart = new Date(activeGame.startDate);
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    if (today < gameStart) return;

    const gameEnd = activeGame.endDate ? new Date(activeGame.endDate) : null;
    const lastCheckDay = gameEnd && today > gameEnd
      ? new Date(Date.UTC(new Date(gameEnd).getUTCFullYear(), new Date(gameEnd).getUTCMonth(), new Date(gameEnd).getUTCDate(), 0, 0, 0, 0))
      : today;

    let participantsQuery = db.select({
      participant: gameParticipants,
      creator: creators,
    }).from(gameParticipants)
      .leftJoin(creators, eq(gameParticipants.creatorId, creators.id))
      .where(eq(gameParticipants.gameId, activeGame.id));

    const allParticipants = await participantsQuery;

    const participantsToUpdate = creatorIds
      ? allParticipants.filter(p => creatorIds.includes(p.participant.creatorId))
      : allParticipants;

    const allCreatorIds = participantsToUpdate.map(p => p.participant.creatorId);
    if (allCreatorIds.length === 0) return;

    const allVideos = await db.select({
      creatorId: videos.creatorId,
      postedAt: videos.postedAt,
      platform: videos.platform,
    }).from(videos)
      .where(and(
        inArray(videos.creatorId, allCreatorIds),
        gte(videos.postedAt, gameStart),
        eq(videos.isIrrelevant, false)
      ));

    const videosByCreator = new Map<number, Date[]>();
    for (const v of allVideos) {
      if (!v.postedAt) continue;
      const postedDate = new Date(v.postedAt);
      if (!videosByCreator.has(v.creatorId)) videosByCreator.set(v.creatorId, []);
      videosByCreator.get(v.creatorId)!.push(postedDate);
    }

    const minPosts = activeGame.minPostsPerDay || 1;

    for (const { participant } of participantsToUpdate) {
      const creatorVideoDates = videosByCreator.get(participant.creatorId) || [];

      const postsByDay = new Map<string, number>();
      for (const d of creatorVideoDates) {
        const dayStr = getUTCDateStr(d);
        postsByDay.set(dayStr, (postsByDay.get(dayStr) || 0) + 1);
      }

      const totalPosts = creatorVideoDates.length;

      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;
      let missedDays = 0;
      let lastPostDate: string | null = null;
      let eliminationDayNumber: number | null = null;

      const dayMs = 24 * 60 * 60 * 1000;
      const originalLives = activeGame.startingLives || 2;
      const cursor = new Date(gameStart);
      let dayNumber = 0;

      while (cursor <= lastCheckDay) {
        dayNumber++;
        const dayStr = getUTCDateStr(cursor);
        const postsThisDay = postsByDay.get(dayStr) || 0;

        if (postsThisDay >= minPosts) {
          tempStreak++;
          lastPostDate = dayStr;
          if (tempStreak > longestStreak) longestStreak = tempStreak;
        } else {
          if (cursor < today) {
            missedDays++;
            if (missedDays >= originalLives && eliminationDayNumber === null) {
              eliminationDayNumber = dayNumber;
            }
          }
          tempStreak = 0;
        }

        cursor.setTime(cursor.getTime() + dayMs);
      }
      currentStreak = tempStreak;

      let newLives = originalLives - missedDays;
      if (newLives < 0) newLives = 0;

      const wasEliminated = participant.isEliminated;
      const isNowEliminated = newLives <= 0 && missedDays > 0;

      await db.update(gameParticipants)
        .set({
          totalPosts: totalPosts,
          currentStreak: currentStreak,
          longestStreak: longestStreak,
          lastPostDate: lastPostDate,
          lives: newLives,
          isEliminated: isNowEliminated,
          eliminatedOnDay: isNowEliminated ? eliminationDayNumber : participant.eliminatedOnDay,
        })
        .where(eq(gameParticipants.id, participant.id));
    }

    const updatedParticipants = await db.select().from(gameParticipants)
      .where(eq(gameParticipants.gameId, activeGame.id));

    const totalActive = updatedParticipants.filter(p => !p.isEliminated).length;
    const totalEliminated = updatedParticipants.filter(p => p.isEliminated).length;
    const daysSinceStart = Math.floor((lastCheckDay.getTime() - gameStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;

    await db.update(survivorGames)
      .set({
        currentDay: daysSinceStart,
        updatedAt: new Date(),
      })
      .where(eq(survivorGames.id, activeGame.id));

  } catch (error) {
    console.error("Update survivor game stats error:", error);
  }
}

async function detectCelebrations(creatorId: number) {
  try {
    const [creator] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
    if (!creator) return;

    const creatorVideos = await db.select().from(videos).where(eq(videos.creatorId, creatorId));
    const existingCelebrations = await db.select().from(celebrations).where(eq(celebrations.creatorId, creatorId));
    const existingTypeSet = new Set(existingCelebrations.map(c => c.type));
    const existingKeys = new Set(existingCelebrations.map(c => `${c.type}:${c.referenceId || ''}`));

    const newCelebrations: { type: string; achievement: string; emoji: string; referenceId?: string }[] = [];

    // --- First 1K video (one-time: first time ANY video hits 1,000 views) ---
    const has1k = creatorVideos.some(v => (v.views || 0) >= 1000);
    if (has1k && !existingTypeSet.has('first_1k')) {
      newCelebrations.push({ type: 'first_1k', achievement: 'Hit 1,000 views on a video!', emoji: '🔥' });
    }

    // --- 10K video (one-time: first time ANY video hits 10,000 views) ---
    const has10k = creatorVideos.some(v => (v.views || 0) >= 10000);
    if (has10k && !existingTypeSet.has('10k_video')) {
      newCelebrations.push({ type: '10k_video', achievement: 'Hit 10,000 views on a video!', emoji: '🚀' });
    }

    // --- New personal best (tracks which video holds the record) ---
    if (creatorVideos.length > 0) {
      const sortedByViews = [...creatorVideos].sort((a, b) => (b.views || 0) - (a.views || 0));
      const topVideo = sortedByViews[0];
      if (topVideo && (topVideo.views || 0) > 0) {
        const existingBests = existingCelebrations.filter(c => c.type === 'personal_best');
        const lastBestRef = existingBests.length > 0 ? existingBests[existingBests.length - 1].referenceId : null;
        if (lastBestRef !== String(topVideo.id)) {
          const key = `personal_best:${topVideo.id}`;
          if (!existingKeys.has(key)) {
            newCelebrations.push({ type: 'personal_best', achievement: `New personal best — ${(topVideo.views || 0).toLocaleString()} views!`, emoji: '👑', referenceId: String(topVideo.id) });
          }
        }
      }
    }

    // --- Posting streaks (7, 14, 30 days) using UTC ---
    const postDatesUTC = new Set(
      creatorVideos
        .filter(v => v.postedAt)
        .map(v => getUTCDateStr(new Date(v.postedAt!)))
    );
    const sortedDates = [...postDatesUTC].sort().reverse();
    let streak = 0;
    if (sortedDates.length > 0) {
      const now = new Date();
      const todayUTC = getUTCDateStr(now);
      const yesterdayUTC = getUTCDateStr(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)));
      if (sortedDates[0] === todayUTC || sortedDates[0] === yesterdayUTC) {
        streak = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const curr = new Date(sortedDates[i - 1] + 'T00:00:00Z');
          const prev = new Date(sortedDates[i] + 'T00:00:00Z');
          const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
          if (diff === 1) { streak++; } else { break; }
        }
      }
    }
    if (streak >= 7 && !existingTypeSet.has('streak_7')) {
      newCelebrations.push({ type: 'streak_7', achievement: '7-day posting streak!', emoji: '⚡' });
    }
    if (streak >= 14 && !existingTypeSet.has('streak_14')) {
      newCelebrations.push({ type: 'streak_14', achievement: '14-day posting streak!', emoji: '⚡' });
    }
    if (streak >= 30 && !existingTypeSet.has('streak_30')) {
      newCelebrations.push({ type: 'streak_30', achievement: '30-day posting streak!', emoji: '💎' });
    }

    // --- 10th video milestone (one-time) ---
    if (creatorVideos.length >= 10 && !existingTypeSet.has('10th_video')) {
      newCelebrations.push({ type: '10th_video', achievement: 'Posted 10 videos!', emoji: '🎬' });
    }

    // --- Bonus tier milestones (per cycle) ---
    const now = new Date();
    const allCycles = await db.select().from(payoutCycles).orderBy(payoutCycles.startDate);
    const activeCycle = allCycles.find(c => now >= new Date(c.startDate) && now <= new Date(c.endDate));
    if (activeCycle) {
      const cycleVideos = creatorVideos.filter(v => {
        if (!v.postedAt) return false;
        const posted = new Date(v.postedAt);
        return posted >= new Date(activeCycle.startDate) && posted <= new Date(activeCycle.endDate);
      });
      const cycleViews = cycleVideos.reduce((sum, v) => sum + (v.views || 0), 0);

      const celebrationTiers = await db.select().from(bonusTiers).orderBy(bonusTiers.viewThreshold);
      for (const tier of celebrationTiers) {
        const bonus = parseFloat(tier.bonusAmount as unknown as string);
        if (bonus > 0 && cycleViews >= tier.viewThreshold) {
          const key = `bonus_tier_${tier.viewThreshold}:${activeCycle.id}`;
          if (!existingKeys.has(key)) {
            newCelebrations.push({ type: `bonus_tier_${tier.viewThreshold}`, achievement: `Bonus Tier: ${tier.viewThreshold.toLocaleString()} views this cycle!`, emoji: '💰', referenceId: String(activeCycle.id) });
          }
        }
      }
    }

    // --- Just posted (any video posted today, UTC) ---
    const todayUTCStr = getUTCDateStr(new Date());
    const todayVideos = creatorVideos.filter(v => {
      if (!v.postedAt) return false;
      return getUTCDateStr(new Date(v.postedAt)) === todayUTCStr;
    });
    if (todayVideos.length > 0 && !existingKeys.has(`just_posted:${todayUTCStr}`)) {
      newCelebrations.push({ type: 'just_posted', achievement: `Posted ${todayVideos.length > 1 ? todayVideos.length + ' videos' : 'a video'} today!`, emoji: '📱', referenceId: todayUTCStr });
    }

    // Insert new celebrations
    for (const cel of newCelebrations) {
      await db.insert(celebrations).values({
        creatorId,
        type: cel.type,
        achievement: cel.achievement,
        emoji: cel.emoji,
        referenceId: cel.referenceId || null,
      });
    }

    if (newCelebrations.length > 0) {
      console.log(`Detected ${newCelebrations.length} new celebrations for creator ${creatorId} (${creator.name})`);
    }
  } catch (error) {
    console.error(`Error detecting celebrations for creator ${creatorId}:`, error);
  }
}

function applyPairBonusLogic<T extends { id: any; platform: string; views: number | null; duration: number | null; postedAt: any; isIrrelevant?: boolean | null; bonusAmount: number; isEligible?: boolean }>(enrichedVideos: T[]): T[] {
  const PAIR_WINDOW_MS = 24 * 60 * 60 * 1000;
  const igVids = enrichedVideos.filter(v => v.platform === "instagram" && v.duration != null && v.postedAt);
  const ttVids = enrichedVideos.filter(v => v.platform === "tiktok" && v.duration != null && v.postedAt);
  const usedTt = new Set<any>();
  const loserIds = new Set<any>();

  for (const ig of igVids) {
    if (ig.isIrrelevant) continue;
    const igTime = new Date(ig.postedAt).getTime();
    let bestMatch: T | null = null;
    let bestDurationDiff = Infinity;
    let bestTimeDiff = Infinity;

    for (const tt of ttVids) {
      if (usedTt.has(tt.id) || tt.isIrrelevant) continue;
      const durationDiff = Math.abs((ig.duration || 0) - (tt.duration || 0));
      if (durationDiff > 1) continue;
      const timeDiff = Math.abs(igTime - new Date(tt.postedAt).getTime());
      if (timeDiff <= PAIR_WINDOW_MS && (durationDiff < bestDurationDiff || (durationDiff === bestDurationDiff && timeDiff < bestTimeDiff))) {
        bestDurationDiff = durationDiff;
        bestTimeDiff = timeDiff;
        bestMatch = tt;
      }
    }

    if (bestMatch) {
      usedTt.add(bestMatch.id);
      const igViews = ig.views || 0;
      const ttViews = bestMatch.views || 0;
      const loserId = igViews >= ttViews ? bestMatch.id : ig.id;
      loserIds.add(loserId);
    }
  }

  return enrichedVideos.map(v => {
    if (loserIds.has(v.id)) {
      return { ...v, bonusAmount: 0 };
    }
    return v;
  });
}

async function calculateCreatorCyclePayout(
  creatorId: number,
  cycle: { id: number; startDate: Date | string; endDate: Date | string; basePayPerVideo?: string | null; bonusTiersSnapshot?: string | null },
  options?: { useCurrentRates?: boolean }
): Promise<{ basePay: number; bonusPay: number; totalAmount: number; eligibleViews: number; igRate: number; ttRate: number; defaultBasePay: number }> {
  const [creator] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
  if (!creator) return { basePay: 0, bonusPay: 0, totalAmount: 0, eligibleViews: 0, igRate: 0, ttRate: 0, defaultBasePay: 0 };

  const existingPayout = await db.select().from(payouts).where(
    and(eq(payouts.creatorId, creatorId), eq(payouts.cycleId, cycle.id))
  ).limit(1);

  const now = new Date();
  const isActiveCycle = options?.useCurrentRates || (now >= new Date(cycle.startDate) && now <= new Date(cycle.endDate));

  let igRate: number;
  let ttRate: number;
  let defaultBasePay: number;
  let tiers: { viewThreshold: number; bonusAmount: string }[];

  if (isActiveCycle) {
    const [settings] = await db.select().from(payoutSettings).limit(1);
    defaultBasePay = settings?.basePay ? parseFloat(settings.basePay as unknown as string) : 0;
    igRate = creator.customInstagramBasePay !== null ? parseFloat(creator.customInstagramBasePay as unknown as string) : defaultBasePay;
    ttRate = creator.customTiktokBasePay !== null ? parseFloat(creator.customTiktokBasePay as unknown as string) : defaultBasePay;
    tiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));
  } else {
    const [settings] = await db.select().from(payoutSettings).limit(1);
    const currentDefaultBasePay = settings?.basePay ? parseFloat(settings.basePay as unknown as string) : 0;

    const cycleBasePay = cycle.basePayPerVideo ? parseFloat(cycle.basePayPerVideo as unknown as string) : 0;
    const snapshotDefault = existingPayout[0]?.snapshotDefaultBasePay ? parseFloat(existingPayout[0].snapshotDefaultBasePay as unknown as string) : 0;

    if (cycleBasePay > 0) {
      defaultBasePay = cycleBasePay;
    } else if (snapshotDefault > 0) {
      defaultBasePay = snapshotDefault;
    } else {
      defaultBasePay = currentDefaultBasePay;
    }

    const snapshotIg = existingPayout[0]?.snapshotIgBasePay ? parseFloat(existingPayout[0].snapshotIgBasePay as unknown as string) : 0;
    if (snapshotIg >= 1) {
      igRate = snapshotIg;
    } else {
      igRate = creator.customInstagramBasePay !== null ? parseFloat(creator.customInstagramBasePay as unknown as string) : defaultBasePay;
      if (igRate === 0) igRate = defaultBasePay;
    }

    const snapshotTt = existingPayout[0]?.snapshotTtBasePay ? parseFloat(existingPayout[0].snapshotTtBasePay as unknown as string) : 0;
    if (snapshotTt >= 1) {
      ttRate = snapshotTt;
    } else {
      ttRate = creator.customTiktokBasePay !== null ? parseFloat(creator.customTiktokBasePay as unknown as string) : defaultBasePay;
      if (ttRate === 0) ttRate = defaultBasePay;
    }

    if (cycle.bonusTiersSnapshot) {
      try {
        tiers = JSON.parse(cycle.bonusTiersSnapshot as string);
        tiers.sort((a: any, b: any) => b.viewThreshold - a.viewThreshold);
        const hasNonZeroTier = tiers.some((t: any) => parseFloat(t.bonusAmount) > 0);
        if (!hasNonZeroTier) {
          tiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));
        }
      } catch {
        tiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));
      }
    } else {
      tiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));
    }
  }

  const cycleStart = new Date(cycle.startDate);
  const cycleEnd = new Date(cycle.endDate);
  const PAIR_WINDOW_MS = 24 * 60 * 60 * 1000;

  const cycleVideos = await db.select().from(videos)
    .where(and(
      eq(videos.creatorId, creator.id),
      eq(videos.isIrrelevant, false),
      gte(videos.postedAt, cycle.startDate),
      lte(videos.postedAt, cycle.endDate)
    ));

  const eligible = cycleVideos.filter(v => !!v.postedAt);

  const igVids = eligible.filter(v => v.platform === "instagram" && !v.isIrrelevant);
  const ttVids = eligible.filter(v => v.platform === "tiktok" && !v.isIrrelevant);
  const usedIg = new Set<number>();
  const usedTt = new Set<number>();
  let basePay = 0;
  let bonusPay = 0;

  for (const ig of igVids) {
    if (!ig.postedAt || ig.duration == null) continue;
    const igTime = new Date(ig.postedAt).getTime();
    let bestMatch: typeof ttVids[0] | null = null;
    let bestDurationDiff = Infinity;
    let bestTimeDiff = Infinity;
    for (const tt of ttVids) {
      if (usedTt.has(tt.id)) continue;
      if (!tt.postedAt || tt.duration == null) continue;
      const durationDiff = Math.abs(ig.duration - tt.duration);
      if (durationDiff > 1) continue;
      const timeDiff = Math.abs(igTime - new Date(tt.postedAt).getTime());
      if (timeDiff <= PAIR_WINDOW_MS && (durationDiff < bestDurationDiff || (durationDiff === bestDurationDiff && timeDiff < bestTimeDiff))) {
        bestDurationDiff = durationDiff;
        bestTimeDiff = timeDiff;
        bestMatch = tt;
      }
    }
    if (bestMatch) {
      usedIg.add(ig.id);
      usedTt.add(bestMatch.id);
      basePay += igRate + ttRate;
      const winnerViews = Math.max(ig.views || 0, bestMatch.views || 0);
      const matchingTier = tiers.find(t => winnerViews >= t.viewThreshold);
      if (matchingTier) {
        bonusPay += parseFloat(matchingTier.bonusAmount as unknown as string);
      }
    }
  }

  const allPrevCycles = await db.select().from(payoutCycles)
    .where(lt(payoutCycles.endDate, cycleStart))
    .orderBy(desc(payoutCycles.startDate))
    .limit(1);
  const prevCycle = allPrevCycles[0];

  if (prevCycle) {
    const prevCycleAllVids = await db.select().from(videos)
      .where(and(
        eq(videos.creatorId, creator.id),
        eq(videos.isIrrelevant, false),
        gte(videos.postedAt, prevCycle.startDate),
        lte(videos.postedAt, prevCycle.endDate)
      ));
    const prevCycleEligible = prevCycleAllVids.filter(v => !!v.postedAt);

    const prevCycleIg = prevCycleEligible.filter(v => v.platform === "instagram" && v.postedAt && v.duration != null);
    const prevCycleTt = prevCycleEligible.filter(v => v.platform === "tiktok" && v.postedAt && v.duration != null);
    const prevUsedTt = new Set<number>();
    const prevUsedIg = new Set<number>();

    for (const pig of prevCycleIg) {
      const pigTime = new Date(pig.postedAt!).getTime();
      let bestMatch: typeof prevCycleTt[0] | null = null;
      let bestDiff = Infinity;
      let bestTd = Infinity;
      for (const ptt of prevCycleTt) {
        if (prevUsedTt.has(ptt.id)) continue;
        if (!ptt.postedAt || ptt.duration == null) continue;
        const dd = Math.abs(pig.duration! - ptt.duration!);
        if (dd > 1) continue;
        const td = Math.abs(pigTime - new Date(ptt.postedAt!).getTime());
        if (td <= PAIR_WINDOW_MS && (dd < bestDiff || (dd === bestDiff && td < bestTd))) { bestDiff = dd; bestTd = td; bestMatch = ptt; }
      }
      if (bestMatch) { prevUsedIg.add(pig.id); prevUsedTt.add(bestMatch.id); }
    }

    const prevEndTime = new Date(prevCycle.endDate).getTime();
    const unpairedPrevIg = prevCycleIg.filter(v => {
      if (prevUsedIg.has(v.id)) return false;
      return new Date(v.postedAt!).getTime() >= prevEndTime - PAIR_WINDOW_MS;
    });
    const unpairedPrevTt = prevCycleTt.filter(v => {
      if (prevUsedTt.has(v.id)) return false;
      return new Date(v.postedAt!).getTime() >= prevEndTime - PAIR_WINDOW_MS;
    });

    const unpairedCurrIgFirstDay = igVids.filter(v => {
      if (usedIg.has(v.id)) return false;
      if (!v.postedAt || v.duration == null) return false;
      return new Date(v.postedAt).getTime() <= cycleStart.getTime() + PAIR_WINDOW_MS;
    });
    const unpairedCurrTtFirstDay = ttVids.filter(v => {
      if (usedTt.has(v.id)) return false;
      if (!v.postedAt || v.duration == null) return false;
      return new Date(v.postedAt).getTime() <= cycleStart.getTime() + PAIR_WINDOW_MS;
    });

    for (const currTt of unpairedCurrTtFirstDay) {
      const currTime = new Date(currTt.postedAt!).getTime();
      let bestMatch: typeof unpairedPrevIg[0] | null = null;
      let bestDiff = Infinity;
      let bestTd = Infinity;
      for (const pIg of unpairedPrevIg) {
        if (usedIg.has(pIg.id)) continue;
        const dd = Math.abs(currTt.duration! - pIg.duration!);
        if (dd > 1) continue;
        const td = Math.abs(currTime - new Date(pIg.postedAt!).getTime());
        if (td <= PAIR_WINDOW_MS && (dd < bestDiff || (dd === bestDiff && td < bestTd))) { bestDiff = dd; bestTd = td; bestMatch = pIg; }
      }
      if (bestMatch) {
        usedIg.add(bestMatch.id);
        usedTt.add(currTt.id);
        basePay += igRate + ttRate;
        const winnerViews = Math.max(bestMatch.views || 0, currTt.views || 0);
        const matchingTier = tiers.find(t => winnerViews >= t.viewThreshold);
        if (matchingTier) bonusPay += parseFloat(matchingTier.bonusAmount as unknown as string);
      }
    }

    for (const currIg of unpairedCurrIgFirstDay) {
      if (usedIg.has(currIg.id)) continue;
      const currTime = new Date(currIg.postedAt!).getTime();
      let bestMatch: typeof unpairedPrevTt[0] | null = null;
      let bestDiff = Infinity;
      let bestTd = Infinity;
      for (const pTt of unpairedPrevTt) {
        if (usedTt.has(pTt.id)) continue;
        const dd = Math.abs(currIg.duration! - pTt.duration!);
        if (dd > 1) continue;
        const td = Math.abs(currTime - new Date(pTt.postedAt!).getTime());
        if (td <= PAIR_WINDOW_MS && (dd < bestDiff || (dd === bestDiff && td < bestTd))) { bestDiff = dd; bestTd = td; bestMatch = pTt; }
      }
      if (bestMatch) {
        usedIg.add(currIg.id);
        usedTt.add(bestMatch.id);
        basePay += igRate + ttRate;
        const winnerViews = Math.max(currIg.views || 0, bestMatch.views || 0);
        const matchingTier = tiers.find(t => winnerViews >= t.viewThreshold);
        if (matchingTier) bonusPay += parseFloat(matchingTier.bonusAmount as unknown as string);
      }
    }
  }

  const allNextCycles = await db.select().from(payoutCycles)
    .where(gt(payoutCycles.startDate, cycleEnd))
    .orderBy(payoutCycles.startDate)
    .limit(1);
  const nextCycle = allNextCycles[0];
  const pulledForwardIds = new Set<number>();

  if (nextCycle) {
    const nextCycleFirstDayVids = await db.select().from(videos)
      .where(and(
        eq(videos.creatorId, creator.id),
        eq(videos.isIrrelevant, false),
        gte(videos.postedAt, nextCycle.startDate),
        lte(videos.postedAt, new Date(new Date(nextCycle.startDate).getTime() + PAIR_WINDOW_MS))
      ));
    const nextFirstDayEligible = nextCycleFirstDayVids.filter(v => !!v.postedAt);

    const nextCycleAllVids = await db.select().from(videos)
      .where(and(
        eq(videos.creatorId, creator.id),
        eq(videos.isIrrelevant, false),
        gte(videos.postedAt, nextCycle.startDate),
        lte(videos.postedAt, nextCycle.endDate)
      ));
    const nextCycleEligible = nextCycleAllVids.filter(v => !!v.postedAt);
    const nextIgAll = nextCycleEligible.filter(v => v.platform === "instagram" && v.postedAt && v.duration != null);
    const nextTtAll = nextCycleEligible.filter(v => v.platform === "tiktok" && v.postedAt && v.duration != null);
    const nextUsedTt = new Set<number>();
    const nextUsedIg = new Set<number>();

    for (const nig of nextIgAll) {
      const nigTime = new Date(nig.postedAt!).getTime();
      let bestMatch: typeof nextTtAll[0] | null = null;
      let bestDiff = Infinity;
      let bestTd = Infinity;
      for (const ntt of nextTtAll) {
        if (nextUsedTt.has(ntt.id)) continue;
        if (!ntt.postedAt || ntt.duration == null) continue;
        const dd = Math.abs(nig.duration! - ntt.duration!);
        if (dd > 1) continue;
        const td = Math.abs(nigTime - new Date(ntt.postedAt!).getTime());
        if (td <= PAIR_WINDOW_MS && (dd < bestDiff || (dd === bestDiff && td < bestTd))) { bestDiff = dd; bestTd = td; bestMatch = ntt; }
      }
      if (bestMatch) { nextUsedIg.add(nig.id); nextUsedTt.add(bestMatch.id); }
    }

    const unpairedNextIgFirstDay = nextFirstDayEligible.filter(v => v.platform === "instagram" && !nextUsedIg.has(v.id) && v.duration != null);
    const unpairedNextTtFirstDay = nextFirstDayEligible.filter(v => v.platform === "tiktok" && !nextUsedTt.has(v.id) && v.duration != null);

    const unpairedEndIg = igVids.filter(v => {
      if (usedIg.has(v.id)) return false;
      if (!v.postedAt || v.duration == null) return false;
      return new Date(v.postedAt).getTime() >= cycleEnd.getTime() - PAIR_WINDOW_MS;
    });
    const unpairedEndTt = ttVids.filter(v => {
      if (usedTt.has(v.id)) return false;
      if (!v.postedAt || v.duration == null) return false;
      return new Date(v.postedAt).getTime() >= cycleEnd.getTime() - PAIR_WINDOW_MS;
    });

    for (const endTt of unpairedEndTt) {
      const endTime = new Date(endTt.postedAt!).getTime();
      for (const nIg of unpairedNextIgFirstDay) {
        const dd = Math.abs(endTt.duration! - nIg.duration!);
        if (dd > 1) continue;
        const td = Math.abs(endTime - new Date(nIg.postedAt!).getTime());
        if (td <= PAIR_WINDOW_MS) { pulledForwardIds.add(endTt.id); break; }
      }
    }
    for (const endIg of unpairedEndIg) {
      const endTime = new Date(endIg.postedAt!).getTime();
      for (const nTt of unpairedNextTtFirstDay) {
        const dd = Math.abs(endIg.duration! - nTt.duration!);
        if (dd > 1) continue;
        const td = Math.abs(endTime - new Date(nTt.postedAt!).getTime());
        if (td <= PAIR_WINDOW_MS) { pulledForwardIds.add(endIg.id); break; }
      }
    }
  }

  const finalEligible = eligible.filter(v => !pulledForwardIds.has(v.id));

  const unpairedVideos = finalEligible.filter(v => !usedIg.has(v.id) && !usedTt.has(v.id) && v.postedAt);
  for (const uv of unpairedVideos) {
    const uvRate = uv.platform === "instagram" ? igRate : uv.platform === "tiktok" ? ttRate : defaultBasePay;
    basePay += uvRate;
    const uvViews = uv.views || 0;
    const matchingTier = tiers.find(t => uvViews >= t.viewThreshold);
    if (matchingTier) {
      bonusPay += parseFloat(matchingTier.bonusAmount as unknown as string);
    }
  }

  const totalAmount = basePay + bonusPay;
  const eligibleViews = finalEligible.reduce((s, v) => s + (v.views || 0), 0);

  return { basePay, bonusPay, totalAmount, eligibleViews, igRate, ttRate, defaultBasePay };
}

export function registerRoutes(app: Express) {
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, name } = req.body;
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({ message: "Email already exists" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const [user] = await db.insert(users).values({
        email,
        password: hashedPassword,
        role: "creator",
        emailVerified: true,
      }).returning();
      
      await db.insert(creators).values({
        userId: user.id,
        name: name || email.split("@")[0],
        email,
      });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
      res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Signup failed" });
    }
  });

  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { email, code } = req.body;
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }
      if (user.emailVerified) {
        return res.status(400).json({ message: "Email already verified" });
      }
      if (user.verificationToken !== code) {
        return res.status(400).json({ message: "Invalid verification code" });
      }
      if (user.verificationCodeExpiry && new Date() > user.verificationCodeExpiry) {
        return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
      }
      await db.update(users).set({
        emailVerified: true,
        verificationToken: null,
        verificationCodeExpiry: null,
      }).where(eq(users.id, user.id));
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
      res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
      console.error("Verify email error:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        return res.json({ message: "If an account exists, a new code has been sent." });
      }
      if (user.emailVerified) {
        return res.status(400).json({ message: "Email is already verified" });
      }
      const newCode = generateVerificationCode();
      await db.update(users).set({
        verificationToken: newCode,
        verificationCodeExpiry: new Date(Date.now() + 15 * 60 * 1000),
      }).where(eq(users.id, user.id));
      await sendVerificationEmail(email, newCode);
      res.json({ message: "A new verification code has been sent." });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to resend verification code" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        return res.json({ message: "If an account exists, a reset link has been sent." });
      }
      const resetToken = generateResetToken();
      await db.update(users).set({
        resetToken,
        resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
      }).where(eq(users.id, user.id));
      await sendPasswordResetEmail(email, resetToken);
      res.json({ message: "If an account exists, a reset link has been sent." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }
      const [user] = await db.select().from(users).where(eq(users.resetToken, token)).limit(1);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }
      if (user.resetTokenExpiry && new Date() > user.resetTokenExpiry) {
        return res.status(400).json({ message: "Reset link has expired. Please request a new one." });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.update(users).set({
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      }).where(eq(users.id, user.id));
      res.json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
      res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // If user is a creator, include their social usernames
      let creatorData: {
        creatorId?: number;
        instagramUsername?: string | null;
        tiktokUsername?: string | null;
        instagramFollowers?: number | null;
        tiktokFollowers?: number | null;
      } = {};
      
      if (user.role === "creator") {
        const [creator] = await db.select().from(creators).where(eq(creators.userId, user.id)).limit(1);
        if (creator) {
          creatorData = {
            creatorId: creator.id,
            instagramUsername: creator.instagramUsername,
            tiktokUsername: creator.tiktokUsername,
            instagramFollowers: creator.instagramFollowers,
            tiktokFollowers: creator.tiktokFollowers,
          };
        }
      }
      
      res.json({ 
        id: user.id, 
        email: user.email, 
        role: user.role,
        ...creatorData
      });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ message: "Auth check failed" });
    }
  });

  app.get("/api/creators", authenticateToken, async (req: any, res) => {
    try {
      const allCreators = await db.select().from(creators).orderBy(desc(creators.createdAt));
      res.json(allCreators);
    } catch (error) {
      console.error("Get creators error:", error);
      res.status(500).json({ message: "Failed to get creators" });
    }
  });

  app.get("/api/creators/:id", authenticateToken, async (req: any, res) => {
    try {
      const [creator] = await db.select().from(creators).where(eq(creators.id, parseInt(req.params.id))).limit(1);
      if (!creator) {
        return res.status(404).json({ message: "Creator not found" });
      }
      res.json(creator);
    } catch (error) {
      console.error("Get creator error:", error);
      res.status(500).json({ message: "Failed to get creator" });
    }
  });

  app.get("/api/creators/:id/videos", authenticateToken, async (req: any, res) => {
    try {
      const creatorVideos = await db.select().from(videos)
        .where(eq(videos.creatorId, parseInt(req.params.id)))
        .orderBy(desc(videos.postedAt));
      res.json(creatorVideos);
    } catch (error) {
      console.error("Get videos error:", error);
      res.status(500).json({ message: "Failed to get videos" });
    }
  });

  app.get("/api/my/creator", authenticateToken, async (req: any, res) => {
    try {
      const [creator] = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator) {
        return res.status(404).json({ message: "Creator profile not found" });
      }
      res.json(creator);
    } catch (error) {
      console.error("Get my creator error:", error);
      res.status(500).json({ message: "Failed to get creator profile" });
    }
  });

  app.get("/api/my/videos", authenticateToken, async (req: any, res) => {
    try {
      const [creator] = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator) {
        return res.status(404).json({ message: "Creator profile not found" });
      }
      const myVideos = await db.select().from(videos)
        .where(and(eq(videos.creatorId, creator.id), inArray(videos.platform, ["instagram", "tiktok"])))
        .orderBy(desc(videos.postedAt));
      res.json(myVideos);
    } catch (error) {
      console.error("Get my videos error:", error);
      res.status(500).json({ message: "Failed to get videos" });
    }
  });

  // Get creator videos with cycle information
  app.get("/api/creator/videos-with-cycle", authenticateToken, async (req: any, res) => {
    try {
      const [creator] = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator) {
        return res.status(404).json({ message: "Creator profile not found" });
      }

      const myVideos = await db.select().from(videos)
        .where(and(eq(videos.creatorId, creator.id), inArray(videos.platform, ["instagram", "tiktok"])))
        .orderBy(desc(videos.postedAt));

      // Get payout settings
      const [settings] = await db.select().from(payoutSettings).limit(1);
      const cycleDays = 14;
      const basePay = settings?.basePay ? parseFloat(settings.basePay as unknown as string) : 0;
      const myIgRate = creator.customInstagramBasePay !== null ? parseFloat(creator.customInstagramBasePay as unknown as string) : basePay;
      const myTtRate = creator.customTiktokBasePay !== null ? parseFloat(creator.customTiktokBasePay as unknown as string) : basePay;
      const tiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));

      // Calculate current cycle dates (bi-weekly starting from a reference date)
      const referenceDate = new Date("2026-01-01");
      const now = new Date();
      const daysSinceReference = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
      const currentCycleNumber = Math.floor(daysSinceReference / cycleDays);
      const cycleStartDate = new Date(referenceDate.getTime() + currentCycleNumber * cycleDays * 24 * 60 * 60 * 1000);
      const cycleEndDate = new Date(cycleStartDate.getTime() + cycleDays * 24 * 60 * 60 * 1000);

      const activeCycle = {
        id: currentCycleNumber,
        startDate: cycleStartDate.toISOString(),
        endDate: cycleEndDate.toISOString(),
        status: "active",
      };

      // Calculate all cycles that have videos
      const allCycles: Array<{id: number; startDate: string; endDate: string; status: string}> = [];
      const videoDates = myVideos.map(v => v.postedAt ? new Date(v.postedAt) : new Date());
      const minDate = videoDates.length > 0 ? new Date(Math.min(...videoDates.map(d => d.getTime()))) : now;
      const minCycleNumber = Math.floor((minDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24) / cycleDays);
      
      for (let i = minCycleNumber; i <= currentCycleNumber; i++) {
        const start = new Date(referenceDate.getTime() + i * cycleDays * 24 * 60 * 60 * 1000);
        const end = new Date(start.getTime() + cycleDays * 24 * 60 * 60 * 1000);
        allCycles.push({
          id: i,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          status: i === currentCycleNumber ? "active" : "completed",
        });
      }

      const videosWithPayInfoRaw = myVideos.map(video => {
        const views = video.views || 0;
        const matchingTier = tiers.find(t => views >= t.viewThreshold);
        const bonusAmount = matchingTier ? parseFloat(matchingTier.bonusAmount as unknown as string) : 0;

        const videoDate = video.postedAt ? new Date(video.postedAt) : new Date();
        let cycleId: number | null = null;
        for (const cycle of allCycles) {
          const cycleStart = new Date(cycle.startDate);
          const cycleEnd = new Date(cycle.endDate);
          if (videoDate >= cycleStart && videoDate <= cycleEnd) {
            cycleId = cycle.id;
            break;
          }
        }
        
        const platformRate = video.platform === "instagram" ? myIgRate : video.platform === "tiktok" ? myTtRate : basePay;
        return {
          ...video,
          timestamp: video.postedAt,
          cycleId,
          basePayPerVideo: platformRate,
          bonusAmount,
        };
      });

      const videosWithPayInfo = applyPairBonusLogic(videosWithPayInfoRaw);

      res.json({
        videos: videosWithPayInfo,
        activeCycle,
        allCycles: allCycles.reverse(),
        settings: {
          basePayPerVideo: basePay,
          instagramBasePayPerVideo: myIgRate,
          tiktokBasePayPerVideo: myTtRate,
        },
      });
    } catch (error) {
      console.error("Get videos with cycle error:", error);
      res.status(500).json({ message: "Failed to get videos" });
    }
  });

  app.get("/api/my/payouts", authenticateToken, async (req: any, res) => {
    try {
      const [creator] = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator) {
        return res.status(404).json({ message: "Creator profile not found" });
      }
      const myPayouts = await db.select().from(payouts)
        .where(eq(payouts.creatorId, creator.id))
        .orderBy(desc(payouts.createdAt));
      res.json(myPayouts);
    } catch (error) {
      console.error("Get my payouts error:", error);
      res.status(500).json({ message: "Failed to get payouts" });
    }
  });

  // Creator posting streak - personal 28-day grid
  app.get("/api/creator/posting-streak", authenticateToken, async (req: any, res) => {
    try {
      const [creator] = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      const now = new Date();
      const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      const dayOfWeek = todayUTC.getUTCDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const thisMonday = new Date(todayUTC.getTime() - mondayOffset * 86400000);
      const gridStart = new Date(thisMonday.getTime() - 21 * 86400000);

      const creatorVideos = await db.select().from(videos).where(
        and(eq(videos.creatorId, creator.id), gte(videos.postedAt, gridStart), eq(videos.isIrrelevant, false))
      );

      const postCountMap: Record<string, number> = {};
      for (const v of creatorVideos) {
        if (!v.postedAt) continue;
        const d = new Date(v.postedAt);
        const dateStr = getUTCDateStr(d);
        postCountMap[dateStr] = (postCountMap[dateStr] || 0) + 1;
      }

      const streakData: number[] = [];
      const dates: string[] = [];
      for (let i = 0; i < 28; i++) {
        const d = new Date(gridStart.getTime() + i * 86400000);
        const dateStr = getUTCDateStr(d);
        dates.push(dateStr);
        streakData.push(postCountMap[dateStr] || 0);
      }

      const allCreatorVideos = await db.select().from(videos).where(and(eq(videos.creatorId, creator.id), eq(videos.isIrrelevant, false)));
      const allPostDates = new Set(
        allCreatorVideos.filter(v => v.postedAt).map(v => getUTCDateStr(new Date(v.postedAt!)))
      );
      const sortedAllDates = [...allPostDates].sort().reverse();
      let currentStreak = 0;
      if (sortedAllDates.length > 0) {
        const todayStr = getUTCDateStr(now);
        const yesterdayStr = getUTCDateStr(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)));
        if (sortedAllDates[0] === todayStr || sortedAllDates[0] === yesterdayStr) {
          currentStreak = 1;
          for (let i = 1; i < sortedAllDates.length; i++) {
            const curr = new Date(sortedAllDates[i - 1] + 'T00:00:00Z');
            const prev = new Date(sortedAllDates[i] + 'T00:00:00Z');
            const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
            if (diff === 1) currentStreak++;
            else break;
          }
        }
      }

      const weekStart = thisMonday;
      const weekEnd = new Date(thisMonday.getTime() + 6 * 86400000);
      let daysPostedThisWeek = 0;
      for (let i = 0; i < 7; i++) {
        const d = getUTCDateStr(new Date(weekStart.getTime() + i * 86400000));
        if (postCountMap[d] && postCountMap[d] > 0) daysPostedThisWeek++;
      }

      const totalPosts28d = streakData.reduce((sum, v) => sum + v, 0);

      const allCycles = await db.select().from(payoutCycles).orderBy(payoutCycles.startDate);
      const activeCycle = allCycles.find(c => now >= new Date(c.startDate) && now <= new Date(c.endDate));
      let cycleVideos = 0;
      let cycleViews = 0;
      let cycleEarnings = 0;
      if (activeCycle) {
        const cycleVids = allCreatorVideos.filter(v => {
          if (!v.postedAt) return false;
          const posted = new Date(v.postedAt);
          return posted >= new Date(activeCycle.startDate) && posted <= new Date(activeCycle.endDate);
        });
        cycleVideos = cycleVids.length;
        cycleViews = cycleVids.reduce((sum, v) => sum + (v.views || 0), 0);
        cycleEarnings = cycleVids.reduce((sum, v) => sum + parseFloat(v.totalPay || '0'), 0);
      }

      res.json({
        streakData,
        dates,
        currentStreak,
        thisWeek: `${daysPostedThisWeek} / 7 days`,
        totalPosts28d,
        cycleVideos,
        cycleViews,
        cycleEarnings,
      });
    } catch (error) {
      console.error("Creator posting streak error:", error);
      res.status(500).json({ message: "Failed to get posting streak" });
    }
  });

  app.get("/api/payouts", authenticateToken, async (req: any, res) => {
    try {
      const allPayouts = await db.select().from(payouts).orderBy(desc(payouts.createdAt));
      res.json(allPayouts);
    } catch (error) {
      console.error("Get payouts error:", error);
      res.status(500).json({ message: "Failed to get payouts" });
    }
  });

  app.get("/api/settings/payout", authenticateToken, async (req: any, res) => {
    try {
      let [settings] = await db.select().from(payoutSettings).limit(1);
      if (!settings) {
        [settings] = await db.insert(payoutSettings).values({}).returning();
      }
      res.json(settings);
    } catch (error) {
      console.error("Get payout settings error:", error);
      res.status(500).json({ message: "Failed to get payout settings" });
    }
  });

  app.put("/api/settings/payout", authenticateToken, async (req: any, res) => {
    try {
      const { basePay } = req.body;
      let [settings] = await db.select().from(payoutSettings).limit(1);
      if (!settings) {
        [settings] = await db.insert(payoutSettings).values({ basePay }).returning();
      } else {
        [settings] = await db.update(payoutSettings)
          .set({ basePay, updatedAt: new Date() })
          .where(eq(payoutSettings.id, settings.id))
          .returning();
      }
      res.json(settings);
    } catch (error) {
      console.error("Update payout settings error:", error);
      res.status(500).json({ message: "Failed to update payout settings" });
    }
  });

  app.get("/api/support", authenticateToken, async (req: any, res) => {
    try {
      const tickets = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
      res.json(tickets);
    } catch (error) {
      console.error("Get support tickets error:", error);
      res.status(500).json({ message: "Failed to get support tickets" });
    }
  });

  app.post("/api/support", authenticateToken, async (req: any, res) => {
    try {
      const [creator] = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator) {
        return res.status(404).json({ message: "Creator profile not found" });
      }
      const { subject, message, priority } = req.body;
      const [ticket] = await db.insert(supportTickets).values({
        creatorId: creator.id,
        subject,
        message,
        priority: priority || "normal",
      }).returning();
      res.json(ticket);
    } catch (error) {
      console.error("Create support ticket error:", error);
      res.status(500).json({ message: "Failed to create support ticket" });
    }
  });

  app.get("/api/stats", authenticateToken, async (req: any, res) => {
    try {
      const totalCreators = await db.select({ count: sql<number>`count(*)` }).from(creators);
      const totalVideos = await db.select({ count: sql<number>`count(*)` }).from(videos).where(inArray(videos.platform, ["instagram", "tiktok"]));
      const totalViews = await db.select({ sum: sql<number>`coalesce(sum(views), 0)` }).from(videos).where(inArray(videos.platform, ["instagram", "tiktok"]));
      res.json({
        totalCreators: Number(totalCreators[0].count),
        totalVideos: Number(totalVideos[0].count),
        totalViews: Number(totalViews[0].sum),
      });
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  // Update creator socials (Instagram/TikTok usernames)
  app.put("/api/creator/socials", authenticateToken, async (req: any, res) => {
    try {
      const [creator] = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator) {
        return res.status(404).json({ message: "Creator profile not found" });
      }
      const { instagramUsername, tiktokUsername } = req.body;
      const [updated] = await db.update(creators)
        .set({ 
          instagramUsername: instagramUsername || null, 
          tiktokUsername: tiktokUsername || null,
          instagramConnected: !!instagramUsername,
          tiktokConnected: !!tiktokUsername,
          updatedAt: new Date()
        })
        .where(eq(creators.id, creator.id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Update socials error:", error);
      res.status(500).json({ message: "Failed to update socials" });
    }
  });

  // Sync creator's videos from social platforms
  app.post("/api/creator/sync", authenticateToken, async (req: any, res) => {
    try {
      const [creator] = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator) {
        return res.status(404).json({ message: "Creator profile not found" });
      }

      // Check daily sync limit (3 per day)
      const today = new Date().toISOString().split('T')[0];
      const currentSyncCount = creator.lastSyncDate === today ? (creator.dailySyncCount || 0) : 0;
      
      if (currentSyncCount >= 3) {
        return res.status(429).json({ 
          message: "Daily refresh limit reached. You can refresh 3 times per day.",
          remainingRefreshes: 0
        });
      }

      let instagramCount = 0;
      let tiktokCount = 0;

      if (creator.instagramUsername) {
        console.log(`Fetching Instagram reels for @${creator.instagramUsername}`);
        const { reels, error } = await fetchInstagramReels(creator.instagramUsername);
        if (error) {
          console.error("Instagram fetch error:", error);
        } else if (reels && reels.length > 0) {
          instagramCount = await replaceCreatorPlatformVideos(creator.id, "instagram", reels);
        }

        const profile = await fetchInstagramProfile(creator.instagramUsername);
        if (profile) {
          await db.update(creators)
            .set({ instagramFollowers: profile.followers })
            .where(eq(creators.id, creator.id));
        }
      }

      if (creator.tiktokUsername) {
        console.log(`Fetching TikTok videos for @${creator.tiktokUsername}`);
        const previousTTCount = await db.select({ count: sql<number>`count(*)` }).from(videos).where(and(eq(videos.creatorId, creator.id), eq(videos.platform, 'tiktok')));
        const ttPrevCount = Number(previousTTCount[0]?.count || 0);
        const { videos: tiktokVideos, error } = await fetchTikTokVideos(creator.tiktokUsername, ttPrevCount);
        if (error) {
          console.error("TikTok fetch error:", error);
        } else if (tiktokVideos && tiktokVideos.length > 0) {
          tiktokCount = await replaceCreatorPlatformVideos(creator.id, "tiktok", tiktokVideos);
        }

        const profile = await fetchTikTokProfile(creator.tiktokUsername);
        if (profile) {
          await db.update(creators)
            .set({ tiktokFollowers: profile.followers })
            .where(eq(creators.id, creator.id));
        }
      }

      const newSyncCount = (creator.lastSyncDate === today ? (creator.dailySyncCount || 0) : 0) + 1;
      await db.update(creators)
        .set({ 
          lastSyncAt: new Date(),
          dailySyncCount: newSyncCount,
          lastSyncDate: today
        })
        .where(eq(creators.id, creator.id));

      await detectCelebrations(creator.id);
      await detectViolations(creator.id);
      await updateSurvivorGameStats([creator.id]);

      res.json({ 
        message: "Sync complete", 
        instagram: instagramCount, 
        tiktok: tiktokCount,
        remainingRefreshes: 3 - newSyncCount
      });
    } catch (error) {
      console.error("Sync error:", error);
      res.status(500).json({ message: "Failed to sync videos" });
    }
  });

  // Get creator refresh status (checks if they can refresh and how many refreshes left)
  app.get("/api/creator/refresh-status", authenticateToken, async (req: any, res) => {
    try {
      const [creator] = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator) {
        return res.status(404).json({ message: "Creator profile not found" });
      }
      
      const maxRefreshesPerDay = 3;
      const today = new Date().toISOString().split('T')[0];
      const usedToday = creator.lastSyncDate === today ? (creator.dailySyncCount || 0) : 0;
      const refreshesRemaining = Math.max(0, maxRefreshesPerDay - usedToday);
      const canRefresh = refreshesRemaining > 0;
      
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      
      res.json({
        canRefresh,
        refreshesUsed: usedToday,
        refreshesRemaining,
        maxRefreshesPerDay,
        lastRefreshedAt: creator.lastSyncAt,
        nextResetAt: !canRefresh ? tomorrow.toISOString() : null,
      });
    } catch (error) {
      console.error("Get refresh status error:", error);
      res.status(500).json({ message: "Failed to get refresh status" });
    }
  });

  // Refresh creator engagement (sync videos and update metrics)
  app.post("/api/creator/refresh-engagement", authenticateToken, async (req: any, res) => {
    try {
      const [creator] = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator) {
        return res.status(404).json({ message: "Creator profile not found" });
      }

      const [currentUser] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      const isAdmin = currentUser?.role === "admin";

      if (!isAdmin) {
        const maxRefreshesPerDay = 3;
        const today = new Date().toISOString().split('T')[0];
        const usedToday = creator.lastSyncDate === today ? (creator.dailySyncCount || 0) : 0;
        
        if (usedToday >= maxRefreshesPerDay) {
          return res.status(429).json({ 
            message: "Daily refresh limit reached. You can refresh 3 times per day.",
            refreshesRemaining: 0
          });
        }
      }

      let instagramCount = 0;
      let tiktokCount = 0;

      if (creator.instagramUsername) {
        const { reels, error } = await fetchInstagramReels(creator.instagramUsername);
        if (!error && reels && reels.length > 0) {
          instagramCount = await replaceCreatorPlatformVideos(creator.id, "instagram", reels);
        }

        const profile = await fetchInstagramProfile(creator.instagramUsername);
        if (profile) {
          await db.update(creators)
            .set({ instagramFollowers: profile.followers })
            .where(eq(creators.id, creator.id));
        }
      }

      if (creator.tiktokUsername) {
        const previousTTCount = await db.select({ count: sql<number>`count(*)` }).from(videos).where(and(eq(videos.creatorId, creator.id), eq(videos.platform, 'tiktok')));
        const ttPrevCount = Number(previousTTCount[0]?.count || 0);
        const { videos: tiktokVideos, error } = await fetchTikTokVideos(creator.tiktokUsername, ttPrevCount);
        if (!error && tiktokVideos && tiktokVideos.length > 0) {
          tiktokCount = await replaceCreatorPlatformVideos(creator.id, "tiktok", tiktokVideos);
        }

        const profile = await fetchTikTokProfile(creator.tiktokUsername);
        if (profile) {
          await db.update(creators)
            .set({ tiktokFollowers: profile.followers })
            .where(eq(creators.id, creator.id));
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const newSyncCount = (creator.lastSyncDate === today ? (creator.dailySyncCount || 0) : 0) + 1;
      await db.update(creators)
        .set({ 
          lastSyncAt: new Date(),
          dailySyncCount: newSyncCount,
          lastSyncDate: today
        })
        .where(eq(creators.id, creator.id));

      const maxRefreshesPerDay = 3;
      const refreshesRemaining = Math.max(0, maxRefreshesPerDay - newSyncCount);

      res.json({ 
        instagram: instagramCount, 
        tiktok: tiktokCount,
        refreshesRemaining
      });
    } catch (error) {
      console.error("Refresh engagement error:", error);
      res.status(500).json({ message: "Failed to refresh engagement" });
    }
  });

  // Admin: Get payout settings with pending changes
  app.get("/api/admin/settings/payout", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      let [settings] = await db.select().from(payoutSettings).limit(1);
      if (!settings) {
        [settings] = await db.insert(payoutSettings).values({}).returning();
      }

      res.json({
        current: {
          ...settings,
          instagramBasePayPerVideo: parseFloat(settings.basePay || "10"),
          tiktokBasePayPerVideo: parseFloat(settings.basePay || "10"),
          minVideosPerWeek: settings.minVideosPerWeek,
          maxVideosPerDay: settings.maxVideosPerDay,
        },
        pending: null,
      });
    } catch (error) {
      console.error("Get admin payout settings error:", error);
      res.status(500).json({ message: "Failed to get payout settings" });
    }
  });

  // Admin: Update payout settings
  app.put("/api/admin/settings/payout", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { instagramBasePayPerVideo, tiktokBasePayPerVideo, minVideosPerWeek, maxVideosPerDay } = req.body;
      
      const basePay = String(instagramBasePayPerVideo || 10);
      const updateData: any = { basePay, updatedAt: new Date() };
      if (minVideosPerWeek !== undefined) updateData.minVideosPerWeek = Number(minVideosPerWeek);
      if (maxVideosPerDay !== undefined) updateData.maxVideosPerDay = Number(maxVideosPerDay);

      let [settings] = await db.select().from(payoutSettings).limit(1);
      if (!settings) {
        [settings] = await db.insert(payoutSettings).values(updateData).returning();
      } else {
        [settings] = await db.update(payoutSettings)
          .set(updateData)
          .where(eq(payoutSettings.id, settings.id))
          .returning();
      }

      res.json({
        current: {
          ...settings,
          instagramBasePayPerVideo: parseFloat(settings.basePay || "10"),
          tiktokBasePayPerVideo: parseFloat(settings.basePay || "10"),
          minVideosPerWeek: settings.minVideosPerWeek,
          maxVideosPerDay: settings.maxVideosPerDay,
        },
        pending: null,
      });
    } catch (error) {
      console.error("Update admin payout settings error:", error);
      res.status(500).json({ message: "Failed to update payout settings" });
    }
  });

  // GET /api/admin/bonus-tiers - List all bonus tiers
  app.get("/api/bonus-tiers", authenticateToken, async (req: any, res) => {
    try {
      const tiers = await db.select().from(bonusTiers).orderBy(bonusTiers.viewThreshold);
      res.json(tiers);
    } catch (error) {
      console.error("Get bonus tiers error:", error);
      res.status(500).json({ message: "Failed to get bonus tiers" });
    }
  });

  app.get("/api/admin/bonus-tiers", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const tiers = await db.select().from(bonusTiers).orderBy(bonusTiers.viewThreshold);
      res.json(tiers);
    } catch (error) {
      console.error("Get bonus tiers error:", error);
      res.status(500).json({ message: "Failed to get bonus tiers" });
    }
  });

  // POST /api/admin/bonus-tiers - Create a new bonus tier
  app.post("/api/admin/bonus-tiers", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { viewThreshold, bonusAmount } = req.body;
      const [tier] = await db.insert(bonusTiers).values({
        viewThreshold: parseInt(viewThreshold),
        bonusAmount: String(bonusAmount),
      }).returning();
      res.json(tier);
    } catch (error) {
      console.error("Create bonus tier error:", error);
      res.status(500).json({ message: "Failed to create bonus tier" });
    }
  });

  // PUT /api/admin/bonus-tiers/:id - Update a bonus tier
  app.put("/api/admin/bonus-tiers/:id", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { id } = req.params;
      const { viewThreshold, bonusAmount } = req.body;
      const [tier] = await db.update(bonusTiers)
        .set({ viewThreshold: parseInt(viewThreshold), bonusAmount: String(bonusAmount), updatedAt: new Date() })
        .where(eq(bonusTiers.id, parseInt(id)))
        .returning();
      res.json(tier);
    } catch (error) {
      console.error("Update bonus tier error:", error);
      res.status(500).json({ message: "Failed to update bonus tier" });
    }
  });

  // DELETE /api/admin/bonus-tiers/:id - Delete a bonus tier
  app.delete("/api/admin/bonus-tiers/:id", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      await db.delete(bonusTiers).where(eq(bonusTiers.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Delete bonus tier error:", error);
      res.status(500).json({ message: "Failed to delete bonus tier" });
    }
  });

  app.get("/api/creator/dashboard-stats", authenticateToken, async (req: any, res) => {
    try {
      const stats = await computeDashboardStats();
      const { totalPay, basePay, bonusPay, moneyPaidTillNow, ...creatorStats } = stats;
      const creatorDeltas = stats.deltas ? (() => {
        const { totalPay: _tp, moneyPaidTillNow: _mp, ...rest } = stats.deltas;
        return rest;
      })() : null;
      res.json({ ...creatorStats, deltas: creatorDeltas });
    } catch (error) {
      console.error("Get creator dashboard stats error:", error);
      res.status(500).json({ message: "Failed to get dashboard stats" });
    }
  });

  app.get("/api/creator/team-stats", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "creator") {
        return res.status(403).json({ message: "Creator access required" });
      }

      const allCreators = await db.select().from(creators).where(eq(creators.status, "active"));
      const allCycles = await db.select().from(payoutCycles).orderBy(desc(payoutCycles.startDate));
      const now = new Date();
      const activeCycle = allCycles.find(c => new Date(c.startDate) <= now && new Date(c.endDate) >= now);
      const allVideos = await db.select().from(videos);

      const result = allCreators.map((creator) => {
        const creatorVideos = allVideos.filter(v => v.creatorId === creator.id);
        const eligibleVids = creatorVideos.filter(v => {
          if (v.isIrrelevant) return false;
          if (!v.postedAt) return false;
          return true;
        });

        const cycleVids = activeCycle
          ? eligibleVids.filter(v => {
              if (!v.postedAt) return false;
              const posted = new Date(v.postedAt);
              return posted >= new Date(activeCycle.startDate) && posted <= new Date(activeCycle.endDate);
            })
          : [];

        const igAll = eligibleVids.filter(v => v.platform === "instagram");
        const ttAll = eligibleVids.filter(v => v.platform === "tiktok");
        const igCycle = cycleVids.filter(v => v.platform === "instagram");
        const ttCycle = cycleVids.filter(v => v.platform === "tiktok");

        return {
          id: creator.id,
          name: creator.instagramUsername || creator.tiktokUsername || "Creator",
          videosThisCycle: cycleVids.length,
          totalVideosAllTime: eligibleVids.length,
          igViewsThisCycle: igCycle.reduce((s, v) => s + (v.views || 0), 0),
          igViewsAllTime: igAll.reduce((s, v) => s + (v.views || 0), 0),
          tiktokViewsThisCycle: ttCycle.reduce((s, v) => s + (v.views || 0), 0),
          tiktokViewsAllTime: ttAll.reduce((s, v) => s + (v.views || 0), 0),
          instagramFollowers: creator.instagramFollowers ?? 0,
          tiktokFollowers: creator.tiktokFollowers ?? 0,
        };
      });

      res.json({ creators: result });
    } catch (error) {
      console.error("Get creator team stats error:", error);
      res.status(500).json({ message: "Failed to get team stats" });
    }
  });

  // Creator: Get own detail (mirrors admin creator detail endpoint)
  app.get("/api/creator/detail", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "creator") {
        return res.status(403).json({ message: "Creator access required" });
      }

      const [creator] = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator) {
        return res.status(404).json({ message: "Creator profile not found" });
      }

      const creatorVideos = await db.select().from(videos).where(eq(videos.creatorId, creator.id));
      const creatorPayouts = await db.select().from(payouts).where(eq(payouts.creatorId, creator.id));
      const [settings] = await db.select().from(payoutSettings).limit(1);
      const creatorViolations = await db.select().from(violations)
        .where(eq(violations.creatorId, creator.id));

      const allCycles = await db.select().from(payoutCycles).orderBy(payoutCycles.startDate);
      const now = new Date();
      
      const activeCycle = allCycles.find(c => {
        const start = new Date(c.startDate);
        const end = new Date(c.endDate);
        return now >= start && now <= end;
      }) || null;

      const eligibleCreatorVideos = creatorVideos.filter(v => {
        if (v.isIrrelevant) return false;
        if (!v.postedAt) return false;
        return true;
      });
      const igVideos = eligibleCreatorVideos.filter(v => v.platform === "instagram");
      const tiktokVideos = eligibleCreatorVideos.filter(v => v.platform === "tiktok");
      const igViews = igVideos.reduce((sum, v) => sum + (v.views || 0), 0);
      const tiktokViews = tiktokVideos.reduce((sum, v) => sum + (v.views || 0), 0);

      const basePayRate = settings?.basePay ? parseFloat(settings.basePay as unknown as string) : 0;
      const igRate = creator.customInstagramBasePay !== null ? parseFloat(creator.customInstagramBasePay as unknown as string) : basePayRate;
      const ttRate = creator.customTiktokBasePay !== null ? parseFloat(creator.customTiktokBasePay as unknown as string) : basePayRate;
      
      const detailTiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));

      const enrichedVideosRaw = creatorVideos.map(v => {
        const videoDate = v.postedAt ? new Date(v.postedAt) : new Date();
        let cycleId: number | null = null;
        
        for (const cycle of allCycles) {
          const cycleStart = new Date(cycle.startDate);
          const cycleEnd = new Date(cycle.endDate);
          if (videoDate >= cycleStart && videoDate <= cycleEnd) {
            cycleId = cycle.id;
            break;
          }
        }
        
        const views = v.views || 0;
        const matchingTier = detailTiers.find(t => views >= t.viewThreshold);
        const bonusAmount = matchingTier ? parseFloat(matchingTier.bonusAmount as unknown as string) : 0;

        const isEligible = !v.isIrrelevant && !!v.postedAt;
        const platformRate = v.platform === "instagram" ? igRate : v.platform === "tiktok" ? ttRate : basePayRate;
        
        return {
          ...v,
          timestamp: v.postedAt,
          isEligible,
          cycleId,
          basePayPerVideo: isEligible ? platformRate : 0,
          bonusAmount: isEligible ? bonusAmount : 0,
        };
      });

      const enrichedVideos = applyPairBonusLogic(enrichedVideosRaw);

      const payoutsWithCycle = creatorPayouts.map(p => {
        const cycle = allCycles.find(c => c.id === p.cycleId);
        return {
          ...p,
          cycle: cycle ? {
            startDate: cycle.startDate.toISOString(),
            endDate: cycle.endDate.toISOString(),
          } : null,
        };
      });

      // Add calculated payout for active cycle if no payout record exists
      if (activeCycle && !creatorPayouts.some(p => p.cycleId === activeCycle.id)) {
        const cycleVids = enrichedVideos.filter(v => v.cycleId === activeCycle.id && v.isEligible && !v.isIrrelevant);
        const igVids1 = cycleVids.filter(v => v.platform === "instagram" && !v.isIrrelevant);
        const ttVids1 = cycleVids.filter(v => v.platform === "tiktok" && !v.isIrrelevant);
        const usedTt1 = new Set<number>();
        const PAIR_WINDOW_MS1 = 24 * 60 * 60 * 1000;
        let calcBase = 0;
        let calcBonus = 0;
        let eligibleViews = 0;

        for (const ig of igVids1) {
          if (!ig.postedAt || ig.duration == null) continue;
          const igTime = new Date(ig.postedAt).getTime();
          let bestMatch: typeof ttVids1[0] | null = null;
          let bestDurationDiff = Infinity;
          let bestTimeDiff = Infinity;
          for (const tt of ttVids1) {
            if (usedTt1.has(tt.id)) continue;
            if (!tt.postedAt || tt.duration == null) continue;
            const durationDiff = Math.abs(ig.duration - tt.duration);
            if (durationDiff > 1) continue;
            const timeDiff = Math.abs(igTime - new Date(tt.postedAt).getTime());
            if (timeDiff <= PAIR_WINDOW_MS1 && (durationDiff < bestDurationDiff || (durationDiff === bestDurationDiff && timeDiff < bestTimeDiff))) {
              bestDurationDiff = durationDiff;
              bestTimeDiff = timeDiff;
              bestMatch = tt;
            }
          }
          if (bestMatch) {
            usedTt1.add(bestMatch.id);
            calcBase += igRate + ttRate;
            const winnerViews = Math.max(ig.views || 0, bestMatch.views || 0);
            eligibleViews += (ig.views || 0) + (bestMatch.views || 0);
            const matchingTier = detailTiers.find(t => winnerViews >= t.viewThreshold);
            if (matchingTier) {
              calcBonus += parseFloat(matchingTier.bonusAmount as unknown as string);
            }
          }
        }

        const calcTotal = calcBase + calcBonus;
        payoutsWithCycle.unshift({
          id: -1,
          creatorId: creator.id,
          cycleId: activeCycle.id,
          amount: calcTotal.toFixed(2),
          status: "pending",
          paidAt: null,
          periodStart: activeCycle.startDate,
          periodEnd: activeCycle.endDate,
          notes: null,
          paymentMethod: null,
          paymentReference: null,
          createdAt: activeCycle.createdAt,
          updatedAt: activeCycle.updatedAt,
          cycle: {
            startDate: activeCycle.startDate.toISOString(),
            endDate: activeCycle.endDate.toISOString(),
          },
          baseAmount: calcBase.toFixed(2),
          bonusAmount: calcBonus.toFixed(2),
          totalAmount: calcTotal.toFixed(2),
          eligibleViews,
          isCalculated: true,
        } as any);
      }

      res.json({
        creator: {
          ...creator,
          isPaused: creator.status === "paused",
          isDeleted: creator.status === "deleted",
        },
        videos: enrichedVideos,
        violations: creatorViolations,
        payouts: payoutsWithCycle,
        activeCycle,
        payoutSettings: settings || null,
        allTimeStats: {
          totalVideos: eligibleCreatorVideos.length,
          igViews,
          tiktokViews,
          igVideos: igVideos.length,
          tiktokVideos: tiktokVideos.length,
          totalViews: igViews + tiktokViews,
          totalEarnings: creator.totalEarnings || 0,
        },
      });
    } catch (error) {
      console.error("Get creator detail error:", error);
      res.status(500).json({ message: "Failed to get creator details" });
    }
  });

  // Creator: Get top videos from all creators with filters (mirrors admin endpoint)
  app.get("/api/creator/top-videos", authenticateToken, async (req: any, res) => {
    try {
      const period = (req.query.period as string) || "cycle";
      const sortBy = (req.query.sortBy as string) || "views";
      const limit = parseInt(req.query.limit as string) || 10;

      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (period === "today") {
        startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      } else if (period === "yesterday") {
        const yesterday = new Date(now);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        startDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0));
        endDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59, 999));
      } else if (period === "cycle") {
        const allCycles = await db.select().from(payoutCycles).orderBy(payoutCycles.startDate);
        const activeCycle = allCycles.find(c => {
          const start = new Date(c.startDate);
          const end = new Date(c.endDate);
          return now >= start && now <= end;
        });
        if (activeCycle) {
          startDate = new Date(activeCycle.startDate);
          endDate = new Date(activeCycle.endDate);
        }
      }

      const selectFields = {
        id: videos.id,
        platform: videos.platform,
        videoId: videos.videoId,
        platformVideoId: videos.platformVideoId,
        videoFileUrl: videos.videoFileUrl,
        thumbnail: videos.thumbnail,
        caption: videos.caption,
        views: videos.views,
        likes: videos.likes,
        comments: videos.comments,
        postedAt: videos.postedAt,
        creatorId: videos.creatorId,
        creatorName: creators.name,
        creatorEmail: creators.email,
        instagramUsername: creators.instagramUsername,
        tiktokUsername: creators.tiktokUsername,
      };

      const eligibleFilter = sql`(${videos.isIrrelevant} = false OR ${videos.isIrrelevant} IS NULL) AND ${videos.postedAt} >= ${creators.createdAt} AND ${creators.status} = 'active'`;

      let topVideosQuery;
      let totalCountResult;

      if (sortBy === "engagementRate") {
        if (startDate && endDate) {
          totalCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(videos)
            .leftJoin(creators, eq(videos.creatorId, creators.id))
            .where(sql`${videos.postedAt} >= ${startDate} AND ${videos.postedAt} <= ${endDate} AND ${eligibleFilter}`);

          topVideosQuery = await db
            .select(selectFields)
            .from(videos)
            .leftJoin(creators, eq(videos.creatorId, creators.id))
            .where(sql`${videos.postedAt} >= ${startDate} AND ${videos.postedAt} <= ${endDate} AND ${eligibleFilter}`);
        } else {
          totalCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(videos)
            .leftJoin(creators, eq(videos.creatorId, creators.id))
            .where(eligibleFilter);

          topVideosQuery = await db
            .select(selectFields)
            .from(videos)
            .leftJoin(creators, eq(videos.creatorId, creators.id))
            .where(eligibleFilter);
        }

        const withEngagement = topVideosQuery.map(v => ({
          ...v,
          engagementRate: (v.views || 0) > 0 ? Math.round(((v.likes || 0) + (v.comments || 0)) / (v.views || 1) * 100 * 100) / 100 : 0,
        }));
        withEngagement.sort((a, b) => b.engagementRate - a.engagementRate);
        const sliced = withEngagement.slice(0, limit);

        const totalCount = Number(totalCountResult[0]?.count || 0);
        const formattedVideos = sliced.map(v => ({
          ...v,
          username: v.platform === "instagram" ? v.instagramUsername : v.tiktokUsername,
        }));

        return res.json({ videos: formattedVideos, totalCount });
      }

      let orderByColumn;
      if (sortBy === "likes") {
        orderByColumn = desc(videos.likes);
      } else if (sortBy === "comments") {
        orderByColumn = desc(videos.comments);
      } else {
        orderByColumn = desc(videos.views);
      }

      if (startDate && endDate) {
        totalCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(videos)
          .leftJoin(creators, eq(videos.creatorId, creators.id))
          .where(sql`${videos.postedAt} >= ${startDate} AND ${videos.postedAt} <= ${endDate} AND ${eligibleFilter}`);

        topVideosQuery = await db
          .select(selectFields)
          .from(videos)
          .leftJoin(creators, eq(videos.creatorId, creators.id))
          .where(sql`${videos.postedAt} >= ${startDate} AND ${videos.postedAt} <= ${endDate} AND ${eligibleFilter}`)
          .orderBy(orderByColumn)
          .limit(limit);
      } else {
        totalCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(videos)
          .leftJoin(creators, eq(videos.creatorId, creators.id))
          .where(eligibleFilter);

        topVideosQuery = await db
          .select(selectFields)
          .from(videos)
          .leftJoin(creators, eq(videos.creatorId, creators.id))
          .where(eligibleFilter)
          .orderBy(orderByColumn)
          .limit(limit);
      }

      const totalCount = Number(totalCountResult[0]?.count || 0);
      const formattedVideos = topVideosQuery.map(v => ({
        ...v,
        engagementRate: (v.views || 0) > 0 ? Math.round(((v.likes || 0) + (v.comments || 0)) / (v.views || 1) * 100 * 100) / 100 : 0,
        username: v.platform === "instagram" ? v.instagramUsername : v.tiktokUsername,
      }));

      res.json({ videos: formattedVideos, totalCount });
    } catch (error) {
      console.error("Get creator top videos error:", error);
      res.status(500).json({ message: "Failed to get top videos" });
    }
  });

  app.get("/api/creator/team-members", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const status = req.query.status || "active";

      let allCreators = await db.select().from(creators).orderBy(desc(creators.createdAt));

      if (status === "active") {
        allCreators = allCreators.filter(c => c.status === "active");
      } else if (status === "paused") {
        allCreators = allCreators.filter(c => c.status === "paused");
      } else if (status === "deleted") {
        allCreators = allCreators.filter(c => c.status === "deleted");
      }

      const allCycles = await db.select().from(payoutCycles).orderBy(desc(payoutCycles.startDate));
      const now = new Date();
      const activeCycle = allCycles.find(c => new Date(c.startDate) <= now && new Date(c.endDate) >= now);

      const allVideos = await db.select().from(videos)
        .where(inArray(videos.platform, ["instagram", "tiktok"]));

      const enrichedCreators = allCreators.map((creator) => {
        const creatorVideos = allVideos.filter(v => v.creatorId === creator.id);

        const eligibleVids = creatorVideos.filter(v => {
          if (v.isIrrelevant) return false;
          if (!v.postedAt) return false;
          return true;
        });

        const cycleVids = activeCycle
          ? eligibleVids.filter(v => {
              if (!v.postedAt) return false;
              const posted = new Date(v.postedAt);
              return posted >= new Date(activeCycle.startDate) && posted <= new Date(activeCycle.endDate);
            })
          : [];

        const igCycle = cycleVids.filter(v => v.platform === "instagram");
        const ttCycle = cycleVids.filter(v => v.platform === "tiktok");
        const igAll = eligibleVids.filter(v => v.platform === "instagram");
        const ttAll = eligibleVids.filter(v => v.platform === "tiktok");

        const { basePay, totalEarnings, ...safeCreator } = creator;
        return {
          ...safeCreator,
          basePay: null,
          totalEarnings: null,
          videosThisCycle: cycleVids.length,
          eligibleVideos: eligibleVids.length,
          totalVideosAllTime: eligibleVids.length,
          viewsThisCycle: cycleVids.reduce((s, v) => s + (v.views || 0), 0),
          eligibleViews: eligibleVids.reduce((s, v) => s + (v.views || 0), 0),
          totalViewsAllTime: eligibleVids.reduce((s, v) => s + (v.views || 0), 0),
          igViewsThisCycle: igCycle.reduce((s, v) => s + (v.views || 0), 0),
          igViewsAllTime: igAll.reduce((s, v) => s + (v.views || 0), 0),
          tiktokViewsThisCycle: ttCycle.reduce((s, v) => s + (v.views || 0), 0),
          tiktokViewsAllTime: ttAll.reduce((s, v) => s + (v.views || 0), 0),
          earningsThisCycle: 0,
          totalPaid: 0,
          isPaused: creator.status === "paused",
          isDeleted: creator.status === "deleted",
        };
      });

      res.json(enrichedCreators);
    } catch (error) {
      console.error("Get team members error:", error);
      res.status(500).json({ message: "Failed to get team members" });
    }
  });

  // Creator: Get top accounts (mirrors admin endpoint)
  app.get("/api/creator/top-accounts", authenticateToken, async (req: any, res) => {
    try {
      const period = (req.query.period as string) || "cycle";
      const metric = (req.query.metric as string) || "views";
      const limit = parseInt(req.query.limit as string) || 10;

      const allCreators = await db.select().from(creators).where(eq(creators.status, "active"));
      
      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (period === "today") {
        startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      } else if (period === "yesterday") {
        const yesterday = new Date(now);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        startDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0));
        endDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59, 999));
      } else if (period === "cycle") {
        const allCycles = await db.select().from(payoutCycles).orderBy(payoutCycles.startDate);
        const activeCycle = allCycles.find(c => {
          const start = new Date(c.startDate);
          const end = new Date(c.endDate);
          return now >= start && now <= end;
        });
        if (activeCycle) {
          startDate = new Date(activeCycle.startDate);
          endDate = new Date(activeCycle.endDate);
        }
      }

      let allVideos;
      if (startDate && endDate) {
        allVideos = await db.select().from(videos)
          .where(sql`${videos.postedAt} >= ${startDate} AND ${videos.postedAt} <= ${endDate}`);
      } else {
        allVideos = await db.select().from(videos);
      }

      const creatorStats = allCreators.map(creator => {
        const creatorVideos = allVideos.filter(v => v.creatorId === creator.id && v.isIrrelevant !== true && !!v.postedAt);
        
        const igVideos = creatorVideos.filter(v => v.platform === "instagram");
        const ttVideos = creatorVideos.filter(v => v.platform === "tiktok");
        
        const instagramViews = igVideos.reduce((sum, v) => sum + (v.views || 0), 0);
        const tiktokViews = ttVideos.reduce((sum, v) => sum + (v.views || 0), 0);
        
        const instagramLikes = igVideos.reduce((sum, v) => sum + (v.likes || 0), 0);
        const tiktokLikes = ttVideos.reduce((sum, v) => sum + (v.likes || 0), 0);
        
        const instagramComments = igVideos.reduce((sum, v) => sum + (v.comments || 0), 0);
        const tiktokComments = ttVideos.reduce((sum, v) => sum + (v.comments || 0), 0);

        const totalViews = instagramViews + tiktokViews;
        const totalLikes = instagramLikes + tiktokLikes;
        const totalComments = instagramComments + tiktokComments;
        const videoCount = creatorVideos.length;
        const avgViews = videoCount > 0 ? Math.round(totalViews / videoCount) : 0;
        const avgLikes = videoCount > 0 ? Math.round(totalLikes / videoCount) : 0;

        return {
          id: creator.id,
          name: creator.name,
          email: creator.email,
          instagramUsername: creator.instagramUsername,
          tiktokUsername: creator.tiktokUsername,
          views: totalViews,
          likes: totalLikes,
          comments: totalComments,
          videos: videoCount,
          avgViews,
          avgLikes,
          instagramViews,
          tiktokViews,
          instagramLikes,
          tiktokLikes,
          instagramComments,
          tiktokComments,
          instagramFollowers: creator.instagramFollowers || 0,
          tiktokFollowers: creator.tiktokFollowers || 0,
        };
      });

      creatorStats.sort((a, b) => {
        const aHasSocial = !!(a.instagramUsername || a.tiktokUsername);
        const bHasSocial = !!(b.instagramUsername || b.tiktokUsername);
        if (aHasSocial !== bHasSocial) return aHasSocial ? -1 : 1;
        if (metric === "likes") return b.likes - a.likes;
        if (metric === "comments") return b.comments - a.comments;
        if (metric === "avgViews") return b.avgViews - a.avgViews;
        if (metric === "avgLikes") return b.avgLikes - a.avgLikes;
        return b.views - a.views;
      });

      res.json({
        accounts: creatorStats.slice(0, limit),
        totalCount: allCreators.length
      });
    } catch (error) {
      console.error("Get creator top accounts error:", error);
      res.status(500).json({ message: "Failed to get top accounts" });
    }
  });

  // Creator: Toggle video irrelevant status for own videos
  app.put("/api/creator/videos/:videoId/irrelevant", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "creator") {
        return res.status(403).json({ message: "Creator access required" });
      }

      const [creator] = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator) {
        return res.status(404).json({ message: "Creator profile not found" });
      }

      const videoId = parseInt(req.params.videoId);
      const { isIrrelevant } = req.body;

      const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      if (video.creatorId !== creator.id) {
        return res.status(403).json({ message: "You can only modify your own videos" });
      }

      const [updated] = await db.update(videos)
        .set({ isIrrelevant, updatedAt: new Date() })
        .where(eq(videos.id, videoId))
        .returning();

      if (updated && updated.creatorId && updated.postedAt) {
        try {
          const matchingCycles = await db.select().from(payoutCycles)
            .where(and(
              lte(payoutCycles.startDate, new Date(updated.postedAt)),
              gte(payoutCycles.endDate, new Date(updated.postedAt))
            ))
            .orderBy(desc(payoutCycles.startDate))
            .limit(1);

          if (matchingCycles.length > 0) {
            const cycle = matchingCycles[0];
            const existingPayout = await db.select().from(payouts)
              .where(and(eq(payouts.creatorId, updated.creatorId), eq(payouts.cycleId, cycle.id)))
              .limit(1);

            const result = await calculateCreatorCyclePayout(updated.creatorId, cycle);
            if (existingPayout.length > 0) {
              await db.update(payouts)
                .set({
                  amount: result.totalAmount.toFixed(2),
                  basePay: result.basePay.toFixed(2),
                  bonusPay: result.bonusPay.toFixed(2),
                  eligibleViews: result.eligibleViews,
                })
                .where(eq(payouts.id, existingPayout[0].id));
            } else {
              await db.insert(payouts).values({
                creatorId: updated.creatorId,
                cycleId: cycle.id,
                amount: result.totalAmount.toFixed(2),
                basePay: result.basePay.toFixed(2),
                bonusPay: result.bonusPay.toFixed(2),
                eligibleViews: result.eligibleViews,
                snapshotIgBasePay: result.igRate.toFixed(2),
                snapshotTtBasePay: result.ttRate.toFixed(2),
                snapshotDefaultBasePay: result.defaultBasePay.toFixed(2),
                status: "pending",
                periodStart: cycle.startDate,
                periodEnd: cycle.endDate,
              });
            }
          }
        } catch (recalcError) {
          console.error("Auto-recalculate payout after irrelevant toggle error:", recalcError);
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Toggle video irrelevant error:", error);
      res.status(500).json({ message: "Failed to update video" });
    }
  });

  // Admin: Toggle video relevance (for live/current cycle videos)
  app.put("/api/admin/videos/:videoId/relevance", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const videoId = parseInt(req.params.videoId);
      if (isNaN(videoId)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }

      const { isIrrelevant } = req.body;

      const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      const [updated] = await db.update(videos)
        .set({ isIrrelevant: !!isIrrelevant, updatedAt: new Date() })
        .where(eq(videos.id, videoId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Admin toggle video relevance error:", error);
      res.status(500).json({ message: "Failed to update video relevance" });
    }
  });

  // Admin: Toggle video irrelevant (alias endpoint)
  app.put("/api/admin/videos/:videoId/irrelevant", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const videoId = parseInt(req.params.videoId);
      if (isNaN(videoId)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }

      const { isIrrelevant } = req.body;

      const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      const [updated] = await db.update(videos)
        .set({ isIrrelevant: !!isIrrelevant, updatedAt: new Date() })
        .where(eq(videos.id, videoId))
        .returning();

      if (updated && updated.creatorId && updated.postedAt) {
        try {
          const matchingCycles = await db.select().from(payoutCycles)
            .where(and(
              lte(payoutCycles.startDate, new Date(updated.postedAt)),
              gte(payoutCycles.endDate, new Date(updated.postedAt))
            ))
            .orderBy(desc(payoutCycles.startDate))
            .limit(1);

          if (matchingCycles.length > 0) {
            const cycle = matchingCycles[0];
            const existingPayout = await db.select().from(payouts)
              .where(and(eq(payouts.creatorId, updated.creatorId), eq(payouts.cycleId, cycle.id)))
              .limit(1);

            const result = await calculateCreatorCyclePayout(updated.creatorId, cycle);
              if (existingPayout.length > 0) {
              await db.update(payouts)
                .set({
                  amount: result.totalAmount.toFixed(2),
                  basePay: result.basePay.toFixed(2),
                  bonusPay: result.bonusPay.toFixed(2),
                  eligibleViews: result.eligibleViews,
                })
                .where(eq(payouts.id, existingPayout[0].id));
            } else {
              await db.insert(payouts).values({
                creatorId: updated.creatorId,
                cycleId: cycle.id,
                amount: result.totalAmount.toFixed(2),
                basePay: result.basePay.toFixed(2),
                bonusPay: result.bonusPay.toFixed(2),
                eligibleViews: result.eligibleViews,
                snapshotIgBasePay: result.igRate.toFixed(2),
                snapshotTtBasePay: result.ttRate.toFixed(2),
                snapshotDefaultBasePay: result.defaultBasePay.toFixed(2),
                status: "pending",
                periodStart: cycle.startDate,
                periodEnd: cycle.endDate,
              });
            }
          }
        } catch (recalcError) {
          console.error("Auto-recalculate payout after irrelevant toggle error:", recalcError);
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Admin toggle video irrelevant error:", error);
      res.status(500).json({ message: "Failed to update video" });
    }
  });

  // Admin: Toggle cycle video snapshot relevance
  app.put("/api/admin/cycle-videos/:snapshotId/relevance", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const snapshotId = parseInt(req.params.snapshotId);
      if (isNaN(snapshotId)) {
        return res.status(400).json({ message: "Invalid snapshot ID" });
      }

      const { isIrrelevant } = req.body;

      const [updated] = await db.update(videos)
        .set({ isIrrelevant: !!isIrrelevant, updatedAt: new Date() })
        .where(eq(videos.id, snapshotId))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Video snapshot not found" });
      }

      if (updated.creatorId && updated.postedAt) {
        try {
          const matchingCycles = await db.select().from(payoutCycles)
            .where(and(
              lte(payoutCycles.startDate, new Date(updated.postedAt)),
              gte(payoutCycles.endDate, new Date(updated.postedAt))
            ))
            .orderBy(desc(payoutCycles.startDate))
            .limit(1);

          if (matchingCycles.length > 0) {
            const cycle = matchingCycles[0];
            const existingPayout = await db.select().from(payouts)
              .where(and(eq(payouts.creatorId, updated.creatorId), eq(payouts.cycleId, cycle.id)))
              .limit(1);

            if (existingPayout.length > 0) {
              const result = await calculateCreatorCyclePayout(updated.creatorId, cycle);
              await db.update(payouts)
                .set({
                  amount: result.totalAmount.toFixed(2),
                  basePay: result.basePay.toFixed(2),
                  bonusPay: result.bonusPay.toFixed(2),
                  eligibleViews: result.eligibleViews,
                })
                .where(eq(payouts.id, existingPayout[0].id));
            }
          }
        } catch (recalcError) {
          console.error("Auto-recalculate payout after relevance toggle error:", recalcError);
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Admin toggle cycle video relevance error:", error);
      res.status(500).json({ message: "Failed to update video relevance" });
    }
  });

  // Admin: Get all payout cycles
  app.get("/api/admin/cycles", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Auto-create next cycle for recurring cycles that have ended
      const now = new Date();
      const allCyclesRaw = await db.select().from(payoutCycles).orderBy(desc(payoutCycles.startDate));
      const newlyCreatedRanges: Array<{ start: Date; end: Date }> = [];
      for (const cycle of allCyclesRaw) {
        if (!cycle.isRecurring) continue;
        const cycleEnd = new Date(cycle.endDate);
        if (cycleEnd >= now) continue;

        const startUTC = Date.UTC(new Date(cycle.startDate).getUTCFullYear(), new Date(cycle.startDate).getUTCMonth(), new Date(cycle.startDate).getUTCDate());
        const endUTC = Date.UTC(cycleEnd.getUTCFullYear(), cycleEnd.getUTCMonth(), cycleEnd.getUTCDate());
        const durationDays = Math.round((endUTC - startUTC) / (1000 * 60 * 60 * 24)) + 1;

        const nextStart = new Date(Date.UTC(cycleEnd.getUTCFullYear(), cycleEnd.getUTCMonth(), cycleEnd.getUTCDate() + 1, 0, 0, 0, 0));
        const nextEnd = new Date(Date.UTC(nextStart.getUTCFullYear(), nextStart.getUTCMonth(), nextStart.getUTCDate() + durationDays - 1, 23, 59, 59, 0));

        const overlapsExisting = allCyclesRaw.some(c => {
          if (c.id === cycle.id) return false;
          const cStart = new Date(c.startDate);
          const cEnd = new Date(c.endDate);
          return nextStart <= cEnd && nextEnd >= cStart;
        });

        const overlapsNewlyCreated = newlyCreatedRanges.some(r => nextStart <= r.end && nextEnd >= r.start);

        if (!overlapsExisting && !overlapsNewlyCreated) {
          const [psettings] = await db.select().from(payoutSettings).limit(1);
          const currentTiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));
          await db.insert(payoutCycles).values({
            startDate: nextStart,
            endDate: nextEnd,
            status: "pending",
            basePayPerVideo: psettings?.basePay || "10.00",
            bonusTiersSnapshot: JSON.stringify(currentTiers),
            snapshotsCreated: true,
            isRecurring: true,
          });
          newlyCreatedRanges.push({ start: nextStart, end: nextEnd });
          await db.update(payoutCycles).set({ isRecurring: false }).where(eq(payoutCycles.id, cycle.id));
        }
      }

      const allCycles = await db.select().from(payoutCycles).orderBy(desc(payoutCycles.startDate));

      const [settings] = await db.select().from(payoutSettings).limit(1);
      const basePayRate = settings?.basePay ? parseFloat(settings.basePay as unknown as string) : 0;
      const tiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));

      const cyclesWithPayouts = await Promise.all(allCycles.map(async (cycle) => {
        const cyclePayouts = await db.select({
          payout: payouts,
          creator: creators,
        }).from(payouts)
          .leftJoin(creators, eq(payouts.creatorId, creators.id))
          .where(eq(payouts.cycleId, cycle.id));

        if (cyclePayouts.length > 0) {
          const payoutsWithCreator = cyclePayouts.map(p => ({
            ...p.payout,
            creatorId: String(p.payout.creatorId),
            creatorEmail: p.creator?.email || "Unknown",
            creatorName: p.creator?.firstName && p.creator?.lastName
              ? `${p.creator.firstName} ${p.creator.lastName}`
              : p.creator?.firstName || p.creator?.lastName || null,
          }));

          const totalPayout = payoutsWithCreator.reduce((sum, p) => sum + parseFloat(p.amount), 0);

          return {
            ...cycle,
            payouts: payoutsWithCreator,
            totalPayout,
          };
        }

        const now = new Date();
        const isFrozen = now > new Date(cycle.endDate);

        if (isFrozen) {
          return {
            ...cycle,
            payouts: [],
            totalPayout: 0,
          };
        }

        const allCreators = await db.select().from(creators).where(eq(creators.status, "active"));
        const calculatedPayouts: any[] = [];
        let totalPayout = 0;

        for (const creator of allCreators) {
          const cIgRate = creator.customInstagramBasePay !== null ? parseFloat(creator.customInstagramBasePay as unknown as string) : basePayRate;
          const cTtRate = creator.customTiktokBasePay !== null ? parseFloat(creator.customTiktokBasePay as unknown as string) : basePayRate;
          const cycleVideos = await db.select().from(videos)
            .where(and(
              eq(videos.creatorId, creator.id),
              eq(videos.isIrrelevant, false),
              gte(videos.postedAt, cycle.startDate),
              lte(videos.postedAt, cycle.endDate)
            ));

          const eligible = cycleVideos.filter(v => !!v.postedAt);

          const igVids2 = eligible.filter(v => v.platform === "instagram" && !v.isIrrelevant);
          const ttVids2 = eligible.filter(v => v.platform === "tiktok" && !v.isIrrelevant);
          const usedTt2 = new Set<number>();
          const PAIR_WINDOW_MS2 = 24 * 60 * 60 * 1000;
          let baseEarnings = 0;
          let bonusEarnings = 0;

          for (const ig of igVids2) {
            if (!ig.postedAt || ig.duration == null) continue;
            const igTime = new Date(ig.postedAt).getTime();
            let bestMatch: typeof ttVids2[0] | null = null;
            let bestDurationDiff = Infinity;
            let bestTimeDiff = Infinity;
            for (const tt of ttVids2) {
              if (usedTt2.has(tt.id)) continue;
              if (!tt.postedAt || tt.duration == null) continue;
              const durationDiff = Math.abs(ig.duration - tt.duration);
              if (durationDiff > 1) continue;
              const timeDiff = Math.abs(igTime - new Date(tt.postedAt).getTime());
              if (timeDiff <= PAIR_WINDOW_MS2 && (durationDiff < bestDurationDiff || (durationDiff === bestDurationDiff && timeDiff < bestTimeDiff))) {
                bestDurationDiff = durationDiff;
                bestTimeDiff = timeDiff;
                bestMatch = tt;
              }
            }
            if (bestMatch) {
              usedTt2.add(bestMatch.id);
              baseEarnings += cIgRate + cTtRate;
              const winnerViews = Math.max(ig.views || 0, bestMatch.views || 0);
              const matchingTier = tiers.find(t => winnerViews >= t.viewThreshold);
              if (matchingTier) {
                bonusEarnings += parseFloat(matchingTier.bonusAmount as unknown as string);
              }
            }
          }

          const creatorTotal = baseEarnings + bonusEarnings;
          if (creatorTotal > 0 || eligible.length > 0) {
            calculatedPayouts.push({
              id: `calc-${cycle.id}-${creator.id}`,
              creatorId: String(creator.id),
              cycleId: cycle.id,
              amount: creatorTotal.toFixed(2),
              status: isFrozen ? "completed" : "pending",
              paidAt: null,
              periodStart: cycle.startDate,
              periodEnd: cycle.endDate,
              createdAt: cycle.createdAt,
              updatedAt: cycle.updatedAt,
              creatorEmail: creator.email || "Unknown",
              creatorName: creator.firstName && creator.lastName
                ? `${creator.firstName} ${creator.lastName}`
                : creator.firstName || creator.lastName || null,
              baseAmount: baseEarnings.toFixed(2),
              bonusAmount: bonusEarnings.toFixed(2),
              totalAmount: creatorTotal.toFixed(2),
            });
            totalPayout += creatorTotal;
          }
        }

        return {
          ...cycle,
          payouts: calculatedPayouts,
          totalPayout,
        };
      }));

      res.json(cyclesWithPayouts);
    } catch (error) {
      console.error("Get cycles error:", error);
      res.status(500).json({ message: "Failed to get cycles" });
    }
  });

  // Admin: Create new payout cycle
  app.post("/api/admin/cycles", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const [psettings] = await db.select().from(payoutSettings).limit(1);

      let startDate: Date;
      let endDate: Date;

      if (req.body.startDate && req.body.endDate) {
        startDate = new Date(req.body.startDate + "T00:00:00.000Z");
        endDate = new Date(req.body.endDate + "T23:59:59.000Z");

        if (startDate > endDate) {
          return res.status(400).json({ message: "Start date cannot be after end date." });
        }

        const durationDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (durationDays < 2) {
          return res.status(400).json({ message: "A pay cycle must be at least 2 days long." });
        }
        if (durationDays > 31) {
          return res.status(400).json({ message: "A pay cycle cannot be longer than 31 days." });
        }

        const allCycles = await db.select().from(payoutCycles);
        for (const cycle of allCycles) {
          const cStart = new Date(cycle.startDate);
          const cEnd = new Date(cycle.endDate);
          if (startDate <= cEnd && endDate >= cStart) {
            const cStartStr = cStart.toISOString().split("T")[0];
            const cEndStr = cEnd.toISOString().split("T")[0];
            return res.status(400).json({ message: `This cycle overlaps with an existing cycle (${cStartStr} to ${cEndStr}). Please choose different dates.` });
          }
        }
      } else {
        return res.status(400).json({ message: "Both start date and end date are required." });
      }

      const isRecurring = req.body.isRecurring !== undefined ? req.body.isRecurring : true;
      const currentTiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));
      const [newCycle] = await db.insert(payoutCycles).values({
        startDate,
        endDate,
        status: "pending",
        basePayPerVideo: psettings?.basePay || "10.00",
        bonusTiersSnapshot: JSON.stringify(currentTiers),
        snapshotsCreated: true,
        isRecurring,
      }).returning();

      const allCreators = await db.select().from(creators).where(eq(creators.status, "active"));
      
      let totalAmount = 0;
      for (const creator of allCreators) {
        const result = await calculateCreatorCyclePayout(creator.id, newCycle, { useCurrentRates: true });

        if (result.totalAmount > 0) {
          await db.insert(payouts).values({
            creatorId: creator.id,
            cycleId: newCycle.id,
            amount: result.totalAmount.toFixed(2),
            basePay: result.basePay.toFixed(2),
            bonusPay: result.bonusPay.toFixed(2),
            eligibleViews: result.eligibleViews,
            snapshotIgBasePay: result.igRate.toFixed(2),
            snapshotTtBasePay: result.ttRate.toFixed(2),
            snapshotDefaultBasePay: result.defaultBasePay.toFixed(2),
            status: "pending",
            periodStart: startDate,
            periodEnd: endDate,
          });
          totalAmount += result.totalAmount;
        }
      }

      await db.update(payoutCycles)
        .set({ totalAmount: totalAmount.toFixed(2) })
        .where(eq(payoutCycles.id, newCycle.id));

      res.json({ ...newCycle, totalAmount: totalAmount.toFixed(2), payouts: [], totalPayout: totalAmount });
    } catch (error) {
      console.error("Create cycle error:", error);
      res.status(500).json({ message: "Failed to create cycle" });
    }
  });

  // Admin: Mark cycle as paid
  app.post("/api/admin/cycles/:id/mark-paid", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const cycleId = parseInt(req.params.id);
      const { paymentMethod, paymentReference, notes } = req.body;

      const [cycle] = await db.select().from(payoutCycles).where(eq(payoutCycles.id, cycleId)).limit(1);
      if (!cycle) {
        return res.status(404).json({ message: "Cycle not found" });
      }

      const [updatedCycle] = await db.update(payoutCycles)
        .set({
          status: "paid",
          paymentMethod,
          paymentReference,
          notes,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payoutCycles.id, cycleId))
        .returning();

      await db.update(payouts)
        .set({
          status: "paid",
          paidAt: new Date(),
        })
        .where(eq(payouts.cycleId, cycleId));

      res.json(updatedCycle);
    } catch (error) {
      console.error("Mark cycle paid error:", error);
      res.status(500).json({ message: "Failed to mark cycle as paid" });
    }
  });

  app.post("/api/admin/cycles/:id/unmark-paid", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const cycleId = parseInt(req.params.id);
      const [cycle] = await db.select().from(payoutCycles).where(eq(payoutCycles.id, cycleId)).limit(1);
      if (!cycle) {
        return res.status(404).json({ message: "Cycle not found" });
      }

      const [updatedCycle] = await db.update(payoutCycles)
        .set({
          status: "completed",
          paidAt: null,
          updatedAt: new Date(),
        })
        .where(eq(payoutCycles.id, cycleId))
        .returning();

      await db.update(payouts)
        .set({
          status: "pending",
          paidAt: null,
        })
        .where(eq(payouts.cycleId, cycleId));

      res.json(updatedCycle);
    } catch (error) {
      console.error("Unmark cycle paid error:", error);
      res.status(500).json({ message: "Failed to unmark cycle as paid" });
    }
  });

  // Admin: Delete a payout cycle (only current or upcoming, not past)
  app.delete("/api/admin/cycles/:id", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const cycleId = parseInt(req.params.id);
      const [cycle] = await db.select().from(payoutCycles).where(eq(payoutCycles.id, cycleId)).limit(1);
      if (!cycle) {
        return res.status(404).json({ message: "Cycle not found" });
      }

      await db.delete(cycleVideoSnapshots).where(eq(cycleVideoSnapshots.cycleId, cycleId));
      await db.delete(payouts).where(eq(payouts.cycleId, cycleId));
      await db.delete(payoutCycles).where(eq(payoutCycles.id, cycleId));

      res.json({ message: "Cycle deleted successfully" });
    } catch (error) {
      console.error("Delete cycle error:", error);
      res.status(500).json({ message: "Failed to delete cycle" });
    }
  });

  // Admin: Get all creators with filtering and enriched data
  app.get("/api/admin/creators", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const status = req.query.status || "active";
      
      let allCreators = await db.select().from(creators).orderBy(desc(creators.createdAt));
      
      // Filter by status
      if (status === "active") {
        allCreators = allCreators.filter(c => c.status === "active");
      } else if (status === "paused") {
        allCreators = allCreators.filter(c => c.status === "paused");
      } else if (status === "deleted") {
        allCreators = allCreators.filter(c => c.status === "deleted");
      }

      const allCycles = await db.select().from(payoutCycles).orderBy(desc(payoutCycles.startDate));
      const now = new Date();
      const activeCycle = allCycles.find(c => new Date(c.startDate) <= now && new Date(c.endDate) >= now);

      const allVideos = await db.select().from(videos);

      const [settings] = await db.select().from(payoutSettings).limit(1);
      const basePayRate = settings?.basePay ? parseFloat(settings.basePay as unknown as string) : 0;
      const tiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));

      const allPayouts = await db.select().from(payouts);

      const enrichedCreators = allCreators.map((creator) => {
        const creatorVideos = allVideos.filter(v => v.creatorId === creator.id);
        const cIgRate = creator.customInstagramBasePay !== null ? parseFloat(creator.customInstagramBasePay as unknown as string) : basePayRate;
        const cTtRate = creator.customTiktokBasePay !== null ? parseFloat(creator.customTiktokBasePay as unknown as string) : basePayRate;

        const eligibleVids = creatorVideos.filter(v => {
          if (v.isIrrelevant) return false;
          if (!v.postedAt) return false;
          return true;
        });

        const cycleVids = activeCycle
          ? eligibleVids.filter(v => {
              if (!v.postedAt) return false;
              const posted = new Date(v.postedAt);
              return posted >= new Date(activeCycle.startDate) && posted <= new Date(activeCycle.endDate);
            })
          : [];

        const igAll = eligibleVids.filter(v => v.platform === "instagram");
        const ttAll = eligibleVids.filter(v => v.platform === "tiktok");

        const igCycle = cycleVids.filter(v => v.platform === "instagram");
        const ttCycle = cycleVids.filter(v => v.platform === "tiktok");
        const usedTt = new Set<number>();
        const PAIR_WINDOW_MS = 24 * 60 * 60 * 1000;
        let baseEarnings = 0;
        let bonusEarnings = 0;

        for (const ig of igCycle) {
          if (!ig.postedAt || ig.duration == null) continue;
          const igTime = new Date(ig.postedAt).getTime();
          let bestMatch: typeof ttCycle[0] | null = null;
          let bestDurationDiff = Infinity;
          let bestTimeDiff = Infinity;
          for (const tt of ttCycle) {
            if (usedTt.has(tt.id)) continue;
            if (!tt.postedAt || tt.duration == null) continue;
            const durationDiff = Math.abs(ig.duration - tt.duration);
            if (durationDiff > 1) continue;
            const timeDiff = Math.abs(igTime - new Date(tt.postedAt).getTime());
            if (timeDiff <= PAIR_WINDOW_MS && (durationDiff < bestDurationDiff || (durationDiff === bestDurationDiff && timeDiff < bestTimeDiff))) {
              bestDurationDiff = durationDiff;
              bestTimeDiff = timeDiff;
              bestMatch = tt;
            }
          }
          if (bestMatch) {
            usedTt.add(bestMatch.id);
            baseEarnings += cIgRate + cTtRate;
            const winnerViews = Math.max(ig.views || 0, bestMatch.views || 0);
            const matchingTier = tiers.find(t => winnerViews >= t.viewThreshold);
            if (matchingTier) {
              bonusEarnings += parseFloat(matchingTier.bonusAmount as unknown as string);
            }
          }
        }

        const creatorPayouts = allPayouts.filter(p => p.creatorId === creator.id && p.paidAt !== null);
        const totalPaid = creatorPayouts.reduce((s, p) => s + parseFloat(p.amount || "0"), 0);

        return {
          ...creator,
          videosThisCycle: cycleVids.length,
          eligibleVideos: eligibleVids.length,
          totalVideosAllTime: eligibleVids.length,
          viewsThisCycle: cycleVids.reduce((s, v) => s + (v.views || 0), 0),
          eligibleViews: eligibleVids.reduce((s, v) => s + (v.views || 0), 0),
          totalViewsAllTime: eligibleVids.reduce((s, v) => s + (v.views || 0), 0),
          igViewsThisCycle: igCycle.reduce((s, v) => s + (v.views || 0), 0),
          igViewsAllTime: igAll.reduce((s, v) => s + (v.views || 0), 0),
          tiktokViewsThisCycle: ttCycle.reduce((s, v) => s + (v.views || 0), 0),
          tiktokViewsAllTime: ttAll.reduce((s, v) => s + (v.views || 0), 0),
          earningsThisCycle: baseEarnings + bonusEarnings,
          totalPaid,
          isPaused: creator.status === "paused",
          isDeleted: creator.status === "deleted",
        };
      });

      res.json(enrichedCreators);
    } catch (error) {
      console.error("Get admin creators error:", error);
      res.status(500).json({ message: "Failed to get creators" });
    }
  });

  // Admin: Get single creator detail
  app.get("/api/admin/creators/:id", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const creatorId = parseInt(req.params.id);
      if (isNaN(creatorId)) {
        return res.status(400).json({ message: "Invalid creator ID" });
      }

      const [creator] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
      if (!creator) {
        return res.status(404).json({ message: "Creator not found" });
      }

      const creatorVideos = await db.select().from(videos).where(eq(videos.creatorId, creatorId));
      const creatorPayouts = await db.select().from(payouts).where(eq(payouts.creatorId, creatorId));
      const [settings] = await db.select().from(payoutSettings).limit(1);

      const allCycles = await db.select().from(payoutCycles).orderBy(payoutCycles.startDate);
      const now = new Date();
      
      const activeCycle = allCycles.find(c => {
        const start = new Date(c.startDate);
        const end = new Date(c.endDate);
        return now >= start && now <= end;
      }) || null;

      const eligibleAdminVideos = creatorVideos.filter(v => {
        if (v.isIrrelevant) return false;
        if (!v.postedAt) return false;
        return true;
      });
      const igVideos = eligibleAdminVideos.filter(v => v.platform === "instagram");
      const tiktokVideos = eligibleAdminVideos.filter(v => v.platform === "tiktok");
      const igViews = igVideos.reduce((sum, v) => sum + (v.views || 0), 0);
      const tiktokViews = tiktokVideos.reduce((sum, v) => sum + (v.views || 0), 0);

      const basePayRate = settings?.basePay ? parseFloat(settings.basePay as unknown as string) : 0;
      const adminIgRate = creator.customInstagramBasePay !== null ? parseFloat(creator.customInstagramBasePay as unknown as string) : basePayRate;
      const adminTtRate = creator.customTiktokBasePay !== null ? parseFloat(creator.customTiktokBasePay as unknown as string) : basePayRate;
      const adminDetailTiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));

      const cycleRatesMap = new Map<number, { igRate: number; ttRate: number; defaultRate: number; tiers: { viewThreshold: number; bonusAmount: string }[] }>();
      for (const p of creatorPayouts) {
        if (p.cycleId) {
          const cycle = allCycles.find(c => c.id === p.cycleId);
          const defaultRate = p.snapshotDefaultBasePay
            ? parseFloat(p.snapshotDefaultBasePay as unknown as string)
            : (cycle?.basePayPerVideo ? parseFloat(cycle.basePayPerVideo as unknown as string) : basePayRate);
          let tiers = adminDetailTiers as { viewThreshold: number; bonusAmount: string }[];
          if (cycle && cycle.bonusTiersSnapshot) {
            try {
              tiers = JSON.parse(cycle.bonusTiersSnapshot);
              tiers.sort((a, b) => b.viewThreshold - a.viewThreshold);
            } catch {}
          }
          cycleRatesMap.set(p.cycleId, {
            igRate: p.snapshotIgBasePay ? parseFloat(p.snapshotIgBasePay as unknown as string) : defaultRate,
            ttRate: p.snapshotTtBasePay ? parseFloat(p.snapshotTtBasePay as unknown as string) : defaultRate,
            defaultRate,
            tiers,
          });
        }
      }

      const BOUNDARY_WINDOW_MS = 24 * 60 * 60 * 1000;
      const crossBoundaryReassign = new Map<number, number>();

      const eligibleForPairing = creatorVideos.filter(v => !v.isIrrelevant && v.postedAt && v.duration != null);

      for (let ci = 1; ci < allCycles.length; ci++) {
        const currCycle = allCycles[ci];
        const prevCycle = allCycles[ci - 1];
        const currStart = new Date(currCycle.startDate).getTime();
        const prevEnd = new Date(prevCycle.endDate).getTime();

        const prevCycleVids = eligibleForPairing.filter(v => {
          const t = new Date(v.postedAt!).getTime();
          return t >= new Date(prevCycle.startDate).getTime() && t <= prevEnd;
        });
        const prevIg = prevCycleVids.filter(v => v.platform === "instagram");
        const prevTt = prevCycleVids.filter(v => v.platform === "tiktok");
        const prevUsedIg = new Set<number>();
        const prevUsedTt = new Set<number>();

        for (const pig of prevIg) {
          const pigTime = new Date(pig.postedAt!).getTime();
          let best: typeof prevTt[0] | null = null;
          let bestDiff = Infinity;
          let bestTd = Infinity;
          for (const ptt of prevTt) {
            if (prevUsedTt.has(ptt.id)) continue;
            const dd = Math.abs(pig.duration! - ptt.duration!);
            if (dd > 1) continue;
            const td = Math.abs(pigTime - new Date(ptt.postedAt!).getTime());
            if (td <= BOUNDARY_WINDOW_MS && (dd < bestDiff || (dd === bestDiff && td < bestTd))) { bestDiff = dd; bestTd = td; best = ptt; }
          }
          if (best) { prevUsedIg.add(pig.id); prevUsedTt.add(best.id); }
        }

        const unpairedPrevBoundaryIg = prevIg.filter(v => !prevUsedIg.has(v.id) && new Date(v.postedAt!).getTime() >= prevEnd - BOUNDARY_WINDOW_MS);
        const unpairedPrevBoundaryTt = prevTt.filter(v => !prevUsedTt.has(v.id) && new Date(v.postedAt!).getTime() >= prevEnd - BOUNDARY_WINDOW_MS);

        const currFirstDayVids = eligibleForPairing.filter(v => {
          const t = new Date(v.postedAt!).getTime();
          return t >= currStart && t <= currStart + BOUNDARY_WINDOW_MS;
        });

        const currCycleVids = eligibleForPairing.filter(v => {
          const t = new Date(v.postedAt!).getTime();
          return t >= currStart && t <= new Date(currCycle.endDate).getTime();
        });
        const currIgAll = currCycleVids.filter(v => v.platform === "instagram");
        const currTtAll = currCycleVids.filter(v => v.platform === "tiktok");
        const currUsedIg = new Set<number>();
        const currUsedTt = new Set<number>();

        for (const cig of currIgAll) {
          const cigTime = new Date(cig.postedAt!).getTime();
          let best: typeof currTtAll[0] | null = null;
          let bestDiff = Infinity;
          let bestTd = Infinity;
          for (const ctt of currTtAll) {
            if (currUsedTt.has(ctt.id)) continue;
            const dd = Math.abs(cig.duration! - ctt.duration!);
            if (dd > 1) continue;
            const td = Math.abs(cigTime - new Date(ctt.postedAt!).getTime());
            if (td <= BOUNDARY_WINDOW_MS && (dd < bestDiff || (dd === bestDiff && td < bestTd))) { bestDiff = dd; bestTd = td; best = ctt; }
          }
          if (best) { currUsedIg.add(cig.id); currUsedTt.add(best.id); }
        }

        const unpairedCurrFirstDayIg = currFirstDayVids.filter(v => v.platform === "instagram" && !currUsedIg.has(v.id));
        const unpairedCurrFirstDayTt = currFirstDayVids.filter(v => v.platform === "tiktok" && !currUsedTt.has(v.id));

        for (const utt of unpairedCurrFirstDayTt) {
          const uttTime = new Date(utt.postedAt!).getTime();
          for (const pig of unpairedPrevBoundaryIg) {
            if (crossBoundaryReassign.has(pig.id)) continue;
            const dd = Math.abs(utt.duration! - pig.duration!);
            if (dd > 1) continue;
            const td = Math.abs(uttTime - new Date(pig.postedAt!).getTime());
            if (td <= BOUNDARY_WINDOW_MS) { crossBoundaryReassign.set(pig.id, currCycle.id); break; }
          }
        }
        for (const uig of unpairedCurrFirstDayIg) {
          const uigTime = new Date(uig.postedAt!).getTime();
          for (const ptt of unpairedPrevBoundaryTt) {
            if (crossBoundaryReassign.has(ptt.id)) continue;
            const dd = Math.abs(uig.duration! - ptt.duration!);
            if (dd > 1) continue;
            const td = Math.abs(uigTime - new Date(ptt.postedAt!).getTime());
            if (td <= BOUNDARY_WINDOW_MS) { crossBoundaryReassign.set(ptt.id, currCycle.id); break; }
          }
        }
      }

      const enrichedVideosRaw = creatorVideos.map(v => {
        const videoDate = v.postedAt ? new Date(v.postedAt) : new Date();
        let cycleId: number | null = null;
        
        if (crossBoundaryReassign.has(v.id)) {
          cycleId = crossBoundaryReassign.get(v.id)!;
        } else {
          for (const cycle of allCycles) {
            const cycleStart = new Date(cycle.startDate);
            const cycleEnd = new Date(cycle.endDate);
            if (videoDate >= cycleStart && videoDate <= cycleEnd) {
              cycleId = cycle.id;
              break;
            }
          }
        }
        
        const isActiveCycleVideo = activeCycle && cycleId === activeCycle.id;
        const cycleRates = cycleId && !isActiveCycleVideo ? cycleRatesMap.get(cycleId) : null;

        const videoIgRate = cycleRates ? cycleRates.igRate : adminIgRate;
        const videoTtRate = cycleRates ? cycleRates.ttRate : adminTtRate;
        const videoDefaultRate = cycleRates ? cycleRates.defaultRate : basePayRate;
        const videoTiers = cycleRates ? cycleRates.tiers : adminDetailTiers;

        const views = v.views || 0;
        const matchingTier = videoTiers.find(t => views >= t.viewThreshold);
        const bonusAmount = matchingTier ? parseFloat(matchingTier.bonusAmount as unknown as string) : 0;
        
        const isEligible = !v.isIrrelevant && !!v.postedAt;
        const platformRate = v.platform === "instagram" ? videoIgRate : v.platform === "tiktok" ? videoTtRate : videoDefaultRate;

        return {
          ...v,
          timestamp: v.postedAt,
          isEligible,
          cycleId,
          basePayPerVideo: isEligible ? platformRate : 0,
          bonusAmount: isEligible ? bonusAmount : 0,
        };
      });

      const enrichedVideos = applyPairBonusLogic(enrichedVideosRaw);

      const cycleMap = new Map(allCycles.map(c => [c.id, c]));

      const approvedCompletions = await db.select({
        completion: bountyCompletions,
        bounty: bounties,
      }).from(bountyCompletions)
        .leftJoin(bounties, eq(bountyCompletions.bountyId, bounties.id))
        .where(and(
          eq(bountyCompletions.creatorId, creatorId),
          inArray(bountyCompletions.status, ["approved", "rejected"])
        ));

      const creatorParticipants = await db.select({
        participant: gameParticipants,
        game: survivorGames,
      }).from(gameParticipants)
        .leftJoin(survivorGames, eq(gameParticipants.gameId, survivorGames.id))
        .where(eq(gameParticipants.creatorId, creatorId));

      const allGameParticipants = new Map<number, { totalSurvivorPosts: number }>();
      for (const cp of creatorParticipants) {
        if (!cp.game) continue;
        if (!allGameParticipants.has(cp.game.id)) {
          const gameParts = await db.select().from(gameParticipants)
            .where(and(
              eq(gameParticipants.gameId, cp.game.id),
              eq(gameParticipants.isEliminated, false)
            ));
          const totalPosts = gameParts.reduce((sum, p) => sum + (p.totalPosts || 0), 0);
          allGameParticipants.set(cp.game.id, { totalSurvivorPosts: totalPosts });
        }
      }

      function getBountyDateForCycle(completion: typeof approvedCompletions[0]): Date | null {
        if (completion.bounty?.deadline) return new Date(completion.bounty.deadline);
        if (completion.completion.completedAt) return new Date(completion.completion.completedAt);
        if (completion.completion.paidAt) return new Date(completion.completion.paidAt);
        return null;
      }

      function computeBountyAndSurvivorForCycle(cycleStart: Date, cycleEnd: Date) {
        const bountyItems: { title: string; reward: string; status: string }[] = [];
        let bountyTotal = 0;
        for (const ac of approvedCompletions) {
          if (!ac.bounty) continue;
          const bDate = getBountyDateForCycle(ac);
          if (!bDate) continue;
          if (bDate >= cycleStart && bDate <= cycleEnd) {
            if (ac.completion.status === "rejected") {
              const penalty = parseFloat(ac.bounty.penaltyAmount as unknown as string || "0");
              if (penalty > 0) {
                bountyTotal -= penalty;
              }
              bountyItems.push({
                title: ac.bounty.title,
                reward: penalty > 0 ? (-penalty).toFixed(2) : "0.00",
                status: ac.completion.status,
              });
            } else {
              const reward = parseFloat(ac.bounty.reward as unknown as string) || 0;
              bountyTotal += reward;
              bountyItems.push({
                title: ac.bounty.title,
                reward: reward.toFixed(2),
                status: ac.completion.status,
              });
            }
          }
        }

        const survivorItems: { gameTitle: string; prizePool: string; payout: string; sharePercent: number }[] = [];
        let survivorTotal = 0;
        for (const cp of creatorParticipants) {
          if (!cp.game || !cp.game.endDate) continue;
          const gameEnd = new Date(cp.game.endDate);
          if (gameEnd >= cycleStart && gameEnd <= cycleEnd) {
            const prizePool = parseFloat(cp.game.prizePool as unknown as string) || 0;
            const gameStats = allGameParticipants.get(cp.game.id);
            const totalSurvivorPosts = gameStats?.totalSurvivorPosts || 0;
            const creatorPosts = cp.participant.totalPosts || 0;
            let payout = 0;
            let sharePercent = 0;
            if (totalSurvivorPosts > 0 && !cp.participant.isEliminated) {
              sharePercent = (creatorPosts / totalSurvivorPosts) * 100;
              payout = (creatorPosts / totalSurvivorPosts) * prizePool;
            }
            survivorTotal += payout;
            survivorItems.push({
              gameTitle: cp.game.title,
              prizePool: prizePool.toFixed(2),
              payout: payout.toFixed(2),
              sharePercent: Math.round(sharePercent * 100) / 100,
            });
          }
        }

        return {
          bountyTotal: bountyTotal.toFixed(2),
          bountyItems,
          survivorTotal: survivorTotal.toFixed(2),
          survivorItems,
          bountyTotalNum: bountyTotal,
          survivorTotalNum: survivorTotal,
        };
      }

      const payoutsWithCyclesRaw = creatorPayouts
        .filter(p => {
          if (p.notes && p.notes.startsWith("Bounty:")) return false;
          if (activeCycle && p.cycleId === activeCycle.id) return false;
          return true;
        })
        .map(p => {
          const cycle = p.cycleId ? cycleMap.get(p.cycleId) : null;
          const cycleStart = cycle ? new Date(cycle.startDate) : new Date(p.periodStart);
          const cycleEnd = cycle ? new Date(cycle.endDate) : new Date(p.periodEnd);
          const bsData = computeBountyAndSurvivorForCycle(cycleStart, cycleEnd);
          const baseAmt = parseFloat(p.amount as unknown as string) || 0;
          const combinedTotal = baseAmt + bsData.bountyTotalNum + bsData.survivorTotalNum;
          return {
            ...p,
            totalAmount: p.amount,
            baseAmount: p.basePay || p.amount,
            bonusAmount: p.bonusPay || "0.00",
            eligibleViews: p.eligibleViews || 0,
            cycleId: p.cycleId ? String(p.cycleId) : null,
            cycle: cycle
              ? { startDate: cycle.startDate.toISOString(), endDate: cycle.endDate.toISOString() }
              : { startDate: p.periodStart.toISOString(), endDate: p.periodEnd.toISOString() },
            snapshotIgBasePay: p.snapshotIgBasePay || null,
            snapshotTtBasePay: p.snapshotTtBasePay || null,
            snapshotDefaultBasePay: p.snapshotDefaultBasePay || null,
            bonusTiersSnapshot: cycle?.bonusTiersSnapshot || null,
            bountyTotal: bsData.bountyTotal,
            bountyItems: bsData.bountyItems,
            survivorTotal: bsData.survivorTotal,
            survivorItems: bsData.survivorItems,
            combinedTotal: combinedTotal.toFixed(2),
          };
        });

      const payoutsWithCycles = payoutsWithCyclesRaw as any[];

      if (activeCycle) {
        const liveResult = await calculateCreatorCyclePayout(creator.id, activeCycle, { useCurrentRates: true });
        const calcBase = liveResult.basePay;
        const calcBonus = liveResult.bonusPay;
        const eligibleViews = liveResult.eligibleViews;

        const activeBsData = computeBountyAndSurvivorForCycle(
          new Date(activeCycle.startDate),
          new Date(activeCycle.endDate)
        );
        const calcTotal = calcBase + calcBonus;
        const activeCombinedTotal = calcTotal + activeBsData.bountyTotalNum + activeBsData.survivorTotalNum;
        const existingActivePayout = creatorPayouts.find(p => p.cycleId === activeCycle.id);
        if (existingActivePayout) {
          await db.update(payouts)
            .set({
              amount: calcTotal.toFixed(2),
              basePay: calcBase.toFixed(2),
              bonusPay: calcBonus.toFixed(2),
              eligibleViews,
              snapshotIgBasePay: adminIgRate.toFixed(2),
              snapshotTtBasePay: adminTtRate.toFixed(2),
              snapshotDefaultBasePay: basePayRate.toFixed(2),
            })
            .where(eq(payouts.id, existingActivePayout.id));
        } else {
          await db.insert(payouts).values({
            creatorId: creator.id,
            cycleId: activeCycle.id,
            amount: calcTotal.toFixed(2),
            basePay: calcBase.toFixed(2),
            bonusPay: calcBonus.toFixed(2),
            eligibleViews,
            snapshotIgBasePay: adminIgRate.toFixed(2),
            snapshotTtBasePay: adminTtRate.toFixed(2),
            snapshotDefaultBasePay: basePayRate.toFixed(2),
            status: "pending",
            periodStart: activeCycle.startDate,
            periodEnd: activeCycle.endDate,
          }).returning();
        }
        payoutsWithCycles.unshift({
          id: existingActivePayout ? existingActivePayout.id : -1,
          creatorId: creator.id,
          cycleId: String(activeCycle.id),
          amount: calcTotal.toFixed(2),
          status: "pending",
          paidAt: null,
          periodStart: activeCycle.startDate,
          periodEnd: activeCycle.endDate,
          notes: null,
          paymentMethod: null,
          paymentReference: null,
          createdAt: activeCycle.createdAt,
          updatedAt: activeCycle.updatedAt,
          totalAmount: calcTotal.toFixed(2),
          baseAmount: calcBase.toFixed(2),
          bonusAmount: calcBonus.toFixed(2),
          cycle: {
            startDate: activeCycle.startDate.toISOString(),
            endDate: activeCycle.endDate.toISOString(),
          },
          eligibleViews,
          isCalculated: true,
          bountyTotal: activeBsData.bountyTotal,
          bountyItems: activeBsData.bountyItems,
          survivorTotal: activeBsData.survivorTotal,
          survivorItems: activeBsData.survivorItems,
          combinedTotal: activeCombinedTotal.toFixed(2),
        } as any);
      }

      res.json({
        creator: {
          ...creator,
          isPaused: creator.status === "paused",
          isDeleted: creator.status === "deleted",
        },
        videos: enrichedVideos,
        violations: [],
        payouts: payoutsWithCycles,
        activeCycle,
        payoutSettings: settings || null,
        allTimeStats: {
          totalVideos: eligibleAdminVideos.length,
          igViews,
          tiktokViews,
          totalEarnings: creator.totalEarnings || 0,
        },
      });
    } catch (error) {
      console.error("Get admin creator detail error:", error);
      res.status(500).json({ message: "Failed to get creator details" });
    }
  });

  app.get("/api/admin/cycles/:id/bounties-and-survivor", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const cycleId = parseInt(req.params.id);
      const creatorId = parseInt(req.query.creatorId as string);
      if (isNaN(cycleId) || isNaN(creatorId)) {
        return res.status(400).json({ message: "Invalid cycleId or creatorId" });
      }

      const [cycle] = await db.select().from(payoutCycles).where(eq(payoutCycles.id, cycleId)).limit(1);
      if (!cycle) {
        return res.status(404).json({ message: "Cycle not found" });
      }

      const cycleStart = new Date(cycle.startDate);
      const cycleEnd = new Date(cycle.endDate);

      const relevantCompletions = await db.select({
        completion: bountyCompletions,
        bounty: bounties,
      }).from(bountyCompletions)
        .leftJoin(bounties, eq(bountyCompletions.bountyId, bounties.id))
        .where(and(
          eq(bountyCompletions.creatorId, creatorId),
          inArray(bountyCompletions.status, ["approved", "rejected"])
        ));

      const bountyResults: any[] = [];
      for (const ac of relevantCompletions) {
        if (!ac.bounty) continue;
        const bDate = ac.bounty.deadline ? new Date(ac.bounty.deadline)
          : ac.completion.completedAt ? new Date(ac.completion.completedAt)
          : null;
        if (!bDate || bDate < cycleStart || bDate > cycleEnd) continue;
        const penaltyAmount = parseFloat(ac.bounty.penaltyAmount as unknown as string || "0");
        let rewardValue: string;
        if (ac.completion.status === "rejected") {
          rewardValue = penaltyAmount > 0 ? (-penaltyAmount).toFixed(2) : "0.00";
        } else {
          rewardValue = parseFloat(ac.bounty.reward as unknown as string).toFixed(2);
        }
        bountyResults.push({
          id: ac.bounty.id,
          title: ac.bounty.title,
          reward: rewardValue,
          deadline: ac.bounty.deadline ? ac.bounty.deadline.toISOString() : null,
          status: ac.completion.status,
          completedAt: ac.completion.completedAt ? ac.completion.completedAt.toISOString() : null,
          paidAt: ac.completion.paidAt ? ac.completion.paidAt.toISOString() : null,
          penaltyAmount: penaltyAmount,
        });
      }

      const participantRows = await db.select({
        participant: gameParticipants,
        game: survivorGames,
      }).from(gameParticipants)
        .leftJoin(survivorGames, eq(gameParticipants.gameId, survivorGames.id))
        .where(eq(gameParticipants.creatorId, creatorId));

      const survivorResults: any[] = [];
      for (const pr of participantRows) {
        if (!pr.game || !pr.game.endDate) continue;
        const gameEnd = new Date(pr.game.endDate);
        if (gameEnd < cycleStart || gameEnd > cycleEnd) continue;

        const survivorParts = await db.select().from(gameParticipants)
          .where(and(
            eq(gameParticipants.gameId, pr.game.id),
            eq(gameParticipants.isEliminated, false)
          ));
        const totalSurvivorPosts = survivorParts.reduce((sum, p) => sum + (p.totalPosts || 0), 0);
        const creatorPosts = pr.participant.totalPosts || 0;
        const prizePool = parseFloat(pr.game.prizePool as unknown as string) || 0;
        let projectedPayout = 0;
        let sharePercent = 0;
        const isSurvivor = !pr.participant.isEliminated;
        if (totalSurvivorPosts > 0 && isSurvivor) {
          sharePercent = (creatorPosts / totalSurvivorPosts) * 100;
          projectedPayout = (creatorPosts / totalSurvivorPosts) * prizePool;
        }

        survivorResults.push({
          id: pr.game.id,
          title: pr.game.title,
          prizePool: prizePool.toFixed(2),
          endDate: pr.game.endDate.toISOString(),
          status: pr.game.status,
          projectedPayout: Math.round(projectedPayout * 100) / 100,
          sharePercent: Math.round(sharePercent * 100) / 100,
          totalPosts: creatorPosts,
          isSurvivor,
        });
      }

      res.json({
        bounties: bountyResults,
        survivorGames: survivorResults,
      });
    } catch (error) {
      console.error("Get cycle bounties and survivor error:", error);
      res.status(500).json({ message: "Failed to get cycle bounties and survivor data" });
    }
  });

  app.get("/api/creator/cycles/:id/bounties-and-survivor", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const [creator] = await db.select().from(creators).where(eq(creators.userId, user.id)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      const cycleId = parseInt(req.params.id);
      if (isNaN(cycleId)) return res.status(400).json({ message: "Invalid cycleId" });

      const [cycle] = await db.select().from(payoutCycles).where(eq(payoutCycles.id, cycleId)).limit(1);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });

      const cycleStart = new Date(cycle.startDate);
      const cycleEnd = new Date(cycle.endDate);
      const creatorId = creator.id;

      const relevantCompletions = await db.select({
        completion: bountyCompletions,
        bounty: bounties,
      }).from(bountyCompletions)
        .leftJoin(bounties, eq(bountyCompletions.bountyId, bounties.id))
        .where(and(
          eq(bountyCompletions.creatorId, creatorId),
          inArray(bountyCompletions.status, ["approved", "rejected"])
        ));

      const bountyResults: any[] = [];
      for (const ac of relevantCompletions) {
        if (!ac.bounty) continue;
        const bDate = ac.bounty.deadline ? new Date(ac.bounty.deadline)
          : ac.completion.completedAt ? new Date(ac.completion.completedAt)
          : null;
        if (!bDate || bDate < cycleStart || bDate > cycleEnd) continue;
        const penaltyAmount = parseFloat(ac.bounty.penaltyAmount as unknown as string || "0");
        let rewardValue: string;
        if (ac.completion.status === "rejected") {
          rewardValue = penaltyAmount > 0 ? (-penaltyAmount).toFixed(2) : "0.00";
        } else {
          rewardValue = parseFloat(ac.bounty.reward as unknown as string).toFixed(2);
        }
        bountyResults.push({
          id: ac.bounty.id,
          title: ac.bounty.title,
          reward: rewardValue,
          deadline: ac.bounty.deadline ? ac.bounty.deadline.toISOString() : null,
          status: ac.completion.status,
          completedAt: ac.completion.completedAt ? ac.completion.completedAt.toISOString() : null,
          penaltyAmount: penaltyAmount,
        });
      }

      const participantRows = await db.select({
        participant: gameParticipants,
        game: survivorGames,
      }).from(gameParticipants)
        .leftJoin(survivorGames, eq(gameParticipants.gameId, survivorGames.id))
        .where(eq(gameParticipants.creatorId, creatorId));

      const survivorResults: any[] = [];
      for (const pr of participantRows) {
        if (!pr.game || !pr.game.endDate) continue;
        const gameEnd = new Date(pr.game.endDate);
        if (gameEnd < cycleStart || gameEnd > cycleEnd) continue;

        const survivorParts = await db.select().from(gameParticipants)
          .where(and(
            eq(gameParticipants.gameId, pr.game.id),
            eq(gameParticipants.isEliminated, false)
          ));
        const totalSurvivorPosts = survivorParts.reduce((sum, p) => sum + (p.totalPosts || 0), 0);
        const creatorPosts = pr.participant.totalPosts || 0;
        const prizePool = parseFloat(pr.game.prizePool as unknown as string) || 0;
        let projectedPayout = 0;
        let sharePercent = 0;
        const isSurvivor = !pr.participant.isEliminated;
        if (totalSurvivorPosts > 0 && isSurvivor) {
          sharePercent = (creatorPosts / totalSurvivorPosts) * 100;
          projectedPayout = (creatorPosts / totalSurvivorPosts) * prizePool;
        }

        survivorResults.push({
          id: pr.game.id,
          title: pr.game.title,
          prizePool: prizePool.toFixed(2),
          projectedPayout: projectedPayout.toFixed(2),
          sharePercent: Math.round(sharePercent * 100) / 100,
          isSurvivor,
          totalPosts: creatorPosts,
        });
      }

      res.json({ bounties: bountyResults, survivor: survivorResults });
    } catch (error) {
      console.error("Get creator cycle bounties and survivor error:", error);
      res.status(500).json({ message: "Failed to get cycle bounties and survivor data" });
    }
  });

  app.get("/api/creator/creators/:id", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const creatorId = parseInt(req.params.id);
      if (isNaN(creatorId)) {
        return res.status(400).json({ message: "Invalid creator ID" });
      }

      const [creator] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
      if (!creator) {
        return res.status(404).json({ message: "Creator not found" });
      }

      const creatorVideos = await db.select().from(videos).where(eq(videos.creatorId, creatorId));

      const allCycles = await db.select().from(payoutCycles).orderBy(payoutCycles.startDate);
      const now = new Date();

      const activeCycle = allCycles.find(c => {
        const start = new Date(c.startDate);
        const end = new Date(c.endDate);
        return now >= start && now <= end;
      }) || null;

      const igVideos = creatorVideos.filter(v => v.platform === "instagram");
      const tiktokVideos = creatorVideos.filter(v => v.platform === "tiktok");
      const igViews = igVideos.reduce((sum, v) => sum + (v.views || 0), 0);
      const tiktokViews = tiktokVideos.reduce((sum, v) => sum + (v.views || 0), 0);

      const enrichedVideos = creatorVideos.map(v => {
        const videoDate = v.postedAt ? new Date(v.postedAt) : new Date();
        let cycleId: number | null = null;

        for (const cycle of allCycles) {
          const cycleStart = new Date(cycle.startDate);
          const cycleEnd = new Date(cycle.endDate);
          if (videoDate >= cycleStart && videoDate <= cycleEnd) {
            cycleId = cycle.id;
            break;
          }
        }

        const isEligible = !v.isIrrelevant && !!v.postedAt;

        return {
          ...v,
          timestamp: v.postedAt,
          isEligible,
          cycleId,
          basePayPerVideo: 0,
          bonusAmount: 0,
        };
      });

      const { basePay, totalEarnings, ...safeCreator } = creator;

      res.json({
        creator: {
          ...safeCreator,
          basePay: null,
          totalEarnings: null,
          isPaused: creator.status === "paused",
          isDeleted: creator.status === "deleted",
        },
        videos: enrichedVideos,
        violations: [],
        payouts: [],
        activeCycle,
        allTimeStats: {
          totalVideos: creatorVideos.length,
          igViews,
          tiktokViews,
          totalEarnings: 0,
        },
      });
    } catch (error) {
      console.error("Get creator profile error:", error);
      res.status(500).json({ message: "Failed to get creator details" });
    }
  });

  // Admin: Get dashboard stats
  async function computeDashboardStats() {
    const allCreators = await db.select().from(creators).where(eq(creators.status, "active"));
    const allVideos = await db.select().from(videos)
      .where(inArray(videos.platform, ["instagram", "tiktok"]));

    const allCycles = await db.select().from(payoutCycles).orderBy(desc(payoutCycles.startDate));
    const now = new Date();
    const activeCycle = allCycles.find(c => new Date(c.startDate) <= now && new Date(c.endDate) >= now);

    const newCreators = activeCycle
      ? allCreators.filter(c => {
          const joined = new Date(c.createdAt);
          return joined >= new Date(activeCycle.startDate) && joined <= new Date(activeCycle.endDate);
        }).length
      : 0;

    const totalCreators = allCreators.length;

    const eligibleVideos = allVideos.filter(v => {
      if (v.isIrrelevant) return false;
      if (!v.postedAt) return false;
      return true;
    });

    const cycleEligibleVideos = activeCycle
      ? eligibleVideos.filter(v => {
          if (!v.postedAt) return false;
          const posted = new Date(v.postedAt);
          return posted >= new Date(activeCycle.startDate) && posted <= new Date(activeCycle.endDate);
        })
      : [];

    const igCycleVideos = cycleEligibleVideos.filter(v => v.platform === "instagram");
    const ttCycleVideos = cycleEligibleVideos.filter(v => v.platform === "tiktok");

    const igAllVideos = eligibleVideos.filter(v => v.platform === "instagram");
    const ttAllVideos = eligibleVideos.filter(v => v.platform === "tiktok");

    const viewsThisCycle = cycleEligibleVideos.reduce((s, v) => s + (v.views || 0), 0);
    const igViewsThisCycle = igCycleVideos.reduce((s, v) => s + (v.views || 0), 0);
    const ttViewsThisCycle = ttCycleVideos.reduce((s, v) => s + (v.views || 0), 0);

    const eligibleViewsAll = eligibleVideos.reduce((s, v) => s + (v.views || 0), 0);
    const igEligibleViewsAll = igAllVideos.reduce((s, v) => s + (v.views || 0), 0);
    const ttEligibleViewsAll = ttAllVideos.reduce((s, v) => s + (v.views || 0), 0);

    const igFollowers = allCreators.reduce((s, c) => s + (c.instagramFollowers || 0), 0);
    const ttFollowers = allCreators.reduce((s, c) => s + (c.tiktokFollowers || 0), 0);

    const [settings] = await db.select().from(payoutSettings).limit(1);
    const defaultBasePay = settings?.basePay ? parseFloat(settings.basePay as unknown as string) : 0;
    const tiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));
    const creatorMap = new Map(allCreators.map(c => [c.id, c]));

    let totalPayThisCycle = 0;
    let basePayThisCycle = 0;
    let bonusPayThisCycle = 0;
    if (activeCycle) {
      const PAIR_WINDOW_MS = 24 * 60 * 60 * 1000;
      for (const cr of allCreators) {
        const crCycleVids = cycleEligibleVideos.filter(v => v.creatorId === cr.id);
        const crIgRate = cr.customInstagramBasePay !== null ? parseFloat(cr.customInstagramBasePay as unknown as string) : defaultBasePay;
        const crTtRate = cr.customTiktokBasePay !== null ? parseFloat(cr.customTiktokBasePay as unknown as string) : defaultBasePay;
        const igVids = crCycleVids.filter(v => v.platform === "instagram");
        const ttVids = crCycleVids.filter(v => v.platform === "tiktok");
        const usedTt = new Set<number>();
        for (const ig of igVids) {
          if (!ig.postedAt || ig.duration == null) continue;
          const igTime = new Date(ig.postedAt).getTime();
          let bestMatch: typeof ttVids[0] | null = null;
          let bestDurationDiff = Infinity;
          let bestTimeDiff = Infinity;
          for (const tt of ttVids) {
            if (usedTt.has(tt.id)) continue;
            if (!tt.postedAt || tt.duration == null) continue;
            const durationDiff = Math.abs(ig.duration - tt.duration);
            if (durationDiff > 1) continue;
            const timeDiff = Math.abs(igTime - new Date(tt.postedAt).getTime());
            if (timeDiff <= PAIR_WINDOW_MS && (durationDiff < bestDurationDiff || (durationDiff === bestDurationDiff && timeDiff < bestTimeDiff))) {
              bestDurationDiff = durationDiff;
              bestTimeDiff = timeDiff;
              bestMatch = tt;
            }
          }
          if (bestMatch) {
            usedTt.add(bestMatch.id);
            basePayThisCycle += crIgRate + crTtRate;
            const winnerViews = Math.max(ig.views || 0, bestMatch.views || 0);
            const matchingTier = tiers.find(t => winnerViews >= t.viewThreshold);
            if (matchingTier) {
              bonusPayThisCycle += parseFloat(matchingTier.bonusAmount as unknown as string);
            }
          }
        }
      }
      totalPayThisCycle = basePayThisCycle + bonusPayThisCycle;
    }

    const paidPayouts = await db.select().from(payouts).where(eq(payouts.status, "paid"));
    const moneyPaidTillNow = paidPayouts.reduce((s, p) => s + parseFloat(p.amount), 0);

    const [prevSnapshot] = await db.select().from(statsSnapshots)
      .where(eq(statsSnapshots.snapshotType, "global"))
      .orderBy(desc(statsSnapshots.createdAt))
      .limit(1);

    const stats = {
      newCreators,
      totalCreators,
      videosThisCycle: cycleEligibleVideos.length,
      igVideosThisCycle: igCycleVideos.length,
      ttVideosThisCycle: ttCycleVideos.length,
      eligibleVideos: eligibleVideos.length,
      igEligibleVideos: igAllVideos.length,
      ttEligibleVideos: ttAllVideos.length,
      viewsThisCycle,
      igViewsThisCycle,
      ttViewsThisCycle,
      eligibleViews: eligibleViewsAll,
      igEligibleViews: igEligibleViewsAll,
      ttEligibleViews: ttEligibleViewsAll,
      followers: igFollowers + ttFollowers,
      igFollowers,
      ttFollowers,
      totalPay: totalPayThisCycle,
      basePay: basePayThisCycle,
      bonusPay: bonusPayThisCycle,
      moneyPaidTillNow,
      lastBulkRefreshAt: prevSnapshot ? prevSnapshot.createdAt.toISOString() : null,
      activeCycle: activeCycle ? {
        id: activeCycle.id,
        startDate: activeCycle.startDate,
        endDate: activeCycle.endDate,
      } : null,
    };

    const deltas = prevSnapshot ? {
      newCreators: stats.newCreators - (prevSnapshot.newCreators || 0),
      totalCreators: stats.totalCreators - (prevSnapshot.totalCreators || 0),
      videosThisCycle: stats.videosThisCycle - (prevSnapshot.videosThisCycle || 0),
      igVideosThisCycle: stats.igVideosThisCycle - (prevSnapshot.igVideosThisCycle || 0),
      ttVideosThisCycle: stats.ttVideosThisCycle - (prevSnapshot.ttVideosThisCycle || 0),
      eligibleVideos: stats.eligibleVideos - (prevSnapshot.eligibleVideos || 0),
      igEligibleVideos: stats.igEligibleVideos - (prevSnapshot.igEligibleVideos || 0),
      ttEligibleVideos: stats.ttEligibleVideos - (prevSnapshot.ttEligibleVideos || 0),
      viewsThisCycle: stats.viewsThisCycle - (prevSnapshot.viewsThisCycle || 0),
      igViewsThisCycle: stats.igViewsThisCycle - (prevSnapshot.igViewsThisCycle || 0),
      ttViewsThisCycle: stats.ttViewsThisCycle - (prevSnapshot.ttViewsThisCycle || 0),
      eligibleViews: stats.eligibleViews - (prevSnapshot.eligibleViews || 0),
      igEligibleViews: stats.igEligibleViews - (prevSnapshot.igEligibleViews || 0),
      ttEligibleViews: stats.ttEligibleViews - (prevSnapshot.ttEligibleViews || 0),
      followers: stats.followers - (prevSnapshot.followers || 0),
      igFollowers: stats.igFollowers - (prevSnapshot.igFollowers || 0),
      ttFollowers: stats.ttFollowers - (prevSnapshot.ttFollowers || 0),
      totalPay: stats.totalPay - parseFloat((prevSnapshot.totalPay as unknown as string) || "0"),
      moneyPaidTillNow: stats.moneyPaidTillNow - parseFloat((prevSnapshot.moneyPaidTillNow as unknown as string) || "0"),
    } : null;

    return { ...stats, deltas };
  }

  async function saveStatsSnapshot(stats: any) {
    const values = {
      snapshotType: "global" as const,
      newCreators: stats.newCreators ?? 0,
      totalCreators: stats.totalCreators ?? 0,
      videosThisCycle: stats.videosThisCycle ?? 0,
      igVideosThisCycle: stats.igVideosThisCycle ?? 0,
      ttVideosThisCycle: stats.ttVideosThisCycle ?? 0,
      eligibleVideos: stats.eligibleVideos ?? 0,
      igEligibleVideos: stats.igEligibleVideos ?? 0,
      ttEligibleVideos: stats.ttEligibleVideos ?? 0,
      viewsThisCycle: stats.viewsThisCycle ?? 0,
      igViewsThisCycle: stats.igViewsThisCycle ?? 0,
      ttViewsThisCycle: stats.ttViewsThisCycle ?? 0,
      eligibleViews: stats.eligibleViews ?? 0,
      igEligibleViews: stats.igEligibleViews ?? 0,
      ttEligibleViews: stats.ttEligibleViews ?? 0,
      followers: stats.followers ?? 0,
      igFollowers: stats.igFollowers ?? 0,
      ttFollowers: stats.ttFollowers ?? 0,
      totalPay: typeof stats.totalPay === 'number' ? stats.totalPay.toFixed(2) : (stats.totalPay || "0.00"),
      moneyPaidTillNow: typeof stats.moneyPaidTillNow === 'number' ? stats.moneyPaidTillNow.toFixed(2) : (stats.moneyPaidTillNow || "0.00"),
    };
    await db.insert(statsSnapshots).values(values);
  }

  app.get("/api/admin/dashboard-stats", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stats = await computeDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Get dashboard stats error:", error);
      res.status(500).json({ message: "Failed to get dashboard stats" });
    }
  });

  // Admin: Sync all creators
  app.post("/api/admin/sync", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const allCreators = await db.select().from(creators);
      let totalInstagram = 0;
      let totalTiktok = 0;
      const failedCreators: string[] = [];

      for (let i = 0; i < allCreators.length; i++) {
        const creator = allCreators[i];
        console.log(`[Bulk Sync] Processing creator ${i + 1}/${allCreators.length}: ${creator.name} (id=${creator.id})`);

        try {
          if (creator.instagramUsername) {
            console.log(`[Bulk Sync] Fetching IG reels for @${creator.instagramUsername}`);
            const { reels, error: igError } = await fetchInstagramReels(creator.instagramUsername);
            if (igError) {
              console.error(`[Bulk Sync] IG fetch failed for ${creator.name}: ${igError}`);
              failedCreators.push(`${creator.name} (IG)`);
            } else if (reels && reels.length > 0) {
              const igCount = await replaceCreatorPlatformVideos(creator.id, "instagram", reels);
              totalInstagram += igCount;
              console.log(`[Bulk Sync] Got ${reels.length} IG reels for ${creator.name}`);
            }

            const profile = await fetchInstagramProfile(creator.instagramUsername);
            if (profile) {
              await db.update(creators)
                .set({ instagramFollowers: profile.followers })
                .where(eq(creators.id, creator.id));
            }
            await delay(500);
          }

          if (creator.tiktokUsername) {
            console.log(`[Bulk Sync] Fetching TT videos for @${creator.tiktokUsername}`);
            const previousTTCount = await db.select({ count: sql<number>`count(*)` }).from(videos).where(and(eq(videos.creatorId, creator.id), eq(videos.platform, 'tiktok')));
            const ttPrevCount = Number(previousTTCount[0]?.count || 0);
            const { videos: tiktokVideos, error: ttError } = await fetchTikTokVideos(creator.tiktokUsername, ttPrevCount);
            if (ttError) {
              console.error(`[Bulk Sync] TT fetch failed for ${creator.name}: ${ttError}`);
              failedCreators.push(`${creator.name} (TT)`);
            } else if (tiktokVideos && tiktokVideos.length > 0) {
              const ttCount = await replaceCreatorPlatformVideos(creator.id, "tiktok", tiktokVideos);
              totalTiktok += ttCount;
              console.log(`[Bulk Sync] Got ${tiktokVideos.length} TT videos for ${creator.name}`);
            }

            const profile = await fetchTikTokProfile(creator.tiktokUsername);
            if (profile) {
              await db.update(creators)
                .set({ tiktokFollowers: profile.followers })
                .where(eq(creators.id, creator.id));
            }
            await delay(500);
          }

          await db.update(creators)
            .set({ lastSyncAt: new Date() })
            .where(eq(creators.id, creator.id));

          await detectCelebrations(creator.id);
          await detectViolations(creator.id);

          console.log(`[Bulk Sync] Completed creator ${creator.name}: IG=${totalInstagram}, TT=${totalTiktok}`);
        } catch (creatorError) {
          console.error(`[Bulk Sync] Error processing creator ${creator.name}:`, creatorError);
          failedCreators.push(creator.name);
        }
      }

      await updateSurvivorGameStats();

      const allCycles = await db.select().from(payoutCycles).orderBy(desc(payoutCycles.startDate));
      const activeCycle = allCycles.find(c => {
        const now = new Date();
        return now >= new Date(c.startDate) && now <= new Date(c.endDate) && !c.paidAt;
      });
      if (activeCycle) {
        console.log(`[Bulk Sync] Auto-refreshing active cycle ${activeCycle.id}`);
        const activeCreators = await db.select().from(creators).where(eq(creators.status, "active"));
        let cycleTotalAmount = 0;
        for (const creator of activeCreators) {
          const result = await calculateCreatorCyclePayout(creator.id, activeCycle, { useCurrentRates: true });
          const existingPayout = await db.select().from(payouts).where(
            and(eq(payouts.creatorId, creator.id), eq(payouts.cycleId, activeCycle.id))
          ).limit(1);
          if (existingPayout[0]) {
            await db.update(payouts).set({
              amount: result.totalAmount.toFixed(2),
              basePay: result.basePay.toFixed(2),
              bonusPay: result.bonusPay.toFixed(2),
              eligibleViews: result.eligibleViews,
              snapshotIgBasePay: result.igRate.toFixed(2),
              snapshotTtBasePay: result.ttRate.toFixed(2),
              snapshotDefaultBasePay: result.defaultBasePay.toFixed(2),
            }).where(eq(payouts.id, existingPayout[0].id));
            cycleTotalAmount += result.totalAmount;
          } else {
            const creatorCycleVideos = await db.select({ count: sql<number>`count(*)` }).from(videos)
              .where(and(
                eq(videos.creatorId, creator.id),
                gte(videos.postedAt, activeCycle.startDate),
                lte(videos.postedAt, activeCycle.endDate)
              ));
            const hasVideos = Number(creatorCycleVideos[0]?.count || 0) > 0;
            if (hasVideos) {
              await db.insert(payouts).values({
                creatorId: creator.id,
                cycleId: activeCycle.id,
                amount: result.totalAmount.toFixed(2),
                basePay: result.basePay.toFixed(2),
                bonusPay: result.bonusPay.toFixed(2),
                eligibleViews: result.eligibleViews,
                snapshotIgBasePay: result.igRate.toFixed(2),
                snapshotTtBasePay: result.ttRate.toFixed(2),
                snapshotDefaultBasePay: result.defaultBasePay.toFixed(2),
                status: "pending",
                periodStart: activeCycle.startDate,
                periodEnd: activeCycle.endDate,
              });
              cycleTotalAmount += result.totalAmount;
            }
          }
        }
        await db.update(payoutCycles).set({ totalAmount: cycleTotalAmount.toFixed(2) }).where(eq(payoutCycles.id, activeCycle.id));
        console.log(`[Bulk Sync] Active cycle ${activeCycle.id} refreshed, total: $${cycleTotalAmount.toFixed(2)}`);
      }

      try {
        const stats = await computeDashboardStats();
        await saveStatsSnapshot(stats);
      } catch (e) {
        console.error("Failed to save stats snapshot after admin sync:", e);
      }

      if (failedCreators.length > 0) {
        console.warn(`[Bulk Sync] Failed creators: ${failedCreators.join(", ")}`);
      }
      console.log(`[Bulk Sync] Complete: ${totalInstagram} IG, ${totalTiktok} TT, ${failedCreators.length} failures`);

      res.json({ 
        message: "Admin sync complete", 
        instagram: totalInstagram, 
        tiktok: totalTiktok,
        failedCreators: failedCreators.length > 0 ? failedCreators : undefined,
      });
    } catch (error) {
      console.error("Admin sync error:", error);
      res.status(500).json({ message: "Failed to sync all creators" });
    }
  });

  // Admin: Sync single creator (used by creator detail page)
  app.post("/api/admin/sync/creator/:id", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const creatorId = parseInt(req.params.id);
      const [creator] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
      
      if (!creator) {
        return res.status(404).json({ message: "Creator not found" });
      }

      let totalInstagram = 0;
      let totalTiktok = 0;

      if (creator.instagramUsername) {
        const { reels } = await fetchInstagramReels(creator.instagramUsername);
        if (reels && reels.length > 0) {
          totalInstagram = await replaceCreatorPlatformVideos(creator.id, "instagram", reels);
        }

        const profile = await fetchInstagramProfile(creator.instagramUsername);
        if (profile) {
          await db.update(creators)
            .set({ instagramFollowers: profile.followers })
            .where(eq(creators.id, creator.id));
        }
      }

      if (creator.tiktokUsername) {
        const previousTTCount = await db.select({ count: sql<number>`count(*)` }).from(videos).where(and(eq(videos.creatorId, creator.id), eq(videos.platform, 'tiktok')));
        const ttPrevCount = Number(previousTTCount[0]?.count || 0);
        const { videos: tiktokVideos } = await fetchTikTokVideos(creator.tiktokUsername, ttPrevCount);
        if (tiktokVideos && tiktokVideos.length > 0) {
          totalTiktok = await replaceCreatorPlatformVideos(creator.id, "tiktok", tiktokVideos);
        }

        const tiktokProfile = await fetchTikTokProfile(creator.tiktokUsername);
        if (tiktokProfile) {
          await db.update(creators)
            .set({ tiktokFollowers: tiktokProfile.followers })
            .where(eq(creators.id, creator.id));
        }
      }

      await db.update(creators)
        .set({ lastSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(creators.id, creator.id));

      await detectCelebrations(creator.id);
      await detectViolations(creator.id);
      await updateSurvivorGameStats([creator.id]);

      res.json({ instagram: totalInstagram, tiktok: totalTiktok });
    } catch (error) {
      console.error("Single creator sync error:", error);
      res.status(500).json({ message: "Failed to sync creator" });
    }
  });

  app.post("/api/admin/cycles/:cycleId/refresh-creator/:creatorId", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const cycleId = parseInt(req.params.cycleId);
      const creatorId = parseInt(req.params.creatorId);

      const [cycle] = await db.select().from(payoutCycles).where(eq(payoutCycles.id, cycleId)).limit(1);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });

      const [creator] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      const existingPayout = await db.select().from(payouts).where(
        and(eq(payouts.creatorId, creatorId), eq(payouts.cycleId, cycleId))
      ).limit(1);
      if (existingPayout[0]?.paidAt) {
        return res.status(400).json({ message: "Cannot refresh a paid cycle" });
      }

      let totalInstagram = 0;
      let totalTiktok = 0;

      if (creator.instagramUsername) {
        const { reels } = await fetchInstagramReels(creator.instagramUsername);
        if (reels && reels.length > 0) {
          totalInstagram = await replaceCreatorPlatformVideos(creator.id, "instagram", reels);
        }
      }

      if (creator.tiktokUsername) {
        const previousTTCount = await db.select({ count: sql<number>`count(*)` }).from(videos).where(and(eq(videos.creatorId, creator.id), eq(videos.platform, 'tiktok')));
        const ttPrevCount = Number(previousTTCount[0]?.count || 0);
        const { videos: tiktokVideos } = await fetchTikTokVideos(creator.tiktokUsername, ttPrevCount);
        if (tiktokVideos && tiktokVideos.length > 0) {
          totalTiktok = await replaceCreatorPlatformVideos(creator.id, "tiktok", tiktokVideos);
        }
      }

      await db.update(creators)
        .set({ lastSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(creators.id, creator.id));

      const now = new Date();
      const isActiveCycle = now >= new Date(cycle.startDate) && now <= new Date(cycle.endDate);
      const result = await calculateCreatorCyclePayout(creator.id, cycle, { useCurrentRates: isActiveCycle });

      if (existingPayout[0]) {
        await db.update(payouts)
          .set({
            amount: result.totalAmount.toFixed(2),
            basePay: result.basePay.toFixed(2),
            bonusPay: result.bonusPay.toFixed(2),
            eligibleViews: result.eligibleViews,
            snapshotIgBasePay: result.igRate.toFixed(2),
            snapshotTtBasePay: result.ttRate.toFixed(2),
            snapshotDefaultBasePay: result.defaultBasePay.toFixed(2),
          })
          .where(eq(payouts.id, existingPayout[0].id));
      } else {
        await db.insert(payouts).values({
          creatorId: creator.id,
          cycleId: cycle.id,
          amount: result.totalAmount.toFixed(2),
          basePay: result.basePay.toFixed(2),
          bonusPay: result.bonusPay.toFixed(2),
          eligibleViews: result.eligibleViews,
          snapshotIgBasePay: result.igRate.toFixed(2),
          snapshotTtBasePay: result.ttRate.toFixed(2),
          snapshotDefaultBasePay: result.defaultBasePay.toFixed(2),
          status: "pending",
          periodStart: cycle.startDate,
          periodEnd: cycle.endDate,
        });
      }

      res.json({
        message: "Cycle refreshed successfully",
        instagram: totalInstagram,
        tiktok: totalTiktok,
        amount: result.totalAmount.toFixed(2),
      });
    } catch (error) {
      console.error("Cycle refresh error:", error);
      res.status(500).json({ message: "Failed to refresh cycle" });
    }
  });

  app.post("/api/admin/cycles/:cycleId/refresh", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const cycleId = parseInt(req.params.cycleId);
      const [cycle] = await db.select().from(payoutCycles).where(eq(payoutCycles.id, cycleId)).limit(1);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      if (cycle.paidAt) return res.status(400).json({ message: "Cannot refresh a paid cycle" });

      const now = new Date();
      const isActiveCycle = now >= new Date(cycle.startDate) && now <= new Date(cycle.endDate);
      const allCreators = await db.select().from(creators).where(eq(creators.status, "active"));

      let totalAmount = 0;
      let creatorCount = 0;

      for (const creator of allCreators) {
        const result = await calculateCreatorCyclePayout(creator.id, cycle, { useCurrentRates: isActiveCycle });

        const existingPayout = await db.select().from(payouts).where(
          and(eq(payouts.creatorId, creator.id), eq(payouts.cycleId, cycleId))
        ).limit(1);

        if (existingPayout[0]) {
          await db.update(payouts)
            .set({
              amount: result.totalAmount.toFixed(2),
              basePay: result.basePay.toFixed(2),
              bonusPay: result.bonusPay.toFixed(2),
              eligibleViews: result.eligibleViews,
              snapshotIgBasePay: result.igRate.toFixed(2),
              snapshotTtBasePay: result.ttRate.toFixed(2),
              snapshotDefaultBasePay: result.defaultBasePay.toFixed(2),
            })
            .where(eq(payouts.id, existingPayout[0].id));
          totalAmount += result.totalAmount;
          if (result.totalAmount > 0) creatorCount++;
        } else {
          const creatorCycleVideos = await db.select({ count: sql<number>`count(*)` }).from(videos)
            .where(and(
              eq(videos.creatorId, creator.id),
              gte(videos.postedAt, cycle.startDate),
              lte(videos.postedAt, cycle.endDate)
            ));
          const hasVideos = Number(creatorCycleVideos[0]?.count || 0) > 0;
          if (hasVideos) {
            await db.insert(payouts).values({
              creatorId: creator.id,
              cycleId: cycle.id,
              amount: result.totalAmount.toFixed(2),
              basePay: result.basePay.toFixed(2),
              bonusPay: result.bonusPay.toFixed(2),
              eligibleViews: result.eligibleViews,
              snapshotIgBasePay: result.igRate.toFixed(2),
              snapshotTtBasePay: result.ttRate.toFixed(2),
              snapshotDefaultBasePay: result.defaultBasePay.toFixed(2),
              status: "pending",
              periodStart: cycle.startDate,
              periodEnd: cycle.endDate,
            });
            totalAmount += result.totalAmount;
            if (result.totalAmount > 0) creatorCount++;
          }
        }
      }

      await db.update(payoutCycles)
        .set({ totalAmount: totalAmount.toFixed(2) })
        .where(eq(payoutCycles.id, cycleId));

      res.json({ message: "Cycle refreshed successfully", totalAmount: totalAmount.toFixed(2), creatorCount });
    } catch (error) {
      console.error("Refresh cycle error:", error);
      res.status(500).json({ message: "Failed to refresh cycle" });
    }
  });

  app.post("/api/sync/bulk-complete", authenticateToken, async (req: any, res) => {
    try {
      const stats = await computeDashboardStats();
      await saveStatsSnapshot(stats);
    } catch (e) {
      console.error("Failed to save stats snapshot after bulk sync:", e);
    }
    res.json({ message: "Bulk sync complete" });
  });

  // ==================== STREAK SURVIVOR GAMES ====================

  // Get active survivor game
  app.get("/api/admin/streak-survivor/active", authenticateToken, async (req, res) => {
    try {
      const [game] = await db.select().from(survivorGames)
        .where(eq(survivorGames.status, "active"))
        .limit(1);
      
      if (!game) {
        return res.json({ game: null, myStats: null, survivors: [], eliminated: [] });
      }

      if (game.endDate && new Date() > new Date(game.endDate)) {
        await db.update(survivorGames)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(survivorGames.id, game.id));
        return res.json({ game: null, myStats: null, survivors: [], eliminated: [] });
      }

      await updateSurvivorGameStats();

      const participants = await db.select({
        participant: gameParticipants,
        creator: creators,
      }).from(gameParticipants)
        .leftJoin(creators, eq(gameParticipants.creatorId, creators.id))
        .where(and(eq(gameParticipants.gameId, game.id), eq(creators.status, "active")));

      const survivors = participants.filter(p => !p.participant.isEliminated);
      const totalSurvivorPosts = survivors.reduce((sum, p) => sum + (p.participant.totalPosts || 0), 0);
      const prizePool = parseFloat(game.prizePool || "0");

      const allCreatorIds = participants.map(p => p.participant.creatorId);
      const gameStartDate = game.startDate ? new Date(game.startDate) : new Date();
      let platformCounts: Map<number, { igPosts: number; ttPosts: number }> = new Map();
      if (allCreatorIds.length > 0) {
        const platformVideos = await db.select({
          creatorId: videos.creatorId,
          platform: videos.platform,
        }).from(videos)
          .where(and(
            inArray(videos.creatorId, allCreatorIds),
            gte(videos.postedAt, gameStartDate),
            eq(videos.isIrrelevant, false)
          ));
        for (const v of platformVideos) {
          if (!platformCounts.has(v.creatorId)) {
            platformCounts.set(v.creatorId, { igPosts: 0, ttPosts: 0 });
          }
          const counts = platformCounts.get(v.creatorId)!;
          if (v.platform === "instagram") counts.igPosts++;
          else if (v.platform === "tiktok") counts.ttPosts++;
        }
      }

      const mapParticipant = (p: typeof participants[0]) => {
        const creatorPosts = p.participant.totalPosts || 0;
        const isSurvivor = !p.participant.isEliminated;
        const projectedPayout = isSurvivor && totalSurvivorPosts > 0
          ? (creatorPosts / totalSurvivorPosts) * prizePool
          : 0;
        const counts = platformCounts.get(p.participant.creatorId) || { igPosts: 0, ttPosts: 0 };
        return {
          ...p.participant,
          name: p.creator?.name || "Unknown",
          email: p.creator?.email,
          instagramUsername: p.creator?.instagramUsername,
          tiktokUsername: p.creator?.tiktokUsername,
          igPosts: counts.igPosts,
          ttPosts: counts.ttPosts,
          projectedPayout: Math.round(projectedPayout * 100) / 100,
          sharePercent: totalSurvivorPosts > 0 && isSurvivor
            ? Math.round((creatorPosts / totalSurvivorPosts) * 10000) / 100
            : 0,
        };
      };

      const survivorsList = survivors.map(mapParticipant);
      const eliminatedList = participants.filter(p => p.participant.isEliminated).map(mapParticipant);

      const updatedGame = await db.select().from(survivorGames).where(eq(survivorGames.id, game.id)).limit(1);

      res.json({
        game: {
          ...(updatedGame[0] || game),
          totalParticipants: participants.length,
          eliminatedCount: eliminatedList.length,
          activeCount: survivorsList.length,
        },
        myStats: null,
        survivors: survivorsList,
        eliminated: eliminatedList,
      });
    } catch (error) {
      console.error("Get active game error:", error);
      res.status(500).json({ message: "Failed to get active game" });
    }
  });

  // Create new survivor game
  app.post("/api/admin/streak-survivor/games", authenticateToken, async (req, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { title, description, prizePool, startDate, endDate, startingLives, minPostsPerDay } = req.body;

      let parsedStartDate: Date;
      if (startDate) {
        const sd = new Date(startDate);
        parsedStartDate = new Date(Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate(), 0, 0, 0, 0));
      } else {
        const now = new Date();
        parsedStartDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      }

      let parsedEndDate: Date | null = null;
      if (endDate) {
        const ed = new Date(endDate);
        parsedEndDate = new Date(Date.UTC(ed.getUTCFullYear(), ed.getUTCMonth(), ed.getUTCDate(), 23, 59, 59, 999));
      }

      const [game] = await db.insert(survivorGames).values({
        title: title || "Streak Survivor",
        description,
        prizePool: String(prizePool || 500),
        originalPrizePool: String(prizePool || 500),
        startingLives: startingLives || 2,
        minPostsPerDay: minPostsPerDay || 1,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        status: "active",
        currentDay: 1,
      }).returning();

      // Auto-enroll all active creators
      const allCreators = await db.select().from(creators).where(eq(creators.status, "active"));
      
      for (const creator of allCreators) {
        await db.insert(gameParticipants).values({
          gameId: game.id,
          creatorId: creator.id,
          lives: startingLives || 2,
        });
      }

      res.json({ 
        ...game, 
        totalParticipants: allCreators.length 
      });
    } catch (error) {
      console.error("Create game error:", error);
      res.status(500).json({ message: "Failed to create game" });
    }
  });

  // Get all games
  app.get("/api/admin/streak-survivor/games", authenticateToken, async (req, res) => {
    try {
      const games = await db.select().from(survivorGames).orderBy(desc(survivorGames.createdAt));
      res.json(games);
    } catch (error) {
      console.error("Get games error:", error);
      res.status(500).json({ message: "Failed to get games" });
    }
  });

  // Update a game
  app.put("/api/admin/streak-survivor/games/:id", authenticateToken, async (req, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const gameId = parseInt(req.params.id);
      const { title, description, prizePool, endDate, startingLives, minPostsPerDay } = req.body;

      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (prizePool !== undefined) updateData.prizePool = String(prizePool);
      if (endDate !== undefined) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        updateData.endDate = end;
      }
      if (startingLives !== undefined) updateData.startingLives = startingLives;
      if (minPostsPerDay !== undefined) updateData.minPostsPerDay = minPostsPerDay;

      const [updated] = await db.update(survivorGames)
        .set(updateData)
        .where(eq(survivorGames.id, gameId))
        .returning();

      if (!updated) return res.status(404).json({ message: "Game not found" });

      if (startingLives !== undefined) {
        await updateSurvivorGameStats();
      }

      res.json(updated);
    } catch (error) {
      console.error("Update game error:", error);
      res.status(500).json({ message: "Failed to update game" });
    }
  });

  // End a game
  app.post("/api/admin/streak-survivor/games/:id/end", authenticateToken, async (req, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const gameId = parseInt(req.params.id);
      const [game] = await db.update(survivorGames)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(survivorGames.id, gameId))
        .returning();

      res.json(game);
    } catch (error) {
      console.error("End game error:", error);
      res.status(500).json({ message: "Failed to end game" });
    }
  });

  app.delete("/api/admin/streak-survivor/games/:id", authenticateToken, async (req, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const gameId = parseInt(req.params.id);

      await db.delete(gameParticipants).where(eq(gameParticipants.gameId, gameId));
      await db.delete(survivorGames).where(eq(survivorGames.id, gameId));

      res.json({ message: "Game deleted successfully" });
    } catch (error) {
      console.error("Delete game error:", error);
      res.status(500).json({ message: "Failed to delete game" });
    }
  });

  // Start a game
  app.post("/api/admin/streak-survivor/games/:id/start", authenticateToken, async (req, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const gameId = parseInt(req.params.id);
      const [game] = await db.update(survivorGames)
        .set({ status: "active", currentDay: 1, updatedAt: new Date() })
        .where(eq(survivorGames.id, gameId))
        .returning();

      res.json(game);
    } catch (error) {
      console.error("Start game error:", error);
      res.status(500).json({ message: "Failed to start game" });
    }
  });

  // Get game participants
  app.get("/api/admin/streak-survivor/games/:id/participants", authenticateToken, async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);

      const [game] = await db.select().from(survivorGames).where(eq(survivorGames.id, gameId)).limit(1);

      const participants = await db.select({
        participant: gameParticipants,
        creator: creators,
      }).from(gameParticipants)
        .leftJoin(creators, eq(gameParticipants.creatorId, creators.id))
        .where(eq(gameParticipants.gameId, gameId));

      const survivors = participants.filter(p => !p.participant.isEliminated);
      const totalSurvivorPosts = survivors.reduce((sum, p) => sum + (p.participant.totalPosts || 0), 0);
      const prizePool = parseFloat(game?.prizePool || "0");

      res.json(participants.map(p => {
        const creatorPosts = p.participant.totalPosts || 0;
        const isSurvivor = !p.participant.isEliminated;
        const projectedPayout = isSurvivor && totalSurvivorPosts > 0
          ? (creatorPosts / totalSurvivorPosts) * prizePool
          : 0;

        return {
          ...p.participant,
          creatorName: p.creator?.name,
          instagramUsername: p.creator?.instagramUsername,
          tiktokUsername: p.creator?.tiktokUsername,
          projectedPayout: Math.round(projectedPayout * 100) / 100,
          sharePercent: totalSurvivorPosts > 0 && isSurvivor
            ? Math.round((creatorPosts / totalSurvivorPosts) * 10000) / 100
            : 0,
        };
      }));
    } catch (error) {
      console.error("Get participants error:", error);
      res.status(500).json({ message: "Failed to get participants" });
    }
  });

  app.get("/api/admin/streak-survivor/history", authenticateToken, async (req, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const games = await db.select().from(survivorGames)
        .where(eq(survivorGames.status, "completed"))
        .orderBy(desc(survivorGames.createdAt));

      const gamesWithParticipants = await Promise.all(games.map(async (game) => {
        const participants = await db.select({
          participant: gameParticipants,
          creator: creators,
        }).from(gameParticipants)
          .leftJoin(creators, eq(gameParticipants.creatorId, creators.id))
          .where(eq(gameParticipants.gameId, game.id));

        const survivors = participants.filter(p => !p.participant.isEliminated);
        const totalSurvivorPosts = survivors.reduce((sum, p) => sum + (p.participant.totalPosts || 0), 0);
        const prizePool = parseFloat(game.prizePool || "0");

        return {
          ...game,
          totalParticipants: participants.length,
          survivorCount: survivors.length,
          eliminatedCount: participants.filter(p => p.participant.isEliminated).length,
          participants: participants.map(p => {
            const creatorPosts = p.participant.totalPosts || 0;
            const isSurvivor = !p.participant.isEliminated;
            const projectedPayout = isSurvivor && totalSurvivorPosts > 0
              ? Math.round((creatorPosts / totalSurvivorPosts) * prizePool * 100) / 100
              : 0;
            return {
              ...p.participant,
              name: p.creator?.name || "Unknown",
              email: p.creator?.email || "",
              instagramUsername: p.creator?.instagramUsername,
              tiktokUsername: p.creator?.tiktokUsername,
              projectedPayout,
              sharePercent: totalSurvivorPosts > 0 && isSurvivor
                ? Math.round((creatorPosts / totalSurvivorPosts) * 10000) / 100
                : 0,
            };
          }),
        };
      }));

      res.json(gamesWithParticipants);
    } catch (error) {
      console.error("Get game history error:", error);
      res.status(500).json({ message: "Failed to get game history" });
    }
  });

  app.get("/api/creator/streak-survivor/active", authenticateToken, async (req: any, res) => {
    try {
      const [game] = await db.select().from(survivorGames)
        .where(eq(survivorGames.status, "active"))
        .limit(1);

      if (!game) {
        return res.json({ game: null, myStats: null, survivors: [], eliminated: [] });
      }

      if (game.endDate && new Date() > new Date(game.endDate)) {
        await db.update(survivorGames)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(survivorGames.id, game.id));
        return res.json({ game: null, myStats: null, survivors: [], eliminated: [] });
      }

      await updateSurvivorGameStats();

      const participants = await db.select({
        participant: gameParticipants,
        creator: creators,
      }).from(gameParticipants)
        .leftJoin(creators, eq(gameParticipants.creatorId, creators.id))
        .where(and(eq(gameParticipants.gameId, game.id), eq(creators.status, "active")));

      const survivors = participants.filter(p => !p.participant.isEliminated);
      const totalSurvivorPosts = survivors.reduce((sum, p) => sum + (p.participant.totalPosts || 0), 0);
      const prizePool = parseFloat(game.prizePool || "0");

      const allCreatorIds = participants.map(p => p.participant.creatorId);
      const gameStartDate = game.startDate ? new Date(game.startDate) : new Date();
      let platformCounts: Map<number, { igPosts: number; ttPosts: number }> = new Map();
      if (allCreatorIds.length > 0) {
        const platformVideos = await db.select({
          creatorId: videos.creatorId,
          platform: videos.platform,
        }).from(videos)
          .where(and(
            inArray(videos.creatorId, allCreatorIds),
            gte(videos.postedAt, gameStartDate),
            eq(videos.isIrrelevant, false)
          ));
        for (const v of platformVideos) {
          if (!platformCounts.has(v.creatorId)) {
            platformCounts.set(v.creatorId, { igPosts: 0, ttPosts: 0 });
          }
          const counts = platformCounts.get(v.creatorId)!;
          if (v.platform === "instagram") counts.igPosts++;
          else if (v.platform === "tiktok") counts.ttPosts++;
        }
      }

      const mapParticipant = (p: typeof participants[0]) => {
        const creatorPosts = p.participant.totalPosts || 0;
        const isSurvivor = !p.participant.isEliminated;
        const projectedPayout = isSurvivor && totalSurvivorPosts > 0
          ? (creatorPosts / totalSurvivorPosts) * prizePool
          : 0;
        const counts = platformCounts.get(p.participant.creatorId) || { igPosts: 0, ttPosts: 0 };
        return {
          ...p.participant,
          name: p.creator?.name || "Unknown",
          email: p.creator?.email,
          instagramUsername: p.creator?.instagramUsername,
          tiktokUsername: p.creator?.tiktokUsername,
          igPosts: counts.igPosts,
          ttPosts: counts.ttPosts,
          projectedPayout: Math.round(projectedPayout * 100) / 100,
          sharePercent: totalSurvivorPosts > 0 && isSurvivor
            ? Math.round((creatorPosts / totalSurvivorPosts) * 10000) / 100
            : 0,
        };
      };

      const survivorsList = survivors.map(mapParticipant);
      const eliminatedList = participants.filter(p => p.participant.isEliminated).map(mapParticipant);

      const updatedGame = await db.select().from(survivorGames).where(eq(survivorGames.id, game.id)).limit(1);

      const [userCreator] = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);

      let myStats = null;
      if (userCreator) {
        const myParticipant = participants.find(p => p.participant.creatorId === userCreator.id);
        if (myParticipant) {
          const mapped = mapParticipant(myParticipant);
          myStats = {
            ...mapped,
            rank: survivorsList.findIndex(s => s.creatorId === userCreator.id) + 1,
          };
        }
      }

      res.json({
        game: {
          ...(updatedGame[0] || game),
          totalParticipants: participants.length,
          eliminatedCount: eliminatedList.length,
          activeCount: survivorsList.length,
        },
        myStats,
        survivors: survivorsList,
        eliminated: eliminatedList,
      });
    } catch (error) {
      console.error("Get creator active game error:", error);
      res.status(500).json({ message: "Failed to get active game" });
    }
  });

  app.get("/api/creator/streak-survivor/history", authenticateToken, async (req: any, res) => {
    try {
      const [userCreator] = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);

      const games = await db.select().from(survivorGames)
        .where(eq(survivorGames.status, "completed"))
        .orderBy(desc(survivorGames.createdAt));

      const gamesWithStats = await Promise.all(games.map(async (game) => {
        const participants = await db.select({
          participant: gameParticipants,
          creator: creators,
        }).from(gameParticipants)
          .leftJoin(creators, eq(gameParticipants.creatorId, creators.id))
          .where(eq(gameParticipants.gameId, game.id));

        const survivors = participants.filter(p => !p.participant.isEliminated);
        const totalSurvivorPosts = survivors.reduce((sum, p) => sum + (p.participant.totalPosts || 0), 0);
        const prizePool = parseFloat(game.prizePool || "0");

        let myStats = null;
        if (userCreator) {
          const myParticipant = participants.find(p => p.participant.creatorId === userCreator.id);
          if (myParticipant) {
            const isSurvivor = !myParticipant.participant.isEliminated;
            const creatorPosts = myParticipant.participant.totalPosts || 0;

            let igPosts = 0;
            let ttPosts = 0;
            if (game.startDate) {
              const gameStart = new Date(game.startDate);
              const gameEnd = game.endDate ? new Date(game.endDate) : new Date();
              const creatorVideos = await db.select().from(videos)
                .where(and(
                  eq(videos.creatorId, userCreator.id),
                  eq(videos.isIrrelevant, false),
                  gte(videos.postedAt, gameStart),
                ));
              for (const v of creatorVideos) {
                if (new Date(v.postedAt) <= gameEnd) {
                  if (v.platform === 'instagram') igPosts++;
                  else if (v.platform === 'tiktok') ttPosts++;
                }
              }
            }

            myStats = {
              ...myParticipant.participant,
              isSurvivor,
              igPosts,
              ttPosts,
              projectedPayout: isSurvivor && totalSurvivorPosts > 0
                ? Math.round((creatorPosts / totalSurvivorPosts) * prizePool * 100) / 100
                : 0,
              sharePercent: totalSurvivorPosts > 0 && isSurvivor
                ? Math.round((creatorPosts / totalSurvivorPosts) * 10000) / 100
                : 0,
            };
          }
        }

        return {
          ...game,
          totalParticipants: participants.length,
          survivorCount: survivors.length,
          eliminatedCount: participants.filter(p => p.participant.isEliminated).length,
          myStats,
          survivors: survivors.map(p => ({
            name: p.creator?.name || "Unknown",
            email: p.creator?.email || "",
            totalPosts: p.participant.totalPosts || 0,
            currentStreak: p.participant.currentStreak || 0,
            longestStreak: p.participant.longestStreak || 0,
          })),
        };
      }));

      res.json(gamesWithStats);
    } catch (error) {
      console.error("Get creator game history error:", error);
      res.status(500).json({ message: "Failed to get game history" });
    }
  });

  // ==================== BOUNTY BOARD ====================

  // Get all bounties
  app.get("/api/admin/bounties", authenticateToken, async (req: any, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const allBounties = await db.select().from(bounties).orderBy(desc(bounties.createdAt));
      const allClaims = await db.select().from(bountyCompletions);
      const allCreators = await db.select().from(creators);
      const allUsers = await db.select().from(users);

      const creatorMap = new Map(allCreators.map(c => [c.id, c]));
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const claimsByBounty = new Map<number, any[]>();
      for (const claim of allClaims) {
        if (!claimsByBounty.has(claim.bountyId)) claimsByBounty.set(claim.bountyId, []);
        const creator = creatorMap.get(claim.creatorId);
        const claimUser = creator ? userMap.get(creator.userId) : null;
        claimsByBounty.get(claim.bountyId)!.push({
          id: String(claim.id),
          userId: creator?.userId || 0,
          userName: creator?.instagramUsername || creator?.tiktokUsername || claimUser?.email?.split('@')[0] || "",
          userEmail: claimUser?.email || "",
          status: claim.status,
          videoId: null,
          completedAt: claim.completedAt ? new Date(claim.completedAt).toISOString() : null,
          approvedAt: claim.paidAt ? new Date(claim.paidAt).toISOString() : null,
          createdAt: new Date(claim.createdAt).toISOString(),
        });
      }

      const formatted = allBounties.map(b => {
        const claims = claimsByBounty.get(b.id) || [];
        const pendingCount = claims.filter(c => c.status === "completed").length;
        return {
          id: String(b.id),
          title: b.title,
          description: b.description,
          reward: `$${b.reward}`,
          rewardAmount: parseFloat(b.reward),
          startDate: new Date(b.createdAt).toISOString(),
          deadline: b.deadline ? new Date(b.deadline).toLocaleDateString() : "No deadline",
          deadlineDate: b.deadline ? (() => { const d = new Date(b.deadline); d.setUTCHours(23, 59, 59, 999); return d.toISOString(); })() : null,
          slots: `${b.currentClaims || 0}/${b.maxClaims || 1}`,
          claimedCount: b.currentClaims || 0,
          maxSlots: b.maxClaims || 1,
          priority: b.type || "challenge",
          penaltyAmount: parseFloat(b.penaltyAmount || "0"),
          userClaim: null,
          canClaim: false,
          claims,
          pendingApprovalCount: pendingCount,
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error("Get bounties error:", error);
      res.status(500).json({ message: "Failed to get bounties" });
    }
  });

  // Create bounty
  app.post("/api/admin/bounties", authenticateToken, async (req, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { title, description, reward, type, targetViews, targetPosts, startDate, deadline, maxClaims, penaltyAmount } = req.body;

      const startDateTime = startDate ? new Date(new Date(startDate).toISOString().split('T')[0] + 'T00:00:00.000Z') : null;
      const deadlineDateTime = deadline ? new Date(new Date(deadline).toISOString().split('T')[0] + 'T23:59:59.999Z') : null;

      const [bounty] = await db.insert(bounties).values({
        title,
        description,
        reward: String(reward || 50),
        type: type || "challenge",
        targetViews,
        targetPosts,
        startDate: startDateTime,
        deadline: deadlineDateTime,
        maxClaims: maxClaims || 1,
        penaltyAmount: penaltyAmount ? String(penaltyAmount) : "0",
      }).returning();

      res.json(bounty);
    } catch (error) {
      console.error("Create bounty error:", error);
      res.status(500).json({ message: "Failed to create bounty" });
    }
  });

  // Update bounty status
  app.patch("/api/admin/bounties/:id", authenticateToken, async (req, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const bountyId = parseInt(req.params.id);
      const { status, title, description, reward, startDate, deadline, maxClaims, priority, penaltyAmount } = req.body;

      const updateData: any = { updatedAt: new Date() };
      if (status) updateData.status = status;
      if (title) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (reward) updateData.reward = String(reward);
      if (startDate) updateData.startDate = new Date(startDate);
      if (deadline) updateData.deadline = new Date(deadline);
      if (maxClaims !== undefined) updateData.maxClaims = maxClaims;
      if (priority) updateData.priority = priority;
      if (penaltyAmount !== undefined) updateData.penaltyAmount = String(penaltyAmount);

      const [bounty] = await db.update(bounties)
        .set(updateData)
        .where(eq(bounties.id, bountyId))
        .returning();

      res.json(bounty);
    } catch (error) {
      console.error("Update bounty error:", error);
      res.status(500).json({ message: "Failed to update bounty" });
    }
  });

  // Delete bounty
  app.delete("/api/admin/bounties/:id", authenticateToken, async (req, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const bountyId = parseInt(req.params.id);
      await db.delete(bountyCompletions).where(eq(bountyCompletions.bountyId, bountyId));
      await db.delete(bounties).where(eq(bounties.id, bountyId));
      res.json({ message: "Bounty deleted" });
    } catch (error) {
      console.error("Delete bounty error:", error);
      res.status(500).json({ message: "Failed to delete bounty" });
    }
  });

  // Admin approve bounty claim
  app.post("/api/admin/bounties/:bountyId/approve-claim/:claimId", authenticateToken, async (req: any, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const claimId = parseInt(req.params.claimId);
      const bountyId = parseInt(req.params.bountyId);

      const [existing] = await db.select().from(bountyCompletions)
        .where(and(eq(bountyCompletions.id, claimId), eq(bountyCompletions.bountyId, bountyId)))
        .limit(1);
      if (!existing) return res.status(404).json({ message: "Claim not found for this bounty" });

      const [claim] = await db.update(bountyCompletions)
        .set({ status: "approved" })
        .where(eq(bountyCompletions.id, claimId))
        .returning();

      const [bountyRecord] = await db.select().from(bounties).where(eq(bounties.id, bountyId)).limit(1);
      if (bountyRecord) {
        const now = new Date();
        await db.insert(payouts).values({
          creatorId: existing.creatorId,
          amount: bountyRecord.reward,
          status: "pending",
          periodStart: bountyRecord.createdAt || now,
          periodEnd: bountyRecord.deadline || now,
          notes: `Bounty: ${bountyRecord.title}`,
        });
      }

      res.json(claim);
    } catch (error) {
      console.error("Approve claim error:", error);
      res.status(500).json({ message: "Failed to approve claim" });
    }
  });

  // Admin reject bounty claim
  app.post("/api/admin/bounties/:bountyId/reject-claim/:claimId", authenticateToken, async (req: any, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const claimId = parseInt(req.params.claimId);
      const bountyId = parseInt(req.params.bountyId);

      const [existing] = await db.select().from(bountyCompletions)
        .where(and(eq(bountyCompletions.id, claimId), eq(bountyCompletions.bountyId, bountyId)))
        .limit(1);
      if (!existing) return res.status(404).json({ message: "Claim not found for this bounty" });
      if (existing.status !== "claimed" && existing.status !== "completed") {
        return res.status(400).json({ message: "Cannot reject claim with status: " + existing.status });
      }

      const [claim] = await db.update(bountyCompletions)
        .set({ status: "rejected" })
        .where(eq(bountyCompletions.id, claimId))
        .returning();
      res.json(claim);
    } catch (error) {
      console.error("Reject claim error:", error);
      res.status(500).json({ message: "Failed to reject claim" });
    }
  });

  app.post("/api/admin/bounties/:bountyId/unapprove-claim/:claimId", authenticateToken, async (req: any, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const claimId = parseInt(req.params.claimId);
      const bountyId = parseInt(req.params.bountyId);

      const [existing] = await db.select().from(bountyCompletions)
        .where(and(eq(bountyCompletions.id, claimId), eq(bountyCompletions.bountyId, bountyId)))
        .limit(1);
      if (!existing) return res.status(404).json({ message: "Claim not found for this bounty" });
      if (existing.status !== "approved" && existing.status !== "rejected") {
        return res.status(400).json({ message: "Can only undo approved or rejected claims" });
      }

      const [claim] = await db.update(bountyCompletions)
        .set({ status: "completed" })
        .where(eq(bountyCompletions.id, claimId))
        .returning();

      const [bountyRecord] = await db.select().from(bounties).where(eq(bounties.id, bountyId)).limit(1);
      if (bountyRecord) {
        await db.delete(payouts).where(
          and(
            eq(payouts.creatorId, existing.creatorId),
            sql`${payouts.notes} = ${'Bounty: ' + bountyRecord.title}`
          )
        );
      }

      res.json(claim);
    } catch (error) {
      console.error("Unapprove claim error:", error);
      res.status(500).json({ message: "Failed to rollback claim" });
    }
  });

  // Admin: Get creator bounty history
  async function getBountyHistoryForCreator(creatorId: number) {
    const completions = await db.select().from(bountyCompletions)
      .where(eq(bountyCompletions.creatorId, creatorId))
      .orderBy(desc(bountyCompletions.createdAt));

    if (completions.length === 0) return [];

    const bountyIds = [...new Set(completions.map(c => c.bountyId))];
    const allBounties = await db.select().from(bounties).where(inArray(bounties.id, bountyIds));
    const bountyMap = new Map(allBounties.map(b => [b.id, b]));

    const creatorPayouts = await db.select().from(payouts).where(
      and(eq(payouts.creatorId, creatorId), sql`${payouts.notes} LIKE 'Bounty:%'`)
    );

    return completions.map(completion => {
      const bounty = bountyMap.get(completion.bountyId);
      if (!bounty) return null;

      const matchingPayout = creatorPayouts.find(p =>
        p.notes === `Bounty: ${bounty.title}`
      );
      const isPaid = matchingPayout ? !!matchingPayout.paidAt : false;

      return {
        id: completion.id,
        bountyId: completion.bountyId,
        bountyTitle: bounty.title,
        bountyReward: bounty.reward,
        bountyStartDate: bounty.createdAt.toISOString(),
        bountyDeadline: bounty.deadline ? bounty.deadline.toISOString() : null,
        status: completion.status,
        isPaid,
        completedAt: completion.completedAt ? completion.completedAt.toISOString() : null,
        paidAt: matchingPayout?.paidAt ? matchingPayout.paidAt.toISOString() : null,
        createdAt: completion.createdAt.toISOString(),
        penaltyAmount: parseFloat(bounty.penaltyAmount || "0"),
      };
    }).filter(Boolean);
  }

  app.get("/api/admin/creators/:id/bounty-history", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const creatorId = parseInt(req.params.id);
      const results = await getBountyHistoryForCreator(creatorId);
      res.json(results);
    } catch (error) {
      console.error("Get creator bounty history error:", error);
      res.status(500).json({ message: "Failed to get bounty history" });
    }
  });

  app.get("/api/admin/creators/:id/streak-survivor", authenticateToken, async (req: any, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const creatorId = parseInt(req.params.id);

      const allGames = await db.select().from(survivorGames)
        .orderBy(desc(survivorGames.createdAt));

      const result = await Promise.all(allGames.map(async (game) => {
        const participants = await db.select({
          participant: gameParticipants,
          creator: creators,
        }).from(gameParticipants)
          .leftJoin(creators, eq(gameParticipants.creatorId, creators.id))
          .where(eq(gameParticipants.gameId, game.id));

        const survivors = participants.filter(p => !p.participant.isEliminated);
        const totalSurvivorPosts = survivors.reduce((sum, p) => sum + (p.participant.totalPosts || 0), 0);
        const prizePool = parseFloat(game.prizePool || "0");

        const myParticipant = participants.find(p => p.participant.creatorId === creatorId);

        let creatorStats = null;
        if (myParticipant) {
          const creatorPosts = myParticipant.participant.totalPosts || 0;
          const isSurvivor = !myParticipant.participant.isEliminated;

          let igPosts = 0;
          let ttPosts = 0;
          if (game.startDate) {
            const gameStart = new Date(game.startDate);
            const gameEnd = game.endDate ? new Date(game.endDate) : new Date();
            const creatorVideos = await db.select().from(videos)
              .where(and(
                eq(videos.creatorId, creatorId),
                eq(videos.isIrrelevant, false),
                gte(videos.postedAt, gameStart),
              ));
            for (const v of creatorVideos) {
              if (new Date(v.postedAt) <= gameEnd) {
                if (v.platform === 'instagram') igPosts++;
                else if (v.platform === 'tiktok') ttPosts++;
              }
            }
          }

          creatorStats = {
            lives: myParticipant.participant.lives ?? 0,
            totalPosts: creatorPosts,
            igPosts,
            ttPosts,
            currentStreak: myParticipant.participant.currentStreak ?? 0,
            longestStreak: myParticipant.participant.longestStreak ?? 0,
            isEliminated: myParticipant.participant.isEliminated ?? false,
            eliminatedOnDay: myParticipant.participant.eliminatedOnDay ?? null,
            isSurvivor,
            projectedPayout: isSurvivor && totalSurvivorPosts > 0
              ? Math.round((creatorPosts / totalSurvivorPosts) * prizePool * 100) / 100
              : 0,
            sharePercent: totalSurvivorPosts > 0 && isSurvivor
              ? Math.round((creatorPosts / totalSurvivorPosts) * 10000) / 100
              : 0,
          };
        }

        return {
          ...game,
          totalParticipants: participants.length,
          survivorCount: survivors.length,
          eliminatedCount: participants.filter(p => p.participant.isEliminated).length,
          creatorStats,
        };
      }));

      res.json(result);
    } catch (error) {
      console.error("Get creator streak survivor history error:", error);
      res.status(500).json({ message: "Failed to get creator streak survivor data" });
    }
  });

  app.get("/api/creator/bounty-history", authenticateToken, async (req: any, res) => {
    try {
      const [creator] = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator) {
        return res.status(404).json({ message: "Creator not found" });
      }
      const results = await getBountyHistoryForCreator(creator.id);
      res.json(results);
    } catch (error) {
      console.error("Get creator bounty history error:", error);
      res.status(500).json({ message: "Failed to get bounty history" });
    }
  });

  // ==================== CREATOR BOUNTY ENDPOINTS ====================

  // Get all active bounties for creator (with their claim status)
  app.get("/api/creator/bounties", authenticateToken, async (req: any, res) => {
    try {
      const creator = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator[0]) {
        return res.status(404).json({ message: "Creator not found" });
      }
      const creatorId = creator[0].id;

      const allBounties = await db.select().from(bounties).orderBy(desc(bounties.createdAt));
      const allClaims = await db.select().from(bountyCompletions).where(eq(bountyCompletions.creatorId, creatorId));

      const claimsByBounty = new Map<number, typeof allClaims[0]>();
      for (const claim of allClaims) {
        claimsByBounty.set(claim.bountyId, claim);
      }

      const formatted = allBounties
        .map(b => {
          const myClaim = claimsByBounty.get(b.id);
          const remaining = (b.maxClaims || 1) - (b.currentClaims || 0);
          return {
            id: String(b.id),
            title: b.title,
            description: b.description,
            reward: `$${b.reward}`,
            rewardAmount: parseFloat(b.reward),
            startDate: new Date(b.createdAt).toISOString(),
            deadline: b.deadline ? new Date(b.deadline).toLocaleDateString() : "No deadline",
            deadlineDate: b.deadline ? (() => { const d = new Date(b.deadline); d.setUTCHours(23, 59, 59, 999); return d.toISOString(); })() : null,
            slots: `${b.currentClaims || 0}/${b.maxClaims || 1}`,
            claimedCount: b.currentClaims || 0,
            maxSlots: b.maxClaims || 1,
            priority: b.type || "challenge",
            penaltyAmount: parseFloat(b.penaltyAmount || "0"),
            userClaim: myClaim ? {
              id: String(myClaim.id),
              status: myClaim.status,
              completedAt: myClaim.completedAt ? new Date(myClaim.completedAt).toISOString() : null,
              approvedAt: myClaim.paidAt ? new Date(myClaim.paidAt).toISOString() : null,
            } : null,
            canClaim: !myClaim && remaining > 0,
          };
        });

      res.json(formatted);
    } catch (error) {
      console.error("Get creator bounties error:", error);
      res.status(500).json({ message: "Failed to get bounties" });
    }
  });

  // Creator claim a bounty
  app.post("/api/creator/bounties/:id/claim", authenticateToken, async (req: any, res) => {
    try {
      const creator = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator[0]) {
        return res.status(404).json({ message: "Creator not found" });
      }
      const creatorId = creator[0].id;
      if (creator[0].status !== "active") {
        return res.status(403).json({ message: "Your account is paused or deleted. You cannot claim bounties." });
      }
      const bountyId = parseInt(req.params.id);

      const [bounty] = await db.select().from(bounties).where(eq(bounties.id, bountyId)).limit(1);
      if (!bounty) return res.status(404).json({ message: "Bounty not found" });
      if (bounty.status !== "active") return res.status(400).json({ message: "Bounty is not active" });

      const remaining = (bounty.maxClaims || 1) - (bounty.currentClaims || 0);
      if (remaining <= 0) return res.status(400).json({ message: "No slots remaining" });

      const existing = await db.select().from(bountyCompletions)
        .where(and(eq(bountyCompletions.bountyId, bountyId), eq(bountyCompletions.creatorId, creatorId)))
        .limit(1);
      if (existing[0]) return res.status(400).json({ message: "You have already claimed this bounty" });

      await db.insert(bountyCompletions).values({
        bountyId,
        creatorId,
        status: "claimed",
      });

      await db.update(bounties)
        .set({ currentClaims: sql`${bounties.currentClaims} + 1` })
        .where(eq(bounties.id, bountyId));

      res.json({ message: "Bounty claimed successfully" });
    } catch (error) {
      console.error("Claim bounty error:", error);
      res.status(500).json({ message: "Failed to claim bounty" });
    }
  });

  // Creator unclaim a bounty
  app.post("/api/creator/bounties/:id/unclaim", authenticateToken, async (req: any, res) => {
    try {
      const creator = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator[0]) {
        return res.status(404).json({ message: "Creator not found" });
      }
      const creatorId = creator[0].id;
      if (creator[0].status !== "active") {
        return res.status(403).json({ message: "Your account is paused or deleted." });
      }
      const bountyId = parseInt(req.params.id);

      const existing = await db.select().from(bountyCompletions)
        .where(and(eq(bountyCompletions.bountyId, bountyId), eq(bountyCompletions.creatorId, creatorId)))
        .limit(1);
      if (!existing[0]) return res.status(400).json({ message: "You haven't claimed this bounty" });
      if (existing[0].status !== "claimed") return res.status(400).json({ message: "Cannot unclaim - bounty is already " + existing[0].status });

      await db.delete(bountyCompletions)
        .where(and(eq(bountyCompletions.bountyId, bountyId), eq(bountyCompletions.creatorId, creatorId)));

      await db.update(bounties)
        .set({ currentClaims: sql`GREATEST(${bounties.currentClaims} - 1, 0)` })
        .where(eq(bounties.id, bountyId));

      res.json({ message: "Bounty unclaimed successfully" });
    } catch (error) {
      console.error("Unclaim bounty error:", error);
      res.status(500).json({ message: "Failed to unclaim bounty" });
    }
  });

  // Creator mark bounty as complete
  app.post("/api/creator/bounties/:id/complete", authenticateToken, async (req: any, res) => {
    try {
      const creator = await db.select().from(creators).where(eq(creators.userId, req.userId)).limit(1);
      if (!creator[0]) {
        return res.status(404).json({ message: "Creator not found" });
      }
      const creatorId = creator[0].id;
      if (creator[0].status !== "active") {
        return res.status(403).json({ message: "Your account is paused or deleted. You cannot complete bounties." });
      }
      const bountyId = parseInt(req.params.id);

      const existing = await db.select().from(bountyCompletions)
        .where(and(eq(bountyCompletions.bountyId, bountyId), eq(bountyCompletions.creatorId, creatorId)))
        .limit(1);
      if (!existing[0]) return res.status(400).json({ message: "You haven't claimed this bounty" });
      if (existing[0].status !== "claimed") return res.status(400).json({ message: "Cannot complete - bounty is " + existing[0].status });

      await db.update(bountyCompletions)
        .set({ status: "completed", completedAt: new Date() })
        .where(and(eq(bountyCompletions.bountyId, bountyId), eq(bountyCompletions.creatorId, creatorId)));

      res.json({ message: "Bounty marked as complete, pending admin approval" });
    } catch (error) {
      console.error("Complete bounty error:", error);
      res.status(500).json({ message: "Failed to complete bounty" });
    }
  });

  // ==================== OTHER ADMIN ENDPOINTS ====================

  // Celebrations endpoint (admin sees all creators)
  app.get("/api/admin/celebrations", authenticateToken, async (req, res) => {
    try {
      const allCelebrations = await db.select().from(celebrations).orderBy(desc(celebrations.createdAt)).limit(50);
      const allCreators = await db.select().from(creators);
      const creatorMap = new Map(allCreators.map(c => [c.id, c]));

      const formatted = allCelebrations.map(c => {
        const creator = creatorMap.get(c.creatorId);
        const now = new Date();
        const created = new Date(c.createdAt);
        const diffMs = now.getTime() - created.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        let time = '';
        if (diffMins < 1) time = 'Just now';
        else if (diffMins < 60) time = `${diffMins}m ago`;
        else if (diffHrs < 24) time = `${diffHrs}h ago`;
        else time = `${diffDays}d ago`;

        return {
          id: c.id,
          creator: creator?.name || 'Unknown',
          achievement: c.achievement,
          emoji: c.emoji,
          time,
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error("Failed to get celebrations:", error);
      res.status(500).json({ message: "Failed to get celebrations" });
    }
  });

  // Celebrations endpoint (creator sees only their own + team)
  app.get("/api/creator/celebrations", authenticateToken, async (req: any, res) => {
    try {
      const allCelebrations = await db.select().from(celebrations).orderBy(desc(celebrations.createdAt)).limit(50);
      const allCreators = await db.select().from(creators);
      const creatorMap = new Map(allCreators.map(c => [c.id, c]));

      const formatted = allCelebrations.map(c => {
        const creator = creatorMap.get(c.creatorId);
        const now = new Date();
        const created = new Date(c.createdAt);
        const diffMs = now.getTime() - created.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        let time = '';
        if (diffMins < 1) time = 'Just now';
        else if (diffMins < 60) time = `${diffMins}m ago`;
        else if (diffHrs < 24) time = `${diffHrs}h ago`;
        else time = `${diffDays}d ago`;

        return {
          id: c.id,
          creator: creator?.name || 'Unknown',
          achievement: c.achievement,
          emoji: c.emoji,
          time,
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error("Failed to get creator celebrations:", error);
      res.status(500).json({ message: "Failed to get celebrations" });
    }
  });

  // Scan all creators for celebrations (admin only)
  app.post("/api/admin/scan-celebrations", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const allCreators = await db.select().from(creators);
      for (const creator of allCreators) {
        await detectCelebrations(creator.id);
      }
      res.json({ message: "Celebration scan complete", creatorsScanned: allCreators.length });
    } catch (error) {
      console.error("Celebration scan error:", error);
      res.status(500).json({ message: "Failed to scan celebrations" });
    }
  });

  // Team posting streak - admin sees all creators summed
  app.get("/api/admin/team-posting-streak", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const now = new Date();
      const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      const dayOfWeek = todayUTC.getUTCDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const thisMonday = new Date(todayUTC.getTime() - mondayOffset * 86400000);
      const gridStart = new Date(thisMonday.getTime() - 21 * 86400000);

      const recentVideos = await db.select({ id: videos.id, postedAt: videos.postedAt, creatorId: videos.creatorId })
        .from(videos)
        .innerJoin(creators, eq(videos.creatorId, creators.id))
        .where(and(gte(videos.postedAt, gridStart), eq(creators.status, "active"), eq(videos.isIrrelevant, false)));

      const postCountMap: Record<string, number> = {};
      for (const v of recentVideos) {
        if (!v.postedAt) continue;
        const dateStr = getUTCDateStr(new Date(v.postedAt));
        postCountMap[dateStr] = (postCountMap[dateStr] || 0) + 1;
      }

      const streakData: number[] = [];
      const dates: string[] = [];
      for (let i = 0; i < 28; i++) {
        const d = new Date(gridStart.getTime() + i * 86400000);
        const dateStr = getUTCDateStr(d);
        dates.push(dateStr);
        streakData.push(postCountMap[dateStr] || 0);
      }

      const allVideos_ = await db.select({
        id: videos.id, postedAt: videos.postedAt, views: videos.views, totalPay: videos.totalPay, creatorId: videos.creatorId,
      }).from(videos)
        .innerJoin(creators, eq(videos.creatorId, creators.id))
        .where(and(eq(creators.status, "active"), eq(videos.isIrrelevant, false)));
      const allPostDates = new Set(
        allVideos_.filter(v => v.postedAt).map(v => getUTCDateStr(new Date(v.postedAt!)))
      );
      const sortedAllDates = [...allPostDates].sort().reverse();
      let currentStreak = 0;
      if (sortedAllDates.length > 0) {
        const todayStr = getUTCDateStr(now);
        const yesterdayStr = getUTCDateStr(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)));
        if (sortedAllDates[0] === todayStr || sortedAllDates[0] === yesterdayStr) {
          currentStreak = 1;
          for (let i = 1; i < sortedAllDates.length; i++) {
            const curr = new Date(sortedAllDates[i - 1] + 'T00:00:00Z');
            const prev = new Date(sortedAllDates[i] + 'T00:00:00Z');
            const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
            if (diff === 1) currentStreak++;
            else break;
          }
        }
      }

      let daysPostedThisWeek = 0;
      for (let i = 0; i < 7; i++) {
        const d = getUTCDateStr(new Date(thisMonday.getTime() + i * 86400000));
        if (postCountMap[d] && postCountMap[d] > 0) daysPostedThisWeek++;
      }

      const totalPosts28d = streakData.reduce((sum, v) => sum + v, 0);

      const allCycles = await db.select().from(payoutCycles).orderBy(payoutCycles.startDate);
      const activeCycle = allCycles.find(c => now >= new Date(c.startDate) && now <= new Date(c.endDate));
      let cycleVideos = 0;
      let cycleViews = 0;
      let cycleEarnings = 0;
      if (activeCycle) {
        const cycleVids = allVideos_.filter(v => {
          if (!v.postedAt) return false;
          const posted = new Date(v.postedAt);
          return posted >= new Date(activeCycle.startDate) && posted <= new Date(activeCycle.endDate);
        });
        cycleVideos = cycleVids.length;
        cycleViews = cycleVids.reduce((sum, v) => sum + (v.views || 0), 0);
        cycleEarnings = cycleVids.reduce((sum, v) => sum + parseFloat(v.totalPay || '0'), 0);
      }

      res.json({
        streakData,
        dates,
        currentStreak,
        thisWeek: `${daysPostedThisWeek} / 7 days`,
        totalPosts28d,
        cycleVideos,
        cycleViews,
        cycleEarnings,
      });
    } catch (error) {
      console.error("Admin team posting streak error:", error);
      res.status(500).json({ message: "Failed to get team streak" });
    }
  });

  // Cycle leaderboard
  app.get("/api/admin/cycle-leaderboard", authenticateToken, async (req, res) => {
    try {
      // Get active payout cycle
      const now = new Date();
      const allCycles = await db.select().from(payoutCycles).orderBy(payoutCycles.startDate);
      const activeCycle = allCycles.find(c => {
        const start = new Date(c.startDate);
        const end = new Date(c.endDate);
        return now >= start && now <= end;
      });

      // Find previous cycle
      const prevCycle = activeCycle 
        ? allCycles.find(c => new Date(c.endDate) < new Date(activeCycle.startDate))
        : null;

      const allCreators = await db.select().from(creators).where(eq(creators.status, "active"));
      const allVideos = await db.select().from(videos);

      const creatorStats = allCreators.map(c => {
        const creatorVideos = allVideos.filter(v => v.creatorId === c.id);
        
        const currentCycleVideos = activeCycle
          ? creatorVideos.filter(v => {
              const postedAt = new Date(v.postedAt);
              return postedAt >= new Date(activeCycle.startDate) && postedAt <= new Date(activeCycle.endDate);
            })
          : creatorVideos;
        const currentViews = currentCycleVideos.reduce((sum, v) => sum + (v.views || 0), 0);

        const prevCycleVideos = prevCycle
          ? creatorVideos.filter(v => {
              const postedAt = new Date(v.postedAt);
              return postedAt >= new Date(prevCycle.startDate) && postedAt <= new Date(prevCycle.endDate);
            })
          : [];
        const prevViews = prevCycleVideos.reduce((sum, v) => sum + (v.views || 0), 0);
        const improvement = prevViews > 0 ? Math.round(((currentViews - prevViews) / prevViews) * 100) : 0;

        const postDays = new Set<string>();
        for (const v of currentCycleVideos) {
          if (!v.postedAt) continue;
          postDays.add(getUTCDateStr(new Date(v.postedAt)));
        }
        let longestStreakVal = 0;
        if (activeCycle) {
          const dayMs = 24 * 60 * 60 * 1000;
          const cycleStart = new Date(activeCycle.startDate);
          const nowUTC = new Date();
          const todayUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate()));
          const cycleEnd = new Date(activeCycle.endDate);
          const lastDay = todayUTC < cycleEnd ? todayUTC : cycleEnd;
          const cursor = new Date(Date.UTC(cycleStart.getUTCFullYear(), cycleStart.getUTCMonth(), cycleStart.getUTCDate()));
          let tempStreak = 0;
          while (cursor <= lastDay) {
            if (postDays.has(getUTCDateStr(cursor))) {
              tempStreak++;
              if (tempStreak > longestStreakVal) longestStreakVal = tempStreak;
            } else {
              tempStreak = 0;
            }
            cursor.setTime(cursor.getTime() + dayMs);
          }
        }

        const handle = c.instagramUsername 
          ? `@${c.instagramUsername}` 
          : c.tiktokUsername 
            ? `@${c.tiktokUsername}` 
            : c.email?.split('@')[0] || '';

        return {
          creatorId: c.id,
          name: c.name,
          handle,
          avatar: c.name?.charAt(0).toUpperCase() || '?',
          views: currentViews,
          improvement,
          streak: longestStreakVal,
          instagramUsername: c.instagramUsername || null,
          tiktokUsername: c.tiktokUsername || null,
        };
      });

      // Format helper
      const formatValue = (val: number) => {
        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
        return val.toString();
      };

      const mapEntry = (c: typeof creatorStats[number], i: number, displayValue: string) => ({
        rank: i + 1,
        name: c.name,
        handle: c.handle,
        displayValue,
        avatar: c.avatar,
        instagramUsername: c.instagramUsername,
        tiktokUsername: c.tiktokUsername,
      });

      const socialFirst = (a: typeof creatorStats[number], b: typeof creatorStats[number]) => {
        const aHas = !!(a.instagramUsername || a.tiktokUsername);
        const bHas = !!(b.instagramUsername || b.tiktokUsername);
        if (aHas !== bHas) return aHas ? -1 : 1;
        return 0;
      };

      // Most Views (top 5)
      const mostViews = [...creatorStats]
        .sort((a, b) => socialFirst(a, b) || b.views - a.views)
        .slice(0, 5)
        .map((c, i) => mapEntry(c, i, formatValue(c.views)));

      // Most Improved (top 5)
      const mostImproved = [...creatorStats]
        .filter(c => c.improvement !== 0)
        .sort((a, b) => socialFirst(a, b) || b.improvement - a.improvement)
        .slice(0, 5)
        .map((c, i) => mapEntry(c, i, `${c.improvement > 0 ? '+' : ''}${c.improvement}%`));

      // Longest Streak (top 5)
      const longestStreak = [...creatorStats]
        .filter(c => c.streak > 0)
        .sort((a, b) => socialFirst(a, b) || b.streak - a.streak)
        .slice(0, 5)
        .map((c, i) => mapEntry(c, i, `${c.streak} days`));

      res.json({ mostViews, mostImproved, longestStreak });
    } catch (error) {
      console.error("Cycle leaderboard error:", error);
      res.status(500).json({ message: "Failed to get leaderboard" });
    }
  });

  app.get("/api/creator/cycle-leaderboard", authenticateToken, async (req: any, res) => {
    try {
      const now = new Date();
      const allCycles = await db.select().from(payoutCycles).orderBy(payoutCycles.startDate);
      const activeCycle = allCycles.find(c => {
        const start = new Date(c.startDate);
        const end = new Date(c.endDate);
        return now >= start && now <= end;
      });

      const prevCycle = activeCycle 
        ? allCycles.find(c => new Date(c.endDate) < new Date(activeCycle.startDate))
        : null;

      const allCreators = await db.select().from(creators).where(eq(creators.status, "active"));
      const allVideos = await db.select().from(videos);

      const creatorStats = allCreators.map(c => {
        const creatorVideos = allVideos.filter(v => v.creatorId === c.id);
        
        const currentCycleVideos = activeCycle
          ? creatorVideos.filter(v => {
              const postedAt = new Date(v.postedAt);
              return postedAt >= new Date(activeCycle.startDate) && postedAt <= new Date(activeCycle.endDate);
            })
          : creatorVideos;
        const currentViews = currentCycleVideos.reduce((sum, v) => sum + (v.views || 0), 0);

        const prevCycleVideos = prevCycle
          ? creatorVideos.filter(v => {
              const postedAt = new Date(v.postedAt);
              return postedAt >= new Date(prevCycle.startDate) && postedAt <= new Date(prevCycle.endDate);
            })
          : [];
        const prevViews = prevCycleVideos.reduce((sum, v) => sum + (v.views || 0), 0);
        const improvement = prevViews > 0 ? Math.round(((currentViews - prevViews) / prevViews) * 100) : 0;

        const postDays = new Set<string>();
        for (const v of currentCycleVideos) {
          if (!v.postedAt) continue;
          postDays.add(getUTCDateStr(new Date(v.postedAt)));
        }
        let longestStreakVal = 0;
        if (activeCycle) {
          const dayMs = 24 * 60 * 60 * 1000;
          const cycleStart = new Date(activeCycle.startDate);
          const nowUTC = new Date();
          const todayUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate()));
          const cycleEnd = new Date(activeCycle.endDate);
          const lastDay = todayUTC < cycleEnd ? todayUTC : cycleEnd;
          const cursor = new Date(Date.UTC(cycleStart.getUTCFullYear(), cycleStart.getUTCMonth(), cycleStart.getUTCDate()));
          let tempStreak = 0;
          while (cursor <= lastDay) {
            if (postDays.has(getUTCDateStr(cursor))) {
              tempStreak++;
              if (tempStreak > longestStreakVal) longestStreakVal = tempStreak;
            } else {
              tempStreak = 0;
            }
            cursor.setTime(cursor.getTime() + dayMs);
          }
        }

        const handle = c.instagramUsername 
          ? `@${c.instagramUsername}` 
          : c.tiktokUsername 
            ? `@${c.tiktokUsername}` 
            : c.email?.split('@')[0] || '';

        return {
          creatorId: c.id,
          name: c.name,
          handle,
          avatar: c.name?.charAt(0).toUpperCase() || '?',
          views: currentViews,
          improvement,
          streak: longestStreakVal,
          instagramUsername: c.instagramUsername || null,
          tiktokUsername: c.tiktokUsername || null,
        };
      });

      const formatValue = (val: number) => {
        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
        return val.toString();
      };

      const mapEntry = (c: typeof creatorStats[number], i: number, displayValue: string) => ({
        rank: i + 1,
        name: c.name,
        handle: c.handle,
        displayValue,
        avatar: c.avatar,
        instagramUsername: c.instagramUsername,
        tiktokUsername: c.tiktokUsername,
      });

      const socialFirst = (a: typeof creatorStats[number], b: typeof creatorStats[number]) => {
        const aHas = !!(a.instagramUsername || a.tiktokUsername);
        const bHas = !!(b.instagramUsername || b.tiktokUsername);
        if (aHas !== bHas) return aHas ? -1 : 1;
        return 0;
      };

      const mostViews = [...creatorStats]
        .sort((a, b) => socialFirst(a, b) || b.views - a.views)
        .slice(0, 5)
        .map((c, i) => mapEntry(c, i, formatValue(c.views)));

      const mostImproved = [...creatorStats]
        .filter(c => c.improvement !== 0)
        .sort((a, b) => socialFirst(a, b) || b.improvement - a.improvement)
        .slice(0, 5)
        .map((c, i) => mapEntry(c, i, `${c.improvement > 0 ? '+' : ''}${c.improvement}%`));

      const longestStreak = [...creatorStats]
        .filter(c => c.streak > 0)
        .sort((a, b) => socialFirst(a, b) || b.streak - a.streak)
        .slice(0, 5)
        .map((c, i) => mapEntry(c, i, `${c.streak} days`));

      res.json({ mostViews, mostImproved, longestStreak });
    } catch (error) {
      console.error("Creator cycle leaderboard error:", error);
      res.status(500).json({ message: "Failed to get leaderboard" });
    }
  });

  // Top videos with filters
  app.get("/api/admin/top-videos", authenticateToken, async (req: any, res) => {
    try {
      const period = (req.query.period as string) || "cycle";
      const sortBy = (req.query.sortBy as string) || "views";
      const limit = parseInt(req.query.limit as string) || 10;

      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (period === "today") {
        startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      } else if (period === "yesterday") {
        const yesterday = new Date(now);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        startDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0));
        endDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59, 999));
      } else if (period === "cycle") {
        const allCycles = await db.select().from(payoutCycles).orderBy(payoutCycles.startDate);
        const activeCycle = allCycles.find(c => {
          const start = new Date(c.startDate);
          const end = new Date(c.endDate);
          return now >= start && now <= end;
        });
        if (activeCycle) {
          startDate = new Date(activeCycle.startDate);
          endDate = new Date(activeCycle.endDate);
        }
      }

      const selectFields = {
        id: videos.id,
        platform: videos.platform,
        videoId: videos.videoId,
        platformVideoId: videos.platformVideoId,
        videoFileUrl: videos.videoFileUrl,
        thumbnail: videos.thumbnail,
        caption: videos.caption,
        views: videos.views,
        likes: videos.likes,
        comments: videos.comments,
        postedAt: videos.postedAt,
        creatorId: videos.creatorId,
        creatorName: creators.name,
        creatorEmail: creators.email,
        instagramUsername: creators.instagramUsername,
        tiktokUsername: creators.tiktokUsername,
      };

      const eligibleFilter = sql`(${videos.isIrrelevant} = false OR ${videos.isIrrelevant} IS NULL) AND ${videos.postedAt} >= ${creators.createdAt} AND ${creators.status} = 'active'`;

      let topVideosQuery;
      let totalCountResult;

      if (sortBy === "engagementRate") {
        if (startDate && endDate) {
          totalCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(videos)
            .leftJoin(creators, eq(videos.creatorId, creators.id))
            .where(sql`${videos.postedAt} >= ${startDate} AND ${videos.postedAt} <= ${endDate} AND ${eligibleFilter}`);

          topVideosQuery = await db
            .select(selectFields)
            .from(videos)
            .leftJoin(creators, eq(videos.creatorId, creators.id))
            .where(sql`${videos.postedAt} >= ${startDate} AND ${videos.postedAt} <= ${endDate} AND ${eligibleFilter}`);
        } else {
          totalCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(videos)
            .leftJoin(creators, eq(videos.creatorId, creators.id))
            .where(eligibleFilter);

          topVideosQuery = await db
            .select(selectFields)
            .from(videos)
            .leftJoin(creators, eq(videos.creatorId, creators.id))
            .where(eligibleFilter);
        }

        const withEngagement = topVideosQuery.map(v => ({
          ...v,
          engagementRate: (v.views || 0) > 0 ? Math.round(((v.likes || 0) + (v.comments || 0)) / (v.views || 1) * 100 * 100) / 100 : 0,
        }));
        withEngagement.sort((a, b) => b.engagementRate - a.engagementRate);
        const sliced = withEngagement.slice(0, limit);

        const totalCount = Number(totalCountResult[0]?.count || 0);
        const formattedVideos = sliced.map(v => ({
          ...v,
          username: v.platform === "instagram" ? v.instagramUsername : v.tiktokUsername,
        }));

        return res.json({ videos: formattedVideos, totalCount });
      }

      let orderByColumn;
      if (sortBy === "likes") {
        orderByColumn = desc(videos.likes);
      } else if (sortBy === "comments") {
        orderByColumn = desc(videos.comments);
      } else {
        orderByColumn = desc(videos.views);
      }

      if (startDate && endDate) {
        totalCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(videos)
          .leftJoin(creators, eq(videos.creatorId, creators.id))
          .where(sql`${videos.postedAt} >= ${startDate} AND ${videos.postedAt} <= ${endDate} AND ${eligibleFilter}`);

        topVideosQuery = await db
          .select(selectFields)
          .from(videos)
          .leftJoin(creators, eq(videos.creatorId, creators.id))
          .where(sql`${videos.postedAt} >= ${startDate} AND ${videos.postedAt} <= ${endDate} AND ${eligibleFilter}`)
          .orderBy(orderByColumn)
          .limit(limit);
      } else {
        totalCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(videos)
          .leftJoin(creators, eq(videos.creatorId, creators.id))
          .where(eligibleFilter);

        topVideosQuery = await db
          .select(selectFields)
          .from(videos)
          .leftJoin(creators, eq(videos.creatorId, creators.id))
          .where(eligibleFilter)
          .orderBy(orderByColumn)
          .limit(limit);
      }

      const totalCount = Number(totalCountResult[0]?.count || 0);
      const formattedVideos = topVideosQuery.map(v => ({
        ...v,
        engagementRate: (v.views || 0) > 0 ? Math.round(((v.likes || 0) + (v.comments || 0)) / (v.views || 1) * 100 * 100) / 100 : 0,
        username: v.platform === "instagram" ? v.instagramUsername : v.tiktokUsername,
      }));

      res.json({ videos: formattedVideos, totalCount });
    } catch (error) {
      console.error("Get top videos error:", error);
      res.status(500).json({ message: "Failed to get top videos" });
    }
  });

  // Today's posts
  app.get("/api/admin/todays-posts", authenticateToken, async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayVideos = await db.select({
        id: videos.id,
        creatorId: videos.creatorId,
        platform: videos.platform,
        videoId: videos.videoId,
        platformVideoId: videos.platformVideoId,
        title: videos.title,
        caption: videos.caption,
        thumbnailUrl: videos.thumbnailUrl,
        thumbnail: videos.thumbnail,
        duration: videos.duration,
        views: videos.views,
        likes: videos.likes,
        comments: videos.comments,
        shares: videos.shares,
        postedAt: videos.postedAt,
        pairedVideoId: videos.pairedVideoId,
        isPaired: videos.isPaired,
        isIrrelevant: videos.isIrrelevant,
        videoFileUrl: videos.videoFileUrl,
        basePay: videos.basePay,
        bonusPay: videos.bonusPay,
        totalPay: videos.totalPay,
        createdAt: videos.createdAt,
        updatedAt: videos.updatedAt,
      }).from(videos)
        .innerJoin(creators, eq(videos.creatorId, creators.id))
        .where(and(sql`${videos.postedAt} >= ${today}`, eq(creators.status, "active")))
        .orderBy(desc(videos.postedAt));
      res.json(todayVideos);
    } catch (error) {
      res.status(500).json({ message: "Failed to get today's posts" });
    }
  });

  // Daily views
  app.get("/api/admin/daily-views", authenticateToken, async (req, res) => {
    try {
      const [adminUser] = await db.select().from(users).where(eq(users.id, req.userId));
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const daysParam = req.query.days as string;
      const creatorId = req.query.creatorId ? parseInt(req.query.creatorId as string) : null;

      let startDate: Date;
      if (daysParam === 'all') {
        startDate = new Date('2025-12-29');
        startDate.setUTCHours(0, 0, 0, 0);
      } else {
        const days = parseInt(daysParam) || 14;
        startDate = new Date();
        startDate.setUTCDate(startDate.getUTCDate() - days);
        startDate.setUTCHours(0, 0, 0, 0);
      }

      const conditions = [
        gte(videos.postedAt, startDate),
        eq(videos.isIrrelevant, false),
      ];
      if (creatorId) {
        conditions.push(eq(videos.creatorId, creatorId));
      }

      const allVideos = await db.select({
        views: videos.views,
        likes: videos.likes,
        comments: videos.comments,
        postedAt: videos.postedAt,
        creatorId: videos.creatorId,
      }).from(videos).where(and(...conditions));

      const eligibleVideos = allVideos.filter(v => !!v.postedAt);

      const dailyMap: Record<string, { views: number; likes: number; comments: number; videoIds: string[] }> = {};

      const todayUTC = new Date();
      todayUTC.setUTCHours(0, 0, 0, 0);
      const endDate = todayUTC;
      const diffTime = endDate.getTime() - startDate.getTime();
      const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(startDate);
        d.setUTCDate(d.getUTCDate() + i);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        dailyMap[key] = { views: 0, likes: 0, comments: 0, videoIds: [] };
      }

      for (const v of eligibleVideos) {
        if (!v.postedAt) continue;
        const d = new Date(v.postedAt);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        if (dailyMap[key]) {
          dailyMap[key].views += v.views || 0;
          dailyMap[key].likes += v.likes || 0;
          dailyMap[key].comments += v.comments || 0;
        }
      }

      const dataPoints = Object.entries(dailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({
          date,
          views: data.views,
          likes: data.likes,
          comments: data.comments,
          engagementRate: data.views > 0 ? ((data.likes + data.comments) / data.views) * 100 : 0,
          videoIds: data.videoIds,
        }));

      const totalViews = dataPoints.reduce((sum, d) => sum + d.views, 0);
      res.json({ days: daysParam, dataPoints, totalViews });
    } catch (error) {
      res.status(500).json({ message: "Failed to get daily views" });
    }
  });

  app.get("/api/creator/daily-views", authenticateToken, async (req: any, res) => {
    try {
      const daysParam = req.query.days as string;
      const scope = req.query.scope as string;
      const queryCreatorId = req.query.creatorId ? parseInt(req.query.creatorId as string) : null;
      const [loggedInCreator] = await db.select({ id: creators.id }).from(creators).where(eq(creators.userId, req.userId));
      const creatorId = queryCreatorId || (scope === 'team' ? null : (loggedInCreator?.id || null));

      let startDate: Date;
      if (daysParam === 'all') {
        startDate = new Date('2025-12-29');
        startDate.setUTCHours(0, 0, 0, 0);
      } else {
        const days = parseInt(daysParam) || 14;
        startDate = new Date();
        startDate.setUTCDate(startDate.getUTCDate() - days);
        startDate.setUTCHours(0, 0, 0, 0);
      }

      const conditions = [
        gte(videos.postedAt, startDate),
        eq(videos.isIrrelevant, false),
      ];
      if (creatorId) {
        conditions.push(eq(videos.creatorId, creatorId));
      }

      const allVideos = await db.select({
        views: videos.views,
        likes: videos.likes,
        comments: videos.comments,
        postedAt: videos.postedAt,
        creatorId: videos.creatorId,
      }).from(videos).where(and(...conditions));

      const eligibleVideos = allVideos.filter(v => !!v.postedAt);

      const dailyMap: Record<string, { views: number; likes: number; comments: number }> = {};

      const todayUTC2 = new Date();
      todayUTC2.setUTCHours(0, 0, 0, 0);
      const endDate2 = todayUTC2;
      const diffTime = endDate2.getTime() - startDate.getTime();
      const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(startDate);
        d.setUTCDate(d.getUTCDate() + i);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        dailyMap[key] = { views: 0, likes: 0, comments: 0 };
      }

      for (const v of eligibleVideos) {
        if (!v.postedAt) continue;
        const d = new Date(v.postedAt);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        if (dailyMap[key]) {
          dailyMap[key].views += v.views || 0;
          dailyMap[key].likes += v.likes || 0;
          dailyMap[key].comments += v.comments || 0;
        }
      }

      const dataPoints = Object.entries(dailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({
          date,
          views: data.views,
          likes: data.likes,
          comments: data.comments,
          engagementRate: data.views > 0 ? ((data.likes + data.comments) / data.views) * 100 : 0,
          videoIds: [],
        }));

      const totalViews = dataPoints.reduce((sum, d) => sum + d.views, 0);
      res.json({ days: daysParam, dataPoints, totalViews });
    } catch (error) {
      res.status(500).json({ message: "Failed to get daily views" });
    }
  });

  app.get("/api/admin/videos-by-date", authenticateToken, async (req: any, res) => {
    try {
      const [adminUser] = await db.select().from(users).where(eq(users.id, req.userId));
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const date = req.query.date as string;
      if (!date) return res.json({ videos: [] });
      const queryCreatorId = req.query.creatorId ? parseInt(req.query.creatorId as string) : null;

      const startOfDay = new Date(date + "T00:00:00.000Z");
      const endOfDay = new Date(date + "T23:59:59.999Z");

      const conditions: any[] = [
        gte(videos.postedAt, startOfDay),
        lte(videos.postedAt, endOfDay),
        eq(videos.isIrrelevant, false),
      ];
      if (queryCreatorId) {
        conditions.push(eq(videos.creatorId, queryCreatorId));
      }

      const allVideos = await db
        .select({
          id: videos.id,
          platform: videos.platform,
          views: videos.views,
          likes: videos.likes,
          comments: videos.comments,
          caption: videos.caption,
          thumbnailUrl: videos.thumbnailUrl,
          postedAt: videos.postedAt,
          platformVideoId: videos.platformVideoId,
          videoFileUrl: videos.videoFileUrl,
          creatorId: videos.creatorId,
        })
        .from(videos)
        .where(and(...conditions));

      const creatorIds = [...new Set(allVideos.map(v => v.creatorId))];
      const creatorMap: Record<number, { name: string; instagramUsername: string | null; tiktokUsername: string | null; createdAt: Date }> = {};
      for (const cId of creatorIds) {
        const [c] = await db.select().from(creators).where(eq(creators.id, cId));
        if (c) creatorMap[cId] = { name: c.name, instagramUsername: c.instagramUsername, tiktokUsername: c.tiktokUsername, createdAt: new Date(c.createdAt) };
      }

      const eligibleVideos = allVideos.filter(v => {
        if (!v.postedAt) return false;
        const creator = creatorMap[v.creatorId];
        if (!creator) return false;
        return true;
      });

      const result = eligibleVideos.map(v => {
        const creator = creatorMap[v.creatorId];
        const username = v.platform === "instagram" ? creator?.instagramUsername : creator?.tiktokUsername;
        let url = "";
        if (v.platform === "instagram" && v.platformVideoId) {
          const igId = isInstagramNumericPk(v.platformVideoId) ? instagramPkToShortcode(v.platformVideoId) : v.platformVideoId;
          url = `https://www.instagram.com/reel/${igId}/`;
        } else if (v.platform === "tiktok" && username && v.platformVideoId) {
          url = `https://www.tiktok.com/@${username}/video/${v.platformVideoId}`;
        }
        return {
          id: String(v.id),
          url,
          thumbnailUrl: v.thumbnailUrl,
          platform: v.platform,
          views: v.views || 0,
          likes: v.likes || 0,
          comments: v.comments || 0,
          caption: v.caption,
          timestamp: v.postedAt?.toISOString() || "",
          creatorName: creator?.name || "",
          username: username || "",
          platformVideoId: v.platformVideoId || null,
          videoFileUrl: v.videoFileUrl || null,
        };
      });

      res.json({ videos: result });
    } catch (error) {
      console.error("Error fetching videos by date:", error);
      res.status(500).json({ message: "Failed to get videos by date" });
    }
  });

  app.get("/api/creator/videos-by-date", authenticateToken, async (req: any, res) => {
    try {
      const scope = req.query.scope as string;
      const queryCreatorId = req.query.creatorId ? parseInt(req.query.creatorId as string) : null;
      const [loggedInCreator] = await db.select().from(creators).where(eq(creators.userId, req.userId));
      if (!loggedInCreator && scope !== 'team') return res.json({ videos: [] });

      const date = req.query.date as string;
      if (!date) return res.json({ videos: [] });

      const startOfDay = new Date(date + "T00:00:00.000Z");
      const endOfDay = new Date(date + "T23:59:59.999Z");

      const targetCreatorId = queryCreatorId || (scope === 'team' ? null : loggedInCreator?.id);

      const conditions: any[] = [
        gte(videos.postedAt, startOfDay),
        lte(videos.postedAt, endOfDay),
        eq(videos.isIrrelevant, false),
      ];
      if (targetCreatorId) {
        conditions.push(eq(videos.creatorId, targetCreatorId));
      }

      const allVideos = await db
        .select({
          id: videos.id,
          platform: videos.platform,
          views: videos.views,
          likes: videos.likes,
          comments: videos.comments,
          caption: videos.caption,
          thumbnailUrl: videos.thumbnailUrl,
          postedAt: videos.postedAt,
          platformVideoId: videos.platformVideoId,
          videoFileUrl: videos.videoFileUrl,
          creatorId: videos.creatorId,
        })
        .from(videos)
        .where(and(...conditions));

      const creatorIds = [...new Set(allVideos.map(v => v.creatorId))];
      const creatorMap: Record<number, { name: string; instagramUsername: string | null; tiktokUsername: string | null; createdAt: Date }> = {};
      for (const cId of creatorIds) {
        const [c] = await db.select().from(creators).where(eq(creators.id, cId));
        if (c) creatorMap[cId] = { name: c.name, instagramUsername: c.instagramUsername, tiktokUsername: c.tiktokUsername, createdAt: new Date(c.createdAt) };
      }

      const eligibleVideos = allVideos.filter(v => {
        if (!v.postedAt) return false;
        const cr = creatorMap[v.creatorId];
        if (!cr) return false;
        return new Date(v.postedAt) >= cr.createdAt;
      });

      const result = eligibleVideos.map(v => {
        const cr = creatorMap[v.creatorId];
        const username = v.platform === "instagram" ? cr?.instagramUsername : cr?.tiktokUsername;
        let url = "";
        if (v.platform === "instagram" && v.platformVideoId) {
          const igId = isInstagramNumericPk(v.platformVideoId) ? instagramPkToShortcode(v.platformVideoId) : v.platformVideoId;
          url = `https://www.instagram.com/reel/${igId}/`;
        } else if (v.platform === "tiktok" && username && v.platformVideoId) {
          url = `https://www.tiktok.com/@${username}/video/${v.platformVideoId}`;
        }
        return {
          id: String(v.id),
          url,
          thumbnailUrl: v.thumbnailUrl,
          platform: v.platform,
          views: v.views || 0,
          likes: v.likes || 0,
          comments: v.comments || 0,
          caption: v.caption,
          timestamp: v.postedAt?.toISOString() || "",
          creatorName: cr?.name || "",
          username: username || "",
          platformVideoId: v.platformVideoId || null,
          videoFileUrl: v.videoFileUrl || null,
        };
      });

      res.json({ videos: result });
    } catch (error) {
      console.error("Error fetching creator videos by date:", error);
      res.status(500).json({ message: "Failed to get videos by date" });
    }
  });

  // ---- Video Fires & Comments (shared for admin and creator) ----

  // Get fires for a video
  const getVideoFires = async (req: any, res: any) => {
    try {
      const videoId = parseInt(req.params.videoId);
      const userId = req.userId;
      const fires = await db.select().from(videoFires).where(eq(videoFires.videoId, videoId));
      const fireUsers = await Promise.all(
        fires.map(async (f) => {
          const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, f.userId));
          const [c] = await db.select({ name: creators.name }).from(creators).where(eq(creators.userId, f.userId));
          return c?.name || u?.email?.split('@')[0] || 'Unknown';
        })
      );
      res.json({
        count: fires.length,
        userFired: fires.some(f => f.userId === userId),
        users: fireUsers,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get fires" });
    }
  };

  // Toggle fire for a video
  const toggleVideoFire = async (req: any, res: any) => {
    try {
      const videoId = parseInt(req.params.videoId);
      const userId = req.userId;

      const [video] = await db.select({ id: videos.id }).from(videos).where(eq(videos.id, videoId)).limit(1);
      if (!video) {
        return res.status(404).json({ message: "Video not found. It may have been refreshed — please reload the page." });
      }

      const existing = await db.select().from(videoFires)
        .where(and(eq(videoFires.videoId, videoId), eq(videoFires.userId, userId)));
      if (existing.length > 0) {
        await db.delete(videoFires).where(and(eq(videoFires.videoId, videoId), eq(videoFires.userId, userId)));
      } else {
        await db.insert(videoFires).values({ videoId, userId });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle fire" });
    }
  };

  // Get comments for a video
  const getVideoComments = async (req: any, res: any) => {
    try {
      const videoId = parseInt(req.params.videoId);
      const allComments = await db.select().from(videoComments)
        .where(eq(videoComments.videoId, videoId))
        .orderBy(desc(videoComments.createdAt));
      const enriched = await Promise.all(
        allComments.map(async (c) => {
          const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, c.userId));
          const [cr] = await db.select({ name: creators.name }).from(creators).where(eq(creators.userId, c.userId));
          return {
            id: c.id,
            content: c.content,
            createdAt: c.createdAt,
            userName: cr?.name || u?.email?.split('@')[0] || 'Unknown',
            userId: c.userId,
          };
        })
      );
      res.json({ comments: enriched });
    } catch (error) {
      res.status(500).json({ message: "Failed to get comments" });
    }
  };

  // Post a comment on a video
  const postVideoComment = async (req: any, res: any) => {
    try {
      const videoId = parseInt(req.params.videoId);
      const userId = req.userId;
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Comment cannot be empty" });
      await db.insert(videoComments).values({ videoId, userId, content: content.trim() });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to post comment" });
    }
  };

  // Admin fire/comment routes
  app.get("/api/admin/videos/:videoId/fires", authenticateToken, getVideoFires);
  app.post("/api/admin/videos/:videoId/fire", authenticateToken, toggleVideoFire);
  app.get("/api/admin/videos/:videoId/comments", authenticateToken, getVideoComments);
  app.post("/api/admin/videos/:videoId/comments", authenticateToken, postVideoComment);

  // Creator fire/comment routes
  app.get("/api/creator/videos/:videoId/fires", authenticateToken, getVideoFires);
  app.post("/api/creator/videos/:videoId/fire", authenticateToken, toggleVideoFire);
  app.get("/api/creator/videos/:videoId/comments", authenticateToken, getVideoComments);
  app.post("/api/creator/videos/:videoId/comments", authenticateToken, postVideoComment);

  // Top accounts - ranked by total views (IG + TikTok) or improvement
  app.get("/api/admin/top-accounts", authenticateToken, async (req: any, res) => {
    try {
      const period = (req.query.period as string) || "cycle";
      const metric = (req.query.metric as string) || "views";
      const limit = parseInt(req.query.limit as string) || 5;

      const allCreators = await db.select().from(creators).where(eq(creators.status, "active"));
      const allCycles = await db.select().from(payoutCycles).orderBy(payoutCycles.startDate);
      
      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      let prevStartDate: Date | null = null;
      let prevEndDate: Date | null = null;

      if (period === "today") {
        startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      } else if (period === "yesterday") {
        const yesterday = new Date(now);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        startDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0));
        endDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59, 999));
      } else if (period === "cycle") {
        const activeCycle = allCycles.find(c => {
          const start = new Date(c.startDate);
          const end = new Date(c.endDate);
          return now >= start && now <= end;
        });
        if (activeCycle) {
          startDate = new Date(activeCycle.startDate);
          endDate = new Date(activeCycle.endDate);
          
          const activeCycleIndex = allCycles.findIndex(c => c.id === activeCycle.id);
          if (activeCycleIndex > 0) {
            const prevCycle = allCycles[activeCycleIndex - 1];
            prevStartDate = new Date(prevCycle.startDate);
            prevEndDate = new Date(prevCycle.endDate);
          }
        }
      }

      let currentVideos;
      if (startDate && endDate) {
        currentVideos = await db.select().from(videos)
          .where(sql`${videos.postedAt} >= ${startDate} AND ${videos.postedAt} <= ${endDate}`);
      } else {
        currentVideos = await db.select().from(videos);
      }

      let prevVideos: any[] = [];
      if (metric === "mostImproved" && prevStartDate && prevEndDate) {
        prevVideos = await db.select().from(videos)
          .where(sql`${videos.postedAt} >= ${prevStartDate} AND ${videos.postedAt} <= ${prevEndDate}`);
      }

      const creatorStats = allCreators.map(creator => {
        const creatorVideos = currentVideos.filter(v => v.creatorId === creator.id && v.isIrrelevant !== true && !!v.postedAt);
        const creatorPrevVideos = prevVideos.filter(v => v.creatorId === creator.id && v.isIrrelevant !== true && !!v.postedAt);
        
        const igVideos = creatorVideos.filter(v => v.platform === "instagram");
        const ttVideos = creatorVideos.filter(v => v.platform === "tiktok");
        
        const instagramViews = igVideos.reduce((sum, v) => sum + (v.views || 0), 0);
        const tiktokViews = ttVideos.reduce((sum, v) => sum + (v.views || 0), 0);
        
        const instagramLikes = igVideos.reduce((sum, v) => sum + (v.likes || 0), 0);
        const tiktokLikes = ttVideos.reduce((sum, v) => sum + (v.likes || 0), 0);
        
        const instagramComments = igVideos.reduce((sum, v) => sum + (v.comments || 0), 0);
        const tiktokComments = ttVideos.reduce((sum, v) => sum + (v.comments || 0), 0);

        const totalViews = instagramViews + tiktokViews;
        const totalLikes = instagramLikes + tiktokLikes;
        const totalComments = instagramComments + tiktokComments;
        const videoCount = creatorVideos.length;
        const avgViews = videoCount > 0 ? Math.round(totalViews / videoCount) : 0;
        const avgLikes = videoCount > 0 ? Math.round(totalLikes / videoCount) : 0;

        const prevViews = creatorPrevVideos.reduce((sum, v) => sum + (v.views || 0), 0);
        const improvement = prevViews > 0 ? Math.round(((totalViews - prevViews) / prevViews) * 100) : (totalViews > 0 ? 100 : 0);

        return {
          id: creator.id,
          name: creator.name,
          email: creator.email,
          instagramUsername: creator.instagramUsername,
          tiktokUsername: creator.tiktokUsername,
          views: totalViews,
          likes: totalLikes,
          comments: totalComments,
          videos: videoCount,
          avgViews,
          avgLikes,
          improvement,
          prevViews,
          instagramViews,
          tiktokViews,
          instagramLikes,
          tiktokLikes,
          instagramComments,
          tiktokComments,
          instagramFollowers: creator.instagramFollowers || 0,
          tiktokFollowers: creator.tiktokFollowers || 0,
        };
      });

      creatorStats.sort((a, b) => {
        const aHasSocial = !!(a.instagramUsername || a.tiktokUsername);
        const bHasSocial = !!(b.instagramUsername || b.tiktokUsername);
        if (aHasSocial !== bHasSocial) return aHasSocial ? -1 : 1;
        if (metric === "likes") return b.likes - a.likes;
        if (metric === "comments") return b.comments - a.comments;
        if (metric === "avgViews") return b.avgViews - a.avgViews;
        if (metric === "avgLikes") return b.avgLikes - a.avgLikes;
        if (metric === "mostImproved") return b.improvement - a.improvement;
        return b.views - a.views;
      });

      res.json({
        accounts: creatorStats.slice(0, limit),
        totalCount: allCreators.length
      });
    } catch (error) {
      console.error("Get admin top accounts error:", error);
      res.status(500).json({ message: "Failed to get top accounts" });
    }
  });

  // Creator: Get current cycle stats (earnings, video count, views)
  app.get("/api/creator/stats", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const [creator] = await db.select().from(creators).where(eq(creators.userId, user.id)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      const allCycles = await db.select().from(payoutCycles).orderBy(payoutCycles.startDate);
      const now = new Date();
      const activeCycle = allCycles.find(c => {
        const start = new Date(c.startDate);
        const end = new Date(c.endDate);
        return now >= start && now <= end;
      }) || null;

      const [settings] = await db.select().from(payoutSettings).limit(1);
      const basePayRate = settings?.basePay ? parseFloat(settings.basePay as unknown as string) : 0;
      const statsIgRate = creator.customInstagramBasePay !== null ? parseFloat(creator.customInstagramBasePay as unknown as string) : basePayRate;
      const statsTtRate = creator.customTiktokBasePay !== null ? parseFloat(creator.customTiktokBasePay as unknown as string) : basePayRate;
      const tiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));

      let videosThisCycle = 0;
      let totalViewsThisCycle = 0;
      let baseEarnings = 0;
      let bonusEarnings = 0;

      if (activeCycle) {
        const cycleVideos = await db.select().from(videos)
          .where(and(
            eq(videos.creatorId, creator.id),
            eq(videos.isIrrelevant, false),
            gte(videos.postedAt, activeCycle.startDate),
            lte(videos.postedAt, activeCycle.endDate)
          ));

        const eligible = cycleVideos.filter(v => !!v.postedAt);

        const igVids5 = eligible.filter(v => v.platform === "instagram" && !v.isIrrelevant);
        const ttVids5 = eligible.filter(v => v.platform === "tiktok" && !v.isIrrelevant);
        const usedTt5 = new Set<number>();
        const PAIR_WINDOW_MS5 = 24 * 60 * 60 * 1000;

        for (const ig of igVids5) {
          if (!ig.postedAt || ig.duration == null) continue;
          const igTime = new Date(ig.postedAt).getTime();
          let bestMatch: typeof ttVids5[0] | null = null;
          let bestDurationDiff = Infinity;
          let bestTimeDiff = Infinity;
          for (const tt of ttVids5) {
            if (usedTt5.has(tt.id)) continue;
            if (!tt.postedAt || tt.duration == null) continue;
            const durationDiff = Math.abs(ig.duration - tt.duration);
            if (durationDiff > 1) continue;
            const timeDiff = Math.abs(igTime - new Date(tt.postedAt).getTime());
            if (timeDiff <= PAIR_WINDOW_MS5 && (durationDiff < bestDurationDiff || (durationDiff === bestDurationDiff && timeDiff < bestTimeDiff))) {
              bestDurationDiff = durationDiff;
              bestTimeDiff = timeDiff;
              bestMatch = tt;
            }
          }
          if (bestMatch) {
            usedTt5.add(bestMatch.id);
            baseEarnings += statsIgRate + statsTtRate;
            const winnerViews = Math.max(ig.views || 0, bestMatch.views || 0);
            const matchingTier = tiers.find(t => winnerViews >= t.viewThreshold);
            if (matchingTier) {
              bonusEarnings += parseFloat(matchingTier.bonusAmount as unknown as string);
            }
          }
        }
        videosThisCycle = eligible.filter(v => !v.isIrrelevant).length;
        totalViewsThisCycle = eligible.filter(v => !v.isIrrelevant).reduce((s, v) => s + (v.views || 0), 0);
      }

      const startOfWeek = new Date();
      startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay());
      startOfWeek.setUTCHours(0, 0, 0, 0);

      const weekVideos = await db.select().from(videos)
        .where(and(
          eq(videos.creatorId, creator.id),
          gte(videos.postedAt, startOfWeek)
        ));

      res.json({
        videosThisCycle,
        videosThisWeek: weekVideos.length,
        totalViewsThisCycle,
        baseEarnings,
        bonusEarnings,
        totalPayout: baseEarnings + bonusEarnings,
        currentCycle: activeCycle ? {
          startDate: activeCycle.startDate,
          endDate: activeCycle.endDate,
        } : null,
        settings: settings || { basePay: "10.00" },
      });
    } catch (error) {
      console.error("Get creator stats error:", error);
      res.status(500).json({ message: "Failed to get creator stats" });
    }
  });

  // Creator: Get payout history with cycle dates
  app.get("/api/creator/payouts", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const [creator] = await db.select().from(creators).where(eq(creators.userId, user.id)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      const creatorId = creator.id;
      const creatorPayouts = await db.select().from(payouts).where(eq(payouts.creatorId, creatorId));
      const allCycles = await db.select().from(payoutCycles);
      const cycleMap = new Map(allCycles.map(c => [c.id, c]));

      const [settings] = await db.select().from(payoutSettings).limit(1);
      const basePayRate = settings?.basePay ? parseFloat(settings.basePay as unknown as string) : 0;
      const payoutIgRate = creator.customInstagramBasePay !== null ? parseFloat(creator.customInstagramBasePay as unknown as string) : basePayRate;
      const payoutTtRate = creator.customTiktokBasePay !== null ? parseFloat(creator.customTiktokBasePay as unknown as string) : basePayRate;
      const allTiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));

      const approvedCompletions = await db.select({
        completion: bountyCompletions,
        bounty: bounties,
      }).from(bountyCompletions)
        .leftJoin(bounties, eq(bountyCompletions.bountyId, bounties.id))
        .where(and(
          eq(bountyCompletions.creatorId, creatorId),
          eq(bountyCompletions.status, "approved")
        ));

      const creatorParticipants = await db.select({
        participant: gameParticipants,
        game: survivorGames,
      }).from(gameParticipants)
        .leftJoin(survivorGames, eq(gameParticipants.gameId, survivorGames.id))
        .where(eq(gameParticipants.creatorId, creatorId));

      const allGameParticipants = new Map<number, { totalSurvivorPosts: number }>();
      for (const cp of creatorParticipants) {
        if (!cp.game) continue;
        if (!allGameParticipants.has(cp.game.id)) {
          const gameParts = await db.select().from(gameParticipants)
            .where(and(
              eq(gameParticipants.gameId, cp.game.id),
              eq(gameParticipants.isEliminated, false)
            ));
          const totalPosts = gameParts.reduce((sum, p) => sum + (p.totalPosts || 0), 0);
          allGameParticipants.set(cp.game.id, { totalSurvivorPosts: totalPosts });
        }
      }

      function getBountyDateForCycle(completion: typeof approvedCompletions[0]): Date | null {
        if (completion.bounty?.deadline) return new Date(completion.bounty.deadline);
        if (completion.completion.completedAt) return new Date(completion.completion.completedAt);
        if (completion.completion.paidAt) return new Date(completion.completion.paidAt);
        return null;
      }

      function computeBountyAndSurvivorForCycleCreator(cycleStart: Date, cycleEnd: Date) {
        const bountyItems: { title: string; reward: string; status: string }[] = [];
        let bountyTotal = 0;
        for (const ac of approvedCompletions) {
          if (!ac.bounty) continue;
          const bDate = getBountyDateForCycle(ac);
          if (!bDate) continue;
          if (bDate >= cycleStart && bDate <= cycleEnd) {
            const reward = parseFloat(ac.bounty.reward as unknown as string) || 0;
            bountyTotal += reward;
            bountyItems.push({
              title: ac.bounty.title,
              reward: reward.toFixed(2),
              status: ac.completion.status,
            });
          }
        }

        const survivorItems: { gameTitle: string; prizePool: string; payout: string; sharePercent: number }[] = [];
        let survivorTotal = 0;
        for (const cp of creatorParticipants) {
          if (!cp.game || !cp.game.endDate) continue;
          const gameEnd = new Date(cp.game.endDate);
          if (gameEnd >= cycleStart && gameEnd <= cycleEnd) {
            const prizePool = parseFloat(cp.game.prizePool as unknown as string) || 0;
            const gameStats = allGameParticipants.get(cp.game.id);
            const totalSurvivorPosts = gameStats?.totalSurvivorPosts || 0;
            const creatorPosts = cp.participant.totalPosts || 0;
            let payout = 0;
            let sharePercent = 0;
            if (totalSurvivorPosts > 0 && !cp.participant.isEliminated) {
              sharePercent = (creatorPosts / totalSurvivorPosts) * 100;
              payout = (creatorPosts / totalSurvivorPosts) * prizePool;
            }
            survivorTotal += payout;
            survivorItems.push({
              gameTitle: cp.game.title,
              prizePool: prizePool.toFixed(2),
              payout: payout.toFixed(2),
              sharePercent: Math.round(sharePercent * 100) / 100,
            });
          }
        }

        return {
          bountyTotal: bountyTotal.toFixed(2),
          bountyItems,
          survivorTotal: survivorTotal.toFixed(2),
          survivorItems,
          bountyTotalNum: bountyTotal,
          survivorTotalNum: survivorTotal,
        };
      }

      const now = new Date();
      const activeCycle = allCycles.find(c => now >= new Date(c.startDate) && now <= new Date(c.endDate));

      const payoutsWithCyclesRaw = creatorPayouts
        .filter(p => {
          if (p.notes && p.notes.startsWith("Bounty:")) return false;
          if (activeCycle && p.cycleId === activeCycle.id) return false;
          return true;
        })
        .map(p => {
          const cycle = p.cycleId ? cycleMap.get(p.cycleId) : null;
          const cycleStart = cycle ? new Date(cycle.startDate) : new Date(p.periodStart);
          const cycleEnd = cycle ? new Date(cycle.endDate) : new Date(p.periodEnd);
          const bsData = computeBountyAndSurvivorForCycleCreator(cycleStart, cycleEnd);
          const baseAmt = parseFloat(p.amount as unknown as string) || 0;
          const combinedTotal = baseAmt + bsData.bountyTotalNum + bsData.survivorTotalNum;
          return {
            id: String(p.id),
            cycleId: p.cycleId ? String(p.cycleId) : null,
            baseAmount: p.basePay || p.amount,
            bonusAmount: p.bonusPay || "0.00",
            eligibleViews: p.eligibleViews || 0,
            totalAmount: p.amount,
            paidAt: p.paidAt ? p.paidAt.toISOString() : null,
            cycle: cycle
              ? { startDate: cycle.startDate.toISOString(), endDate: cycle.endDate.toISOString() }
              : { startDate: p.periodStart.toISOString(), endDate: p.periodEnd.toISOString() },
            bountyTotal: bsData.bountyTotal,
            bountyItems: bsData.bountyItems,
            survivorTotal: bsData.survivorTotal,
            survivorItems: bsData.survivorItems,
            combinedTotal: combinedTotal.toFixed(2),
          };
        });

      const payoutsResult = payoutsWithCyclesRaw as any[];

      if (activeCycle) {
        const allCreatorVideos = await db.select().from(videos).where(eq(videos.creatorId, creatorId));
        const cycleStart = new Date(activeCycle.startDate);
        const cycleEnd = new Date(activeCycle.endDate);

        const cycleVids = allCreatorVideos.filter(v => {
          if (!v.postedAt) return false;
          const vDate = new Date(v.postedAt);
          return vDate >= cycleStart && vDate <= cycleEnd && !v.isIrrelevant;
        });

        const igVids6 = cycleVids.filter(v => v.platform === "instagram");
        const ttVids6 = cycleVids.filter(v => v.platform === "tiktok");
        const usedTt6 = new Set<number>();
        const PAIR_WINDOW_MS6 = 24 * 60 * 60 * 1000;
        let calcBase = 0;
        let calcBonus = 0;
        let eligibleViews = cycleVids.reduce((s, v) => s + (v.views || 0), 0);

        for (const ig of igVids6) {
          if (!ig.postedAt || ig.duration == null) continue;
          const igTime = new Date(ig.postedAt).getTime();
          let bestMatch: typeof ttVids6[0] | null = null;
          let bestDurationDiff = Infinity;
          let bestTimeDiff = Infinity;
          for (const tt of ttVids6) {
            if (usedTt6.has(tt.id)) continue;
            if (!tt.postedAt || tt.duration == null) continue;
            const durationDiff = Math.abs(ig.duration - tt.duration);
            if (durationDiff > 1) continue;
            const timeDiff = Math.abs(igTime - new Date(tt.postedAt).getTime());
            if (timeDiff <= PAIR_WINDOW_MS6 && (durationDiff < bestDurationDiff || (durationDiff === bestDurationDiff && timeDiff < bestTimeDiff))) {
              bestDurationDiff = durationDiff;
              bestTimeDiff = timeDiff;
              bestMatch = tt;
            }
          }
          if (bestMatch) {
            usedTt6.add(bestMatch.id);
            calcBase += payoutIgRate + payoutTtRate;
            const winnerViews = Math.max(ig.views || 0, bestMatch.views || 0);
            const matchingTier = allTiers.find(t => winnerViews >= t.viewThreshold);
            if (matchingTier) {
              calcBonus += parseFloat(matchingTier.bonusAmount as unknown as string);
            }
          }
        }

        const activeBsData = computeBountyAndSurvivorForCycleCreator(cycleStart, cycleEnd);
        const calcTotal = calcBase + calcBonus;
        const activeCombinedTotal = calcTotal + activeBsData.bountyTotalNum + activeBsData.survivorTotalNum;

        payoutsResult.unshift({
          id: "-1",
          cycleId: String(activeCycle.id),
          baseAmount: calcBase.toFixed(2),
          bonusAmount: calcBonus.toFixed(2),
          totalAmount: calcTotal.toFixed(2),
          paidAt: null,
          cycle: {
            startDate: activeCycle.startDate.toISOString(),
            endDate: activeCycle.endDate.toISOString(),
          },
          eligibleViews,
          isCalculated: true,
          bountyTotal: activeBsData.bountyTotal,
          bountyItems: activeBsData.bountyItems,
          survivorTotal: activeBsData.survivorTotal,
          survivorItems: activeBsData.survivorItems,
          combinedTotal: activeCombinedTotal.toFixed(2),
        });
      }

      res.json(payoutsResult);
    } catch (error) {
      console.error("Get creator payouts error:", error);
      res.status(500).json({ message: "Failed to get payouts" });
    }
  });

  // Creator: Get cycle videos with frozen flag
  app.get("/api/creator/cycle/:cycleId/videos", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const [creator] = await db.select().from(creators).where(eq(creators.userId, user.id)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      const cycleId = parseInt(req.params.cycleId);
      const [cycle] = await db.select().from(payoutCycles).where(eq(payoutCycles.id, cycleId)).limit(1);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });

      const now = new Date();
      const isFrozen = now > new Date(cycle.endDate);

      const [settings] = await db.select().from(payoutSettings).limit(1);
      const liveBasePayRate = settings?.basePay ? parseFloat(settings.basePay as unknown as string) : 0;
      const liveIgRate = creator.customInstagramBasePay !== null ? parseFloat(creator.customInstagramBasePay as unknown as string) : liveBasePayRate;
      const liveTtRate = creator.customTiktokBasePay !== null ? parseFloat(creator.customTiktokBasePay as unknown as string) : liveBasePayRate;
      const liveTiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));

      let cycleIgRate = liveIgRate;
      let cycleTtRate = liveTtRate;
      let cycleBaseRate = liveBasePayRate;
      let cycleTiers: { viewThreshold: number; bonusAmount: string }[] = liveTiers as any;

      if (isFrozen) {
        const [payout] = await db.select().from(payouts).where(and(eq(payouts.creatorId, creator.id), eq(payouts.cycleId, cycleId))).limit(1);
        const snapshotDefault = payout?.snapshotDefaultBasePay
          ? parseFloat(payout.snapshotDefaultBasePay as unknown as string)
          : (cycle.basePayPerVideo ? parseFloat(cycle.basePayPerVideo as unknown as string) : liveBasePayRate);
        cycleBaseRate = snapshotDefault;
        cycleIgRate = payout?.snapshotIgBasePay ? parseFloat(payout.snapshotIgBasePay as unknown as string) : snapshotDefault;
        cycleTtRate = payout?.snapshotTtBasePay ? parseFloat(payout.snapshotTtBasePay as unknown as string) : snapshotDefault;
        if (cycle.bonusTiersSnapshot) {
          try {
            cycleTiers = JSON.parse(cycle.bonusTiersSnapshot);
            cycleTiers.sort((a: any, b: any) => b.viewThreshold - a.viewThreshold);
          } catch {}
        }
      }

      const cycleVideos = await db.select().from(videos)
        .where(and(
          eq(videos.creatorId, creator.id),
          gte(videos.postedAt, cycle.startDate),
          lte(videos.postedAt, cycle.endDate)
        ));

      const igVideos = cycleVideos.filter(v => v.platform === "instagram" && !v.isIrrelevant && v.postedAt);
      const ttVideos = cycleVideos.filter(v => v.platform === "tiktok" && !v.isIrrelevant && v.postedAt);

      const pairedIgIds = new Set<number>();
      const pairedTtIds = new Set<number>();
      const pairBonusMap = new Map<number, number>();
      const usedTt = new Set<number>();

      for (const ig of igVideos) {
        if (!ig.postedAt || !ig.duration) continue;
        const igTime = new Date(ig.postedAt).getTime();
        let bestMatch: typeof ttVideos[0] | null = null;
        let bestDurationDiff = Infinity;
        let bestTimeDiff = Infinity;
        for (const tt of ttVideos) {
          if (usedTt.has(tt.id)) continue;
          if (!tt.postedAt || !tt.duration) continue;
          const durationDiff = Math.abs(ig.duration - tt.duration);
          if (durationDiff > 1) continue;
          const timeDiff = Math.abs(igTime - new Date(tt.postedAt).getTime());
          if (timeDiff / (1000 * 60 * 60) <= 24 && (durationDiff < bestDurationDiff || (durationDiff === bestDurationDiff && timeDiff < bestTimeDiff))) {
            bestDurationDiff = durationDiff;
            bestTimeDiff = timeDiff;
            bestMatch = tt;
          }
        }
        if (bestMatch) {
          usedTt.add(bestMatch.id);
          pairedIgIds.add(ig.id);
          pairedTtIds.add(bestMatch.id);
          const winnerViews = Math.max(ig.views || 0, bestMatch.views || 0);
          const matchingTier = cycleTiers.find((t: any) => winnerViews >= t.viewThreshold);
          const pairBonus = matchingTier ? parseFloat(matchingTier.bonusAmount as unknown as string) : 0;
          pairBonusMap.set(ig.id, pairBonus);
          pairBonusMap.set(bestMatch.id, pairBonus);
        }
      }

      const enrichedVideos = cycleVideos.map(v => {
        const isEligible = !v.isIrrelevant && !!v.postedAt;
        const isPairedByDuration = pairedIgIds.has(v.id) || pairedTtIds.has(v.id);

        return {
          id: String(v.id),
          videoId: v.videoId,
          platform: v.platform,
          platformVideoId: v.platformVideoId,
          caption: v.caption,
          thumbnailUrl: v.thumbnailUrl || v.thumbnail,
          thumbnailHash: v.thumbnail,
          url: v.url,
          videoFileUrl: v.videoFileUrl,
          views: v.views || 0,
          likes: v.likes || 0,
          comments: v.comments || 0,
          postedAt: v.postedAt ? v.postedAt.toISOString() : null,
          isIrrelevant: v.isIrrelevant,
          isEligible,
          isFrozen,
          duration: v.duration,
          isPaired: isPairedByDuration,
          pairedVideoId: v.pairedVideoId,
          basePayPerVideo: isPairedByDuration ? (v.platform === "instagram" ? cycleIgRate : v.platform === "tiktok" ? cycleTtRate : cycleBaseRate) : 0,
          bonusAmount: pairBonusMap.get(v.id) || 0,
        };
      });

      res.json({
        cycle: {
          id: String(cycle.id),
          startDate: cycle.startDate.toISOString(),
          endDate: cycle.endDate.toISOString(),
        },
        videos: enrichedVideos,
        isFrozen,
      });
    } catch (error) {
      console.error("Get creator cycle videos error:", error);
      res.status(500).json({ message: "Failed to get cycle videos" });
    }
  });

  // Admin: Get cycle videos for a specific creator with frozen flag
  app.get("/api/admin/cycles/:id/videos", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const cycleId = parseInt(req.params.id);
      const creatorId = parseInt(req.query.creatorId as string);
      if (isNaN(cycleId) || isNaN(creatorId)) {
        return res.status(400).json({ message: "Invalid cycle or creator ID" });
      }

      const [cycle] = await db.select().from(payoutCycles).where(eq(payoutCycles.id, cycleId)).limit(1);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });

      const [creator] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      const now = new Date();
      const isFrozen = now > new Date(cycle.endDate);

      const [settings] = await db.select().from(payoutSettings).limit(1);
      const liveBasePayRate = settings?.basePay ? parseFloat(settings.basePay as unknown as string) : 0;
      const liveIgRate = creator.customInstagramBasePay !== null ? parseFloat(creator.customInstagramBasePay as unknown as string) : liveBasePayRate;
      const liveTtRate = creator.customTiktokBasePay !== null ? parseFloat(creator.customTiktokBasePay as unknown as string) : liveBasePayRate;
      const liveTiers = await db.select().from(bonusTiers).orderBy(desc(bonusTiers.viewThreshold));

      let cvIgRate = liveIgRate;
      let cvTtRate = liveTtRate;
      let cvBaseRate = liveBasePayRate;
      let tiers: { viewThreshold: number; bonusAmount: string }[] = liveTiers as any;

      if (isFrozen) {
        const [payout] = await db.select().from(payouts).where(and(eq(payouts.creatorId, creatorId), eq(payouts.cycleId, cycleId))).limit(1);
        const snapshotDefault = payout?.snapshotDefaultBasePay
          ? parseFloat(payout.snapshotDefaultBasePay as unknown as string)
          : (cycle.basePayPerVideo ? parseFloat(cycle.basePayPerVideo as unknown as string) : liveBasePayRate);
        cvBaseRate = snapshotDefault;
        cvIgRate = payout?.snapshotIgBasePay ? parseFloat(payout.snapshotIgBasePay as unknown as string) : snapshotDefault;
        cvTtRate = payout?.snapshotTtBasePay ? parseFloat(payout.snapshotTtBasePay as unknown as string) : snapshotDefault;
        if (cycle.bonusTiersSnapshot) {
          try {
            tiers = JSON.parse(cycle.bonusTiersSnapshot);
            tiers.sort((a: any, b: any) => b.viewThreshold - a.viewThreshold);
          } catch {}
        }
      }

      let cycleVideos = await db.select().from(videos)
        .where(and(
          eq(videos.creatorId, creatorId),
          gte(videos.postedAt, cycle.startDate),
          lte(videos.postedAt, cycle.endDate)
        ));

      const BOUNDARY_WINDOW_MS = 24 * 60 * 60 * 1000;
      const allCyclesList = await db.select().from(payoutCycles).orderBy(payoutCycles.startDate);
      const cycleIndex = allCyclesList.findIndex(c => c.id === cycle.id);
      if (cycleIndex > 0) {
        const prevCycle = allCyclesList[cycleIndex - 1];
        const prevEnd = new Date(prevCycle.endDate).getTime();
        const currStart = new Date(cycle.startDate).getTime();

        const prevCycleVids = await db.select().from(videos)
          .where(and(
            eq(videos.creatorId, creatorId),
            gte(videos.postedAt, prevCycle.startDate),
            lte(videos.postedAt, prevCycle.endDate)
          ));

        const eligiblePrev = prevCycleVids.filter(v => !v.isIrrelevant && v.postedAt && v.duration != null);
        const prevIg = eligiblePrev.filter(v => v.platform === "instagram");
        const prevTt = eligiblePrev.filter(v => v.platform === "tiktok");
        const prevUsedIg = new Set<number>();
        const prevUsedTt = new Set<number>();

        for (const pig of prevIg) {
          const pigTime = new Date(pig.postedAt!).getTime();
          let best: typeof prevTt[0] | null = null;
          let bestDiff = Infinity;
          let bestTd = Infinity;
          for (const ptt of prevTt) {
            if (prevUsedTt.has(ptt.id)) continue;
            const dd = Math.abs(pig.duration! - ptt.duration!);
            if (dd > 1) continue;
            const td = Math.abs(pigTime - new Date(ptt.postedAt!).getTime());
            if (td <= BOUNDARY_WINDOW_MS && (dd < bestDiff || (dd === bestDiff && td < bestTd))) { bestDiff = dd; bestTd = td; best = ptt; }
          }
          if (best) { prevUsedIg.add(pig.id); prevUsedTt.add(best.id); }
        }

        const unpairedBoundaryIg = prevIg.filter(v => !prevUsedIg.has(v.id) && new Date(v.postedAt!).getTime() >= prevEnd - BOUNDARY_WINDOW_MS);
        const unpairedBoundaryTt = prevTt.filter(v => !prevUsedTt.has(v.id) && new Date(v.postedAt!).getTime() >= prevEnd - BOUNDARY_WINDOW_MS);

        const eligibleCurr = cycleVideos.filter(v => !v.isIrrelevant && v.postedAt && v.duration != null);
        const currIg = eligibleCurr.filter(v => v.platform === "instagram");
        const currTt = eligibleCurr.filter(v => v.platform === "tiktok");
        const currUsedIg = new Set<number>();
        const currUsedTt = new Set<number>();

        for (const cig of currIg) {
          const cigTime = new Date(cig.postedAt!).getTime();
          let best: typeof currTt[0] | null = null;
          let bestDiff = Infinity;
          let bestTd = Infinity;
          for (const ctt of currTt) {
            if (currUsedTt.has(ctt.id)) continue;
            const dd = Math.abs(cig.duration! - ctt.duration!);
            if (dd > 1) continue;
            const td = Math.abs(cigTime - new Date(ctt.postedAt!).getTime());
            if (td <= BOUNDARY_WINDOW_MS && (dd < bestDiff || (dd === bestDiff && td < bestTd))) { bestDiff = dd; bestTd = td; best = ctt; }
          }
          if (best) { currUsedIg.add(cig.id); currUsedTt.add(best.id); }
        }

        const unpairedCurrFirstDayIg = currIg.filter(v => !currUsedIg.has(v.id) && new Date(v.postedAt!).getTime() <= currStart + BOUNDARY_WINDOW_MS);
        const unpairedCurrFirstDayTt = currTt.filter(v => !currUsedTt.has(v.id) && new Date(v.postedAt!).getTime() <= currStart + BOUNDARY_WINDOW_MS);

        const pullForwardIds = new Set<number>();
        for (const utt of unpairedCurrFirstDayTt) {
          const uttTime = new Date(utt.postedAt!).getTime();
          for (const pig of unpairedBoundaryIg) {
            if (pullForwardIds.has(pig.id)) continue;
            const dd = Math.abs(utt.duration! - pig.duration!);
            if (dd > 1) continue;
            const td = Math.abs(uttTime - new Date(pig.postedAt!).getTime());
            if (td <= BOUNDARY_WINDOW_MS) { pullForwardIds.add(pig.id); break; }
          }
        }
        for (const uig of unpairedCurrFirstDayIg) {
          const uigTime = new Date(uig.postedAt!).getTime();
          for (const ptt of unpairedBoundaryTt) {
            if (pullForwardIds.has(ptt.id)) continue;
            const dd = Math.abs(uig.duration! - ptt.duration!);
            if (dd > 1) continue;
            const td = Math.abs(uigTime - new Date(ptt.postedAt!).getTime());
            if (td <= BOUNDARY_WINDOW_MS) { pullForwardIds.add(ptt.id); break; }
          }
        }

        if (pullForwardIds.size > 0) {
          const pulledVids = prevCycleVids.filter(v => pullForwardIds.has(v.id));
          cycleVideos = [...cycleVideos, ...pulledVids];
        }
      }

      if (cycleIndex >= 0 && cycleIndex < allCyclesList.length - 1) {
        const nextCycle = allCyclesList[cycleIndex + 1];
        const currEnd = new Date(cycle.endDate).getTime();
        const nextStart = new Date(nextCycle.startDate).getTime();

        const nextCycleVids = await db.select().from(videos)
          .where(and(
            eq(videos.creatorId, creatorId),
            gte(videos.postedAt, nextCycle.startDate),
            lte(videos.postedAt, nextCycle.endDate)
          ));

        const eligCurr = cycleVideos.filter(v => !v.isIrrelevant && v.postedAt && v.duration != null);
        const cIg = eligCurr.filter(v => v.platform === "instagram");
        const cTt = eligCurr.filter(v => v.platform === "tiktok");
        const usedCIg = new Set<number>();
        const usedCTt = new Set<number>();

        for (const ig2 of cIg) {
          const igTime2 = new Date(ig2.postedAt!).getTime();
          let best2: typeof cTt[0] | null = null;
          let bestDiff2 = Infinity;
          let bestTd2 = Infinity;
          for (const tt2 of cTt) {
            if (usedCTt.has(tt2.id)) continue;
            const dd2 = Math.abs(ig2.duration! - tt2.duration!);
            if (dd2 > 1) continue;
            const td2 = Math.abs(igTime2 - new Date(tt2.postedAt!).getTime());
            if (td2 <= BOUNDARY_WINDOW_MS && (dd2 < bestDiff2 || (dd2 === bestDiff2 && td2 < bestTd2))) { bestDiff2 = dd2; bestTd2 = td2; best2 = tt2; }
          }
          if (best2) { usedCIg.add(ig2.id); usedCTt.add(best2.id); }
        }

        const unpairedEndIg = cIg.filter(v => !usedCIg.has(v.id) && new Date(v.postedAt!).getTime() >= currEnd - BOUNDARY_WINDOW_MS);
        const unpairedEndTt = cTt.filter(v => !usedCTt.has(v.id) && new Date(v.postedAt!).getTime() >= currEnd - BOUNDARY_WINDOW_MS);

        const eligNext = nextCycleVids.filter(v => !v.isIrrelevant && v.postedAt && v.duration != null);
        const nextFirstDayIg = eligNext.filter(v => v.platform === "instagram" && new Date(v.postedAt!).getTime() <= nextStart + BOUNDARY_WINDOW_MS);
        const nextFirstDayTt = eligNext.filter(v => v.platform === "tiktok" && new Date(v.postedAt!).getTime() <= nextStart + BOUNDARY_WINDOW_MS);

        const nUsedIg = new Set<number>();
        const nUsedTt = new Set<number>();
        for (const nig of eligNext.filter(v => v.platform === "instagram")) {
          const nigTime = new Date(nig.postedAt!).getTime();
          let bestN: typeof eligNext[0] | null = null;
          let bestDN = Infinity;
          let bestTdN = Infinity;
          for (const ntt of eligNext.filter(v => v.platform === "tiktok")) {
            if (nUsedTt.has(ntt.id)) continue;
            const ddn = Math.abs(nig.duration! - ntt.duration!);
            if (ddn > 1) continue;
            const tdn = Math.abs(nigTime - new Date(ntt.postedAt!).getTime());
            if (tdn <= BOUNDARY_WINDOW_MS && (ddn < bestDN || (ddn === bestDN && tdn < bestTdN))) { bestDN = ddn; bestTdN = tdn; bestN = ntt; }
          }
          if (bestN) { nUsedIg.add(nig.id); nUsedTt.add(bestN.id); }
        }

        const unpairedNextFirstIg = nextFirstDayIg.filter(v => !nUsedIg.has(v.id));
        const unpairedNextFirstTt = nextFirstDayTt.filter(v => !nUsedTt.has(v.id));

        const excludeFromCurr = new Set<number>();
        for (const utt2 of unpairedNextFirstTt) {
          const utt2Time = new Date(utt2.postedAt!).getTime();
          for (const eig of unpairedEndIg) {
            if (excludeFromCurr.has(eig.id)) continue;
            const dd3 = Math.abs(utt2.duration! - eig.duration!);
            if (dd3 > 1) continue;
            const td3 = Math.abs(utt2Time - new Date(eig.postedAt!).getTime());
            if (td3 <= BOUNDARY_WINDOW_MS) { excludeFromCurr.add(eig.id); break; }
          }
        }
        for (const uig2 of unpairedNextFirstIg) {
          const uig2Time = new Date(uig2.postedAt!).getTime();
          for (const ett of unpairedEndTt) {
            if (excludeFromCurr.has(ett.id)) continue;
            const dd4 = Math.abs(uig2.duration! - ett.duration!);
            if (dd4 > 1) continue;
            const td4 = Math.abs(uig2Time - new Date(ett.postedAt!).getTime());
            if (td4 <= BOUNDARY_WINDOW_MS) { excludeFromCurr.add(ett.id); break; }
          }
        }

        if (excludeFromCurr.size > 0) {
          cycleVideos = cycleVideos.filter(v => !excludeFromCurr.has(v.id));
        }
      }

      const enrichedVideosRaw = cycleVideos.map(v => {
        const isEligible = !v.isIrrelevant && !!v.postedAt;
        const views = v.views || 0;
        const matchingTier = tiers.find((t: any) => views >= t.viewThreshold);
        const bonusAmount = isEligible && matchingTier ? parseFloat(matchingTier.bonusAmount as unknown as string) : 0;
        const platformRate = v.platform === "instagram" ? cvIgRate : v.platform === "tiktok" ? cvTtRate : cvBaseRate;

        return {
          id: String(v.id),
          videoId: v.videoId,
          platform: v.platform,
          platformVideoId: v.platformVideoId,
          caption: v.caption,
          thumbnailUrl: v.thumbnailUrl || v.thumbnail,
          thumbnailHash: v.thumbnail,
          url: v.url,
          videoFileUrl: v.videoFileUrl,
          views,
          likes: v.likes || 0,
          comments: v.comments || 0,
          postedAt: v.postedAt ? v.postedAt.toISOString() : null,
          isIrrelevant: v.isIrrelevant,
          isEligible,
          isFrozen,
          duration: v.duration,
          isPaired: v.isPaired,
          pairedVideoId: v.pairedVideoId,
          basePayPerVideo: isEligible ? platformRate : 0,
          bonusAmount,
          creatorId: String(creatorId),
          creatorEmail: creator.email,
          creatorName: creator.name,
        };
      });

      const enrichedVideos = applyPairBonusLogic(enrichedVideosRaw);

      res.json({
        cycle: {
          id: String(cycle.id),
          startDate: cycle.startDate.toISOString(),
          endDate: cycle.endDate.toISOString(),
        },
        videos: enrichedVideos,
        isFrozen,
      });
    } catch (error) {
      console.error("Get admin cycle videos error:", error);
      res.status(500).json({ message: "Failed to get cycle videos" });
    }
  });

  // Creator: Get all-time stats
  app.get("/api/creator/stats/all-time", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const [creator] = await db.select().from(creators).where(eq(creators.userId, user.id)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      const allVideos = await db.select().from(videos)
        .where(and(
          eq(videos.creatorId, creator.id),
          eq(videos.isIrrelevant, false)
        ));

      const totalViews = allVideos.reduce((sum, v) => sum + (v.views || 0), 0);

      const creatorPayouts = await db.select().from(payouts).where(eq(payouts.creatorId, creator.id));
      const totalEarnings = creatorPayouts.reduce((sum, p) => sum + parseFloat(p.amount as unknown as string), 0);

      res.json({
        totalVideos: allVideos.length,
        totalViews,
        totalEarnings,
        totalBaseEarnings: totalEarnings,
        totalBonusEarnings: 0,
      });
    } catch (error) {
      console.error("Get creator all-time stats error:", error);
      res.status(500).json({ message: "Failed to get all-time stats" });
    }
  });

  app.put("/api/admin/creators/:id/base-pay", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Unauthorized" });

      const creatorId = parseInt(req.params.id);
      const [creator] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      const { customInstagramBasePay, customTiktokBasePay } = req.body;

      await db.update(creators).set({
        customInstagramBasePay: customInstagramBasePay === null || customInstagramBasePay === "" ? null : customInstagramBasePay,
        customTiktokBasePay: customTiktokBasePay === null || customTiktokBasePay === "" ? null : customTiktokBasePay,
        updatedAt: new Date(),
      }).where(eq(creators.id, creatorId));

      res.json({ message: "Custom base pay updated" });
    } catch (error) {
      console.error("Update custom base pay error:", error);
      res.status(500).json({ message: "Failed to update custom base pay" });
    }
  });

  // Admin: Pause/unpause creator
  app.put("/api/admin/creators/:id/pause", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Unauthorized" });

      const creatorId = parseInt(req.params.id);
      const [creator] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      const { isPaused } = req.body;
      await db.update(creators).set({
        status: isPaused ? "paused" : "active",
        updatedAt: new Date(),
      }).where(eq(creators.id, creatorId));

      res.json({ message: isPaused ? "Creator paused" : "Creator unpaused" });
    } catch (error) {
      console.error("Pause creator error:", error);
      res.status(500).json({ message: "Failed to update creator status" });
    }
  });

  // Admin: Skip trial for creator
  app.post("/api/admin/creators/:id/skip-trial", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Unauthorized" });

      const creatorId = parseInt(req.params.id);
      const [creator] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      await db.update(creators).set({
        status: "active",
        updatedAt: new Date(),
      }).where(eq(creators.id, creatorId));

      res.json({ message: "Trial skipped, creator is now active" });
    } catch (error) {
      console.error("Skip trial error:", error);
      res.status(500).json({ message: "Failed to skip trial" });
    }
  });

  // Admin: Delete creator (soft delete)
  app.delete("/api/admin/creators/:id", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Unauthorized" });

      const creatorId = parseInt(req.params.id);
      const [creator] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      await db.update(creators).set({
        status: "deleted",
        updatedAt: new Date(),
      }).where(eq(creators.id, creatorId));

      res.json({ message: "Creator deleted" });
    } catch (error) {
      console.error("Delete creator error:", error);
      res.status(500).json({ message: "Failed to delete creator" });
    }
  });

  // Admin: Revive deleted creator
  app.post("/api/admin/creators/:id/revive", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Unauthorized" });

      const creatorId = parseInt(req.params.id);
      const [creator] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      await db.update(creators).set({
        status: "active",
        updatedAt: new Date(),
      }).where(eq(creators.id, creatorId));

      res.json({ message: "Creator revived and is now active" });
    } catch (error) {
      console.error("Revive creator error:", error);
      res.status(500).json({ message: "Failed to revive creator" });
    }
  });

  // Admin: Mark individual payout as paid
  app.post("/api/admin/payouts/:id/mark-paid", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Unauthorized" });

      const payoutId = parseInt(req.params.id);
      const [payout] = await db.select().from(payouts).where(eq(payouts.id, payoutId)).limit(1);
      if (!payout) return res.status(404).json({ message: "Payout not found" });

      await db.update(payouts).set({
        status: "paid",
        paidAt: new Date(),
      }).where(eq(payouts.id, payoutId));

      res.json({ message: "Payout marked as paid" });
    } catch (error) {
      console.error("Mark payout paid error:", error);
      res.status(500).json({ message: "Failed to mark payout as paid" });
    }
  });

  app.post("/api/admin/payouts/:id/unmark-paid", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Unauthorized" });

      const payoutId = parseInt(req.params.id);
      const [payout] = await db.select().from(payouts).where(eq(payouts.id, payoutId)).limit(1);
      if (!payout) return res.status(404).json({ message: "Payout not found" });

      await db.update(payouts).set({
        status: "pending",
        paidAt: null,
      }).where(eq(payouts.id, payoutId));

      res.json({ message: "Payout unmarked as paid" });
    } catch (error) {
      console.error("Unmark payout paid error:", error);
      res.status(500).json({ message: "Failed to unmark payout" });
    }
  });

  // Admin: Update creator PayPal info
  app.put("/api/admin/creators/:id/paypal", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Unauthorized" });

      const creatorId = parseInt(req.params.id);
      const [creator] = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      const { paypalEmail, firstName, lastName } = req.body;
      await db.update(creators).set({
        paypalEmail: paypalEmail || null,
        firstName: firstName || null,
        lastName: lastName || null,
        updatedAt: new Date(),
      }).where(eq(creators.id, creatorId));

      res.json({ message: "PayPal info updated" });
    } catch (error) {
      console.error("Update creator PayPal error:", error);
      res.status(500).json({ message: "Failed to update PayPal info" });
    }
  });

  // Creator: Update PayPal info
  app.put("/api/creator/paypal", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const [creator] = await db.select().from(creators).where(eq(creators.userId, user.id)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      const { paypalEmail: email, firstName: first, lastName: last } = req.body;
      if (!email) return res.status(400).json({ message: "PayPal email is required" });

      await db.update(creators).set({
        paypalEmail: email,
        firstName: first || null,
        lastName: last || null,
        updatedAt: new Date(),
      }).where(eq(creators.id, creator.id));

      res.json({ message: "PayPal info updated" });
    } catch (error) {
      console.error("Update PayPal error:", error);
      res.status(500).json({ message: "Failed to update PayPal info" });
    }
  });

  // Creator: Get trial status
  app.get("/api/creator/trial-status", authenticateToken, async (req: any, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const [creator] = await db.select().from(creators).where(eq(creators.userId, user.id)).limit(1);
      if (!creator) return res.status(404).json({ message: "Creator not found" });

      const allVideos = await db.select().from(videos)
        .where(and(
          eq(videos.creatorId, creator.id),
          eq(videos.isIrrelevant, false)
        ));

      const totalViews = allVideos.reduce((sum, v) => sum + (v.views || 0), 0);
      const viewGoal = 10000;
      const trialDays = 14;
      const trialStartDate = new Date(creator.createdAt);
      const trialEndDate = new Date(trialStartDate);
      trialEndDate.setDate(trialEndDate.getDate() + trialDays);

      const now = new Date();
      const isInTrial = now < trialEndDate;
      const trialCompleted = totalViews >= viewGoal;
      const daysRemaining = Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      res.json({
        trialEndsAt: trialEndDate.toISOString(),
        trialCompleted,
        accountFlagged: false,
        totalViews,
        viewGoal,
        viewsRemaining: Math.max(0, viewGoal - totalViews),
        progressPercent: Math.min(100, (totalViews / viewGoal) * 100),
        daysRemaining,
        isInTrial,
        trialDays,
      });
    } catch (error) {
      console.error("Get trial status error:", error);
      res.status(500).json({ message: "Failed to get trial status" });
    }
  });

}
