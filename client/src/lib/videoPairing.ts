import type { Video } from "@shared/schema";

export function getDateKey(timestamp: string | Date | null): string {
  if (!timestamp) return "unknown";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "unknown";
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

export function isWithin36Hours(date1: Date | null, date2: Date | null): boolean {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  
  const timeDiff = Math.abs(d1.getTime() - d2.getTime());
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  return hoursDiff <= 24;
}

export function calculateHammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length || hash1.length !== 16) return Infinity;
  try {
    const xor = BigInt('0x' + hash1) ^ BigInt('0x' + hash2);
    let distance = 0;
    let val = xor;
    const zero = BigInt(0);
    const one = BigInt(1);
    while (val > zero) {
      distance += Number(val & one);
      val >>= one;
    }
    return distance;
  } catch {
    return Infinity;
  }
}

export function areThumbnailsSimilar(hash1: string | null | undefined, hash2: string | null | undefined, threshold: number = 12): boolean {
  if (!hash1 || !hash2) return false;
  return calculateHammingDistance(hash1, hash2) <= threshold;
}

export interface PairedVideoRow {
  id: string;
  date: Date;
  caption: string;
  ig: Video | null;
  tiktok: Video | null;
  matchType: "duration" | "thumbnail" | "none";
  winnerPlatform: "instagram" | "tiktok" | null;
}

function getVideoDate(v: any): Date | null {
  const raw = v.timestamp || v.postedAt;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export function buildPairedVideoRows(videos: Video[]): PairedVideoRow[] {
  const igVideos = videos.filter(v => v.platform === "instagram");
  const tiktokVideos = videos.filter(v => v.platform === "tiktok");
  const usedTiktokIds = new Set<number>();
  const rows: PairedVideoRow[] = [];

  for (const ig of igVideos) {
    let bestMatch: Video | null = null;
    let bestDurationDiff = Infinity;
    let bestTimeDiff = Infinity;
    let matchType: "duration" | "thumbnail" | "none" = "none";

    const igDate = getVideoDate(ig);
    if (!igDate) continue;
    const igTimestamp = igDate.getTime();
    const igDuration = ig.duration;
    if (igDuration != null) {
      for (const tt of tiktokVideos) {
        if (usedTiktokIds.has(tt.id)) continue;
        const ttDate = getVideoDate(tt);
        if (!ttDate || !isWithin36Hours(igDate, ttDate)) continue;
        const ttDuration = tt.duration;
        if (ttDuration == null) continue;
        
        const durationDiff = Math.abs(igDuration - ttDuration);
        const timeDiff = Math.abs(igTimestamp - ttDate.getTime());
        if (durationDiff <= 1 && (durationDiff < bestDurationDiff || (durationDiff === bestDurationDiff && timeDiff < bestTimeDiff))) {
          bestDurationDiff = durationDiff;
          bestTimeDiff = timeDiff;
          bestMatch = tt;
          matchType = "duration";
        }
      }
    }

    if (!bestMatch) {
      for (const tt of tiktokVideos) {
        if (usedTiktokIds.has(tt.id)) continue;
        if (!isWithin36Hours(igDate, getVideoDate(tt))) continue;
        
        if (areThumbnailsSimilar((ig as any).thumbnailHash || ig.thumbnail, (tt as any).thumbnailHash || tt.thumbnail)) {
          bestMatch = tt;
          matchType = "thumbnail";
          break;
        }
      }
    }

    if (bestMatch) {
      usedTiktokIds.add(bestMatch.id);
    }

    let winnerPlatform: "instagram" | "tiktok" | null = null;
    if (bestMatch) {
      const igViews = ig.views || 0;
      const ttViews = bestMatch?.views || 0;
      
      if (igViews >= ttViews) {
        winnerPlatform = "instagram";
      } else {
        winnerPlatform = "tiktok";
      }
    } else {
      winnerPlatform = "instagram";
    }

    const rowDate = getVideoDate(ig) || new Date();
    
    rows.push({
      id: `pair-${ig.id}`,
      date: rowDate,
      caption: ig.caption || "No caption",
      ig,
      tiktok: bestMatch,
      matchType: bestMatch ? matchType : "none",
      winnerPlatform,
    });
  }

  for (const tt of tiktokVideos) {
    if (usedTiktokIds.has(tt.id)) continue;
    const ttRowDate = getVideoDate(tt) || new Date();
    
    rows.push({
      id: `pair-${tt.id}`,
      date: ttRowDate,
      caption: tt.caption || "No caption",
      ig: null,
      tiktok: tt,
      matchType: "none",
      winnerPlatform: "tiktok",
    });
  }

  return rows;
}
