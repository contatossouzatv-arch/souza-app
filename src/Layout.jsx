import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Newspaper, Trophy, Wallet, User, Settings } from "lucide-react";
import DataRefresher from "./components/DataRefresher";
import NotificationListener from "./components/NotificationListener";
import ErrorBoundary from "./components/ErrorBoundary";
import { useAuth } from "@/lib/AuthContext";
import PlatformMigrationModal from "./components/PlatformMigrationModal";
import PhoneAlert from "./components/PhoneAlert";
import SocialMediaBar from "./components/SocialMediaBar";
import DailyChestEntry from "./components/DailyChestEntry";
import { DAILY_CHEST_ROUTE_PATH, FEATURE_FLAGS, MAIN_GAME_ROUTE_PATH } from "@/lib/featureFlags";
import mainMenuClickSound from "../assets-para-app/Songs/Song click menu principal.mp3";
import { isMenuSoundEnabled } from "@/lib/soundPrefs";

const routePreloaders = {
  [createPageUrl("Home")]: () => import("@/pages/Home"),
  [createPageUrl("Dashboard")]: () => import("@/pages/Dashboard"),
  [createPageUrl("Deposits")]: () => import("@/pages/Deposits"),
  [createPageUrl("Profile")]: () => import("@/pages/Profile"),
  [createPageUrl("Settings")]: () => import("@/pages/Settings"),
  [createPageUrl("AdminPanel")]: () => import("@/pages/AdminPanel"),
  [DAILY_CHEST_ROUTE_PATH]: () => import("@/pages/DailyChestHub"),
};

const navItems = [
  {
    label: "INICIO",
    path: createPageUrl("Home"),
    icon: Newspaper,
    match: [createPageUrl("Home")],
  },
  {
    label: "PRÊMIOS",
    path: createPageUrl("Dashboard"),
    icon: Trophy,
    match: ["/", createPageUrl("Dashboard")],
  },
  {
    label: "DEPOSITOS",
    path: createPageUrl("Deposits"),
    icon: Wallet,
    match: [createPageUrl("Deposits")],
  },
  {
    label: "PERFIL",
    path: createPageUrl("Profile"),
    icon: User,
    match: [createPageUrl("Profile")],
  },
  {
    label: "AJUSTES",
    path: createPageUrl("Settings"),
    icon: Settings,
    match: [createPageUrl("Settings")],
  },
];

export default function Layout({ children }) {
  const { user, checkAppState } = useAuth();
  const location = useLocation();
  const menuClickAudioRef = React.useRef(null);
  const [platformModalVisible, setPlatformModalVisible] = React.useState(false);
  const enableBlockingOverlays = import.meta.env.VITE_ENABLE_BLOCKING_OVERLAYS !== "false";
  const pathname = String(location.pathname || "").toLowerCase();
  const isAdminPanel = pathname === createPageUrl("AdminPanel");
  const isMainGamePage = pathname === MAIN_GAME_ROUTE_PATH;
  const isDailyChestPage = pathname === DAILY_CHEST_ROUTE_PATH;
  const showDailyChestEntry =
    FEATURE_FLAGS.DAILY_CHEST_3D_ENABLED && !isAdminPanel && !isMainGamePage && !isDailyChestPage;

  React.useEffect(() => {
    const audio = new Audio(mainMenuClickSound);
    audio.preload = "auto";
    menuClickAudioRef.current = audio;
    return () => {
      menuClickAudioRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (!FEATURE_FLAGS.GAME_MAIN_ENABLED) return undefined;

    let cancelled = false;
    const idleScheduler = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 180));
    const idleHandle = idleScheduler(() => {
      import("@/lib/mainGameWarmup")
        .then(({ warmMainGameEntryMedia }) => {
          if (!cancelled) {
            warmMainGameEntryMedia();
          }
        })
        .catch(() => {});
    });

    import("@/lib/mainGameWarmup")
      .then(({ warmMainGameAppShell }) => {
        if (!cancelled) {
          warmMainGameAppShell();
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === "function" && typeof idleHandle === "number") {
        window.cancelIdleCallback(idleHandle);
        return;
      }
      window.clearTimeout(idleHandle);
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const idleScheduler = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 180));
    const idleHandle = idleScheduler(() => {
      Object.values(routePreloaders).forEach((preload) => {
        Promise.resolve()
          .then(() => preload())
          .catch(() => {});
      });
    });

    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === "function" && typeof idleHandle === "number") {
        window.cancelIdleCallback(idleHandle);
        return;
      }
      if (!cancelled) return;
      window.clearTimeout(idleHandle);
    };
  }, []);

  const playMenuClickSound = () => {
    if (!isMenuSoundEnabled()) return;
    const audio = menuClickAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const preloadRoute = React.useCallback((path) => {
    const preload = routePreloaders[path];
    if (!preload) return;
    preload().catch(() => {});
  }, []);

  const handleFieldFocus = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const isFormField =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable;

    if (!isFormField) return;

    const centerField = () => {
      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    };

    centerField();
    setTimeout(centerField, 120);
    setTimeout(centerField, 260);
  };

  return (
    <ErrorBoundary>
      <DataRefresher />
      <NotificationListener />
      {enableBlockingOverlays && user ? (
        <PlatformMigrationModal
          user={user}
          onVisibilityChange={setPlatformModalVisible}
          onConfirmed={checkAppState}
        />
      ) : null}
      {enableBlockingOverlays && user ? (
        <PhoneAlert user={user} onUpdate={checkAppState} platformModalVisible={platformModalVisible} />
      ) : null}
      <div className="min-h-screen bg-slate-950 text-white">
        {showDailyChestEntry ? <DailyChestEntry onPress={playMenuClickSound} /> : null}
        <main
            data-app-scroll-root="true"
            onFocusCapture={handleFieldFocus}
            className={`hide-scrollbar h-[calc(100dvh-4.5rem)] overflow-y-auto w-full pb-28 ${
            showDailyChestEntry ? "pt-28" : "pt-4"
            } ${isAdminPanel ? "px-3 sm:px-4" : "mx-auto max-w-md px-3 sm:px-4"}`}
          >
          {children}

          {!isAdminPanel ? (
            <div className="mt-6">
              <SocialMediaBar />
            </div>
          ) : null}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-md items-center justify-between px-2 py-2 sm:px-3">
            {navItems.map((item) => {
              const isActive = item.match.includes(location.pathname);
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={() => {
                    preloadRoute(item.path);
                    playMenuClickSound();
                  }}
                  onMouseEnter={() => preloadRoute(item.path)}
                  onTouchStart={() => preloadRoute(item.path)}
                  onFocus={() => preloadRoute(item.path)}
                  className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-semibold tracking-wide transition-all sm:text-[10px] ${
                    isActive
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </ErrorBoundary>
  );
}
