import { Suspense, useEffect, useMemo, useState } from "react";
import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { Analytics } from "@vercel/analytics/react";
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import RealtimeSync from '@/lib/RealtimeSync'
import MetricGainNotifier from '@/components/MetricGainNotifier'
import { DAILY_CHEST_ROUTE_PATH, FEATURE_FLAGS, MAIN_GAME_ROUTE_PATH } from '@/lib/featureFlags';
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { warmAppShell } from '@/lib/appBoot';
import { lazyWithRecovery } from '@/lib/lazyWithRecovery';

const Login = lazyWithRecovery(() => import('@/pages/Login'));
const LoginTwoFactor = lazyWithRecovery(() => import('@/pages/LoginTwoFactor'));
const ResetPassword = lazyWithRecovery(() => import('@/pages/ResetPassword'));
const TermsOfUse = lazyWithRecovery(() => import('@/pages/TermsOfUse'));
const PrivacyPolicy = lazyWithRecovery(() => import('@/pages/PrivacyPolicy'));
const Onboarding = lazyWithRecovery(() => import('@/pages/Onboarding'));
const MainGameComingSoon = lazyWithRecovery(() => import('@/pages/MainGameComingSoon'));
const DailyChestHub = lazyWithRecovery(() => import('@/pages/DailyChestHub'));

const { Pages, Layout, mainPage } = pagesConfig;
const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE_MODE === "true";
const MAINTENANCE_BYPASS_KEY = String(import.meta.env.VITE_MAINTENANCE_BYPASS_KEY || "").trim();
const MAINTENANCE_BYPASS_PATH = String(import.meta.env.VITE_MAINTENANCE_BYPASS_PATH || "/acesso-manutencao").trim() || "/acesso-manutencao";
const MAINTENANCE_SESSION_KEY = "souza_maintenance_bypass_v1";
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;
const visiblePages = Object.entries(Pages);

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const RouteLoader = () => {
  const [progress, setProgress] = useState(14);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        const step = Math.max(1, Math.ceil((92 - prev) * 0.22));
        return Math.min(92, prev + step);
      });
    }, 90);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="fixed inset-0 z-[160] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_34%),linear-gradient(180deg,#020617_0%,#071120_42%,#020617_100%)] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.14),transparent_24%),radial-gradient(circle_at_80%_22%,rgba(56,189,248,0.16),transparent_22%)]" />
      <div className="relative flex h-full items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-slate-950/55 px-6 py-7 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/90">Souza Cass</p>
          <h1 className="mt-3 text-2xl font-black text-white">Abrindo a pagina</h1>
          <p className="mt-2 text-sm text-slate-200/88">Carregando a tela selecionada e preparando os componentes.</p>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-sky-300 transition-[width] duration-200 ease-out"
              style={{ width: `${Math.max(8, Math.min(100, progress))}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
            <span>Sincronizando rota e conteudo</span>
            <span className="font-bold text-cyan-200">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const AppBootLoader = ({ progress, status }) => (
  <div className="fixed inset-0 z-[200] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.2),transparent_34%),linear-gradient(180deg,#020617_0%,#071120_42%,#020617_100%)] text-white">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.14),transparent_24%),radial-gradient(circle_at_80%_22%,rgba(56,189,248,0.16),transparent_22%)]" />
    <div className="relative flex h-full items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-slate-950/55 px-6 py-7 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/90">Souza Cass</p>
        <h1 className="mt-3 text-2xl font-black text-white">Carregando o app</h1>
        <p className="mt-2 text-sm text-slate-200/88">{status}</p>
        <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-sky-300 transition-[width] duration-200 ease-out"
            style={{ width: `${Math.max(6, Math.min(100, progress))}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
          <span>Preparando menus, sons e telas</span>
          <span className="font-bold text-cyan-200">{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  </div>
);

const AppUnavailableState = ({ message, onRetry }) => (
  <div className="fixed inset-0 z-[200] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.2),transparent_34%),linear-gradient(180deg,#020617_0%,#071120_42%,#020617_100%)] text-white">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.14),transparent_24%),radial-gradient(circle_at_80%_22%,rgba(56,189,248,0.16),transparent_22%)]" />
    <div className="relative flex h-full items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-slate-950/55 px-6 py-7 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/90">Souza Cass</p>
        <h1 className="mt-3 text-2xl font-black text-white">Servidor indisponivel</h1>
        <p className="mt-2 text-sm text-slate-200/88">
          {message || "Nao foi possivel carregar o app agora. Tente novamente em instantes."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-cyan-400 font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  </div>
);

