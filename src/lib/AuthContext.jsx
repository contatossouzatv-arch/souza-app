import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();
const AUTH_REQUIRED_EVENT = 'souza:auth-required';

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
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.warn('[auth-bootstrap] checkAppState:unauthenticated', {
        status: error?.status || null,
        message: error?.message || 'Authentication required',
      });
      base44.auth.clearClientAuthState('bootstrap_unauthorized');
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: 'auth_required',
        message: error?.message || 'Authentication required',
      });
    } finally {
      console.info('[auth-bootstrap] checkAppState:finish');
      setIsLoadingAuth(false);
    }
  };

  const logout = (shouldRedirect = true) => {
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
