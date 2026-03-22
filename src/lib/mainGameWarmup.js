import appOpenLogoSound from "../../assets-para-app/Songs/Song logo ao abrir o jogo.mp3";
import gameplayMusicSound from "../../assets-para-app/Songs/Musica Durante o Jogo Gameplay.mp3";
import premiumRewardCollectSound from "../../assets-para-app/Songs/Song Coleta de Bau que da mais dinheiro.mp3";
import moneyRainPickupSound from "../../assets-para-app/Songs/Song pegando o dinheiro jogado pelo carro.mp3";

const audioPromiseCache = new Map();

function warmAudio(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url || typeof Audio === "undefined") return Promise.resolve(false);
  if (audioPromiseCache.has(url)) return audioPromiseCache.get(url);
  const promise = new Promise((resolve) => {
    const audio = new Audio();
    const finish = (ok) => {
      audio.removeEventListener("canplaythrough", handleReady);
      audio.removeEventListener("loadeddata", handleReady);
      audio.removeEventListener("error", handleError);
      resolve(ok);
    };
    const handleReady = () => finish(true);
    const handleError = () => finish(false);
    audio.preload = "auto";
    audio.src = url;
    audio.addEventListener("canplaythrough", handleReady, { once: true });
    audio.addEventListener("loadeddata", handleReady, { once: true });
    audio.addEventListener("error", handleError, { once: true });
    audio.load();
    window.setTimeout(() => finish(true), 1200);
  });
  audioPromiseCache.set(url, promise);
  return promise;
}

export async function warmMainGameAppShell() {
  const [{ warmDailyEventAppShell }] = await Promise.all([
    import("@/lib/dailyEventBoot"),
    warmAudio(appOpenLogoSound),
    warmAudio(gameplayMusicSound),
    warmAudio(premiumRewardCollectSound),
    warmAudio(moneyRainPickupSound),
  ]);

  return warmDailyEventAppShell();
}

export async function warmMainGameEntryMedia() {
  const [{ DAILY_EVENT_BOOT_VIDEO_URLS }, { primeVideoPlayback, warmDailyEventMedia }] = await Promise.all([
    import("@/lib/dailyEventBoot"),
    import("@/lib/dailyEventMediaWarmup"),
  ]);

  warmDailyEventMedia(DAILY_EVENT_BOOT_VIDEO_URLS);
  DAILY_EVENT_BOOT_VIDEO_URLS.forEach((url) => primeVideoPlayback(url));
}
