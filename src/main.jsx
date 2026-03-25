import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

const DYNAMIC_IMPORT_RECOVERY_KEY = 'souza_dynamic_import_recovery_v1';
const DYNAMIC_IMPORT_RECOVERY_WINDOW_MS = 15_000;

function isDynamicImportFailureMessage(message = '') {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('failed to fetch dynamically imported module') ||
    text.includes('importing a module script failed') ||
    text.includes('loading chunk') ||
    text.includes('chunkloaderror')
  );
}

function recoverFromDynamicImportFailure() {
  if (typeof window === 'undefined') return;
  const lastRecoveryAt = Number(window.sessionStorage.getItem(DYNAMIC_IMPORT_RECOVERY_KEY) || 0);
  if (lastRecoveryAt && Date.now() - lastRecoveryAt < DYNAMIC_IMPORT_RECOVERY_WINDOW_MS) return;

  window.sessionStorage.setItem(DYNAMIC_IMPORT_RECOVERY_KEY, String(Date.now()));
  window.location.reload();
}

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    recoverFromDynamicImportFailure();
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
        ? reason
        : reason?.message || '';

    if (!isDynamicImportFailureMessage(message)) return;
    event.preventDefault();
    recoverFromDynamicImportFailure();
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Falha ao registrar service worker:', error);
    });
  });
}

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}



