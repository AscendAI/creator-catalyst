const BASE_URL = "https://api.scrapecreators.com";

function getApiKey(): string | undefined {
  return process.env.SCRAPCREATORS_API_KEY || process.env.SCRAPECREATORS_API_KEY;
}

export const MAX_VIDEOS_PER_PLATFORM = 100;

const IG_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function instagramPkToShortcode(pk: string | number): string {
  let id = BigInt(pk);
  if (id === 0n) return 'A';
  let shortcode = '';
  while (id > 0n) {
    const remainder = Number(id % 64n);
    id = id / 64n;
    shortcode = IG_ALPHABET[remainder] + shortcode;
  }
  return shortcode;
}

export function isInstagramNumericPk(value: string): boolean {
  return /^\d{10,}$/.test(value);
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest<T>(endpoint: string, params: Record<string, string>): Promise<T | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("SCRAPCREATORS_API_KEY is not set");
    return null;
  }

  const maxRetries = 2;

  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        headers: {
          "x-api-key": apiKey,
        },
      });

      if (!response.ok) {
        console.error(`ScrapeCreators API error (attempt ${attempt + 1}): ${response.status} ${response.statusText} for ${endpoint} params=${JSON.stringify(params)}`);

        if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404) {
          return null;
        }

        if (attempt < maxRetries && (response.status === 429 || response.status >= 500)) {
          const backoffMs = attempt === 0 ? 1500 : 3000;
          console.log(`Retrying in ${backoffMs}ms...`);
          await delay(backoffMs);
          continue;
        }
        return null;
      }

      const data = await response.json();
      console.log(`ScrapeCreators API response for ${endpoint}:`, JSON.stringify(data).substring(0, 500));
      return data as T;
    } catch (error) {
      console.error(`ScrapeCreators API request failed (attempt ${attempt + 1}):`, error);
      if (attempt < maxRetries) {
        const backoffMs = attempt === 0 ? 1500 : 3000;
        console.log(`Retrying in ${backoffMs}ms...`);
        await delay(backoffMs);
        continue;
      }
      return null;
    }
  }
  return null;
}

function extractTikTokVideoList(result: any): any[] {
  if (result.aweme_list) return result.aweme_list;
  if (result.data?.aweme_list) return result.data.aweme_list;
  if (result.data?.videos) return result.data.videos;
  if (result.videos) return result.videos;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result)) return result;
  return [];
}

function extractInstagramReelList(result: any): any[] {
  if (result.items) {
    return result.items.map((item: any) => item.media || item);
  } else if (result.data?.items) {
    return result.data.items.map((item: any) => item.media || item);
  } else if (result.data?.reels) {
    return result.data.reels;
  } else if (result.reels) {
    return result.reels;
  } else if (Array.isArray(result.data)) {
    return result.data;
  } else if (Array.isArray(result)) {
    return result;
  }
  return [];
}

function mapTikTokVideo(video: any) {
  const rawDuration = video.video?.duration || video.duration || 0;
  const duration = rawDuration > 1000 ? Math.round(rawDuration / 1000) : Math.round(rawDuration);

  const coverUrls = video.video?.cover?.url_list || [];
  const dynamicCoverUrls = video.video?.dynamic_cover?.url_list || [];
  const originCoverUrls = video.video?.origin_cover?.url_list || [];
  const allCoverUrls = [...coverUrls, ...dynamicCoverUrls, ...originCoverUrls];

  let thumbnail = allCoverUrls.find((url: string) =>
    url && (url.includes('.jpeg') || url.includes('.jpg') || url.includes('.png') || url.includes('.webp'))
  ) || "";

  if (!thumbnail && allCoverUrls.length > 0) {
    thumbnail = allCoverUrls[0].replace('.heic', '.jpeg').replace('.avif', '.jpeg');
  }

  if (!thumbnail) {
    thumbnail = video.cover_image_url || video.video?.cover || video.cover || video.thumbnail || "";
  }

  const videoFileUrl = video.video?.play_addr?.url_list?.[0] || video.video?.download_addr?.url_list?.[0] || video.video?.play_addr?.uri || video.video_url || "";

  return {
    platformVideoId: video.aweme_id || video.id || video.video_id || "",
    caption: video.desc || video.description || video.title || "",
    videoFileUrl,
    views: Math.round(video.statistics?.play_count || video.stats?.playCount || video.play_count || video.views || 0),
    likes: Math.round(video.statistics?.digg_count || video.stats?.diggCount || video.like_count || video.likes || 0),
    comments: Math.round(video.statistics?.comment_count || video.stats?.commentCount || video.comment_count || video.comments || 0),
    shares: Math.round(video.statistics?.share_count || video.stats?.shareCount || video.share_count || video.shares || 0),
    thumbnail,
    duration,
    postedAt: new Date((video.create_time || video.createTime || Date.now() / 1000) * 1000),
  };
}

