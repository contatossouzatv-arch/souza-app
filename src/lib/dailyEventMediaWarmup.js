const warmedAssetUrls = new Set();
const warmVideoCache = new Map();

function ensureVideoElement(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url) return null;
  let entry = warmVideoCache.get(url);
  if (entry?.video) return entry.video;

  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.src = url;
  video.load();
  warmVideoCache.set(url, { video, primed: false });
  return video;
}

function ensurePreloadLink(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url || warmedAssetUrls.has(url) || typeof document === "undefined") return;
  warmedAssetUrls.add(url);
}

export function warmVideoAsset(rawUrl) {
  if (typeof document === "undefined") return null;
  const url = String(rawUrl || "").trim();
  if (!url) return null;
  ensurePreloadLink(url);
  return ensureVideoElement(url);
}

export function primeVideoPlayback(rawUrl) {
  const video = warmVideoAsset(rawUrl);
  if (!video) return;
  const cacheEntry = warmVideoCache.get(String(rawUrl || "").trim());
  if (!cacheEntry || cacheEntry.primed) return;
  cacheEntry.primed = true;
  const playPromise = video.play();
  if (playPromise && typeof playPromise.then === "function") {
    playPromise
      .then(() => {
        video.pause();
        video.currentTime = 0;
      })
      .catch(() => {
        cacheEntry.primed = false;
      });
  }
}

export function warmDailyEventMedia(assetUrls) {
  if (!Array.isArray(assetUrls)) return;
  assetUrls.forEach((url) => {
    warmVideoAsset(url);
  });
}
