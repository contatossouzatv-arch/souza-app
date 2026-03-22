import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, Bell, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Verificar se é mobile
    const checkMobile = () => {
      const mobile = /Android|webOOS|iPhone|iPad|iPod|BlackBerry|IEMobile|OOpera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };

    checkMobile();

    // Verificar se já está instalado
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;

    // Verificar se já foi dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    // Mostrar se: é mobile, não está instalado, e não foi dismissed nos últimos 7 dias
    if (isMobile && !isInstalled && daysSinceDismissed > 7) {
      setTimeout(() => setShowPrompt(true), 2000);
    }

    // Capturar evento de instalação
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isMobile]);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          localStorage.setItem('notification-permission', 'granted');
          // Mostrar notificação de teste
          new Notification(' Notificações Ativadas!', {
            body: 'Você receberá alertas sobre sorteios e promoções!',
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png'
          });
        }
      } catch (error) {
        console.error('Erro ao solicitar permissão:', error);
      }
    }
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setShowPrompt(false);
        // Solicitar permissão de notificação após instalação
        setTimeout(() => requestNotificationPermission(), 1000);
      }
      setDeferredPrompt(null);
    } else {
      // Mostrar instruções manuais para iOOS ou outros navegadores
      showManualInstructions();
    }
  };

  const showManualInstructions = async () => {
    const isIOOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOOS) {
      alert(` Para instalar no iPhone/iPad:

1. Toque no ícone de compartilhar (quadrado com seta) na parte inferior
2. Role para baixo e toque em "Adicionar à Tela de Início"
3. Toque em "Adicionar" no canto superior direito

 IMPORTANTE: Após instalar, abra as configurações do Safari e ATIVE as notificações para este site!`);
    } else {
      alert(` Para instalar:

1. No menu do navegador (⋮), toque em "Adicionar à tela inicial" ou "Instalar app"
2. Confirme a instalação

 IMPORTANTE: Após instalar, ATIVE as notificações quando solicitado para receber promoções e avisos de sorteios!`);
      
      // Solicitar permissão de notificação após fechar o alert
      setTimeout(() => requestNotificationPermission(), 500);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt || !isMobile) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -100 }}
        className="fixed top-0 left-0 right-0 z-50 p-4"
      >
        <div className="max-w-md mx-auto bg-gradient-to-r from-purple-900 to-pink-900 border-2 border-yellow-500 rounded-2xl shadow-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            
            <div className="flex-1">
              <h3 className="font-bold text-white text-lg mb-1">
                 Instale nosso App!
              </h3>
              <p className="text-sm text-purple-200 mb-3">
                Acesse mais rápido e receba notificações de promoções e sorteios direto no seu celular!
              </p>
              
              <div className="flex items-start gap-2 mb-3 p-2 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
                <Bell className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-yellow-200">
                  <strong>Importante:</strong> Após instalar, ative as notificações para não perder nenhuma promoção!
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleInstall}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Instalar Agora
                </Button>
                <Button
                  onClick={handleDismiss}
                  variant="ghost"
                  size="icon"
                  className="text-purple-200 hover:text-white hover:bg-purple-800/30"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