function mapInstagramReel(reel: any) {
  return {
    platformVideoId: (() => {
      const code = reel.code || reel.shortcode;
      if (code) return String(code);
      const pk = reel.pk || reel.id || reel.strong_id__;
      if (pk && isInstagramNumericPk(String(pk))) return instagramPkToShortcode(pk);
      return String(pk || "");
    })(),
    caption: reel.caption?.text || reel.caption || "",
    views: Math.round(reel.play_count || reel.view_count || reel.views || reel.video_view_count || 0),
    likes: Math.round(reel.like_count || reel.likes || 0),
    comments: Math.round(reel.comment_count || reel.comments || 0),
    thumbnail: reel.image_versions2?.candidates?.[0]?.url || reel.thumbnail_url || reel.display_url || "",
    videoFileUrl: reel.video_versions?.[0]?.url || reel.video_url || "",
    duration: Math.round(reel.video_duration || reel.duration || 0),
    postedAt: new Date((reel.taken_at || Date.now() / 1000) * 1000),
  };
}

async function fetchTikTokVideosInternal(username: string): Promise<{
  videos: Array<{
    platformVideoId: string;
    caption: string;
    videoFileUrl: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    thumbnail: string;
    duration: number;
    postedAt: Date;
  }>;
  error?: string;
}> {
  let allVideos: any[] = [];
  let cursor: string | undefined = undefined;
  let page = 1;

  while (allVideos.length < MAX_VIDEOS_PER_PLATFORM) {
    const params: Record<string, string> = {
      handle: username,
      amount: "100",
    };
    if (cursor) {
      params.max_cursor = cursor;
    }

    const result = await makeRequest<any>("/v3/tiktok/profile/videos", params);

    if (!result) {
      if (allVideos.length === 0) {
        return { videos: [], error: "Failed to fetch TikTok videos" };
      }
      break;
    }

    const pageVideos = extractTikTokVideoList(result);
    allVideos = allVideos.concat(pageVideos);

    const hasMore = result.has_more === true || result.has_more === 1;
    const nextCursor = result.max_cursor ? String(result.max_cursor) : undefined;

    console.log(`TikTok page ${page}: got ${pageVideos.length} videos, has_more=${hasMore}, cursor=${nextCursor}`);

    if (!hasMore || !nextCursor || pageVideos.length === 0) {
      break;
    }

    if (allVideos.length >= MAX_VIDEOS_PER_PLATFORM) {
      break;
    }

    cursor = nextCursor;
    page++;

    await delay(300);
  }

  const videoList = allVideos.slice(0, MAX_VIDEOS_PER_PLATFORM);
  console.log(`Found ${videoList.length} TikTok videos total (${page} page${page > 1 ? 's' : ''})`);

  if (videoList.length === 0) {
    return { videos: [], error: "No videos found" };
  }

  return {
    videos: videoList.map(mapTikTokVideo),
  };
}

export async function fetchTikTokVideos(username: string, previousVideoCount?: number): Promise<{
  videos: Array<{
    platformVideoId: string;
    caption: string;
    videoFileUrl: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    thumbnail: string;
    duration: number;
    postedAt: Date;
  }>;
  error?: string;
}> {
  const maxSuspiciousRetries = 2;

  for (let attempt = 0; attempt <= maxSuspiciousRetries; attempt++) {
    const result = await fetchTikTokVideosInternal(username);

    if (result.error) return result;

    const fetchedCount = result.videos.length;

    if (
      previousVideoCount !== undefined &&
      previousVideoCount >= 10 &&
      fetchedCount < previousVideoCount * 0.5 &&
      fetchedCount < 5 &&
      attempt < maxSuspiciousRetries
    ) {
      console.log(`TikTok suspicious drop detected for @${username}: had ${previousVideoCount}, got ${fetchedCount}. Retrying...`);
      await delay(2000);
      continue;
    }

    return result;
  }

  return await fetchTikTokVideosInternal(username);
}