const MaintenanceGate = () => {
  const location = useLocation();
  const [isUnlocked, setIsUnlocked] = useState(() => {
    try {
      return window.sessionStorage.getItem(MAINTENANCE_SESSION_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!MAINTENANCE_MODE) return;
    if (!MAINTENANCE_BYPASS_KEY) return;
    const params = new URLSearchParams(location.search);
    const providedKey = String(params.get("k") || "").trim();
    if (!providedKey || providedKey !== MAINTENANCE_BYPASS_KEY) return;
    try {
      window.sessionStorage.setItem(MAINTENANCE_SESSION_KEY, "true");
    } catch {
      // ignore sessionStorage errors
    }
    setIsUnlocked(true);
  }, [location.search]);

  if (!MAINTENANCE_MODE || isUnlocked || location.pathname === MAINTENANCE_BYPASS_PATH) {
    return <AuthenticatedApp />;
  }

  return (
    <div className="fixed inset-0 z-[220] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_34%),linear-gradient(180deg,#020617_0%,#071120_42%,#020617_100%)] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.14),transparent_24%),radial-gradient(circle_at_80%_22%,rgba(56,189,248,0.16),transparent_22%)]" />
      <div className="relative flex h-full items-center justify-center px-6">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-slate-950/55 px-7 py-8 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/90">Souza Cass</p>
          <h1 className="mt-3 text-3xl font-black text-white">Estamos em manutenção</h1>
          <p className="mt-3 text-sm text-slate-200/88">
            Estamos ajustando o app para melhorar estabilidade, login e desempenho. O acesso público volta em instantes.
          </p>
          <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
            Se você precisa entrar para testar internamente, use seu link privado de manutenção.
          </div>
        </div>
      </div>
    </div>
  );
};

const MaintenanceBypass = () => {
  const location = useLocation();
  const [status, setStatus] = useState("Validando acesso privado");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const providedKey = String(params.get("k") || "").trim();
    if (!MAINTENANCE_MODE) {
      window.location.replace("/login");
      return;
    }
    if (!MAINTENANCE_BYPASS_KEY || providedKey !== MAINTENANCE_BYPASS_KEY) {
      setStatus("Link privado inválido");
      return;
    }
    try {
      window.sessionStorage.setItem(MAINTENANCE_SESSION_KEY, "true");
    } catch {
      // ignore sessionStorage errors
    }
    window.location.replace("/login");
  }, [location.search]);

  return (
    <div className="fixed inset-0 z-[220] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_34%),linear-gradient(180deg,#020617_0%,#071120_42%,#020617_100%)] text-white">
      <div className="relative flex h-full items-center justify-center px-6">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/55 px-7 py-8 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/90">Souza Cass</p>
          <h1 className="mt-3 text-2xl font-black text-white">Acesso interno</h1>
          <p className="mt-3 text-sm text-slate-200/88">{status}</p>
        </div>
      </div>
    </div>
  );
};

const AUTH_BOOT_FAILSAFE_MS = 18000;

const needsOnboarding = (user) =>
  !user?.onboarding_completed || !user?.terms_accepted || !user?.privacy_accepted;

