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
import { DAILY_CHEST_ROUTE_PATH, FEATURE_FLAGS, isMainGamePage, MAIN_GAME_ROUTE_PATH } from '@/lib/featureFlags';
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
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
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;
const FULLSCREEN_PAGES = new Set(["DailyEvent"]);
const visiblePages = Object.entries(Pages).filter(([pageKey]) => {
  if (isMainGamePage(pageKey) && !FEATURE_FLAGS.GAME_MAIN_ENABLED) return false;
  return true;
});

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const RouteLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

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

const needsOnboarding = (user) =>
  !user?.onboarding_completed || !user?.terms_accepted || !user?.privacy_accepted;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, user } = useAuth();
  const [isBootReady, setIsBootReady] = useState(false);
  const [hasBootMinDurationElapsed, setHasBootMinDurationElapsed] = useState(false);
  const [bootProgress, setBootProgress] = useState(8);

  useEffect(() => {
    let cancelled = false;
    setIsBootReady(false);
    setHasBootMinDurationElapsed(false);
    setBootProgress(8);
    warmAppShell().finally(() => {
      if (!cancelled) setIsBootReady(true);
    });
    const timerId = window.setTimeout(() => {
      if (!cancelled) setHasBootMinDurationElapsed(true);
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, []);

  const bootTargetProgress = useMemo(() => {
    let target = 18;
    if (!isLoadingPublicSettings) target = 32;
    if (!isLoadingAuth) target = 62;
    if (isBootReady) target = 90;
    if (!isLoadingPublicSettings && !isLoadingAuth && isBootReady && hasBootMinDurationElapsed) target = 100;
    return target;
  }, [hasBootMinDurationElapsed, isBootReady, isLoadingAuth, isLoadingPublicSettings]);

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

  if (isLoadingPublicSettings || isLoadingAuth || !isBootReady || !hasBootMinDurationElapsed) {
    return <AppBootLoader progress={bootProgress} status={bootStatus} />;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  return (
    <Suspense fallback={<RouteLoader />}>
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
                <MainPage />
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
            ) : FEATURE_FLAGS.GAME_MAIN_ENABLED ? (
              <Pages.DailyEvent />
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
                FULLSCREEN_PAGES.has(path) ? (
                  <Page />
                ) : (
                  <LayoutWrapper currentPageName={path}>
                    <Page />
                  </LayoutWrapper>
                )
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
          <AuthenticatedApp />
        </Router>
        <Analytics />
        <Toaster />
        {enableVisualEditAgent ? <VisualEditAgent /> : null}
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