export async function fetchInstagramReels(username: string): Promise<{
  reels: Array<{
    platformVideoId: string;
    caption: string;
    views: number;
    likes: number;
    comments: number;
    thumbnail: string;
    videoFileUrl: string;
    duration: number;
    postedAt: Date;
  }>;
  error?: string;
}> {
  let allReels: any[] = [];
  let cursor: string | undefined = undefined;
  let page = 1;

  while (allReels.length < MAX_VIDEOS_PER_PLATFORM) {
    const params: Record<string, string> = {
      handle: username,
      amount: "100",
    };
    if (cursor) {
      params.max_id = cursor;
    }

    const result = await makeRequest<any>("/v1/instagram/user/reels", params);

    if (!result) {
      if (allReels.length === 0) {
        return { reels: [], error: "Failed to fetch Instagram reels" };
      }
      break;
    }

    const pageReels = extractInstagramReelList(result);
    allReels = allReels.concat(pageReels);

    const pagingInfo = result.paging_info || result.data?.paging_info;
    const moreAvailable = pagingInfo?.more_available === true;
    const maxId = pagingInfo?.max_id ? String(pagingInfo.max_id) : undefined;

    console.log(`Instagram page ${page}: got ${pageReels.length} reels, more_available=${moreAvailable}, max_id=${maxId}`);

    if (!moreAvailable || !maxId || pageReels.length === 0) {
      break;
    }

    if (allReels.length >= MAX_VIDEOS_PER_PLATFORM) {
      break;
    }

    cursor = maxId;
    page++;

    await delay(300);
  }

  const reelList = allReels.slice(0, MAX_VIDEOS_PER_PLATFORM);
  console.log(`Found ${reelList.length} Instagram reels total (${page} page${page > 1 ? 's' : ''})`);

  if (reelList.length === 0) {
    return { reels: [], error: "No reels found" };
  }

  return {
    reels: reelList.map(mapInstagramReel),
  };
}

export async function fetchInstagramProfile(username: string): Promise<{
  followers: number;
  following: number;
  posts: number;
  profilePic: string;
  error?: string;
} | null> {
  const result = await makeRequest<any>("/v1/instagram/profile", {
    handle: username,
  });

  if (!result) {
    return null;
  }

  console.log("Instagram profile raw response:", JSON.stringify(result).substring(0, 1500));

  const findFollowerCount = (obj: any): number => {
    if (!obj || typeof obj !== 'object') return 0;
    if (typeof obj.follower_count === 'number') return obj.follower_count;
    if (typeof obj.followers_count === 'number') return obj.followers_count;
    if (typeof obj.edge_followed_by?.count === 'number') return obj.edge_followed_by.count;
    return 0;
  };

  const findFollowingCount = (obj: any): number => {
    if (!obj || typeof obj !== 'object') return 0;
    if (typeof obj.following_count === 'number') return obj.following_count;
    if (typeof obj.followings_count === 'number') return obj.followings_count;
    if (typeof obj.edge_follow?.count === 'number') return obj.edge_follow.count;
    return 0;
  };

  const candidates = [
    result?.data?.user,
    result?.user,
    result?.data,
    result,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const followers = findFollowerCount(candidate);
    const following = findFollowingCount(candidate);
    if (followers > 0 || following > 0) {
      const mediaCount = candidate.media_count ?? candidate.edge_owner_to_timeline_media?.count ?? 0;
      const profilePic = candidate.profile_pic_url ?? candidate.profile_pic_url_hd ?? "";
      console.log(`Instagram profile for @${username} (found at level): followers=${followers}, following=${following}`);
      return {
        followers,
        following,
        posts: mediaCount,
        profilePic,
      };
    }
  }

  const user = result?.data?.user ?? result?.user ?? result?.data ?? result;
  const followerCount = findFollowerCount(user);
  const followingCount = findFollowingCount(user);
  const mediaCount = user?.media_count ?? user?.edge_owner_to_timeline_media?.count ?? 0;
  const profilePic = user?.profile_pic_url ?? user?.profile_pic_url_hd ?? "";
  console.log(`Instagram profile for @${username} (fallback): followers=${followerCount}, following=${followingCount}`);

  return {
    followers: followerCount,
    following: followingCount,
    posts: mediaCount,
    profilePic: profilePic,
  };
}

export async function fetchTikTokProfile(username: string): Promise<{
  followers: number;
  following: number;
  likes: number;
  videos: number;
  profilePic: string;
  error?: string;
} | null> {
  const result = await makeRequest<any>("/v1/tiktok/profile", {
    handle: username,
  });

  if (!result) {
    return null;
  }

  console.log("TikTok profile raw response:", JSON.stringify(result).substring(0, 800));

  const stats = result?.data?.stats ?? result?.stats ?? null;
  const user = result?.data?.user ?? result?.user ?? null;

  if (stats) {
    const followerCount = stats.followerCount ?? stats.follower_count ?? 0;
    const followingCount = stats.followingCount ?? stats.following_count ?? 0;
    const heartCount = stats.heartCount ?? stats.heart_count ?? 0;
    const videoCount = stats.videoCount ?? stats.video_count ?? 0;
    const profilePic = user?.avatarLarger ?? user?.avatar_larger ?? "";
    console.log(`TikTok profile for @${username}: followers=${followerCount}, following=${followingCount}`);
    return {
      followers: followerCount,
      following: followingCount,
      likes: heartCount,
      videos: videoCount,
      profilePic: profilePic,
    };
  }

  console.log(`TikTok profile for @${username}: no stats object found in response`);

  return {
    followers: 0,
    following: 0,
    likes: 0,
    videos: 0,
    profilePic: user?.avatarLarger ?? "",
  };
}
