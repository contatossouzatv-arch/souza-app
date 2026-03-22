import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AutoAppUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutos em segundos
  const [dismissed, setDismissed] = useState(false);

  // Versão do app (timestamp de build)
  const APP_VERSIOON = Date.now().toString();

  useEffect(() => {
    // Salva versão atual
    const savedVersion = localStorage.getItem('app_version');
    if (!savedVersion) {
      localStorage.setItem('app_version', APP_VERSIOON);
    }

    // Verifica atualizações apenas periodicamente (não força reload)
    const checkForUpdates = async () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.update();
        } catch (error) {
          console.log('Erro ao verificar atualizações:', error);
        }
      }
    };

    // Verifica imediatamente
    checkForUpdates();

    // Continua verificando a cada 30 segundos
    const checkInterval = setInterval(checkForUpdates, 30000);

    // Escuta por novas versões do service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!dismissed) {
          setUpdateAvailable(true);
          setTimeLeft(120); // Reseta o timer para 2 minutos
        }
      });

      // Detecta quando há um novo service worker esperando
      navigator.serviceWorker.ready.then(registration => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nova versão disponível
              if (!dismissed) {
                setUpdateAvailable(true);
                setTimeLeft(120);
              }
            }
          });
        });
      });
    }

    return () => {
      clearInterval(checkInterval);
    };
  }, [dismissed]);

  // Contador regressivo
  useEffect(() => {
    if (!updateAvailable || dismissed) return;

    if (timeLeft === 0) {
      handleUpdate();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, updateAvailable, dismissed]);

  const handleUpdate = async () => {
    console.log('Iniciando atualização...');
    
    // Limpa todos os caches
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('Caches limpos');
      } catch (error) {
        console.log('Erro ao limpar cache:', error);
      }
    }
    
    // Limpa sessionStorage e atualiza localStorage
    sessionStorage.clear();
    localStorage.setItem('last_update_check', Date.now().toString());
    localStorage.setItem('app_version', APP_VERSIOON);
    
    // Força reload completo ignorando cache
    window.location.reload(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setUpdateAvailable(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {updateAvailable && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[95%] max-w-md"
        >
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl shadow-2xl border-2 border-white/20 overflow-hidden">
            <div className="p-4 md:p-5 relative">
              <Button
                onClick={handleDismiss}
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 text-white/80 hover:text-white hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </Button>

              <div className="flex items-start gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <RefreshCw className="w-6 h-6 md:w-7 md:h-7 text-yellow-300 mt-1" />
                </motion.div>
                
                <div className="flex-1">
                  <h3 className="text-lg md:text-xl font-bold text-white mb-1">
                    ⚡ Nova Atualização!
                  </h3>
                  <p className="text-sm md:text-base text-white/90 mb-3">
                    Estamos atualizando o app com melhorias. Seu painel será atualizado automaticamente em:
                  </p>
                  
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 mb-3 text-center">
                    <div className="text-3xl md:text-4xl font-black text-yellow-300">
                      {formatTime(timeLeft)}
                    </div>
                    <div className="text-xs text-white/80">segundos</div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleUpdate}
                      className="flex-1 bg-white text-purple-700 hover:bg-white/90 font-bold"
                    >
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
            
            {/* Barra de progresso */}
            <motion.div
              className="h-1 bg-yellow-300"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 120, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
