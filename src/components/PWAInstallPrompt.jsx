import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Download, ExternalLink, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(window.navigator.userAgent);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export default function PWAInstallPrompt({ blocking = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => isStandaloneMode());
  const [isMobile, setIsMobile] = useState(() => isMobileDevice());
  const [showPrompt, setShowPrompt] = useState(() => (blocking ? isMobileDevice() && !isStandaloneMode() : false));
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );

  useEffect(() => {
    const syncState = () => {
      const mobile = isMobileDevice();
      const standalone = isStandaloneMode();
      setIsMobile(mobile);
      setInstalled(standalone);
      setShowPrompt(blocking ? mobile && !standalone : mobile && !standalone);
    };

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      syncState();
    };

    const handleInstalled = () => {
      setInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    syncState();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [blocking]);

  const isIOS = useMemo(() => {
    if (typeof window === "undefined") return false;
    return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
  }, []);

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") {
      setNotificationStatus("unsupported");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
    } catch {
      setNotificationStatus("denied");
    }
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result?.outcome === "accepted") {
        await requestNotifications();
      }
      return;
    }

    setInstallHelpOpen(true);
    await requestNotifications();
  };

  if (!isMobile || installed || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={blocking ? "fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/92 p-4 backdrop-blur-md" : "fixed inset-x-0 top-0 z-[120] p-4"}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          className={`w-full ${blocking ? "max-w-md" : "max-w-lg mx-auto"} overflow-hidden rounded-[2rem] border border-cyan-400/30 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6 shadow-[0_24px_90px_rgba(8,145,178,0.28)]`}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/14 text-cyan-200">
              <Smartphone className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Experiência Recomendada</p>
              <h3 className="mt-2 text-2xl font-black text-white">Instale o app para continuar</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Para usar o Souza com mais estabilidade, abertura rápida e notificações, o acesso no celular deve ser feito pelo app instalado.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-100">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Ative também as notificações</p>
                <p className="mt-1 text-amber-50/85">
                  Assim você recebe avisos de sorteios, resultados, liberações e campanhas sem depender do navegador.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <Button onClick={handleInstall} className="h-12 rounded-2xl bg-cyan-400 font-bold text-slate-950 hover:bg-cyan-300">
              <Download className="mr-2 h-4 w-4" />
              Instalar agora
            </Button>
            <p className="text-center text-xs text-slate-400">
              Depois de instalar, abra o app pela tela inicial do celular para liberar login e cadastro.
            </p>
          </div>

          {installHelpOpen ? (
            <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-200">
              <p className="font-semibold text-white">{isIOS ? "Como instalar no iPhone" : "Como instalar no Android"}</p>
              {isIOS ? (
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-300">
                  <li>Toque no botão de compartilhar do Safari.</li>
                  <li>Escolha "Adicionar à Tela de Início".</li>
                  <li>Abra o app pela tela inicial depois da instalação.</li>
                </ol>
              ) : (
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-300">
                  <li>Toque em "Instalar agora".</li>
                  <li>Se o navegador não abrir o prompt, use o menu e escolha "Instalar app" ou "Adicionar à tela inicial".</li>
                  <li>Abra o app instalado pela tela inicial.</li>
                </ol>
              )}
              <div className="mt-3 flex items-center gap-2 text-xs text-cyan-200">
                <ExternalLink className="h-3.5 w-3.5" />
                Notificações: {notificationStatus === "granted" ? "ativadas" : notificationStatus === "denied" ? "bloqueadas" : notificationStatus === "unsupported" ? "não suportadas neste aparelho" : "aguardando permissão"}
              </div>
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
