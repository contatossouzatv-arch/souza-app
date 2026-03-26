import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();
const AUTH_REQUIRED_EVENT = 'souza:auth-required';
const LAST_KNOWN_USER_KEY = 'souza_last_known_user_v1';

function readLastKnownUser() {
  try {
    const raw = window.localStorage.getItem(LAST_KNOWN_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeLastKnownUser(user) {
  try {
    if (user && typeof user === 'object') {
      window.localStorage.setItem(LAST_KNOWN_USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(LAST_KNOWN_USER_KEY);
    }
  } catch {
    // ignore localStorage errors
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState(null);

  useEffect(() => {
    console.info('[auth-bootstrap] mount');
    checkAppState();

    const handleAuthRequired = (event) => {
      console.warn('[auth-bootstrap] auth-required event received', event?.detail || {});
      writeLastKnownUser(null);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: 'auth_required',
        message: event?.detail?.message || 'Authentication required',
      });
      setIsLoadingAuth(false);
    };

    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => {
      window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    };
  }, []);

  const checkAppState = async () => {
    console.info('[auth-bootstrap] checkAppState:start', {
      hasToken: base44.auth.hasToken(),
    });
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      const currentUser = await base44.auth.me();
      console.info('[auth-bootstrap] checkAppState:authenticated', {
        userId: currentUser?.id || null,
      });
      writeLastKnownUser(currentUser);
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      const isRecoverable = base44.auth.isRecoverableAuthError(error);
      const hasToken = base44.auth.hasToken();
      const cachedUser = hasToken ? readLastKnownUser() : null;
      console.warn('[auth-bootstrap] checkAppState:failed', {
        status: error?.status || null,
        message: error?.message || 'Authentication required',
        isRecoverable,
        hasToken,
        hasCachedUser: Boolean(cachedUser?.id),
      });
      if (isRecoverable && cachedUser?.id) {
        console.warn('[auth-bootstrap] checkAppState:using-cached-user', {
          userId: cachedUser.id,
        });
        setUser(cachedUser);
        setIsAuthenticated(true);
        setAuthError(null);
      } else if (isRecoverable) {
        setAuthError({
          type: 'auth_unreachable',
          message: 'Nao foi possivel validar sua sessao agora. Tente novamente em instantes.',
        });
      } else {
        base44.auth.clearClientAuthState('bootstrap_unauthorized');
        writeLastKnownUser(null);
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({
          type: 'auth_required',
          message: error?.message || 'Authentication required',
        });
      }
    } finally {
      console.info('[auth-bootstrap] checkAppState:finish');
      setIsLoadingAuth(false);
    }
  };

  const logout = (shouldRedirect = true) => {
    writeLastKnownUser(null);
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout(shouldRedirect ? '/login' : undefined);
  };

  const navigateToLogin = async () => {
    base44.auth.redirectToLogin();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