const getPageElementKey = (pageName, location) => {
  if (pageName === "Profile") {
    return `${location.pathname}${location.search}`;
  }
  return undefined;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, user, checkAppState } = useAuth();
  const location = useLocation();
  const [isBootReady, setIsBootReady] = useState(false);
  const [hasBootMinDurationElapsed, setHasBootMinDurationElapsed] = useState(false);
  const [bootProgress, setBootProgress] = useState(8);
  const [hasAuthBootFailsafeElapsed, setHasAuthBootFailsafeElapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    console.info("[app-boot] warmup:start");
    setIsBootReady(false);
    setHasBootMinDurationElapsed(false);
    setHasAuthBootFailsafeElapsed(false);
    setBootProgress(8);
    warmAppShell().finally(() => {
      if (!cancelled) {
        console.info("[app-boot] warmup:ready");
        setIsBootReady(true);
      }
    });
    const timerId = window.setTimeout(() => {
      if (!cancelled) {
        console.info("[app-boot] min-duration:elapsed");
        setHasBootMinDurationElapsed(true);
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    if (!isLoadingAuth) {
      setHasAuthBootFailsafeElapsed(false);
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      console.warn("[app-boot] auth:failsafe-elapsed", {
        delayMs: AUTH_BOOT_FAILSAFE_MS,
        path: `${location.pathname}${location.search}`,
      });
      setHasAuthBootFailsafeElapsed(true);
    }, AUTH_BOOT_FAILSAFE_MS);

    return () => window.clearTimeout(timerId);
  }, [isLoadingAuth, location.pathname, location.search]);

  const bootTargetProgress = useMemo(() => {
    let target = 18;
    if (!isLoadingPublicSettings) target = 32;
    if (!isLoadingAuth) target = 62;
    if (isBootReady) target = 90;
    if (!isLoadingPublicSettings && !isLoadingAuth && isBootReady && hasBootMinDurationElapsed) target = 100;
    return target;
  }, [hasBootMinDurationElapsed, isBootReady, isLoadingAuth, isLoadingPublicSettings]);

  useEffect(() => {
    console.info("[app-boot] state", {
      isLoadingAuth,
      isLoadingPublicSettings,
      isBootReady,
      hasBootMinDurationElapsed,
      hasAuthBootFailsafeElapsed,
      isAuthenticated,
      authErrorType: authError?.type || null,
      path: `${location.pathname}${location.search}`,
    });
  }, [
    authError?.type,
    hasAuthBootFailsafeElapsed,
    hasBootMinDurationElapsed,
    isAuthenticated,
    isBootReady,
    isLoadingAuth,
    isLoadingPublicSettings,
    location.pathname,
    location.search,
  ]);

  const shouldShowAuthUnavailable =
    authError?.type === 'auth_unreachable' || (isLoadingAuth && hasAuthBootFailsafeElapsed);

  const bootStatus = useMemo(() => {
    if (isLoadingPublicSettings) return "Sincronizando configurações públicas";
    if (isLoadingAuth) return "Validando sessao e preparando dados";
    if (!isBootReady) return "Aquecendo menus, sons e telas principais";
    if (!hasBootMinDurationElapsed) return "Finalizando entrada";
    return "Tudo pronto";
  }, [hasBootMinDurationElapsed, isBootReady, isLoadingAuth, isLoadingPublicSettings]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setBootProgress((prev) => {
        if (prev >= bootTargetProgress) return prev;
        const distance = bootTargetProgress - prev;
        const step = bootTargetProgress >= 100 ? Math.max(2, Math.ceil(distance * 0.45)) : Math.max(1, Math.ceil(distance * 0.24));
        return Math.min(bootTargetProgress, prev + step);
      });
    }, 48);
    return () => window.clearInterval(intervalId);
  }, [bootTargetProgress]);

  if (!shouldShowAuthUnavailable && (isLoadingPublicSettings || isLoadingAuth || !isBootReady || !hasBootMinDurationElapsed)) {
    return <AppBootLoader progress={bootProgress} status={bootStatus} />;
  }

  if (shouldShowAuthUnavailable) {
    return (
      <AppUnavailableState
        message={authError?.message || "Nao foi possivel validar sua sessao agora. Tente novamente em instantes."}
        onRetry={checkAppState}
      />
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  return (
    <Suspense fallback={<RouteLoader />}>
      {/*
        Only Profile keeps a URL-based remount key because it depends on query-string
        navigation (`?user=` / `?u=`). Other pages should preserve their mounted state
        across menu navigation and rely on React Query cache.
      */}
      <Routes>
      <Route path="/termos-de-uso" element={<TermsOfUse />} />
      <Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={needsOnboarding(user) ? "/onboarding" : "/"} replace />
          ) : (
            <Login />
          )
        }
      />

      <Route
        path="/login-2fa"
        element={
          isAuthenticated ? (
            <Navigate to={needsOnboarding(user) ? "/onboarding" : "/"} replace />
          ) : (
            <LoginTwoFactor />
          )
        }
      />

      <Route
        path="/onboarding"
        element={
          isAuthenticated ? (
            needsOnboarding(user) ? <Onboarding /> : <Navigate to="/" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/"
        element={
          isAuthenticated ? (
            needsOnboarding(user) ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <LayoutWrapper currentPageName={mainPageKey}>
                <MainPage key={getPageElementKey(mainPageKey, location)} />
              </LayoutWrapper>
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path={MAIN_GAME_ROUTE_PATH}
        element={
          isAuthenticated ? (
            needsOnboarding(user) ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <MainGameComingSoon />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path={DAILY_CHEST_ROUTE_PATH}
        element={
          isAuthenticated ? (
            needsOnboarding(user) ? (
              <Navigate to="/onboarding" replace />
            ) : FEATURE_FLAGS.DAILY_CHEST_3D_ENABLED ? (
              <DailyChestHub />
            ) : (
              <Navigate to="/" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {visiblePages.map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            isAuthenticated ? (
              needsOnboarding(user) ? (
                <Navigate to="/onboarding" replace />
              ) : (
                <LayoutWrapper currentPageName={path}>
                  <Page key={getPageElementKey(path, location)} />
                </LayoutWrapper>
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      ))}

      <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  const enableVisualEditAgent = import.meta.env.VITE_ENABLE_VISUAL_EDIT_AGENT === "true";
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <RealtimeSync />
          <NavigationTracker />
          <MetricGainNotifier />
          <Routes>
            {MAINTENANCE_MODE ? (
              <Route path={MAINTENANCE_BYPASS_PATH} element={<MaintenanceBypass />} />
            ) : null}
            <Route path="*" element={<MaintenanceGate />} />
          </Routes>
        </Router>
        <Analytics />
        <Toaster />
        {enableVisualEditAgent ? <VisualEditAgent /> : null}
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
