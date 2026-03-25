import { lazy } from "react";

const DYNAMIC_IMPORT_RECOVERY_KEY = "souza_dynamic_import_recovery_v1";
const DYNAMIC_IMPORT_RECOVERY_WINDOW_MS = 15_000;

function isDynamicImportFailureMessage(message = "") {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("failed to fetch dynamically imported module") ||
    text.includes("importing a module script failed") ||
    text.includes("loading chunk") ||
    text.includes("chunkloaderror")
  );
}

function recoverFromDynamicImportFailure() {
  if (typeof window === "undefined") return;
  const lastRecoveryAt = Number(window.sessionStorage.getItem(DYNAMIC_IMPORT_RECOVERY_KEY) || 0);
  if (lastRecoveryAt && Date.now() - lastRecoveryAt < DYNAMIC_IMPORT_RECOVERY_WINDOW_MS) return;

  window.sessionStorage.setItem(DYNAMIC_IMPORT_RECOVERY_KEY, String(Date.now()));
  window.location.reload();
}

export function lazyWithRecovery(importer) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      if (isDynamicImportFailureMessage(error?.message || error)) {
        recoverFromDynamicImportFailure();
      }
      throw error;
    }
  });
}
