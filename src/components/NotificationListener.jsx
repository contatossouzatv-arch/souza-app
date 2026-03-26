import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import RichTextMessage from "@/components/RichTextMessage";

export default function NotificationListener() {
  const [inAppNotifications, setInAppNotifications] = useState([]);
  const [lastChecked, setLastChecked] = useState(Date.now());
  const navigate = useNavigate();

  const { data: notifications = [] } = useQuery({
    queryKey: ['push-notifications-check'],
    queryFn: async () => {
      const response = await base44.notifications.recent({ limit: 50 });
      return response.items || [];
    },
  });

  useEffect(() => {
    // Verificar notificações novas
    const newNotifications = notifications.filter(notification => {
      const notificationTime = new Date(notification.sent_at).getTime();
      const shownKey = `notification-shown-${notification.id}`;
      const wasShown = localStorage.getItem(shownKey);
      
      // Se a notificação é mais recente que a última verificação e não foi mostrada
      return notificationTime > lastChecked && !wasShown;
    });

    // Mostrar notificações novas
    newNotifications.forEach(notification => {
      // Tentar notificação nativa primeiro
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const n = new Notification(notification.title, {
            body: notification.message,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: `notification-${notification.id}`,
            requireInteraction: false,
            vibrate: [200, 100, 200],
            silent: false,
            data: {
              url: `${window.location.origin}${createPageUrl("Home")}?post=notice-${notification.id}`,
              notificationId: notification.id,
            }
          });

          n.onclick = function(event) {
            event.preventDefault();
            window.focus();
            navigate(`${createPageUrl("Home")}?post=notice-${notification.id}`);
            n.close();
          };

          setTimeout(() => n.close(), 15000);
        } catch (error) {
          console.error('Erro ao mostrar notificação nativa:', error);
        }
      }
      
      // Sempre mostrar notificação in-app também
      setInAppNotifications(prev => [...prev, notification]);
      localStorage.setItem(`notification-shown-${notification.id}`, 'true');
      
      // Auto-remover após 15 segundos
      setTimeout(() => {
        setInAppNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 15000);
    });

    // Atualizar último check
    if (newNotifications.length > 0) {
      setLastChecked(Date.now());
    }
  }, [notifications]);

  const handleDismiss = (notificationId) => {
    setInAppNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleOpenPost = (notification) => {
    navigate(`${createPageUrl("Home")}?post=notice-${notification.id}`);
    setInAppNotifications((prev) => prev.filter((n) => n.id !== notification.id));
  };

  return (
    <div className="fixed top-4 left-4 right-4 z-[9999] pointer-events-none">
      <div className="max-w-md mx-auto space-y-2 pointer-events-auto">
        <AnimatePresence>
          {inAppNotifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className="bg-gradient-to-r from-purple-900 to-pink-900 border-2 border-yellow-500 rounded-2xl shadow-2xl p-4"
              role="button"
              tabIndex={0}
              onClick={() => handleOpenPost(notification)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleOpenPost(notification);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-pulse">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white text-base mb-1 line-clamp-1">
                    {notification.title}
                  </h3>
                  <RichTextMessage
                    text={notification.message}
                    maxChars={110}
                    className="text-sm text-purple-200 break-words leading-snug"
                  />
                  <div className="mt-2 inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-200">
                    Toque para abrir o post
                  </div>
                </div>

                <Button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDismiss(notification.id);
                  }}
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 text-purple-200 hover:text-white hover:bg-purple-800/30 h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
