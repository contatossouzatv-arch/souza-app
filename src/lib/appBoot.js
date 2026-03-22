import mainMenuClickSound from "../../assets-para-app/Songs/Song click menu principal.mp3";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

const modulePromiseCache = new Map();
const audioPromiseCache = new Map();

function warmModule(cacheKey, importer) {
  const key = String(cacheKey || "").trim();
  if (!key || typeof importer !== "function") return Promise.resolve(null);
  if (modulePromiseCache.has(key)) return modulePromiseCache.get(key);
  const promise = Promise.resolve()
    .then(() => importer())
    .catch(() => null);
  modulePromiseCache.set(key, promise);
  return promise;
}

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

export function warmAppShell() {
  Promise.allSettled([
    warmModule("layout", () => import("../Layout.jsx")),
    warmModule("dashboard", () => import("../pages/Dashboard")),
    warmModule("home", () => import("../pages/Home")),
    warmModule("deposits", () => import("../pages/Deposits")),
    warmModule("profile", () => import("../pages/Profile")),
    warmModule("settings", () => import("../pages/Settings")),
    warmModule("login", () => import("../pages/Login")),
    warmModule("login-2fa", () => import("../pages/LoginTwoFactor")),
    warmModule("onboarding", () => import("../pages/Onboarding")),
    warmAudio(mainMenuClickSound),
    ...(FEATURE_FLAGS.GAME_MAIN_ENABLED
      ? [import("@/lib/mainGameWarmup").then(({ warmMainGameAppShell }) => warmMainGameAppShell())]
      : []),
  ]).catch(() => {});
  return Promise.resolve();
}
