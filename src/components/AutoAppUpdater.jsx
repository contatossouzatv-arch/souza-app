import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const UPDATE_CHECK_INTERVAL_MS = 300000;
const UPDATE_COUNTDOWN_SECONDS = 120;

export default function AutoAppUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [timeLeft, setTimeLeft] = useState(UPDATE_COUNTDOWN_SECONDS);
  const [dismissed, setDismissed] = useState(false);
  const appVersionRef = useRef(Date.now().toString());

  useEffect(() => {
    const savedVersion = localStorage.getItem("app_version");
    if (!savedVersion) {
      localStorage.setItem("app_version", appVersionRef.current);
    }

    const checkForUpdates = async () => {
      if (document.visibilityState !== "visible") return;
      if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();
      } catch (error) {
        void error;
      }
    };

    const handleControllerChange = () => {
      if (!dismissed) {
        setUpdateAvailable(true);
        setTimeLeft(UPDATE_COUNTDOWN_SECONDS);
      }
    };

    checkForUpdates();
    const checkInterval = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller && !dismissed) {
              setUpdateAvailable(true);
              setTimeLeft(UPDATE_COUNTDOWN_SECONDS);
            }
          });
        });
      });
    }

    return () => {
      clearInterval(checkInterval);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      }
    };
  }, [dismissed]);

  useEffect(() => {
    if (!updateAvailable || dismissed) return undefined;

    if (timeLeft === 0) {
      handleUpdate();
      return undefined;
    }

    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [dismissed, timeLeft, updateAvailable]);

  const handleUpdate = async () => {
    if ("caches" in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch (error) {
        void error;
      }
    }

    sessionStorage.clear();
    localStorage.setItem("last_update_check", Date.now().toString());
    localStorage.setItem("app_version", appVersionRef.current);
    window.location.reload(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setUpdateAvailable(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <AnimatePresence>
      {updateAvailable && !dismissed ? (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          className="fixed top-4 left-1/2 z-[9999] w-[95%] max-w-md -translate-x-1/2"
        >
          <div className="overflow-hidden rounded-2xl border-2 border-white/20 bg-gradient-to-r from-purple-600 to-pink-600 shadow-2xl">
            <div className="relative p-4 md:p-5">
              <Button
                onClick={handleDismiss}
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 text-white/80 hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="flex items-start gap-3">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                  <RefreshCw className="mt-1 h-6 w-6 text-yellow-300 md:h-7 md:w-7" />
                </motion.div>

                <div className="flex-1">
                  <h3 className="mb-1 text-lg font-bold text-white md:text-xl">Nova Atualizacao!</h3>
                  <p className="mb-3 text-sm text-white/90 md:text-base">
                    Estamos atualizando o app com melhorias. Seu painel sera atualizado automaticamente em:
                  </p>

                  <div className="mb-3 rounded-lg bg-white/20 px-4 py-2 text-center backdrop-blur-sm">
                    <div className="text-3xl font-black text-yellow-300 md:text-4xl">{formatTime(timeLeft)}</div>
                    <div className="text-xs text-white/80">segundos</div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleUpdate} className="flex-1 bg-white font-bold text-purple-700 hover:bg-white/90">
                      Atualizar Agora
                    </Button>
                    <Button
                      onClick={handleDismiss}
                      variant="outline"
                      className="border-white/40 text-white hover:bg-white/20"
                    >
                      Depois
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <motion.div
              className="h-1 bg-yellow-300"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: UPDATE_COUNTDOWN_SECONDS, ease: "linear" }}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
