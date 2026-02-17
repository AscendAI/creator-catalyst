import fs from "fs";
import { parse } from "csv-parse/sync";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function readCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });
}

function cleanTimestamp(val: string | undefined | null): string | null {
  if (!val || val === "" || val === '""') return null;
  const cleaned = val.replace(/^"+|"+$/g, "");
  if (!cleaned) return null;
  return cleaned;
}

function cleanBool(val: string | undefined | null): boolean {
  if (!val) return false;
  return val.replace(/"/g, "").toLowerCase() === "true";
}

function cleanNum(val: string | undefined | null): number | null {
  if (!val || val === "") return null;
  const n = Number(val.replace(/"/g, ""));
  return isNaN(n) ? null : n;
}

function cleanStr(val: string | undefined | null): string | null {
  if (!val || val === "" || val === '""') return null;
  return val.replace(/^"+|"+$/g, "");
}

async function main() {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    const basePath = "/home/runner/workspace/attached_assets";

    const oldUsers = readCSV(`${basePath}/users_(3)_1770984833790.csv`);
    const oldVideos = readCSV(`${basePath}/videos_(1)_1770984833789.csv`);
    const oldCycles = readCSV(`${basePath}/cycles_(1)_1770984833791.csv`);
    const oldPayouts = readCSV(`${basePath}/payouts_(2)_1770984833790.csv`);
    const oldBonusTiers = readCSV(`${basePath}/bonus_tiers_1770984833791.csv`);
    const oldSettings = readCSV(`${basePath}/settings_1770984833790.csv`);
    const oldSupportTickets = readCSV(`${basePath}/support_tickets_1770984833790.csv`);
    const oldViolations = readCSV(`${basePath}/violations_1770984833789.csv`);
    const oldSnapshots = readCSV(`${basePath}/cycle_video_snapshots_1770984833791.csv`);
    const oldAdminViews = readCSV(`${basePath}/admin_creator_views_(1)_1770984833792.csv`);
    const oldSystemSettings = readCSV(`${basePath}/system_settings_1770984833790.csv`);

    console.log(`Users: ${oldUsers.length}, Videos: ${oldVideos.length}, Cycles: ${oldCycles.length}`);
    console.log(`Payouts: ${oldPayouts.length}, BonusTiers: ${oldBonusTiers.length}, Settings: ${oldSettings.length}`);
    console.log(`Violations: ${oldViolations.length}, Snapshots: ${oldSnapshots.length}, AdminViews: ${oldAdminViews.length}`);

    // ===== 1. Import payout settings =====
    console.log("\n--- Importing payout settings ---");
    const settingsMap: Record<string, string> = {};
    for (const s of oldSettings) {
      settingsMap[s.key] = s.value;
    }
    
    await client.query(`
      INSERT INTO payout_settings (base_pay, min_videos_per_week, max_videos_per_day, cycle_duration_days, updated_at)
      VALUES ($1, $2, $3, 14, NOW())
      ON CONFLICT DO NOTHING
    `, [
      settingsMap["basePayPerVideo"] || "10",
      parseInt(settingsMap["minVideosPerWeek"] || "3"),
      parseInt(settingsMap["maxVideosPerDay"] || "2"),
    ]);
    console.log("Payout settings imported");

    // ===== 2. Import bonus tiers =====
    console.log("\n--- Importing bonus tiers ---");
    for (const tier of oldBonusTiers) {
      await client.query(`
        INSERT INTO bonus_tiers (view_threshold, bonus_amount, created_at, updated_at)
        VALUES ($1, $2, $3, $4)
      `, [
        parseInt(tier.view_threshold),
        tier.bonus_amount,
        cleanTimestamp(tier.created_at) || new Date().toISOString(),
        cleanTimestamp(tier.updated_at) || new Date().toISOString(),
      ]);
    }
    console.log(`Imported ${oldBonusTiers.length} bonus tiers`);

    // ===== 3. Import users and creators =====
    console.log("\n--- Importing users and creators ---");
    const userUuidToId: Record<string, number> = {};
    const creatorUuidToId: Record<string, number> = {};

    for (const u of oldUsers) {
      const email = u.email;
      const passwordHash = u.password_hash;
      const role = u.role;
      const emailVerified = cleanBool(u.email_verified);
      const createdAt = cleanTimestamp(u.created_at) || new Date().toISOString();

      const userResult = await client.query(`
        INSERT INTO users (email, password, role, email_verified, created_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [email, passwordHash, role, emailVerified, createdAt]);
      
      const newUserId = userResult.rows[0].id;
      userUuidToId[u.id] = newUserId;

      if (role === "creator") {
        const igUsername = cleanStr(u.instagram_username);
        const ttUsername = cleanStr(u.tiktok_username);
        const paypalEmail = cleanStr(u.paypal_email);
        const firstName = cleanStr(u.first_name);
        const lastName = cleanStr(u.last_name);
        const isPaused = cleanBool(u.is_paused);
        const isDeleted = cleanBool(u.is_deleted);
        const customIgBasePay = cleanNum(u.custom_instagram_base_pay);
        const customTtBasePay = cleanNum(u.custom_tiktok_base_pay);
        const igFollowers = cleanNum(u.instagram_followers);
        const ttFollowers = cleanNum(u.tiktok_followers);
        const igLastSync = cleanTimestamp(u.instagram_last_sync_at);
        const refreshCount = cleanNum(u.refresh_count_today) || 0;

        let status = "active";
        if (isDeleted) status = "deleted";
        else if (isPaused) status = "paused";

        const name = [firstName, lastName].filter(Boolean).join(" ") || igUsername || ttUsername || email.split("@")[0];

        const creatorResult = await client.query(`
          INSERT INTO creators (
            user_id, name, email, instagram_username, tiktok_username,
            instagram_connected, tiktok_connected,
            instagram_followers, tiktok_followers,
            paypal_email, first_name, last_name, status,
            custom_instagram_base_pay, custom_tiktok_base_pay,
            last_sync_at, daily_sync_count, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          RETURNING id
        `, [
          newUserId, name, email, igUsername, ttUsername,
          !!igUsername, !!ttUsername,
          igFollowers || 0, ttFollowers || 0,
          paypalEmail, firstName, lastName, status,
          customIgBasePay, customTtBasePay,
          igLastSync, refreshCount,
          createdAt, igLastSync || createdAt,
        ]);

        creatorUuidToId[u.id] = creatorResult.rows[0].id;
        console.log(`  User+Creator: ${email} (${u.id} → user:${newUserId}, creator:${creatorResult.rows[0].id})`);
      } else {
        console.log(`  Admin user: ${email} (${u.id} → user:${newUserId})`);
      }
    }

    // ===== 4. Import payout cycles =====
    console.log("\n--- Importing payout cycles ---");
    const cycleUuidToId: Record<string, number> = {};

    for (const c of oldCycles) {
      const startDate = cleanTimestamp(c.start_date)!;
      const endDate = cleanTimestamp(c.end_date)!;
      const isPaid = cleanBool(c.is_paid);
      const paidAt = cleanTimestamp(c.paid_at);
      const basePayPerVideo = cleanNum(c.base_pay_per_video);
      const bonusPayPer100k = cleanNum(c.bonus_pay_per_100k_views);
      const bonusViewThreshold = cleanNum(c.bonus_view_threshold);
      const snapshotsCreated = cleanBool(c.snapshots_created);
      const bonusTiersSnapshot = cleanStr(c.bonus_tiers_snapshot);

      const cycleResult = await client.query(`
        INSERT INTO payout_cycles (
          start_date, end_date, status, paid_at,
          base_pay_per_video, bonus_pay_per_100k_views, bonus_view_threshold,
          snapshots_created, bonus_tiers_snapshot,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id
      `, [
        startDate, endDate, isPaid ? "paid" : "pending", paidAt,
        basePayPerVideo, bonusPayPer100k, bonusViewThreshold,
        snapshotsCreated, bonusTiersSnapshot,
      ]);

      cycleUuidToId[c.id] = cycleResult.rows[0].id;
      console.log(`  Cycle: ${startDate} to ${endDate} (${c.id} → ${cycleResult.rows[0].id})`);
    }

    // ===== 5. Import videos =====
    console.log("\n--- Importing videos ---");
    const videoUuidToId: Record<string, number> = {};
    let videoCount = 0;
    let videoSkipped = 0;

    for (const v of oldVideos) {
      const creatorId = creatorUuidToId[v.creator_id];
      if (!creatorId) {
        videoSkipped++;
        continue;
      }

      const platform = v.platform;
      const platformVideoId = v.platform_video_id;
      const url = v.url;
      const caption = v.caption;
      const postedAt = cleanTimestamp(v.timestamp);
      const views = cleanNum(v.views) || 0;
      const likes = cleanNum(v.likes) || 0;
      const comments = cleanNum(v.comments) || 0;
      const isIrrelevant = cleanBool(v.is_irrelevant);
      const thumbnailUrl = cleanStr(v.thumbnail_url);
      const thumbnailHash = cleanStr(v.thumbnail_hash);
      const duration = cleanNum(v.duration);
      const isBonus = cleanBool(v.is_bonus);

      const videoResult = await client.query(`
        INSERT INTO videos (
          creator_id, platform, video_id, platform_video_id,
          caption, thumbnail_url, thumbnail, duration,
          views, likes, comments,
          posted_at, is_irrelevant,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        RETURNING id
      `, [
        creatorId, platform, platformVideoId || v.id, platformVideoId,
        caption, thumbnailUrl, thumbnailHash, duration,
        views, likes, comments,
        postedAt, isIrrelevant,
      ]);

      videoUuidToId[v.id] = videoResult.rows[0].id;
      videoCount++;

      if (videoCount % 200 === 0) {
        console.log(`  ... imported ${videoCount} videos`);
      }
    }
    console.log(`Imported ${videoCount} videos (skipped ${videoSkipped})`);

    // ===== 6. Import payouts =====
    console.log("\n--- Importing payouts ---");
    let payoutCount = 0;

    for (const p of oldPayouts) {
      const creatorId = creatorUuidToId[p.creator_id];
      if (!creatorId) continue;

      const cycleId = p.cycle_id ? cycleUuidToId[p.cycle_id] : null;
      const baseAmount = cleanNum(p.base_amount) || 0;
      const bonusAmount = cleanNum(p.bonus_amount) || 0;
      const totalAmount = cleanNum(p.total_amount) || 0;
      const paidAt = cleanTimestamp(p.paid_at);
      const paymentMethod = cleanStr(p.payment_method);
      const notes = cleanStr(p.notes);

      const cycleRow = cycleId ? (await client.query("SELECT start_date, end_date FROM payout_cycles WHERE id = $1", [cycleId])).rows[0] : null;
      const periodStart = cycleRow ? cycleRow.start_date : new Date("2026-01-01");
      const periodEnd = cycleRow ? cycleRow.end_date : new Date("2026-01-14");

      await client.query(`
        INSERT INTO payouts (
          creator_id, cycle_id, amount, status,
          period_start, period_end, paid_at, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        creatorId, cycleId, totalAmount.toFixed(2),
        paidAt ? "paid" : "pending",
        periodStart, periodEnd, paidAt, notes,
      ]);
      payoutCount++;
    }
    console.log(`Imported ${payoutCount} payouts`);

    // ===== 7. Import violations =====
    console.log("\n--- Importing violations ---");
    let violationCount = 0;

    for (const v of oldViolations) {
      const creatorId = creatorUuidToId[v.creator_id];
      if (!creatorId) continue;

      const date = cleanTimestamp(v.date);
      if (!date) continue;

      await client.query(`
        INSERT INTO violations (creator_id, date, type, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [creatorId, date, v.type]);
      violationCount++;
    }
    console.log(`Imported ${violationCount} violations`);

    // ===== 8. Import support tickets =====
    console.log("\n--- Importing support tickets ---");
    let ticketCount = 0;

    for (const t of oldSupportTickets) {
      const creatorId = creatorUuidToId[t.creator_id];
      if (!creatorId) continue;

      const createdAt = cleanTimestamp(t.created_at) || new Date().toISOString();
      const resolvedAt = t.status === "resolved" ? (cleanTimestamp(t.updated_at) || createdAt) : null;

      await client.query(`
        INSERT INTO support_tickets (creator_id, subject, message, status, created_at, resolved_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [creatorId, t.subject, t.message, t.status, createdAt, resolvedAt]);
      ticketCount++;
    }
    console.log(`Imported ${ticketCount} support tickets`);

    // ===== 9. Import cycle video snapshots =====
    console.log("\n--- Importing cycle video snapshots ---");
    let snapshotCount = 0;
    let snapshotSkipped = 0;

    for (const s of oldSnapshots) {
      const cycleId = cycleUuidToId[s.cycle_id];
      const creatorId = creatorUuidToId[s.creator_id];
      if (!cycleId || !creatorId) {
        snapshotSkipped++;
        continue;
      }

      const videoId = s.video_id ? videoUuidToId[s.video_id] : null;

      await client.query(`
        INSERT INTO cycle_video_snapshots (
          cycle_id, video_id, creator_id, platform, platform_video_id,
          url, caption, timestamp, views, likes, comments,
          is_irrelevant, is_eligible, base_pay_per_video,
          bonus_pay_per_100k_views, bonus_view_threshold,
          thumbnail_url, thumbnail_hash, duration, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      `, [
        cycleId, videoId, creatorId, s.platform, s.platform_video_id,
        s.url, s.caption, cleanTimestamp(s.timestamp), cleanNum(s.views) || 0,
        cleanNum(s.likes) || 0, cleanNum(s.comments) || 0,
        cleanBool(s.is_irrelevant), cleanBool(s.is_eligible),
        cleanNum(s.base_pay_per_video), cleanNum(s.bonus_pay_per_100k_views),
        cleanNum(s.bonus_view_threshold),
        cleanStr(s.thumbnail_url), cleanStr(s.thumbnail_hash),
        cleanNum(s.duration),
        cleanTimestamp(s.created_at) || new Date().toISOString(),
      ]);
      snapshotCount++;

      if (snapshotCount % 100 === 0) {
        console.log(`  ... imported ${snapshotCount} snapshots`);
      }
    }
    console.log(`Imported ${snapshotCount} snapshots (skipped ${snapshotSkipped})`);

    // ===== 10. Import admin creator views =====
    console.log("\n--- Importing admin creator views ---");
    let viewCount = 0;

    for (const v of oldAdminViews) {
      const adminId = userUuidToId[v.admin_id];
      const creatorId = creatorUuidToId[v.creator_id];
      if (!adminId || !creatorId) continue;

      const viewedAt = cleanTimestamp(v.viewed_at) || new Date().toISOString();

      await client.query(`
        INSERT INTO admin_creator_views (admin_id, creator_id, viewed_at)
        VALUES ($1, $2, $3)
      `, [adminId, creatorId, viewedAt]);
      viewCount++;
    }
    console.log(`Imported ${viewCount} admin creator views`);

    // ===== 11. Import system settings =====
    console.log("\n--- Importing system settings ---");
    for (const s of oldSystemSettings) {
      await client.query(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ($1, $2, $3)
      `, [s.key, s.value, cleanTimestamp(s.updated_at) || new Date().toISOString()]);
    }
    console.log(`Imported ${oldSystemSettings.length} system settings`);

    await client.query("COMMIT");
    console.log("\n=== IMPORT COMPLETE ===");
    console.log(`Users: ${Object.keys(userUuidToId).length}`);
    console.log(`Creators: ${Object.keys(creatorUuidToId).length}`);
    console.log(`Cycles: ${Object.keys(cycleUuidToId).length}`);
    console.log(`Videos: ${videoCount}`);
    console.log(`Payouts: ${payoutCount}`);
    console.log(`Violations: ${violationCount}`);
    console.log(`Snapshots: ${snapshotCount}`);
    console.log(`Admin Views: ${viewCount}`);

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Import failed, rolled back:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
