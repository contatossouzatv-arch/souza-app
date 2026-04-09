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
import { DAILY_CHEST_ROUTE_PATH, FEATURE_FLAGS } from "@/lib/featureFlags";
import mainMenuClickSound from "../assets-para-app/Songs/Song click menu principal.mp3";
import { isMenuSoundEnabled } from "@/lib/soundPrefs";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

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
  const { user, checkAppState, isLoadingAuth } = useAuth();
  const location = useLocation();
  const menuClickAudioRef = React.useRef(null);
  const [platformModalVisible, setPlatformModalVisible] = React.useState(false);
  const isAdminUser = user?.role === "admin";
  const depositsPath = createPageUrl("Deposits");
  const enableBlockingOverlays = import.meta.env.VITE_ENABLE_BLOCKING_OVERLAYS !== "false";
  const pathname = String(location.pathname || "").toLowerCase();
  const isAdminPanel = pathname === createPageUrl("AdminPanel");
  const isDailyChestPage = pathname === DAILY_CHEST_ROUTE_PATH;
  const [isDailyChestLoadReady, setIsDailyChestLoadReady] = React.useState(false);
  const shouldLoadDailyChestState =
    isDailyChestLoadReady &&
    !isLoadingAuth &&
    isAdminUser &&
    Boolean(user?.id) &&
    (
      pathname === createPageUrl("Home").toLowerCase() ||
      pathname === createPageUrl("Dashboard").toLowerCase()
    );
  const { data: chestStateForLayout } = useQuery({
    queryKey: ["daily-chest-state"],
    queryFn: () => base44.dailyChest.getState(),
    enabled: FEATURE_FLAGS.DAILY_CHEST_3D_ENABLED && isAdminUser && Boolean(user?.id) && !isLoadingAuth,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const showDailyChestEntry =
    FEATURE_FLAGS.DAILY_CHEST_3D_ENABLED &&
    isAdminUser &&
    !isAdminPanel &&
    !isDailyChestPage &&
    chestStateForLayout?.enabled !== false;
  const hideBottomNav = isDailyChestPage;

  React.useEffect(() => {
    setIsDailyChestLoadReady(false);
    if (
      isLoadingAuth ||
      !isAdminUser ||
      !user?.id ||
      !(
        pathname === createPageUrl("Home").toLowerCase() ||
        pathname === createPageUrl("Dashboard").toLowerCase()
      )
    ) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setIsDailyChestLoadReady(true);
    }, 1800);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isAdminUser, isLoadingAuth, pathname, user?.id]);

  React.useEffect(() => {
    const audio = new Audio(mainMenuClickSound);
    audio.preload = "auto";
    menuClickAudioRef.current = audio;
    return () => {
      menuClickAudioRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const likelyNextRoutes = navItems
      .map((item) => item.path)
      .filter((path) => isAdminUser || path === depositsPath)
      .filter((path) => path && path !== location.pathname)
      .slice(0, 2);
    const idleScheduler = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 600));
    const idleHandle = idleScheduler(() => {
      likelyNextRoutes.forEach((path) => {
        const preload = routePreloaders[path];
        if (!preload) return;
        Promise.resolve()
          .then(() => preload())
          .catch(() => {});
      });
    });

    return () => {
      if (typeof window.cancelIdleCallback === "function" && typeof idleHandle === "number") {
        window.cancelIdleCallback(idleHandle);
        return;
      }
      window.clearTimeout(idleHandle);
    };
  }, [depositsPath, isAdminUser, location.pathname]);

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
    <ErrorBoundary resetKey={`${location.pathname}${location.search}`}>
      <DataRefresher />
      <NotificationListener />
      {enableBlockingOverlays && user && isAdminUser ? (
        <PlatformMigrationModal
          user={user}
          onVisibilityChange={setPlatformModalVisible}
          onConfirmed={checkAppState}
        />
      ) : null}
      {enableBlockingOverlays && user && isAdminUser ? (
        <PhoneAlert user={user} onUpdate={checkAppState} platformModalVisible={platformModalVisible} />
      ) : null}
      <div className="min-h-screen bg-slate-950 text-white">
        {showDailyChestEntry ? (
          <DailyChestEntry onPress={playMenuClickSound} loadState={shouldLoadDailyChestState} />
        ) : null}
        <main
            data-app-scroll-root="true"
            onFocusCapture={handleFieldFocus}
            className={`hide-scrollbar overflow-y-auto w-full ${
            isDailyChestPage
              ? "h-[100dvh] px-0 pt-0 pb-0"
              : `h-[calc(100dvh-4.5rem)] pb-28 ${showDailyChestEntry ? "pt-28" : "pt-4"} ${isAdminPanel ? "px-3 sm:px-4" : "mx-auto max-w-md px-3 sm:px-4"}`
            }`}
          >
          {children}

          {!isAdminPanel && !isDailyChestPage ? (
            <div className="mt-6">
              <SocialMediaBar />
            </div>
          ) : null}
        </main>

        {!hideBottomNav ? (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-md items-center justify-between px-2 py-2 sm:px-3">
            {navItems.map((item) => {
              const isActive = item.match.includes(location.pathname);
              const Icon = item.icon;
              const isDisabled = false;
              const navClassName = `flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-semibold tracking-wide transition-all sm:text-[10px] ${
                isDisabled
                  ? "cursor-not-allowed bg-slate-900/60 text-slate-600 opacity-60"
                  : isActive
                    ? "bg-cyan-500/15 text-cyan-300"
                    : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
              }`;

              if (isDisabled) {
                return (
                  <button
                    key={item.label}
                    type="button"
                    disabled
                    aria-disabled="true"
                    title="Menu desativado temporariamente"
                    className={navClassName}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </button>
                );
              }

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
                  className={navClassName}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
        ) : null}
      </div>
    </ErrorBoundary>
  );
}
