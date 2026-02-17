import { useMemo, useState, useRef, useCallback } from "react";

const IG_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function pkToShortcode(pk: string): string {
  let id = BigInt(pk);
  if (id === 0n) return 'A';
  let sc = '';
  while (id > 0n) {
    const r = Number(id % 64n);
    id = id / 64n;
    sc = IG_ALPHABET[r] + sc;
  }
  return sc;
}

function resolveInstagramId(videoId: string): string {
  if (/^\d{10,}$/.test(videoId)) return pkToShortcode(videoId);
  return videoId;
}

interface VideoEmbedProps {
  platform: string;
  platformVideoId: string;
  username?: string;
  videoFileUrl?: string;
  thumbnailUrl?: string;
  small?: boolean;
}

export function VideoEmbed({ platform, platformVideoId, username, videoFileUrl, thumbnailUrl, small }: VideoEmbedProps) {
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play();
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  }, []);

  const embedUrl = useMemo(() => {
    if (platform === "tiktok") {
      return `https://www.tiktok.com/embed/v2/${platformVideoId}`;
    }
    return null;
  }, [platform, platformVideoId]);

  const instagramSrcdoc = useMemo(() => {
    if (platform !== "instagram") return "";
    const igId = resolveInstagramId(platformVideoId);
    const permalink = `https://www.instagram.com/reel/${igId}/?utm_source=ig_embed&utm_campaign=embed_video_watch_again`;
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;justify-content:center;background:#000;overflow:hidden}</style>
</head><body>
<blockquote class="instagram-media" data-instgrm-permalink="${permalink}" data-instgrm-version="14"
style="max-width:540px;min-width:250px;width:100%;background:#000;border:0;border-radius:0;padding:0;margin:0">
<a href="${permalink}" target="_blank" style="color:#3897f0;font-family:Arial,sans-serif;font-size:14px;padding:16px;display:block;text-align:center">View on Instagram</a>
</blockquote>
<script async src="//www.instagram.com/embed.js"><\/script>
<script>
window.addEventListener('load', function() {
  setTimeout(function() {
    if (window.instgrm) window.instgrm.Embeds.process();
  }, 300);
});
<\/script>
</body></html>`;
  }, [platform, platformVideoId]);

  const iframeStyle = {
    height: small ? "100%" : "700px",
    maxHeight: small ? "none" : "80vh",
  };

  if (videoFileUrl && !videoError) {
    return (
      <div className="relative w-full h-full" style={iframeStyle}>
        <video
          ref={videoRef}
          src={videoFileUrl}
          poster={thumbnailUrl}
          autoPlay
          playsInline
          loop
          disablePictureInPicture
          className="w-full h-full object-cover"
          onError={() => setVideoError(true)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-10"
        >
          {!isPlaying && (
            <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
              <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-white border-b-[10px] border-b-transparent ml-1" />
            </div>
          )}
        </button>
      </div>
    );
  }

  if (platform === "tiktok" && embedUrl) {
    return (
      <iframe
        src={embedUrl}
        className="w-full border-0"
        style={iframeStyle}
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
      />
    );
  }

  if (platform === "instagram" && instagramSrcdoc) {
    return (
      <iframe
        srcDoc={instagramSrcdoc}
        className="w-full border-0"
        style={iframeStyle}
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation"
      />
    );
  }

  return null;
}
